import { jobQueue } from "../../queues/queue.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";

type JobStatus = "pending" | "processing" | "completed" | "failed";

const STATE_STATUS_MAP: Record<string, JobStatus> = {
  waiting: "pending",
  delayed: "pending",
  paused: "pending",
  active: "processing",
  completed: "completed",
  failed: "failed"
};

function mapStateToStatus(state: string): JobStatus {
  return STATE_STATUS_MAP[state] ?? "pending";
}

export const streamJobStatusController = asyncHandler(async (req, res) => {
  const jobIdParam = req.params.jobId;

  const jobId = Array.isArray(jobIdParam)
    ? jobIdParam[0]
    : jobIdParam;

  if (!jobId) {
    throw new ApiError(400, "jobId is required");
  }

  const initialJob = await jobQueue.getJob(jobId);

  if (!initialJob) {
    throw new ApiError(404, "Job not found");
  }

  const ownerId = (initialJob.data as { userId?: string }).userId;
  if (!ownerId || ownerId !== req.user.id) {
    throw new ApiError(403, "Unauthorized: Job does not belong to user");
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders?.();

  const send = (data: unknown) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let closed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const heartbeat = setInterval(() => {
    if (!closed) {
      res.write(": keep-alive\n\n");
    }
  }, 15000);

  const end = () => {
    if (closed) return;
    closed = true;
    if (timeout) clearTimeout(timeout);
    if (heartbeat) clearInterval(heartbeat);
    res.end();
  };

  const poll = async () => {
    if (closed) return;

    try {
      const job = await jobQueue.getJob(jobId);

      if (!job) {
        send({ error: "Job not found" });
        return end();
      }

      const state = await job.getState();
      const status = mapStateToStatus(state);

      send({
        id: String(job.id),
        name: job.name,
        status,
        state,
        progress: job.progress ?? null,
        failedReason: job.failedReason ?? null,
        returnValue: job.returnvalue ?? null
      });

      if (state === "completed" || state === "failed") {
        return end();
      }
    } catch {
      send({ error: "Failed to read job status" });
      return end();
    }

    timeout = setTimeout(poll, 1000);
  };

  void poll();

  req.on("close", end);
});