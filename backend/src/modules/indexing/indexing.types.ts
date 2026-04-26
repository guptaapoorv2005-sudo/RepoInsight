import { Prisma } from "@prisma/client";

export type IndexChunkInput = {
  id: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  metadata?: Prisma.InputJsonValue;
  embedding?: number[];
};

export type IndexRepositoryInput = {
  owner: string;
  name: string;
  defaultBranch?: string | null;
  chunks: IndexChunkInput[];
};