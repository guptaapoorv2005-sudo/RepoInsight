"use client";

import { useMemo, useState } from "react";
import { useMessages, useSendMessage } from "@/features/chat/chat.hooks";
import type { Chat, Message } from "@/types/chat";
import { MessageBubble } from "@/features/chat/MessageBubble";
import { MessageInput } from "@/features/chat/MessageInput";
import { useAutoScroll } from "@/lib/hooks/useAutoScroll";
import { Spinner } from "@/components/ui/Spinner";

const typingMessage: Message = {
  id: "typing-indicator",
  chatId: "pending",
  role: "assistant",
  content: "",
  createdAt: new Date().toISOString()
};

type ChatWindowProps = {
  chat: Chat | null;
  locked: boolean;
};

export function ChatWindow({ chat, locked }: ChatWindowProps) {
  const [draft, setDraft] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null);

  const { data, isLoading } = useMessages(chat?.id ?? null);
  const messages = data?.messages ?? [];

  const sendMutation = useSendMessage(chat?.id ?? "");
  const scrollRef = useAutoScroll([messages.length, pendingUserMessage, sendMutation.isPending]);

  const displayedMessages = useMemo(() => {
    if (!chat) return [];
    const list = [...messages];
    if (pendingUserMessage) list.push(pendingUserMessage);
    if (sendMutation.isPending) list.push(typingMessage);
    return list;
  }, [chat, messages, pendingUserMessage, sendMutation.isPending]);

  const handleSend = async () => {
    if (!chat || locked || !draft.trim() || sendMutation.isPending) return;
    const question = draft.trim();

    setPendingUserMessage({
      id: "pending-user-" + Date.now(),
      chatId: chat.id,
      role: "user",
      content: question,
      createdAt: new Date().toISOString()
    });

    setDraft("");

    try {
      await sendMutation.mutateAsync({ question });
    } finally {
      setPendingUserMessage(null);
    }
  };

  if (!chat) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="max-w-md text-center">
          <p className="text-base font-medium text-ink">Select a chat to begin</p>
          <p className="mt-3 text-sm text-muted">
            Choose a conversation on the left or start a new repository ingestion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-bg">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="w-full flex justify-center">
          <div className="flex w-full max-w-3xl flex-col gap-4 p-4">
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted">
                <Spinner size="sm" className="border-accent/20 border-t-accent" />
                Loading messages...
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted transition-all duration-200">
                Start by asking about your repository. We will respond with the most
                relevant context we can find.
              </div>
            ) : (
              displayedMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg px-52 py-3">
        <MessageInput
          value={draft}
          onChange={setDraft}
          onSend={handleSend}
          isSending={sendMutation.isPending}
          disabled={locked || sendMutation.isPending}
          placeholder={
            locked
              ? "Ingest a repository to unlock chat"
              : "Ask a question about the codebase"
          }
        />
      </div>
    </div>
  );
}
