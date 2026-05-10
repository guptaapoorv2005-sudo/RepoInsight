export type ScanRepositoryInput = {
  repoUrl: string;
  branch?: string;
};

export type ScannedFile = {
  path: string;
  size: number | null;
  extension: string;
};

export type ScanRepositoryResult = {
  owner: string;
  repo: string;
  branch: string;
  totalFromTree: number;
  kept: number;
  skipped: number;
  files: ScannedFile[];
};

export type FetchAndChunkInput = {
  owner: string;
  repo: string;
  branch: string;
  files: Array<{ path: string; size: number | null }>;
};

export type FileChunk = {
  filePath: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  language: string;
  tokenCount: number;
};

export type FetchAndChunkResult = {
  owner: string;
  repo: string;
  branch: string;
  requestedFiles: number;
  processedFiles: number;
  skippedFiles: number;
  totalChunks: number;
  chunks: FileChunk[];
  errors: Array<{ filePath: string; reason: string }>;
};

export type IngestRepositoryInput = {
  userId: string;
  repoUrl: string;
  branch?: string;
};

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