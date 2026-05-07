"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";
import type { JobEvent, JobProgress, JobStatus } from "@/types/job";

type JobState = {
  status: JobStatus;
  progress: JobProgress | null;
  failedReason?: string | null;
};

type JobProgressSummary = {
  processed: number;
  remaining: number;
  total: number | null;
  allCompleted: boolean;
  anyFailed: boolean;
  indeterminate: boolean;
  completed: boolean;
  failed: boolean;
};

export function useJobProgress(jobIds: string[], totalChunks: number | null): JobProgressSummary {
  const [jobs, setJobs] = useState<Record<string, JobState>>({});
  const sourcesRef = useRef<Map<string, EventSource>>(new Map());
  const isClosedRef = useRef(false);

  // Memoize the job IDs key for dependency tracking
  const jobIdsKey = jobIds.join("|");

  useEffect(() => {
    // Capture the current sources to avoid issues in cleanup function
    const currentSources = sourcesRef.current;
    // Reset closed flag when jobIds change
    isClosedRef.current = false;

    if (jobIds.length === 0) {
      // Clean up any existing sources
      currentSources.forEach((source) => source.close());
      currentSources.clear();
      return;
    }

    // Create new sources for job IDs
    jobIds.forEach((jobId) => {
      // Skip if we already have this source
      if (currentSources.has(jobId)) {
        return;
      }

      const source = new EventSource(`${API_BASE_URL}/jobs/${jobId}`, {
        withCredentials: true
      });

      source.onmessage = (event) => {
        // Ignore messages if connection is closed
        if (isClosedRef.current) {
          return;
        }

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

          // Close source when job reaches terminal state
          if (data.status === "completed" || data.status === "failed") {
            source.close();
            currentSources.delete(jobId);
          }
        } catch {
          // ignore malformed events
        }
      };

      source.onerror = () => {
        source.close();
        currentSources.delete(jobId);
      };

      currentSources.set(jobId, source);
    });

    return () => {
      // Close all sources on cleanup
      currentSources.forEach((source) => source.close());
      currentSources.clear();
      isClosedRef.current = true;
    };
  }, [jobIdsKey, jobIds]);

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

    // Completion is derived from: processed >= total AND remaining === 0
    const allCompleted = total > 0 && remaining === 0 && processed >= total;

    // Failed is when any job has failed status
    const anyFailed = jobIds.some((id) => jobs[id]?.status === "failed");

    // Completion is driven primarily by the final progress numbers.
    const completed = allCompleted && !anyFailed;

    // Failed state
    const failed = anyFailed;

    const indeterminate =
      total === 0 && processed === 0 && remaining === 0 && jobIds.length > 0;

    return {
      processed,
      remaining,
      total,
      allCompleted,
      anyFailed,
      indeterminate,
      completed,
      failed
    };
  }, [jobs, jobIds, totalChunks]);

  return summary;
}
