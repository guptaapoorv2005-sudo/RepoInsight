import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-11 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-all duration-200 hover:bg-hover focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
