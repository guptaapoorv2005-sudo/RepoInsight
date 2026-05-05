export type MessageRole = "user" | "assistant";

export type Chat = {
  id: string;
  userId: string;
  repositoryId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type CompletionCitation = {
  id: string;
  filePath: string;
  chunkIndex: number;
  score: number;
  distance: number;
};

export type CompletionResult = {
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
