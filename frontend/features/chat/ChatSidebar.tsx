import { Trash2 } from "lucide-react";
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
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between p-4">
        <div className="text-sm font-medium text-ink">RepoInsight</div>
        <Button variant="secondary" size="sm" onClick={onNewChat}>
          New Chat
        </Button>
      </div>

      <div className="px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted">
        Conversations
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : chats.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-muted">
            No chats yet. Start one from the right panel.
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectChat(chat.id);
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200",
                  isActive
                    ? "border-accent/60 bg-accent/15 text-ink"
                    : "border-border bg-surface hover:border-accent/30 hover:bg-hover"
                )}
              >
                <span className="text-sm text-ink">
                  {chat.title?.trim() || "Untitled chat"}
                </span>
                <span className="text-xs text-muted">
                  Last updated {new Date(chat.updatedAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-300/0 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300 group-hover:text-red-300/80"
                  aria-label="Delete chat"
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
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
