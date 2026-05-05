import { apiPost } from "@/lib/api/client";
import type { IngestRepositoryResult } from "@/types/ingestion";

type IngestInput = {
  repoUrl: string;
  branch?: string;
  scanMaxFiles?: number;
  scanMaxFileSizeBytes?: number;
  chunkSizeTokens?: number;
  overlapTokens?: number;
  fetchMaxFiles?: number;
  fetchMaxFileSizeBytes?: number;
};

export function ingestRepository(input: IngestInput) {
  return apiPost<IngestRepositoryResult>("/ingestion/run", input);
}
