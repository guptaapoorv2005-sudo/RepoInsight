import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";

type MessageBubbleProps = {
  message: Message;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isTyping = message.id === "typing-indicator";

  return (
    <motion.div
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-xl px-4 py-3 text-sm leading-relaxed transition-all duration-200",
          isUser ? "bg-accent text-white" : "bg-surface text-ink"
        )}
      >
        {isTyping ? (
          <span className="typing-dots text-muted" aria-label="Assistant is typing" />
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </motion.div>
  );
}
