# RepoInsight

A production-oriented repository intelligence platform that ingests source code from GitHub, builds vector embeddings, and exposes a Retrieval-Augmented Generation (RAG) chat interface.

This README documents architecture, pipelines, API, environment variables, local development, and deployment guidance based on the current codebase.

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-DB4B4B?style=flat-square&logo=redis&logoColor=white)](https://docs.bullmq.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pgvector](https://img.shields.io/badge/pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Gemini](https://img.shields.io/badge/Gemini-4285F4?style=flat-square&logo=googlegemini&logoColor=white)](https://ai.google.dev/gemini)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com/)


---

## Table of contents

- [Quick overview](#quick-overview)
- [Why RepoInsight exists](#why-repoinsight-exists)
- [Features](#features)
- [Architecture (ASCII diagrams)](#architecture-ascii-diagrams)
- [Request lifecycle](#request-lifecycle)
- [Example Query Flow](#example-query-flow)
- [Project structure (detailed)](#project-structure-detailed)
- [Backend overview & key files](#backend-overview--key-files)
- [Embedding & worker pipelines](#embedding--worker-pipelines)
- [SSE progress & job monitoring](#sse-progress--job-monitoring)
- [Engineering Challenges](#engineering-challenges)
- [Developer onboarding (local dev)](#developer-onboarding-local-dev)
- [Docker & deployment notes](#docker--deployment-notes)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Design notes (short)](#design-notes-short)
- [Roadmap & future improvements](#roadmap--future-improvements)
- [License](#license)

---

## Quick overview

RepoInsight lets you explore and ask questions about a repository using Retrieval-Augmented Generation (RAG). It:

- Scans GitHub repos, tokenizes and chunks source files, and stores chunks in Postgres.
- Computes vector embeddings (OpenAI or Google Gemini) in an async worker pipeline powered by BullMQ + Redis.
- Performs hybrid retrieval (vector similarity + keyword boosting) and serves a chat UI that generates answers using Gemini.

This README focuses on architecture, developer onboarding, and operational notes for production-like deployments.

---

## Why RepoInsight exists

Software teams need fast, accurate ways to search and reason about large codebases. RepoInsight was built to demonstrate a scalable, production-oriented approach to code-aware RAG:

- Async embedding pipelines decouple heavy provider calls from the API, enabling scalable ingestion.
- A queue-first architecture (BullMQ) provides visibility, retries, and backpressure for long-running ingestion tasks.
- Hybrid retrieval (vectors + SQL keyword boosting) improves relevance for code search where exact identifiers matter.

Design note: prioritizing asynchronous embedding and queueing reduces tail latency for interactive user queries and allows horizontal scaling of workers.

---

## Features

- **AI codebase chat:** Ask questions about a repository and get RAG-powered answers with citations.
- **Semantic retrieval:** Vector search over tokenized code chunks.
- **Hybrid search:** Vector similarity + keyword boosting for precise results.
- **Async embedding workers:** Background embedding with batch processing and retries.
- **BullMQ + Redis:** Reliable job queue with progress updates.
- **SSE real-time progress:** Browser-side progress via Server-Sent Events for ingestion/embedding jobs.
- **Google OAuth + JWT auth:** OAuth login plus access/refresh token flow.
- **Dockerized local dev:** Compose file to run frontend, backend, worker, and Redis.
- **pgvector similarity search:** Postgres-based vector operations and optimized SQL patterns.
- **Multi-provider embeddings:** OpenAI or Gemini (configurable).

---

## Architecture (ASCII diagrams)

System overview (development topology):

```text
┌──────────────────────┐       ┌─────────────────────┐       ┌──────────────────────┐
│      Frontend        │ <───> │     Backend API     │ <───> │     PostgreSQL       │
│    Next.js @3000     │       │     Express @4000   │       │      Prisma ORM      │
└──────────────────────┘       └──────────┬──────────┘       └──────────────────────┘
                                          │
                          ┌───────────────┴───────────────┐
                          │                               │
                          v                               v
                   ┌────────────────┐           ┌──────────────────────┐
                   │   Redis        │           │    SSE clients       │
                   │    BullMQ      │           │    EventSource       │
                   └──────┬─────────┘           └──────────────────────┘
                          │
                          v
                   ┌──────────────────────┐
                   │       Worker(s)      │
                   │   embedding jobs     │
                   └──────────────────────┘
```

Architecture note: the worker(s) are separated from the API so heavy embedding work can scale independently from interactive API latency.

### RAG pipeline (high level)

```text
┌──────────────┐
│  User Query  │
└──────┬───────┘
       │
       v
┌─────────────────────────────────────────────┐
│ API auth + optional query rewrite           │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│ Query embedding generation                  │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│ Hybrid retrieval (vector + keyword SQL)     │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│ Context assembly (trim + format)            │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│ Gemini/OpenAI completion                    │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│ Persist message + return response           │
└─────────────────────────────────────────────┘
```

### Embedding pipeline (worker-focused)

```text
┌─────────────────────────────────────────────┐
│ enqueueEmbeddingsForRepository              │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌──────────────────────────────────────────────┐
│ BullMQ job: embed-repository (rag-processing)│
└──────────────────────┬───────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│ Worker locks batch (FOR UPDATE SKIP LOCKED) │
│ and fetches pending chunks                  │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│ Call embedding provider in batches          │
│ and validate vectors                        │
└──────────────────────┬──────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────┐
│ updateChunkEmbeddingsBatch                  │
│ set status done + persist vectors           │
└─────────────────────────────────────────────┘
```

### BullMQ job lifecycle

```text
┌──────────────────────┐
│ Producer enqueues job│
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Job queued in Redis  │
└──────────┬───────────┘
           │
           v
┌─────────────────────────────────────────────┐
│ Worker fetches job and updates progress     │
└───────────────────┬─────────────────────────┘
                    │
                    v
      ┌─────────────┴───────────────────┐
      │                                 │
      v                                 v
┌──────────────────────┐   ┌──────────────────────────────┐
│ Success: job done    │   │ Failure: retry with backoff  │
└──────────────────────┘   └──────────┬───────────────────┘
                                      │
                                      v
                         ┌──────────────────────────────┐
                         │ Failed after max attempts    │
                         └──────────────────────────────┘
```

### SSE progress flow

```text
┌──────────────────────────────┐
│ Worker updates job progress  │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Backend polls BullMQ state   │
│ and normalizes job updates   │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ SSE stream to browser        │
│ progress / state / keepalive │
└──────────────────────────────┘
```

---

## Request lifecycle

This section describes what happens when a user asks a question in the chat UI.

```text
┌──────────────────────────────┐
│ User submits query in chat   │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ API verifies auth            │
│ cookie or Authorization      │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Optional query rewrite       │
│ for retrieval quality        │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Query embedding generation   │
│ cached in Redis when possible│
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Hybrid retrieval             │
│ vector search + keyword SQL  │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Context assembly             │
│ trim to token budget         │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Gemini completion            │
│ or configured model          │
└──────────────┬───────────────┘
               │
               v
┌──────────────────────────────┐
│ Persist assistant message    │
│ and return response          │
└──────────────────────────────┘
```

Design note: caching query embeddings and doing retrieval server-side keeps the client fast and reduces provider calls.

---

## Example Query Flow

Repository: `facebook/react`

Question: "How does useEffect cleanup work internally?"

1. The backend generates a query embedding for the question and reuses a cached vector when the same normalized query is seen again.
2. Hybrid retrieval combines pgvector similarity with keyword SQL matches so exact symbols like `useEffect` and `cleanup` stay competitive.
3. The highest-signal chunks are selected from the repository context and trimmed to fit the prompt budget.
4. The prompt is assembled with repository-specific code excerpts and the user question.
5. Gemini generates the answer from that grounded context.
6. The final response is persisted as a chat message and returned with citations to the relevant chunks.

---

## Engineering Challenges

- Asynchronous embedding work is isolated from the request path so repository ingestion does not block interactive chat latency.
- Worker coordination uses `FOR UPDATE SKIP LOCKED` so multiple workers can process the same repository safely without duplicate chunk writes.
- Chunk statuses and unique constraints make retry behavior idempotent across queue retries and worker restarts.
- Retrieval balances semantic similarity with SQL keyword boosting so exact identifiers still surface in code-heavy searches.
- Prompt assembly trims and ranks context to stay within model token budgets without dropping the most relevant chunks.
- Provider retries and batching absorb transient OpenAI or Gemini failures while keeping throughput predictable under rate limits.
- SSE progress updates give the UI a lightweight, browser-native way to surface long-running ingestion state without WebSocket complexity.

---

## Project structure (detailed)

Top-level (monorepo):

```
docker-compose.yml        # local dev composition for frontend, backend, worker, redis
README.md
backend/                  # Express API, workers, prisma
  Dockerfile
  package.json
  tsconfig.json
  prisma/                 # schema + migrations
  src/
   app.ts                # Express app wiring
   server.ts             # server bootstrap
   config/               # env, constants
    constants.ts
    env.ts
   lib/                  # shared clients & connectors
    prisma.ts
    redis.ts
    redis-bullmq.ts
   middlewares/          # auth, error handlers
    auth.middleware.ts
    error.middleware.ts
   modules/              # domain logic (grouped by feature)
    ingestion/          # repo scanning, chunking
    chunks/             # chunk repository operations
    embeddings/         # embedding service
    indexing/           # indexing helpers
    retrieval/          # hybrid retrieval logic
    completions/        # LLM generation glue
    user/               # user management + auth
    jobs/               # job controllers and helpers
   queues/               # BullMQ queue + worker runner
    queue.ts
    worker.ts
   routes/               # Express route definitions
    ingestion.routes.ts
    completions.routes.ts
    job.routes.ts
    user.routes.ts
   scripts/              # small smoke tests and helpers
   types/                # express.d.ts augmentations
   utils/                # ApiError, ApiResponse, AsyncHandler
frontend/                 # Next.js app
  app/                    # Next 13+ app router pages
  components/             # UI components
  features/               # domain UI + hooks
  lib/                    # client helpers
  package.json
```

Notes:
- The `modules/` folder contains the main business logic that controllers call.
- The `queues/` folder contains the BullMQ configuration and the `worker.ts` that runs embedding jobs.

---

## Backend overview & key files

- App bootstrap: [backend/src/app.ts](backend/src/app.ts)
- Server lifecycle: [backend/src/server.ts](backend/src/server.ts)
- Env and constants: [backend/src/config/env.ts](backend/src/config/env.ts)
- Queue wiring: [backend/src/queues/queue.ts](backend/src/queues/queue.ts)
- Worker: [backend/src/queues/worker.ts](backend/src/queues/worker.ts)
- Embeddings service: [backend/src/modules/embeddings/embeddings.service.ts](backend/src/modules/embeddings/embeddings.service.ts)
- Chunk repository: [backend/src/modules/chunks/chunk.repository.ts](backend/src/modules/chunks/chunk.repository.ts)

See the `src/routes/` folder for API surface details.

---

## Embedding & worker pipelines

Behavior summary:

- Embeddings are produced asynchronously in worker jobs that process chunks in batches.
- Workers lock rows with `FOR UPDATE SKIP LOCKED` to safely parallelize across multiple worker processes.
- Results are written back to Postgres using raw SQL to persist vectors into a `vector` column.

Design note: using `FOR UPDATE SKIP LOCKED` prevents duplicate work across concurrent workers and provides a natural way to chunk work without external coordination.

---

## SSE progress & job monitoring

- Clients subscribe to `GET /api/v1/jobs/:jobId` to receive Server-Sent Events (SSE) for ingestion and embedding progress.
- The backend polls BullMQ job state and forwards `progress` updates to connected clients, including keep-alives.

Design note: SSE is chosen for simplicity and wide browser support; it fits well for streaming job progress without WebSockets complexity.

---

## Developer onboarding (local dev)

1. Backend - quick start

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL, DIRECT_URL, ACCESS/REFRESH secrets, provider keys
npm run prisma:generate
npm run dev
```

2. Worker (background)

```bash
cd backend
npm run worker
```

3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# update NEXT_PUBLIC_GOOGLE_CLIENT_ID
npm run dev
```

Useful scripts (backend/package.json):

- `npm run dev` — Express server with tsx watch
- `npm run worker` — runs `src/queues/worker.ts` (worker process)
- Smoke tests: `npm run smoke:queue`, `npm run smoke:redis`, `npm run smoke:vector`

Local tips:
- Ensure `REDIS_URL` and `DATABASE_URL` are reachable.
- Run `prisma migrate dev --schema prisma/schema.prisma --preview-feature` or follow `prisma` scripts to apply migrations against `DIRECT_URL`.

---

## Docker & deployment notes

Compose services (development):

- `frontend` — Next.js app (port 3000) — serves the UI and static assets.
- `backend` — Express API (port 4000) — handles auth, retrieval, and routes.
- `worker` — worker image running the BullMQ worker (embedding + indexing tasks).
- `redis` — Redis used by BullMQ for job queues and short-term caching.

Why separate the worker container?

- Embedding and indexing are CPU/network intensive and can be scaled independently from the API.
- Separating concerns reduces tail latency on API requests and allows using different instance types for workers.

Production deployment notes:

- Run multiple worker replicas to scale ingestion throughput and set appropriate concurrency.
- Keep Redis in a managed/HA configuration for reliability and persistence.
- Use a managed Postgres with vector support (pgvector) and sufficient I/O for similarity queries.

Scaling recommendations:

- Increase worker replicas and tune `EMBEDDING_BATCH_SIZE` for provider rate limits.
- Separate read and write DB pools if your deployment supports it.
- Use a CDN for frontend static assets and a load balancer for the backend API.

---

## Environment variables

The backend validates required env vars at startup ([backend/src/config/env.ts](backend/src/config/env.ts)). Minimum set for local development:

| Name | Purpose | Example |
|---|---|---|
| PORT | Backend HTTP port | 4000 |
| NODE_ENV | Node environment | development |
| CORS_ORIGIN | Frontend origin for CORS | http://localhost:3000 |
| DATABASE_URL | Postgres connection URL | postgres://... |
| DIRECT_URL | Direct Postgres URL for migrations | postgres://... |
| REDIS_URL | Redis connection for BullMQ | redis://localhost:6379 |
| EMBEDDING_PROVIDER | openai or gemini | openai |
| OPENAI_API_KEY | OpenAI API key (if provider=openai) | — |
| GEMINI_API_KEY | Google Gemini API key (if provider=gemini) | — |
| GEMINI_CHAT_MODEL | Gemini chat model | gemini-2.5-flash |
| EMBEDDING_BATCH_SIZE | Embedding provider batch size | 20 |
| EMBEDDING_CONCURRENCY | Parallel embedding calls (Gemini) | 3 |
| ACCESS_TOKEN_SECRET | JWT access secret | REQUIRED |
| REFRESH_TOKEN_SECRET | JWT refresh secret | REQUIRED |
| GOOGLE_CLIENT_ID | Google OAuth client ID | REQUIRED for Google login |

See `backend/.env.example` for a complete template.

---

## API overview

| Method | Path | Description | Auth |
|---|---:|---|:---:|
| GET | /api/v1/health | Health check | No |
| GET | /api/v1/ready | DB readiness check | No |
| POST | /api/v1/ingestion/run | Start ingestion of GitHub repository (returns job ids and repository id) | Yes |
| POST | /api/v1/completions/query | Ask a question in the context of a chat (RAG) | Yes |
| GET | /api/v1/jobs/:jobId | SSE stream for job progress | Yes |
| POST | /api/v1/users/google-login | Login with Google ID token | No |
| POST | /api/v1/users/register | Create account (email/password) | No |
| POST | /api/v1/users/login | Login with email/password | No |
| POST | /api/v1/users/refresh-token | Exchange refresh token for new access token | No |
| POST | /api/v1/chat | Create chat for repository | Yes |
| GET  | /api/v1/chat | List chats | Yes |
| DELETE | /api/v1/chat/:chatId | Delete chat | Yes |
| GET | /api/v1/chat/:chatId/messages | List messages | Yes |

Refer to `backend/src/routes` for route implementations.

---

## Design notes (short)

- BullMQ: chosen for its robust retry/backoff semantics and easy Redis-based visibility into job state.
- Redis: used for queue coordination and short-term caching (e.g., embedding caches) to reduce duplicate provider calls.
- Async embeddings: decoupling embeddings from the request path reduces API latency and allows batch optimization.
- Hybrid retrieval: vector search provides semantic relevance; keyword SQL helps surface exact identifier matches common in code search.

---

## Roadmap & future improvements

- Add Postgres-based change-tracking (commit SHA) to only re-index changed files.
- Split ingestion into staged queues (fetch → chunk → index → embed) for stronger orchestration and backpressure control.
- Add provider circuit-breakers and rate-limit handling for robustness.
- Add CI jobs and end-to-end tests (ingest small repo → run worker → query).

---

## License

ISC

---

**Author:** Apoorv Gupta