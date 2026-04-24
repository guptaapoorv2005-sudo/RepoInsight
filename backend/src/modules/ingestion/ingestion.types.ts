export type ScanRepositoryInput = {
repoUrl: string;
branch?: string;
maxFiles?: number;
maxFileSizeBytes?: number;
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
  chunkSizeLines?: number;
  overlapLines?: number;
  maxFilesToFetch?: number;
  maxFileSizeBytes?: number;
};

export type FileChunk = {
  filePath: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  charCount: number;
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
  repoUrl: string;
  branch?: string;
  scanMaxFiles?: number;
  scanMaxFileSizeBytes?: number;
  chunkSizeLines?: number;
  overlapLines?: number;
  fetchMaxFiles?: number;
  fetchMaxFileSizeBytes?: number;
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
  };
};