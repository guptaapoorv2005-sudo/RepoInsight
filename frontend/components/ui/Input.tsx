import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "lovable";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClassName =
      variant === "lovable"
        ? "rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[color:var(--lovable-brand)] focus:ring-2 focus:ring-[color:var(--lovable-ring)]"
        : "rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink hover:bg-hover focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-muted";
    return (
      <input
        ref={ref}
        className={cn(
          "w-full outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
          variantClassName,
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
