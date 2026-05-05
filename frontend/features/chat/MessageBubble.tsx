import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";

type MessageBubbleProps = {
  message: Message;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-2xl border px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "border-accent/60 bg-accent text-white"
            : "border-border bg-surface-muted text-ink"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}
