"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";

import { BrandMark } from "@/components/layout/BrandMark";
import { cn } from "@/lib/utils";

import type { Chat } from "@/types/chat";

type ChatSidebarProps = {
  chats: Chat[];
  activeChatId: string | null;
  isLoading: boolean;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
};

export function ChatSidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: ChatSidebarProps) {
  return (
    <aside className="relative flex h-screen w-[290px] shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#071018]/80 backdrop-blur-2xl">

      {/* glow */}
      <div className="absolute left-[-120px] top-[-120px] h-[260px] w-[260px] rounded-full bg-[#22c55e]/10 blur-[120px]" />

      <div className="relative z-10 flex h-16 items-center px-6">
        <BrandMark />
      </div>

      {/* button */}
      <div className="relative z-10 px-4">

        <motion.button
          whileHover={{
            scale: 1.01,
            y: -1,
          }}
          whileTap={{
            scale: 0.985,
          }}
          onClick={onNewChat}
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#84d44b] text-sm font-semibold text-black shadow-[0_0_30px_rgba(132,212,75,0.18)] transition-all hover:brightness-110"
        >
          <Plus className="h-4 w-4" />

          New Chat
        </motion.button>
      </div>

      {/* recent */}
      <div className="relative z-10 mt-8 px-5 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
        Recent Chats
      </div>

      {/* chats */}
      <nav className="scrollbar-thin relative z-10 mt-3 flex-1 space-y-2 overflow-y-auto px-3 pb-5">

        <AnimatePresence initial={false}>

          {chats.length === 0 ? (
            <motion.div
              key="empty"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              className="px-3 py-10 text-center text-sm text-zinc-500"
            >
              No chats yet
            </motion.div>
          ) : (
            chats.map((chat) => {
              const active =
                chat.id === activeChatId;

              return (
                <motion.div
                  key={chat.id}
                  layout
                  initial={{
                    opacity: 0,
                    x: -10,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  exit={{
                    opacity: 0,
                    x: -10,
                  }}
                  transition={{
                    duration: 0.2,
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border transition-all duration-200",
                    active
                      ? "border-[#84d44b]/20 bg-white/[0.06] shadow-[0_0_30px_rgba(132,212,75,0.08)]"
                      : "border-transparent bg-white/[0.03] hover:bg-white/[0.05]"
                  )}
                >

                  {active && (
                    <motion.div
                      layoutId="active-chat"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#84d44b]"
                    />
                  )}

                  <div className="flex items-center gap-3 px-4 py-3">

                    <button
                      onClick={() =>
                        onSelectChat(chat.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          active
                            ? "bg-[#84d44b]/15 text-[#84d44b]"
                            : "bg-white/[0.04] text-zinc-400"
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            active
                              ? "text-white"
                              : "text-zinc-300"
                          )}
                        >
                          {chat.title?.trim() ||
                            "Untitled Chat"}
                        </p>

                        <p className="mt-0.5 text-xs text-zinc-500">
                          Repository discussion
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();

                        onDeleteChat(chat.id);
                      }}
                      className="opacity-0 transition-all group-hover:opacity-100"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </div>
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </nav>

      {/* footer */}
      <div className="relative z-10 border-t border-white/[0.06] p-4">

        <div className="rounded-2xl bg-white/[0.03] px-4 py-3">

          <p className="text-sm font-medium text-white">
            RepoInsight AI
          </p>

          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Analyze repositories with semantic AI conversations.
          </p>
        </div>
      </div>
    </aside>
  );
}