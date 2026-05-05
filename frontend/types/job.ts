export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobProgress = {
  processedChunks: number;
  remainingChunks: number;
};

export type JobEvent = {
  id: string;
  name?: string;
  status: JobStatus;
  state: string;
  progress: JobProgress | null;
  failedReason?: string | null;
  returnValue?: unknown | null;
  error?: string;
};
