export type IngestRepositoryResult = {
  owner: string;
  repo: string;
  branch: string;
  scan: {
    totalFromTree: number;
    kept: number;
    skipped: number;
  };
  chunking: {
    requestedFiles: number;
    processedFiles: number;
    skippedFiles: number;
    totalChunks: number;
    errors: Array<{ filePath: string; reason: string }>;
  };
  persistence: {
    repositoryId: string;
    totalChunks: number;
    embeddedChunks: number;
    embeddingJobsQueued: number;
    embeddingJobIds: string[];
  };
};
