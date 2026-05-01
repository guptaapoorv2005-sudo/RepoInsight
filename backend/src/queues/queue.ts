import { Queue } from "bullmq";
import { bullmqConnection } from "../lib/redis-bullmq.js";
import crypto from "crypto";

export const QUEUE_NAME = "rag-processing";

export type TestJobPayload = {
  message: string;
};

export const jobQueue = new Queue<TestJobPayload>(QUEUE_NAME, {
  connection: bullmqConnection
});

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000
  },
  removeOnComplete: true,
  removeOnFail: false
};

export async function enqueueTestJob(message: string) {
  const hash = crypto.createHash("md5").update(message).digest("hex");

  return jobQueue.add("test", { message }, {
    jobId: `test-${hash}`,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  });
}