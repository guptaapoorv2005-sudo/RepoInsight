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