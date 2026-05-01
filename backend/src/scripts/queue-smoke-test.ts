import { redis } from "../lib/redis.js";
import { enqueueTestJob, jobQueue } from "../queues/queue.js";

async function main() {
  const job = await enqueueTestJob("hello from queue smoke test");

  console.log({
    jobId: job.id,
    name: job.name
  });
}

main()
  .catch((error) => {
    console.error("Queue smoke test failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await jobQueue.close();
    await redis.quit();
  });
