import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { EMBEDDING_DIMENSION } from "../../config/constants.js";
import {
  countChunksWithoutEmbedding,
  getChunksWithoutEmbedding,
  updateChunkEmbedding
} from "../chunks/chunk.repository.js";
import type {
  GenerateEmbeddingsInput,
  GenerateEmbeddingsResult,
  EmbeddingError
} from "./embeddings.types.js";
import { GoogleGenAI } from "@google/genai";

type EmbeddingProvider = {
  name: "openai" | "gemini";
  model: string;
  embedBatch: (texts: string[]) => Promise<number[][]>;
};

type OpenAiEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_CHUNKS = 200;
const RETRY_BASE_DELAY_MS = 500;

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
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is required for gemini provider");
  }

  const results: number[][] = [];

  for (const text of texts) {
    const res = await ai.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,
      contents: text,
      config: {
        outputDimensionality: EMBEDDING_DIMENSION
      }
    });

    if (!res.embeddings?.[0]?.values) {
      throw new Error("Invalid Gemini response");
    }

    results.push(res.embeddings[0].values);
  }

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

export async function generateEmbeddingsForRepository(
  input: GenerateEmbeddingsInput
): Promise<GenerateEmbeddingsResult> {
  if (!input.repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  const batchSize = input.batchSize ?? env.EMBEDDING_BATCH_SIZE;
  const maxRetries = input.maxRetries ?? env.EMBEDDING_MAX_RETRIES;
  const maxChunks = input.maxChunks ?? DEFAULT_MAX_CHUNKS;

  if (batchSize <= 0) {
    throw new ApiError(400, "batchSize must be greater than 0");
  }

  if (maxRetries < 0) {
    throw new ApiError(400, "maxRetries must be >= 0");
  }

  if (maxChunks <= 0) {
    throw new ApiError(400, "maxChunks must be greater than 0");
  }

  const provider = getEmbeddingProvider();
  const started = Date.now();

  const pending = await getChunksWithoutEmbedding({
    repositoryId: input.repositoryId,
    limit: maxChunks
  });

  const errors: EmbeddingError[] = [];
  let processedChunks = 0;

  if (pending.length > 0) {
    const batches = chunkArray(pending, batchSize);

    for (const batch of batches) {
      try {
        const vectors = await withRetry(
          () => provider.embedBatch(batch.map((x) => x.content)),
          maxRetries
        );

        if (vectors.length !== batch.length) {
          throw new Error("Provider returned mismatched embedding count");
        }

        for (let i = 0; i < batch.length; i += 1) {
          const vector = vectors[i];
          validateVector(vector);
          await updateChunkEmbedding(batch[i].id, vector);
          processedChunks += 1;
        }
      } catch (error) {
        for (const chunk of batch) {
          errors.push({
            chunkId: chunk.id,
            reason: error instanceof Error ? error.message : "Unknown embedding error"
          });
        }
      }
    }
  }

  const remainingChunks = await countChunksWithoutEmbedding(input.repositoryId);

  return {
    repositoryId: input.repositoryId,
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
  const vectors = await withRetry(
    () => provider.embedBatch([trimmed]),
    env.EMBEDDING_MAX_RETRIES
  );

  if (!Array.isArray(vectors) || vectors.length !== 1) {
    throw new ApiError(500, "Embedding provider returned invalid query vector result");
  }

  const vector = vectors[0];
  validateVector(vector);

  return {
    vector,
    provider: provider.name,
    model: provider.model
  };
}

//TODO:
/*
 Critical Issues (Fix Before Scaling)

## 1. ❌ No DB locking (BIGGEST ISSUE)

👉 Causes:
- duplicate processing
- double billing (OpenAI $$$)

---

## 2. ❌ Sequential DB writes (performance killer)

👉 Needs:
- batching OR parallelism

---

## 3. ❌ Whole-batch failure handling

👉 One error → whole batch fails

---

## 4. ❌ No "in-progress" state

👉 Chunks can be:
- picked multiple times
- retried infinitely

---
*/