import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-all duration-200 hover:bg-hover focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
