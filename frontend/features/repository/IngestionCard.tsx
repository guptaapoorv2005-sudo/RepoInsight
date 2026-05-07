"use client";

import type { ComponentPropsWithoutRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
  completed: boolean;
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
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      repoUrl: "",
      title: ""
    }
  });

  const isBusy = isSubmitting || Boolean(progress && !progress.failed && !progress.completed);

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
      className="pointer-events-auto w-full max-w-lg rounded-2xl glass-strong p-6 shadow-elevated"
    >
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Start a new chat
        </h2>
        <p className="text-xs text-muted-foreground">
          Point at any public repository — we'll index it for you.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!progress || progress.completed || progress.failed ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <Field
              label="Chat title"
              placeholder="My weekend exploration"
              disabled={isBusy}
              {...register("title")}
            />
            <Field
              label="Repository URL"
              placeholder="https://github.com/owner/repo"
              disabled={isBusy}
              {...register("repoUrl")}
            />

            {errors.repoUrl ? (
              <p className="text-xs text-destructive">{errors.repoUrl.message}</p>
            ) : null}
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={isBusy || !watch("repoUrl")?.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-medium text-brand-foreground shadow-soft transition-all hover:shadow-glow disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Begin ingestion" : "Begin ingestion"}
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-border bg-surface-1 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="uppercase tracking-wider">
                  {progress.failed
                    ? "error"
                    : progress.indeterminate
                      ? "preparing"
                      : "indexing"}
                </span>
                {!progress.indeterminate && total > 0 ? (
                  <span className="tabular-nums">{percent}%</span>
                ) : null}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="h-full rounded-full bg-gradient-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0.24, 1] }}
                />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={percent}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="mt-3 text-sm text-foreground"
                >
                  {total > 0
                    ? `${processed} processed · ${Math.max(remaining, 0)} remaining`
                    : "Warming up indexing jobs"}
                </motion.p>
              </AnimatePresence>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Chat will unlock automatically when ingestion completes.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type FieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  icon?: React.ReactNode;
};

function Field({ label, icon, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2.5 transition-colors focus-within:border-(--lovable-brand) focus-within:ring-2 focus-within:ring-(--lovable-ring)">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <input
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          {...props}
        />
      </div>
    </label>
  );
}
