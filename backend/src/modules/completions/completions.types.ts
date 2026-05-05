export type GenerateCompletionInput = {
  userId: string;
  chatId: string;
  question: string;
  topK?: number;
  temperature?: number;
  maxOutputTokens?: number;
};

export type CompletionCitation = {
  id: string;
  filePath: string;
  chunkIndex: number;
  score: number;
  distance: number;
};

export type GenerateCompletionResult = {
  repositoryId: string;
  chatId: string;
  question: string;
  topK: number;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  answer: string;
  citations: CompletionCitation[];
  durationMs: number;
};