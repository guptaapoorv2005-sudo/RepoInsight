import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TagProps = {
  children: ReactNode;
  className?: string;
};

export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted transition-all duration-200",
        className
      )}
    >
      {children}
    </span>
  );
}
