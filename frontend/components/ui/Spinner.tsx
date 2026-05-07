import { cn } from "@/lib/utils";

type SpinnerProps = {
  size?: "sm" | "md";
  tone?: "default" | "lovable";
  className?: string;
};

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-[3px]"
};

export function Spinner({ size = "md", tone = "default", className }: SpinnerProps) {
  const toneClassName =
    tone === "lovable"
      ? "border-border/50 border-t-[color:var(--lovable-brand)]"
      : "border-accent/30 border-t-accent";
  return (
    <span
      className={cn(
        "inline-flex animate-spin rounded-full border",
        sizeMap[size],
        toneClassName,
        className
      )}
      aria-label="Loading"
    />
  );
}
