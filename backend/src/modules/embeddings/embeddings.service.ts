import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { EMBEDDING_DIMENSION } from "../../config/constants.js";
import { prisma } from "../../lib/prisma.js";
import { redis } from "../../lib/redis.js";
import { enqueueEmbeddingJob } from "../../queues/queue.js";
import {
  countChunksWithoutEmbedding,
  markChunksFailed,
  updateChunkEmbeddingsBatch
} from "../chunks/chunk.repository.js";
import type {
  GenerateEmbeddingsInput,
  GenerateEmbeddingsResult,
  EmbeddingError,
  EnqueueEmbeddingsResult
} from "./embeddings.types.js";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import pLimit from "p-limit";

type EmbeddingProvider = {
  name: "openai" | "gemini";
  model: string;
  embedBatch: (texts: string[]) => Promise<number[][]>;
};

type OpenAiEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

const DEFAULT_MAX_CHUNKS = 200;
const RETRY_BASE_DELAY_MS = 500;
const QUERY_EMBEDDING_CACHE_TTL_SECONDS = 60 * 60;
const QUERY_EMBEDDING_CACHE_PREFIX = "cache:query-embedding:v1";

type NormalizedEmbeddingInput = {
  repositoryId: string;
  batchSize: number;
  maxRetries: number;
  limit: number;
};

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildQueryEmbeddingCacheKey(provider: EmbeddingProvider, text: string): string {
  return [
    QUERY_EMBEDDING_CACHE_PREFIX,
    provider.name,
    provider.model,
    hashText(text)
  ].join(":");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      const delay = RETRY_BASE_DELAY_MS * (attempt + 1); // Increasing delay reduces pressure on API, this is a simple linear backoff strategy
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError;
}

function validateVector(vector: number[]): void {
  if (vector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      "Embedding dimension mismatch. Expected " +
        EMBEDDING_DIMENSION +
        ", received " +
        vector.length
    );
  }

  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding contains non-finite numbers");
    }
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function openAiEmbedBatch(texts: string[]): Promise<number[][]> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(500, "OPENAI_API_KEY is required for openai provider");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSION
    })
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "OpenAI embeddings request failed with status " + response.status
    );
  }

  const payload = (await response.json()) as OpenAiEmbeddingsResponse;
  // OpenAI returns embeddings in the same order as input, but we sort by index just to be safe and explicit
  const ordered = payload.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  return ordered;
}

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

async function geminiEmbedBatch(texts: string[]): Promise<number[][]> {
  const limit = pLimit(env.EMBEDDING_CONCURRENCY ?? 1);

  const results: number[][] = new Array(texts.length);

  await Promise.all(
    texts.map((text, i) =>
      limit(async () => {
        const res = await ai.models.embedContent({
          model: env.GEMINI_EMBEDDING_MODEL,
          contents: text,
          config: { outputDimensionality: EMBEDDING_DIMENSION }
        });

        if (!res.embeddings?.[0]?.values) {
          throw new Error("Invalid Gemini response");
        }

        results[i] = res.embeddings[0].values;
      })
    )
  );

  return results;
}

function getEmbeddingProvider(): EmbeddingProvider {
  const provider = env.EMBEDDING_PROVIDER;

  switch (provider) {
    case "openai":
      return {
        name: "openai",
        model: env.OPENAI_EMBEDDING_MODEL,
        embedBatch: openAiEmbedBatch,
      };

    case "gemini":
      return {
        name: "gemini",
        model: env.GEMINI_EMBEDDING_MODEL,
        embedBatch: geminiEmbedBatch,
      };

    default:
      throw new ApiError(400, "Invalid EMBEDDING_PROVIDER");
  }
}

type ProgressCallback = (progress: {
  processedChunks: number;
  remainingChunks: number;
}) => Promise<void> | void;

export async function generateEmbeddingsForRepository(
  input: GenerateEmbeddingsInput,
  onProgress?: ProgressCallback
): Promise<GenerateEmbeddingsResult> {
  const normalized = normalizeEmbeddingInput(input);
  const batchSize = normalized.batchSize;
  const maxRetries = normalized.maxRetries;
  const limit = normalized.limit;

  const provider = getEmbeddingProvider();
  const started = Date.now();

  const pending = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; content: string }>>`
      SELECT "id"::text AS id, "content"
      FROM "code_chunks"
      WHERE "repository_id" = ${normalized.repositoryId}::uuid
        AND "embedding" IS NULL
        AND "status" = 'pending'
      ORDER BY "file_path" ASC, "chunk_index" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    return rows;
  });

  const errors: EmbeddingError[] = [];
  let processedChunks = 0;
  let completedChunks = 0;

  const emitProgress = async () => {
    if (!onProgress) return;
    const remainingChunks = Math.max(0, pending.length - completedChunks);
    await onProgress({
      processedChunks: completedChunks,
      remainingChunks
    });
  };

  if (pending.length > 0) {
    const batches = chunkArray(pending, batchSize);

    for (const batch of batches) {
      const safeBatch: typeof batch = [];
      const skippedIds: string[] = [];

      try {

        for (const item of batch) {
          if (item.content.length > 8000) {
            skippedIds.push(item.id);
            continue;
          }
          safeBatch.push(item);
        }

        if (skippedIds.length > 0) {
          await markChunksFailed(skippedIds);
          for (const id of skippedIds) {
            errors.push({
              chunkId: id,
              reason: "Chunk content too large"
            });
          }
        }

        const batchTotal = safeBatch.length + skippedIds.length;

        if (safeBatch.length === 0) {
          completedChunks += batchTotal;
          await emitProgress();
          continue;
        }
        const vectors = await withRetry(
          () => provider.embedBatch(safeBatch.map((x) => x.content)),
          maxRetries
        );

        if (vectors.length !== safeBatch.length) {
          throw new Error("Provider returned mismatched embedding count");
        }

        const successUpdates: Array<{ id: string; embedding: number[] }> = [];
        const failedIds: string[] = [];

        for (let i = 0; i < safeBatch.length; i += 1) {
          try {
            validateVector(vectors[i]);

            successUpdates.push({
              id: safeBatch[i].id,
              embedding: vectors[i]
            });

            processedChunks++;
          } catch (err) {
            failedIds.push(safeBatch[i].id);
            errors.push({
              chunkId: safeBatch[i].id,
              reason: "Invalid embedding"
            });
          }
        }

        await updateChunkEmbeddingsBatch(successUpdates);

        await markChunksFailed(failedIds);

        completedChunks += batchTotal;
        await emitProgress();

      } catch (error) {
        const ids = safeBatch.map((x) => x.id);

        await markChunksFailed(ids);

        for (const id of ids) {
          errors.push({
            chunkId: id,
            reason: error instanceof Error ? error.message : "Unknown error"
          });
        }

        completedChunks += safeBatch.length + skippedIds.length;
        await emitProgress();
      }
    }
  }

  const remainingChunks = await countChunksWithoutEmbedding(normalized.repositoryId);

  return {
    repositoryId: normalized.repositoryId,
    provider: provider.name,
    model: provider.model,
    requestedChunks: pending.length,
    processedChunks,
    failedChunks: errors.length,
    remainingChunks,
    durationMs: Date.now() - started,
    errors
  };
}

export async function enqueueEmbeddingsForRepository(
  input: GenerateEmbeddingsInput
): Promise<EnqueueEmbeddingsResult> {
  const normalized = normalizeEmbeddingInput(input);

  if (!input.userId) {
    throw new ApiError(400, "userId is required");
  }

  const job = await enqueueEmbeddingJob({
    repositoryId: normalized.repositoryId,
    userId: input.userId,
    limit: normalized.limit
  });

  return {
    repositoryId: normalized.repositoryId,
    jobId: String(job.id),
    status: "queued"
  };
}

export type QueryEmbeddingResult = {
  vector: number[];
  provider: "openai" | "gemini";
  model: string;
};

export async function generateQueryEmbedding(text: string): Promise<QueryEmbeddingResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ApiError(400, "question must not be empty");
  }

  const provider = getEmbeddingProvider();
  const cacheKey = buildQueryEmbeddingCacheKey(provider, trimmed);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as QueryEmbeddingResult;
      if (Array.isArray(parsed.vector)) {
        validateVector(parsed.vector);
        return {
          vector: parsed.vector,
          provider: parsed.provider,
          model: parsed.model
        };
      }
    }
  } catch {
    // Best-effort cache read; ignore failures.
  }

  const vectors = await withRetry(
    () => provider.embedBatch([trimmed]),
    env.EMBEDDING_MAX_RETRIES
  );

  if (!Array.isArray(vectors) || vectors.length !== 1) {
    throw new ApiError(500, "Embedding provider returned invalid query vector result");
  }

  const vector = vectors[0];
  validateVector(vector);

  try {
    await redis.set(
      cacheKey,
      JSON.stringify({ vector, provider: provider.name, model: provider.model }),
      "EX",
      QUERY_EMBEDDING_CACHE_TTL_SECONDS
    );
  } catch {
    // Best-effort cache write; ignore failures.
  }

  return {
    vector,
    provider: provider.name,
    model: provider.model
  };
}

function normalizeEmbeddingInput(input: GenerateEmbeddingsInput): NormalizedEmbeddingInput {
  if (!input.repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  const batchSize = input.batchSize ?? env.EMBEDDING_BATCH_SIZE;
  const maxRetries = input.maxRetries ?? env.EMBEDDING_MAX_RETRIES;
  const limit = input.limit ?? input.maxChunks ?? DEFAULT_MAX_CHUNKS;

  if (batchSize <= 0) {
    throw new ApiError(400, "batchSize must be greater than 0");
  }

  if (maxRetries < 0) {
    throw new ApiError(400, "maxRetries must be >= 0");
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ApiError(400, "limit must be a positive integer");
  }

  return {
    repositoryId: input.repositoryId,
    batchSize,
    maxRetries,
    limit
  };
}

//TODO:
//add timeout to external API calls(If provider hangs → your worker hangs)