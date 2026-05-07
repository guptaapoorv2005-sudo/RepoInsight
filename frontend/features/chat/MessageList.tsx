"use client";

import { useEffect, useRef } from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

import {
  MessageBubble,
  TypingBubble,
} from "@/features/chat/MessageBubble";

import type { Message } from "@/types/chat";

interface MessageListProps {
  messages: Message[];

  pending?: boolean;

  emptyTitle?: string;

  emptySubtitle?: string;
}

const prompts = [
  "Summarize the project structure",

  "Where is authentication handled?",

  "Explain the API architecture",

  "Trace the repository data flow",
];

export function MessageList({
  messages,
  pending,
  emptyTitle,
  emptySubtitle,
}: MessageListProps) {
  const endRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages.length, pending]);

  if (
    messages.length === 0 &&
    !pending
  ) {
    return (
      <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden px-6">

        {/* glow */}
        <div className="absolute left-[10%] top-[15%] h-[320px] w-[320px] rounded-full bg-[#22c55e]/10 blur-[140px]" />

        <div className="absolute bottom-[5%] right-[8%] h-[260px] w-[260px] rounded-full bg-[#84d44b]/10 blur-[140px]" />

        <motion.div
          initial={{
            opacity: 0,
            y: 24,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.6,
            ease: [
              0.22,
              1,
              0.36,
              1,
            ],
          }}
          className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center"
        >

          {/* icon */}
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">

            <Sparkles className="h-9 w-9 text-[#84d44b]" />
          </div>

          {/* title */}
          <h1 className="max-w-2xl text-center text-[52px] font-semibold leading-[1.02] tracking-[-0.05em] text-white">

            {emptyTitle ??
              "Chat with your repository"}
          </h1>

          {/* subtitle */}
          <p className="mt-5 max-w-2xl text-center text-[16px] leading-8 text-zinc-400">

            {emptySubtitle ??
              "Understand architecture, trace flows, inspect APIs, and explore your codebase with AI-powered conversations."}
          </p>

          {/* prompt cards */}
          <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">

            {prompts.map(
              (prompt, index) => (
                <motion.button
                  key={prompt}
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay:
                      index * 0.08,
                    duration: 0.45,
                  }}
                  className="group relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-white/[0.03] p-5 text-left backdrop-blur-xl transition-all duration-300 hover:border-[#84d44b]/20 hover:bg-white/[0.05]"
                >

                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,212,75,0.12),transparent_60%)]" />
                  </div>

                  <div className="relative z-10 flex items-start justify-between gap-4">

                    <div>

                      <p className="text-sm font-medium text-white">
                        {prompt}
                      </p>

                      <p className="mt-2 text-xs leading-6 text-zinc-500">
                        Explore repository intelligence with AI assistance.
                      </p>
                    </div>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500 transition-all group-hover:bg-[#84d44b]/15 group-hover:text-[#84d44b]">

                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                </motion.button>
              )
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">

        <AnimatePresence initial={false}>
          {messages.map(
            (message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                index={index}
              />
            )
          )}

          {pending ? (
            <TypingBubble key="typing" />
          ) : null}
        </AnimatePresence>

        <div ref={endRef} />
      </div>
    </div>
  );
}