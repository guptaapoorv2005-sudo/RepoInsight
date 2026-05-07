"use client";

import { motion } from "framer-motion";
import { GitBranch, Search, Sparkles, Zap } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";

export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-aurora lg:flex lg:flex-col lg:justify-between lg:p-10">
        <motion.div
          aria-hidden
          className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-brand/20 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute -right-20 bottom-10 rounded-full bg-brand-glow/15 blur-3xl"
          style={{ width: "28rem", height: "28rem" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10">
          <BrandMark />
        </div>

        <div className="relative z-10 max-w-md">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground"
          >
            Talk to any codebase
            <span className="block text-gradient-brand">like it's a colleague.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            Drop a repo, get instant context. Trace functions, summarize folders,
            and understand systems in minutes — not days.
          </motion.p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { icon: GitBranch, label: "Any public repo" },
              { icon: Search, label: "Semantic search" },
              { icon: Zap, label: "Streaming answers" },
              { icon: Sparkles, label: "Premium models" }
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.06 }}
                className="flex items-center gap-2 rounded-xl border border-border bg-surface-1/50 px-3 py-2 text-sm text-foreground/90 backdrop-blur"
              >
                <item.icon className="h-3.5 w-3.5 text-brand" />
                <span>{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} RepoInsight — built for curious engineers.
        </div>
      </div>

      <div className="relative flex items-center justify-center bg-aurora p-6 lg:bg-background">
        <div className="absolute left-6 top-6 lg:hidden">
          <BrandMark />
        </div>
        {children}
      </div>
    </div>
  );
}
