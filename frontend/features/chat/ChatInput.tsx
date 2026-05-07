"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { motion } from "framer-motion";

import {
  ArrowUp,
} from "lucide-react";

interface ChatInputProps {
  onSend: (value: string) => void;

  disabled?: boolean;

  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder,
}: ChatInputProps) {
  const [value, setValue] =
    useState("");

  const ref =
    useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    element.style.height = "0px";

    element.style.height =
      Math.min(
        element.scrollHeight,
        220
      ) + "px";
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();

    if (!trimmed || disabled)
      return;

    onSend(trimmed);

    setValue("");
  };

  const onKey = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      submit();
    }
  };

  return (
    <div className="pointer-events-none sticky bottom-0 z-20 px-6 pb-6 pt-4">

      <div className="pointer-events-auto mx-auto w-full max-w-4xl">

        <motion.div
          initial={{
            y: 20,
            opacity: 0,
          }}
          animate={{
            y: 0,
            opacity: 1,
          }}
          transition={{
            duration: 0.45,
            ease: [
              0.22,
              1,
              0.36,
              1,
            ],
          }}
          className="group relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.04] shadow-[0_10px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-all duration-300 focus-within:border-[#84d44b]/20"
        >

          {/* glow */}
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,212,75,0.12),transparent_55%)]" />
          </div>

          <div className="relative z-10 flex items-end gap-4 p-4">

            <textarea
              ref={ref}
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(event) =>
                setValue(
                  event.target.value
                )
              }
              onKeyDown={onKey}
              placeholder={
                placeholder ??
                "Ask anything about the repository..."
              }
              className="max-h-[220px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-8 text-white placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
            />

            <motion.button
              whileHover={{
                scale: 1.04,
              }}
              whileTap={{
                scale: 0.94,
              }}
              onClick={submit}
              disabled={
                disabled ||
                !value.trim()
              }
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#84d44b] text-black shadow-[0_0_35px_rgba(132,212,75,0.28)] transition-all hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >

              <ArrowUp
                className="h-5 w-5"
                strokeWidth={2.8}
              />
            </motion.button>
          </div>
        </motion.div>

        <p className="mt-3 text-center text-[11px] text-zinc-500">

          Shift + Enter for newline
        </p>
      </div>
    </div>
  );
}