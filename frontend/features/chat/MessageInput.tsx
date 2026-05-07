"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

type MessageInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  disabled: boolean;
  placeholder?: string;
};

export function MessageInput({
  value,
  onChange,
  onSend,
  isSending,
  disabled,
  placeholder
}: MessageInputProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!disabled) return;
    onChange("");
  }, [disabled, onChange]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  return (
    <div className="pointer-events-none sticky bottom-0 z-10 px-4 pb-5 pt-2">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0.24, 1] }}
          className="glass-strong group flex items-end gap-2 rounded-2xl p-2 shadow-elevated transition-shadow focus-within:shadow-glow"
        >
          <textarea
            ref={ref}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!disabled && value.trim()) {
                  onSend();
                }
              }
            }}
            placeholder={placeholder ?? "Ask anything about the repository…"}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={onSend}
            disabled={disabled || !value.trim() || isSending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow transition-opacity disabled:opacity-40 disabled:shadow-none"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.6} />
          </motion.button>
        </motion.div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          Shift + Enter for newline · responses are AI-generated
        </p>
      </div>
    </div>
  );
}
