"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import type { User } from "@/types/auth";

interface TopbarProps {
  onOpenSettings: () => void;
  title?: string;
  user: User;
  onLogout: () => void;
}

export function Topbar({ onOpenSettings, title, user, onLogout }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (user.email ?? "U").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/70 px-5 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-medium text-foreground/90">
          {title ?? "New conversation"}
        </h1>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-sm font-semibold text-brand-foreground shadow-soft ring-1 ring-white/10 transition-transform hover:scale-105"
        >
          {initials}
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.32, 0.72, 0.24, 1] }}
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl glass-strong p-1.5 shadow-elevated"
            >
              <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {user.email.split("@")[0]}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
