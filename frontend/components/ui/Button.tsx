import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full border border-transparent font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white border border-accent/60 hover:bg-accent-strong shadow-[0_16px_40px_-28px_rgba(124,58,237,0.65)]",
  secondary:
    "bg-surface text-ink border-border hover:border-accent/60 hover:bg-surface-muted",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-muted"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Spinner size="sm" /> : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
