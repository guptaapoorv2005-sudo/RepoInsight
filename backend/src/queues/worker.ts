import { Job, Worker } from "bullmq";
import { bullmqConnection } from "../lib/redis-bullmq.js";
import { generateEmbeddingsForRepository } from "../modules/embeddings/embeddings.service.js";
import {
  QUEUE_NAME,
  JOB_NAMES,
  JobName,
  TestJobPayload,
  EmbeddingJobPayload,
  RagJobPayload
} from "./queue.js";

type JobHandlers = {
  [JOB_NAMES.TEST]: (job: Job<TestJobPayload>) => Promise<void>;
  [JOB_NAMES.EMBED_REPOSITORY]: (job: Job<EmbeddingJobPayload>) => Promise<void>;
};

// NOTE: This timeout does NOT cancel underlying execution
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Embedding job timeout")), ms)
    )
  ]);
}

const handlers: JobHandlers = {
  [JOB_NAMES.TEST]: async (job) => {
    console.log("Processing job", {
      jobId: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade
    });

    console.log("Test job payload", {
      message: job.data.message
    });
  },

  [JOB_NAMES.EMBED_REPOSITORY]: async (job) => {
    console.log("Processing embedding job", {
      jobId: job.id,
      repositoryId: job.data.repositoryId,
      userId: job.data.userId,
      attemptsMade: job.attemptsMade
    });

    try {
      const result = await withTimeout(
        generateEmbeddingsForRepository(job.data, async (progress) => {
          try {
            await job.updateProgress(progress);
          } catch {
            // ignore progress update failures
          }
        }),
        60000
      ); // 60s timeout

      await job.updateProgress({
        processedChunks: result.processedChunks + result.failedChunks,
        remainingChunks: result.remainingChunks
      });

      console.log("Embedding job completed", {
        jobId: job.id,
        repositoryId: result.repositoryId,
        userId: job.data.userId,
        processedChunks: result.processedChunks,
        failedChunks: result.failedChunks,
        remainingChunks: result.remainingChunks
      });
    } 
    catch (error) {
      console.error("Embedding job error", {
        jobId: job.id,
        repositoryId: job.data.repositoryId,
        userId: job.data.userId,
        error: error instanceof Error ? error.message : error
      });
      throw error; // IMPORTANT → so BullMQ retries
    }
  }
};

const worker = new Worker<RagJobPayload>(
  QUEUE_NAME,
  async (job) => {
    const jobName = job.name as JobName;

    if (!(jobName in handlers)) {
      throw new Error(`No handler for job: ${job.name}`);
    }

    await handlers[jobName](job as any); // safe due to runtime check
  },
  {
    connection: bullmqConnection,
    concurrency: 1 // concurrency means how many jobs can be processed in parallel by this worker instance.
  }
);

worker.on("completed", (job) => {
  console.log("Job completed", {
    jobId: job.id,
    name: job.name
  });
});

worker.on("failed", (job, error) => {
  console.error("Job failed", {
    jobId: job?.id ?? null,
    name: job?.name ?? null,
    error: error.message
  });
});

worker.on("stalled", (jobId) => {
  console.warn("Job stalled", { jobId });
});

worker.on("error", (error) => {
  console.error("Worker error", error);
});

let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("Shutting down worker...");

  try {
    await worker.close();
  } catch (err) {
    console.error("Error closing worker:", err);
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);