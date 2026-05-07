"use client";

import { useEffect, useState, type FormEvent } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { Loader2 } from "lucide-react";

import { Modal } from "@/components/ui/Modal";

import type { IngestRepositoryResult } from "@/types/ingestion";

type ProgressEvent = {
  processed: number;
  remaining: number;
  total: number | null;
  indeterminate: boolean;
  failed: boolean;
  completed: boolean;
};

type NewChatModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (values: { repoUrl: string; title?: string }) => Promise<IngestRepositoryResult>;
  isSubmitting?: boolean;
  error?: string | null;
  progress?: ProgressEvent | null;
};

export function NewChatModal({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  error: externalError,
  progress: externalProgress,
}: NewChatModalProps) {
  const [repoUrl, setRepoUrl] = useState("");

  const [title, setTitle] = useState("");

  const [loading, setLoading] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRepoUrl("");
      setTitle("");
      setLoading(false);
      setLocalError(null);
    }
  }, [open]);

  const isBusy = loading || isSubmitting || Boolean(externalProgress && !externalProgress.failed && !externalProgress.completed);

  const total = externalProgress?.total ?? 0;
  const processed = externalProgress?.processed ?? 0;
  const remaining = externalProgress?.remaining ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const displayProgress = externalProgress || null;

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();
    
    if (!repoUrl.trim()) {
      setLocalError("Repository URL is required");
      return;
    }

    if (!onSubmit) {
      setLocalError("Submit handler not configured");
      return;
    }

    setLoading(true);
    setLocalError(null);

    try {
      await onSubmit({
        repoUrl: repoUrl.trim(),
        title: title.trim() || undefined
      });
      
      // Parent component handles closing and state management
      setRepoUrl("");
      setTitle("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create chat";
      setLocalError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || externalError;

  return (
    <AnimatePresence>
      {open ? (
        <Modal
          open={open}
          onClose={onClose}
        >
          <motion.div
            initial={{
              opacity: 0,
              y: 24,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 12,
              scale: 0.96,
            }}
            transition={{
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#091018]/95 p-7 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
          >
            {/* glow */}
            <div className="absolute left-[-20%] top-[-20%] h-[260px] w-[260px] rounded-full bg-[#22c55e]/10 blur-[120px]" />

            <div className="relative z-10">
              {/* heading */}
              <div className="mb-7">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <div className="h-7 w-7 rounded-lg bg-[#84d44b]/20" />
                </div>

                <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-white">
                  Create new chat
                </h2>

                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Connect a repository and start exploring your codebase with AI.
                </p>
              </div>

              {/* form */}
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* repo url */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Repository URL
                  </label>

                  <input
                    value={repoUrl}
                    onChange={(e) =>
                      setRepoUrl(e.target.value)
                    }
                    placeholder="https://github.com/org/repo"
                    disabled={isBusy}
                    className="h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:border-[#84d44b]/30 focus:bg-white/[0.05] disabled:opacity-50"
                  />
                </div>

                {/* title */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Chat title (optional)
                  </label>

                  <input
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    placeholder="Authentication architecture"
                    disabled={isBusy}
                    className="h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:border-[#84d44b]/30 focus:bg-white/[0.05] disabled:opacity-50"
                  />
                </div>

                {/* progress */}
                {displayProgress && !displayProgress.completed && !displayProgress.failed ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider">
                      <span>
                        {displayProgress.indeterminate
                          ? "Preparing"
                          : "Processing repository"}
                      </span>

                      {!displayProgress.indeterminate && total > 0 ? (
                        <span className="tabular-nums">{percent}%</span>
                      ) : null}
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        className="h-full rounded-full bg-[#84d44b]"
                        animate={{
                          width: `${percent}%`,
                        }}
                        transition={{ duration: 0.5, ease: [0.32, 0.72, 0.24, 1] }}
                      />
                    </div>

                    {total > 0 && !displayProgress.indeterminate ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        {processed} processed · {Math.max(remaining, 0)} remaining
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* error message */}
                {displayError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                    <p className="text-xs text-red-400">{displayError}</p>
                  </div>
                ) : null}

                {/* buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isBusy}
                    className="h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isBusy || !repoUrl.trim()}
                    className="flex h-11 items-center gap-2 rounded-2xl bg-[#84d44b] px-5 text-sm font-semibold text-black shadow-[0_0_35px_rgba(132,212,75,0.24)] transition-all hover:brightness-110 disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}

                    {displayProgress && !displayProgress.completed ? "Processing..." : "Create Chat"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </Modal>
      ) : null}
    </AnimatePresence>
  );
}
