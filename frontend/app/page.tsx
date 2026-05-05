"use client";

import { motion } from "framer-motion";
import { AuthCard } from "@/features/auth/AuthCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1fr]">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative flex flex-col justify-between overflow-hidden px-8 py-16 text-ink sm:px-12 lg:px-14 lg:pl-28"
        >
          <div className="absolute left-[-10%] top-[-20%] h-85 w-85 rounded-full bg-accent/20 blur-[160px]" />
          <div className="absolute bottom-[-12%] right-[-12%] h-65 w-65 rounded-full bg-accent-soft/70 blur-[180px]" />

          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.4em] text-muted">
              Developer intelligence
            </p>
            <h1 className="mt-6 text-5xl font-medium tracking-tight text-ink">
              RepoInsight
            </h1>
            <p className="mt-6 max-w-lg text-xl leading-relaxed text-muted">
              Chat with your codebase. Understand any repository instantly using AI.
            </p>
            <p className="mt-4 max-w-md text-sm text-muted">
              Secure ingestion, fast semantic search, and structured answers that help
              your team ship with confidence.
            </p>
          </div>

          <div className="relative z-10 flex flex-col gap-4 text-sm text-muted">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Index repositories once, ask anything.
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Track ingestion progress in real time.
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Keep conversations organized by repo.
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center justify-center px-6 py-12 lg:justify-start lg:px-8 lg:pl-36"
        >
          <AuthCard />
        </motion.section>
      </div>
    </div>
  );
}
