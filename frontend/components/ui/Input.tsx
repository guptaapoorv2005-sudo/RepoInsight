import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm text-ink shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
