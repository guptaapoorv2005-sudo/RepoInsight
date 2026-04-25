export type GenerateEmbeddingsInput = {
  repositoryId: string;
  batchSize?: number;
  maxRetries?: number;
  maxChunks?: number;
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