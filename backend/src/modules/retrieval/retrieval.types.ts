export type RetrievalInput = {
  repositoryId: string;
  queryEmbedding: number[];
  limit?: number;
};

export type RetrievalQuestionInput = {
  repositoryId: string;
  question: string;
  topK?: number;
};

export type RetrievalContextResult = {
  repositoryId: string;
  question: string;
  topK: number;
  embeddingProvider: "openai" | "gemini";
  embeddingModel: string;
  matches: Array<{
    id: string;
    filePath: string;
    chunkIndex: number;
    score: number;
    distance: number;
    content: string;
  }>;
  contextText: string;
};