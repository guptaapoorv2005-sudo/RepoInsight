"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@/types/auth";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  user: User;
  onOpenSettings: () => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
};

function getInitials(email: string) {
  const name = email.split("@")[0] || email;
  return name.slice(0, 2).toUpperCase();
}

export function UserMenu({
  user,
  onOpenSettings,
  onLogout,
  isLoggingOut
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const initials = getInitials(user.email);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!ref.current || !(event.target instanceof Node)) return;
      if (!ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative z-40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink transition-all duration-200 hover:border-accent/40 hover:bg-hover active:scale-95"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-xs text-accent">
          {initials}
        </span>
      </button>

      <div
        className={cn(
          "pointer-events-auto absolute right-0 mt-3 w-52 origin-top-right rounded-2xl border border-border/70 bg-surface/95 p-4 shadow-lg backdrop-blur transition-all duration-200",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
        style={{ zIndex: 60 }}
      >
        <div className="px-3 py-2 text-xs text-muted">Account</div>
        <div className="my-3 h-px bg-border" />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onOpenSettings();
          }}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink transition-all duration-200 hover:bg-hover"
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onLogout();
          }}
          disabled={isLoggingOut}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 transition-all duration-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
