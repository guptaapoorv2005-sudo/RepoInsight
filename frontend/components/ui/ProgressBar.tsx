import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  max: number;
  indeterminate?: boolean;
  className?: string;
};

export function ProgressBar({ value, max, indeterminate, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-hover",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-linear-to-r from-accent to-accent-strong transition-all duration-200 ease-out",
          indeterminate ? "w-1/3 animate-progress" : null
        )}
        style={indeterminate ? undefined : { width: percent + "%" }}
      />
    </div>
  );
}
