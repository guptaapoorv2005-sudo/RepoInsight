"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";
import type { JobEvent, JobProgress, JobStatus } from "@/types/job";

type JobState = {
  status: JobStatus;
  progress: JobProgress | null;
  failedReason?: string | null;
};

export function useJobProgress(jobIds: string[], totalChunks: number | null) {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});

  useEffect(() => {
    if (jobIds.length === 0) return;

    const sources = jobIds.map((jobId) => {
      const source = new EventSource(`${API_BASE_URL}/jobs/${jobId}`, {
        withCredentials: true
      });

      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as JobEvent;
          setJobs((prev) => ({
            ...prev,
            [jobId]: {
              status: data.status,
              progress: data.progress ?? null,
              failedReason: data.failedReason ?? null
            }
          }));
        } catch {
          // ignore malformed events
        }
      };

      source.onerror = () => {
        source.close();
      };

      return source;
    });

    return () => {
      sources.forEach((source) => source.close());
    };
  }, [jobIds.join("|")]);

  const summary = useMemo(() => {
    const entries = jobIds.map((id) => jobs[id]).filter(Boolean);

    const processed = entries.reduce(
      (sum, item) => sum + (item?.progress?.processedChunks ?? 0),
      0
    );

    const remaining = entries.reduce(
      (sum, item) => sum + (item?.progress?.remainingChunks ?? 0),
      0
    );

    const total = totalChunks ?? processed + remaining;

    const derivedComplete = total > 0 && remaining === 0 && processed >= total;

    const allCompleted =
      derivedComplete ||
      (jobIds.length > 0 && jobIds.every((id) => jobs[id]?.status === "completed"));

    const anyFailed = jobIds.some((id) => jobs[id]?.status === "failed");

    const indeterminate = total === 0 && processed === 0 && remaining === 0 && jobIds.length > 0;

    return {
      processed,
      remaining,
      total,
      allCompleted,
      anyFailed,
      indeterminate
    };
  }, [jobs, jobIds, totalChunks]);

  return summary;
}
