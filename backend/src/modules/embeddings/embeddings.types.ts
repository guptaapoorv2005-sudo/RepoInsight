export type GenerateEmbeddingsInput = {
  repositoryId: string;
  userId?: string;
  batchSize?: number;
  maxRetries?: number;
  maxChunks?: number;
  limit?: number;
};

export type EmbeddingError = {
  chunkId: string;
  reason: string;
};

export type GenerateEmbeddingsResult = {
  repositoryId: string;
  provider: "openai" | "gemini";
  model: string;
  requestedChunks: number;
  processedChunks: number;
  failedChunks: number;
  remainingChunks: number;
  durationMs: number;
  errors: EmbeddingError[];
};

export type EnqueueEmbeddingsResult = {
  repositoryId: string;
  jobId: string;
  status: "queued";
};