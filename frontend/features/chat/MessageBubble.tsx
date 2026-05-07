"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";

type MessageBubbleProps = {
  message: Message;
};

export function MessageBubble({ message, index }: MessageBubbleProps & { index: number }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.02, 0.12),
        ease: [0.32, 0.72, 0.24, 1]
      }}
      className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "prose-chat max-w-[78%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed shadow-soft",
          isUser ? "bg-gradient-brand text-brand-foreground" : "bg-surface-2 text-foreground"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        )}
      </div>

      {isUser ? (
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 ring-1 ring-border">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      ) : null}
    </motion.div>
  );
}

export function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex items-center gap-1.5 rounded-2xl bg-surface-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-foreground/60"
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
