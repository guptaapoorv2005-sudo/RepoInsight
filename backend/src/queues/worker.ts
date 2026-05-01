import { Job, Worker } from "bullmq";
import { bullmqConnection } from "../lib/redis-bullmq.js";
import { QUEUE_NAME, TestJobPayload } from "./queue.js";

const handlers: Record<string, (job: Job<any>) => Promise<void>> = {
  test: async (job: Job<TestJobPayload>) => {
    console.log("Processing job", {
      jobId: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade
    });

    console.log("BullMQ test job received", {
      message: job.data.message
    });
  }
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const handler = handlers[job.name];

    if (!handler) {
      throw new Error(`No handler for job: ${job.name}`);
    }

    await handler(job);
  },
  {
    connection: bullmqConnection,
    concurrency: 5
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