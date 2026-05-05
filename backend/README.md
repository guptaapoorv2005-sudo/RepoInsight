# RepoInsight — Backend

Professional README for the backend service, written for interview and recruiter review.

## Project Summary

RepoInsight is a production-style Retrieval-Augmented Generation (RAG) backend built to power intelligent codebase assistants. It ingests repositories from GitHub, token-aware chunks source files, creates embeddings asynchronously through a scalable queue and worker architecture, and offers a vector-based retrieval pipeline to serve LLM-backed answers. This is designed as a real engineering system (not a toy demo) with fault-tolerant queues, caching, token-aware chunking, and operational concerns covered.

Use cases include code understanding, onboarding new engineers, programmatic code search, and powering AI copilots that need accurate, context-limited answers grounded in repository source code.

## High-level Architecture

Pipeline flow (simplified):

Ingestion → Chunking → Queue (BullMQ) → Worker → Embeddings → DB (Postgres) → Retrieval → LLM (answers)

- The ingestion service scans a GitHub repo, fetches selected files and performs token-aware chunking. See [src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L1-L120) and [src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L120-L360).
- Chunk metadata and content are stored in Postgres via the repository layer in [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L120) and [src/modules/indexing/indexing.service.ts](src/modules/indexing/indexing.service.ts#L1-L160).
- Embedding jobs are queued with BullMQ backed by Redis; queue producers in [src/queues/queue.ts](src/queues/queue.ts#L1-L120) and consumers (worker) in [src/queues/worker.ts](src/queues/worker.ts#L1-L200) process jobs and call the embedding pipeline in [src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L120).
- Vector storage is implemented as a Postgres vector column (see [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L120)). Retrieval is a hybrid vector + keyword strategy implemented in [src/modules/retrieval/retrieval.service.ts](src/modules/retrieval/retrieval.service.ts#L1-L200).
- LLM completions use a system prompt and repository context produced by retrieval; see [src/modules/completions/completions.service.ts](src/modules/completions/completions.service.ts#L1-L120).

### Why this design?

- Asynchronous queueing decouples ingestion and embedding. Embeddings are IO-heavy and rate-limited; queuing with BullMQ avoids blocking the API and allows horizontally scaling workers.
- Redis serves two roles: BullMQ backend for robust job handling and a fast cache for query embeddings and retrieval results (see [src/lib/redis.ts](src/lib/redis.ts#L1-L120) and [src/lib/redis-bullmq.ts](src/lib/redis-bullmq.ts#L1-L40)).
- Postgres stores canonical chunk content and vector embeddings. Using the database for vector search (Postgres vector type) enables strong consistency, backup, and transactional operations.

## Key Features (engineering-first)

- Async embedding pipeline using BullMQ (producer: [src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L80); queue: [src/queues/queue.ts](src/queues/queue.ts#L1-L120); worker: [src/queues/worker.ts](src/queues/worker.ts#L1-L200)).
- Redis-based caching for query embeddings and retrieval results to reduce repeated external API calls ([src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L120), [src/modules/retrieval/retrieval.service.ts](src/modules/retrieval/retrieval.service.ts#L1-L60)).
- Token-aware, code-aware chunking: splits by function boundaries and tokenizes using `gpt-tokenizer` with overlap to preserve context ([src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L1-L200)).
- Batch embedding generation with retry/backoff, batch size configured via env ([src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L200)).
- Worker concurrency model and job progress reporting (BullMQ job progress updates, SSE-compatible job status stream) ([src/queues/worker.ts](src/queues/worker.ts#L1-L200), [src/modules/jobs/job.controller.ts](src/modules/jobs/job.controller.ts#L1-L200)).
- Fault tolerance: `attempts`, exponential backoff, `FOR UPDATE SKIP LOCKED` pattern for safe parallel chunk locking, and marking failed chunks so they don't block pipelines ([src/queues/queue.ts](src/queues/queue.ts#L1-L120), [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L240)).

## Deep Dive

### Ingestion Pipeline

- Entry: the API endpoint is [POST /api/v1/ingestion/run](src/routes/ingestion.routes.ts#L1-L40) and controller logic lives in [src/modules/ingestion/ingestion.controller.ts](src/modules/ingestion/ingestion.controller.ts#L1-L80).
- `scanRepository` inspects the GitHub tree via the GitHub API, filters and scores files (priority to `src/`, `app/`, package.json, README) to control breadth and relevance. See scoring and filtering logic in [src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L1-L140).
- `fetchAndChunkFiles` fetches file content (base64 from GitHub), detects binary files, and tokenizes content using `gpt-tokenizer`. It prefers splitting on code boundaries (function definitions) and falls back to token-window chunking with overlap. This minimizes semantic splits and reduces LLM hallucination risk. See token-aware chunking at [src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L200-L360).
- Chunks are deduplicated and persisted transactionally using `indexRepository` which calls into the chunks repository layer for upserts, deletes, and batched inserts ([src/modules/indexing/indexing.service.ts](src/modules/indexing/indexing.service.ts#L1-L160)).

Why chunking matters: RAG systems must control token budgets and ensure retrieved passages are coherent and self-contained. Token-aware chunking with overlap preserves local context (function signature, surrounding comments) and reduces the chance of providing misleading or truncated context to the LLM.

### Embedding System

- Embeddings are generated off the main request path. After indexing, the ingestion flow enqueues embedding jobs via `enqueueEmbeddingsForRepository` which calls [src/queues/queue.ts](src/queues/queue.ts#L1-L120).
- Worker(s) call `generateEmbeddingsForRepository` which: selects pending chunks with `FOR UPDATE SKIP LOCKED` inside a transaction, batches them, calls the configured provider (`openai` or `gemini`), validates the resulting vectors, and writes them back with `updateChunkEmbeddingsBatch`. See [src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L240) and [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L260).
- Batch sizes, concurrency, and retries are configurable (ENV driven) and the code uses `withRetry` with incremental backoff to protect against transient API failures.
- Provider abstraction supports both OpenAI and Gemini embedding endpoints, including a per-request concurrency limit and validation of vector dimensionality. See provider selection in [src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L120).

Failure handling: oversized chunk content is marked as `failed` to avoid repeated attempts; provider errors mark chunks as failed and record errors returned in the job result.

### Queue System (BullMQ + Redis)

- Producer: `enqueueEmbeddingJob` creates a job per embedding chunk slice. Jobs include `attempts` and exponential backoff configured in [src/queues/queue.ts](src/queues/queue.ts#L1-L120).
- Consumer: the worker in [src/queues/worker.ts](src/queues/worker.ts#L1-L200) processes `embed-repository` jobs and reports progress via `job.updateProgress()` so the front-end (or clients) can stream progress using the job SSE endpoint.
- Job splitting: ingestion computes `jobsToQueue` by grouping repository chunks into jobs of size `DEFAULT_EMBEDDING_JOB_MAX_CHUNKS` to enable incremental processing of large repositories without requiring one massive job.
- Concurrency / scaling: run multiple worker instances (via the `worker` npm script) and set `concurrency` on the worker to control per-process parallelism. Workers use Redis and Postgres row locking (`SKIP LOCKED`) to avoid double-processing.

### Retrieval System

- Query flow: query text → query embedding (cached in Redis) → vector similarity search in Postgres → hybridize with keyword search → re-score and trim by token budget → return context.
- Query embeddings are cached with a TTL to avoid repeated calls to external embedding APIs ([src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L320-L420)).
- Vector search uses Postgres vector comparison (`embedding <=> query_vector`) and returns distance & score. See [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L120) for SQL.
- A keyword-based fallback / hybridization boosts exact identifier matches (important when the query references a function or type name) and the system trims the result to a token budget before passing context to the LLM. See hybrid logic in [src/modules/retrieval/retrieval.service.ts](src/modules/retrieval/retrieval.service.ts#L1-L240).

### Redis Usage

- Queue backend: BullMQ uses Redis connection in [src/lib/redis-bullmq.ts](src/lib/redis-bullmq.ts#L1-L40).
- Cache layer: `redis` in [src/lib/redis.ts](src/lib/redis.ts#L1-L120) is used to cache query embeddings and retrieval outputs (keys prefixed with `cache:`). TTLs are conservative (minutes) to balance freshness vs cost.
- Benefits: Redis provides ultra-fast lookups for query embeddings, drastically reducing the number of external embedding calls and improving latency for repeated queries.

## Folder Overview

- `src/modules/ingestion` — repo scanning, file filtering, token-aware chunking, and enqueueing jobs. See [src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L1-L360).
- `src/modules/embeddings` — embedding orchestration, provider adapters, query embedding cache. See [src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L240).
- `src/queues` — BullMQ queue and worker. See [src/queues/queue.ts](src/queues/queue.ts#L1-L120) and [src/queues/worker.ts](src/queues/worker.ts#L1-L200).
- `src/modules/chunks` — database access layer for chunks and vector search. See [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L260).
- `src/modules/retrieval` — hybrid retrieval logic, query optimization, and context assembly. See [src/modules/retrieval/retrieval.service.ts](src/modules/retrieval/retrieval.service.ts#L1-L320).
- `src/modules/completions` — LLM orchestration, system prompt, and chat integration. See [src/modules/completions/completions.service.ts](src/modules/completions/completions.service.ts#L1-L240).
- `src/lib` — infra clients (Redis, BullMQ, Prisma). See [src/lib/redis.ts](src/lib/redis.ts#L1-L120) and [src/lib/redis-bullmq.ts](src/lib/redis-bullmq.ts#L1-L40).

## Tech Stack

- Node.js + Express (TypeScript)
- Postgres with vector extension (embedding stored in `vector` column)
- Redis (BullMQ backend + caching)
- BullMQ for job orchestration
- OpenAI / Google Gemini for embeddings and completions
- `gpt-tokenizer` for token-aware chunking

## API Overview

- POST /api/v1/ingestion/run — start a repository ingestion and queue embedding jobs. Controller: [src/modules/ingestion/ingestion.controller.ts](src/modules/ingestion/ingestion.controller.ts#L1-L80).
- POST /api/v1/completions/query — ask a question scoped to a repository/chat. Controller: [src/modules/completions/completions.controller.ts](src/modules/completions/completions.controller.ts#L1-L120).
- GET /api/v1/jobs/:jobId — stream job status (SSE) for progress and completion. Controller: [src/modules/jobs/job.controller.ts](src/modules/jobs/job.controller.ts#L1-L220).

All endpoints are authenticated (JWT) and designed to be used from the frontend where user and repository context are already established.

## Running Locally (developer steps)

1. Install dependencies

```bash
cd backend
npm install
```

2. Configure environment

Copy `.env.example` to `.env` and set the following keys (required):

- `DATABASE_URL` — Postgres connection
- `DIRECT_URL` — public URL for the frontend
- `REDIS_URL` — Redis connection (e.g., redis://localhost:6379)
- `CORS_ORIGIN` — frontend origin
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and expiry values
- `EMBEDDING_PROVIDER` — `openai` or `gemini`
- If `openai`: `OPENAI_API_KEY` and `OPENAI_EMBEDDING_MODEL`
- If `gemini`: `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, `GEMINI_CHAT_MODEL`

See environment variables and validation in [src/config/env.ts](src/config/env.ts#L1-L260).

3. Start infra

- Start Postgres and Redis locally (or use hosted services).

Example using Docker Compose (not provided here): run Postgres + Redis and ensure `DATABASE_URL` and `REDIS_URL` match.

4. Run the backend server and worker

```bash
# run API server (auto-reload in dev)
npm run dev

# in another terminal: run worker(s)
npm run worker
```

5. Smoke tests

Utility scripts exist to sanity-check Redis, queues, and vector pipeline: `npm run smoke:redis`, `npm run smoke:queue`, `npm run smoke:vector`.

## Challenges & Engineering Decisions

This section explains design trade-offs and decisions an interviewer will care about.

- Asynchronous processing vs synchronous: embeddings are rate-limited, costly, and long-running. Offloading to BullMQ decouples ingestion (fast API response) from heavy compute and API calls, enabling retries, progress telemetry, and horizontal scaling ([src/queues/queue.ts](src/queues/queue.ts#L1-L120), [src/queues/worker.ts](src/queues/worker.ts#L1-L200)).
- Handling large repositories: the ingestion pipeline scores files, limits files and bytes, and batches chunk persistence + embedding jobs to avoid memory pressure and long single transactions ([src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L1-L220), [src/modules/indexing/indexing.service.ts](src/modules/indexing/indexing.service.ts#L1-L160)).
- Avoiding token overflow: token-aware chunking, overlap, and trimming of retrieval context ensure we never exceed the LLM context window and reduce hallucinations ([src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L200-L360), [src/modules/retrieval/retrieval.service.ts](src/modules/retrieval/retrieval.service.ts#L1-L240)).
- Embedding caching: query embeddings are cached in Redis with a TTL to avoid repeated calls for identical queries, improving latency and reducing API usage ([src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L320-L420)).
- Queue-based scaling: worker processes are stateless and leverage Redis + Postgres row-locking to allow safe horizontal scaling. Job splitting (offset/limit pattern via `limit` in embedding jobs) ensures very large datasets can be processed incrementally.

## Future Improvements

- Re-ranking with a cross-encoder model for higher precision on top results.
- AST-aware chunking (language-aware parsers) to guarantee semantic boundaries instead of regex heuristics.
- Streaming responses from the LLM to the client (reduce perceived latency and support partial answers).
- Multi-repo embeddings and global search with tenant-aware sharding.
- More robust caching and invalidation strategy based on commit SHA or file content hashes (the code already computes content hash for chunk IDs to enable this).

## Notes for Interview Discussion

- Explain `FOR UPDATE SKIP LOCKED` used when claiming chunks for embedding: it's a robust pattern for parallel workers to avoid double processing.
- Discuss the trade-offs of storing vectors in Postgres vs specialized vector DBs: Postgres gives transactional guarantees and simplicity, while a dedicated vector DB could provide lower-latency nearest-neighbor search at scale.
- Illustrate how the design supports operational needs: job telemetry (SSE), retry/backoff on jobs, and best-effort caching.

## References (key files)

- Ingestion & chunking: [src/modules/ingestion/ingestion.service.ts](src/modules/ingestion/ingestion.service.ts#L1-L360)
- Embeddings orchestration: [src/modules/embeddings/embeddings.service.ts](src/modules/embeddings/embeddings.service.ts#L1-L420)
- Queueing: [src/queues/queue.ts](src/queues/queue.ts#L1-L120)
- Worker: [src/queues/worker.ts](src/queues/worker.ts#L1-L200)
- Chunk DAL & vector SQL: [src/modules/chunks/chunk.repository.ts](src/modules/chunks/chunk.repository.ts#L1-L260)
- Retrieval & hybrid ranking: [src/modules/retrieval/retrieval.service.ts](src/modules/retrieval/retrieval.service.ts#L1-L320)
- Completions/LLM orchestration: [src/modules/completions/completions.service.ts](src/modules/completions/completions.service.ts#L1-L240)
- Redis clients & bullmq connection: [src/lib/redis.ts](src/lib/redis.ts#L1-L120), [src/lib/redis-bullmq.ts](src/lib/redis-bullmq.ts#L1-L40)

---

If you'd like, I can:

- Add a small architecture diagram (Mermaid) to this README.
- Add a sample `.env.example` snippet with the minimum variables.
- Produce a short interview talking points bullet list mapping code locations to common questions.

---
Generated by an automated repo scan to reflect the current backend implementation.
