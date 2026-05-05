"use client";

import { motion } from "framer-motion";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";

const schema = z.object({
  repoUrl: z.string().url("Enter a valid repository URL"),
  title: z.string().max(80, "Keep the title under 80 characters").optional()
});

type FormValues = z.infer<typeof schema>;

type IngestionProgress = {
  processed: number;
  remaining: number;
  total: number | null;
  indeterminate: boolean;
  failed: boolean;
};

type IngestionCardProps = {
  onSubmit: (values: FormValues) => void;
  isSubmitting: boolean;
  error?: string | null;
  progress?: IngestionProgress | null;
};

export function IngestionCard({ onSubmit, isSubmitting, error, progress }: IngestionCardProps) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      repoUrl: "",
      title: ""
    }
  });

  const isBusy = isSubmitting || Boolean(progress && !progress.failed);

  const total = progress?.total ?? 0;
  const processed = progress?.processed ?? 0;
  const remaining = progress?.remaining ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-surface p-8 shadow-xl"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
          Start a new chat
        </p>
        <h2 className="text-2xl font-semibold text-ink font-display">Start a new chat</h2>
        <p className="text-sm text-muted">
          Paste a GitHub repository URL, name the conversation, and we will build an
          index before you can chat.
        </p>
      </div>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">Repository URL</label>
          <Input
            placeholder="https://github.com/org/repo"
            {...register("repoUrl")}
            disabled={isBusy}
          />
          {errors.repoUrl ? (
            <p className="text-xs text-red-400">{errors.repoUrl.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">Chat title (optional)</label>
          <Input
            placeholder="Payments architecture review"
            {...register("title")}
            disabled={isBusy}
          />
          {errors.title ? (
            <p className="text-xs text-red-400">{errors.title.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {progress ? (
          <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-medium text-ink">
                {progress.failed
                  ? "Embedding failed"
                  : progress.indeterminate
                    ? "Preparing repository"
                    : "Indexing repository"}
              </span>
              {!progress.indeterminate && total > 0 ? (
                <span>{percent}%</span>
              ) : null}
            </div>
            <ProgressBar
              value={processed}
              max={total || 1}
              indeterminate={progress.indeterminate}
              className={cn(progress.failed ? "bg-red-900/40" : null)}
            />
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {total > 0
                  ? `${processed} processed · ${Math.max(remaining, 0)} remaining`
                  : "Warming up indexing jobs"}
              </span>
              <span className="text-ink">
                {progress.failed ? "Try again" : "Do not close this tab"}
              </span>
            </div>
          </div>
        ) : null}

        <Button type="submit" size="lg" isLoading={isSubmitting} disabled={isBusy} className="w-full">
          {progress?.failed ? "Try Again" : isSubmitting ? "Creating chat" : "Create Chat"}
        </Button>
      </form>
    </motion.div>
  );
}
