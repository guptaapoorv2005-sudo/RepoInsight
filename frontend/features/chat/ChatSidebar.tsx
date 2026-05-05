import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
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
  isLoading,
  onNewChat,
  onSelectChat,
  onDeleteChat
}: ChatSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold text-ink font-display">RepoInsight</div>
        <Button variant="secondary" size="sm" onClick={onNewChat}>
          New Chat
        </Button>
      </div>

      <div className="px-6 pb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        Conversations
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : chats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-5 text-sm text-muted">
            No chats yet. Start one from the right panel.
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <motion.button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "group relative flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition",
                  isActive
                    ? "border-accent/60 bg-accent/20 text-ink"
                    : "border-border bg-surface-muted hover:border-accent/40 hover:bg-surface-muted/80"
                )}
              >
                <span className="text-sm font-medium text-ink">
                  {chat.title?.trim() || "Untitled chat"}
                </span>
                <span className="text-xs text-muted">Last updated {new Date(chat.updatedAt).toLocaleDateString()}</span>
                <span className="pointer-events-none absolute right-3 top-3 text-[11px] text-red-300/0 transition group-hover:text-red-300/80">
                  Delete
                </span>
                <span
                  className="absolute right-3 top-3 h-6 w-12"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteChat(chat.id);
                    }
                  }}
                />
              </motion.button>
            );
          })
        )}
      </div>
    </aside>
  );
}
