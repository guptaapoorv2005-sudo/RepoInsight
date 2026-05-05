import { cn } from "@/lib/utils";

type SpinnerProps = {
  size?: "sm" | "md";
  className?: string;
};

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-[3px]"
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        "inline-flex animate-spin rounded-full border border-accent/30 border-t-accent",
        sizeMap[size],
        className
      )}
      aria-label="Loading"
    />
  );
}
