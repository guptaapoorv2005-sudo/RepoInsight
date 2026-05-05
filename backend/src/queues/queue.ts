import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis-bullmq.js";

export const QUEUE_NAME = "rag-processing";

export const JOB_NAMES = {
  TEST: "test",
  EMBED_REPOSITORY: "embed-repository"
} as const;

export type JobName = typeof JOB_NAMES[keyof typeof JOB_NAMES];

export type TestJobPayload = {
  message: string;
};

export type EmbeddingJobPayload = {
  repositoryId: string;
  userId: string;
  limit: number;
};

export type RagJobPayload = TestJobPayload | EmbeddingJobPayload;

export const jobQueue = new Queue<RagJobPayload>(QUEUE_NAME, {
  connection: bullmqConnection
});

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000
  }
};

export async function enqueueTestJob(message: string) {
  return jobQueue.add(JOB_NAMES.TEST, { message }, {
    ...defaultJobOptions,
    jobId: `test-${Date.now()}`,
    removeOnComplete: true,
    removeOnFail: false
  });
}

export async function enqueueEmbeddingJob(payload: EmbeddingJobPayload) {
  return jobQueue.add(JOB_NAMES.EMBED_REPOSITORY, payload, {
    ...defaultJobOptions,
    jobId: `embed-${payload.repositoryId}-${Date.now()}`,
    removeOnComplete: true,
    removeOnFail: 50 // keep last 50 failures
  });
}