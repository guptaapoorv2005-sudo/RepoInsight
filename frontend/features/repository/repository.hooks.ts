import { useMutation } from "@tanstack/react-query";
import type { ApiError } from "@/types/api";
import type { IngestRepositoryResult } from "@/types/ingestion";
import { ingestRepository } from "@/features/repository/repository.api";

export function useIngestRepository() {
  return useMutation<IngestRepositoryResult, ApiError, { repoUrl: string }>({
    mutationFn: ingestRepository
  });
}
