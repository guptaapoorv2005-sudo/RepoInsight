"use client";

import React, {
  useMemo,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Settings,
  LogOut,
} from "lucide-react";

import {
  useMessages,
  useSendMessage,
} from "@/features/chat/chat.hooks";

import type {
  Chat,
  Message,
} from "@/types/chat";

import {
  MessageBubble,
  TypingBubble,
} from "@/features/chat/MessageBubble";

import { MessageInput } from "@/features/chat/MessageInput";

import { useAutoScroll } from "@/lib/hooks/useAutoScroll";

const typingMessage: Message = {
  id: "typing-indicator",
  chatId: "pending",
  role: "assistant",
  content: "",
  createdAt: new Date().toISOString(),
};

type ChatWindowProps = {
  chat: Chat | null;
  locked: boolean;
  onNewChat?: () => void;
};

export function ChatWindow({
  chat,
  locked,
  onNewChat,
}: ChatWindowProps) {
  const [draft, setDraft] =
    useState("");

  const [
    pendingUserMessage,
    setPendingUserMessage,
  ] = useState<Message | null>(
    null
  );

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const { data, isLoading } =
    useMessages(chat?.id ?? null);

  const messages =
    data?.messages ?? [];

  const sendMutation =
    useSendMessage(chat?.id ?? "");

  const scrollRef =
    useAutoScroll([
      messages.length,
      pendingUserMessage,
      sendMutation.isPending,
    ]);

  const displayedMessages =
    useMemo(() => {
      if (!chat) return [];

      const list = [...messages];

      if (pendingUserMessage)
        list.push(
          pendingUserMessage
        );

      if (
        sendMutation.isPending
      )
        list.push(
          typingMessage
        );

      return list;
    }, [
      chat,
      messages,
      pendingUserMessage,
      sendMutation.isPending,
    ]);

  const handleSend =
    async () => {
      if (
        !chat ||
        locked ||
        !draft.trim() ||
        sendMutation.isPending
      )
        return;

      const question =
        draft.trim();

      setPendingUserMessage({
        id:
          "pending-user-" +
          Date.now(),
        chatId: chat.id,
        role: "user",
        content: question,
        createdAt:
          new Date().toISOString(),
      });

      setDraft("");
      setCompletionError(null);

      try {
        await sendMutation.mutateAsync(
          {
            question,
          }
        );
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ) {
          setCompletionError((error as { message: string }).message);
        } else {
          setCompletionError(
            "Something went wrong while generating a response."
          );
        }
      } finally {
        setPendingUserMessage(
          null
        );
      }
    };

  const emptyTitle = chat
    ? `Chat with ${
        chat.title?.trim() ||
        "your repository"
      }`
    : "Chat with your repository";

  const emptySubtitle = chat
    ? "Understand architecture, APIs, authentication, flows, and repository intelligence using AI-powered conversations."
    : "Create a new repository conversation to begin exploring your codebase.";

  return (
    <>
      <div className="relative flex h-full w-full flex-col overflow-hidden">

        {/* PROFILE */}
        <div className="absolute right-6 top-5 z-30">
          <button
            onClick={() =>
              setProfileOpen(
                !profileOpen
              )
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-green-400 text-sm font-semibold text-black shadow-lg transition-all hover:scale-105"
          >
            Y
          </button>

          <AnimatePresence>
            {profileOpen ? (
              <motion.div
                initial={{
                  opacity: 0,
                  y: 10,
                  scale: 0.96,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  scale: 0.96,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] shadow-2xl backdrop-blur-xl"
              >
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-sm font-semibold text-white">
                    You
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    you@gmail.com
                  </p>
                </div>

                <div className="p-2">
                  <button
                    onClick={() =>
                      setSettingsOpen(
                        true
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-zinc-300 transition-all hover:bg-white/5 hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>

                  <button
                    onClick={() => {
                      window.location.href =
                        "/";
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-red-400 transition-all hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">

          <div className="absolute left-[10%] top-[10%] h-80 w-80 rounded-full bg-green-500/10 blur-3xl" />

          <div className="absolute bottom-[5%] right-[8%] h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
        </div>

        <div
  ref={scrollRef as React.RefObject<HTMLDivElement>}
  className="scrollbar-thin relative z-10 h-full overflow-y-auto"
>
          <div className="mx-auto flex max-w-5xl flex-col px-6 py-10">

            <AnimatePresence initial={false}>

              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  className="text-sm text-zinc-500"
                >
                  Loading messages...
                </motion.div>
              ) : displayedMessages.length ===
                  0 &&
                !sendMutation.isPending ? (
                <motion.div
                  key="empty"
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
                  }}
                  className="relative flex min-h-[80vh] items-center justify-center"
                >

                  <div className="mx-auto flex w-full max-w-4xl flex-col items-center">

                    <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">

                      <svg
                        width="34"
                        height="34"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-green-400"
                      >
                        <path
                          d="M9 18L15 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />

                        <path
                          d="M5 8L2 12L5 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />

                        <path
                          d="M19 8L22 12L19 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <h1 className="max-w-3xl text-center text-5xl font-semibold leading-tight text-white">

                      {emptyTitle}
                    </h1>

                    <p className="mt-5 max-w-2xl text-center text-base leading-8 text-zinc-400">

                      {emptySubtitle}
                    </p>

                    <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">

                      {[
                        "Summarize the project structure",
                        "Where is authentication handled?",
                        "Explain the API architecture",
                        "Trace the repository data flow",
                      ].map(
                        (
                          prompt,
                          index
                        ) => (
                          <motion.div
                            key={prompt}
                            initial={{
                              opacity: 0,
                              y: 18,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            transition={{
                              delay:
                                index *
                                0.08,
                            }}
                            className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-5 backdrop-blur-xl transition-all duration-300 hover:border-green-400/20 hover:bg-white/10"
                          >

                            <div className="relative z-10">

                              <p className="text-sm font-medium text-white">
                                {
                                  prompt
                                }
                              </p>

                              <p className="mt-2 text-xs leading-6 text-zinc-500">
                                Explore repository intelligence with AI assistance.
                              </p>
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                displayedMessages.map(
                  (
                    message,
                    index
                  ) =>
                    message.id ===
                    "typing-indicator" ? (
                      <TypingBubble
                        key={
                          message.id
                        }
                      />
                    ) : (
                      <MessageBubble
                        key={
                          message.id
                        }
                        message={
                          message
                        }
                        index={
                          index
                        }
                      />
                    )
                )
              )}
            </AnimatePresence>
          </div>
        </div>

        {chat ? (
          <div className="relative z-10">
            {completionError ? (
              <div className="mx-auto mb-3 flex max-w-3xl items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 shadow-lg backdrop-blur-xl">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-300" />
                <p>{completionError}</p>
              </div>
            ) : null}

            <MessageInput
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
              isSending={
                sendMutation.isPending
              }
              disabled={
                locked ||
                sendMutation.isPending
              }
              placeholder={
                locked
                  ? "Ingestion in progress..."
                  : "Ask anything about the repository..."
              }
            />
          </div>
        ) : (
          <div className="relative z-10 px-6 pb-8">

            <button
              type="button"
              onClick={onNewChat}
              className="mx-auto block rounded-2xl bg-green-400 px-6 py-3 text-sm font-semibold text-black shadow-lg transition-all hover:brightness-110"
            >
              + New Chat
            </button>
          </div>
        )}
      </div>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {settingsOpen ? (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 20,
              }}
              transition={{
                duration: 0.22,
              }}
              className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] p-8 shadow-2xl backdrop-blur-xl"
            >
              <button
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
                className="absolute right-6 top-5 text-zinc-500 transition-colors hover:text-white"
              >
                ✕
              </button>

              <h2 className="text-4xl font-semibold text-white">
                Settings
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Manage your account.
              </p>

              <div className="mt-10 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Current password
                  </label>

                  <input
                    type="password"
                    placeholder="••••••••"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-5 text-sm text-white outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    New password
                  </label>

                  <input
                    type="password"
                    placeholder="••••••••"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-5 text-sm text-white outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Confirm new password
                  </label>

                  <input
                    type="password"
                    placeholder="••••••••"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-5 text-sm text-white outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>

                <button
                  className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-green-400 text-[15px] font-semibold text-black shadow-lg transition-all hover:brightness-110"
                >
                  Save changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}