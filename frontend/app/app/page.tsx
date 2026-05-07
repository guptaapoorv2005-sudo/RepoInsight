"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChatSidebar } from "@/features/chat/ChatSidebar";
import { ChatInput } from "@/features/chat/ChatInput";
import { MessageList } from "@/features/chat/MessageList";
import { NewChatModal } from "@/features/chat/NewChatModal";
import { useChats, useCreateChat, useDeleteChat, useMessages, useSendMessage } from "@/features/chat/chat.hooks";
import { useIngestRepository } from "@/features/repository/repository.hooks";
import { useJobProgress } from "@/features/repository/useJobProgress";
import { useCurrentUser, useLogout } from "@/features/auth/auth.hooks";
import { SettingsModal } from "@/features/auth/SettingsModal";
import { Topbar } from "@/components/layout/Topbar";
import type { Message } from "@/types/chat";
import type { IngestRepositoryResult } from "@/types/ingestion";

export default function AppPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const { data: chatData, isLoading: chatsLoading } = useChats(Boolean(user));

  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const ingestRepo = useIngestRepository();
  const logout = useLogout();

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ingestionState, setIngestionState] = useState<{
    jobIds: string[];
    totalChunks: number | null;
  } | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null);

  const chats = chatData?.chats ?? [];
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId]
  );

  const progress = useJobProgress(
    ingestionState?.jobIds ?? [],
    ingestionState?.totalChunks ?? null
  );

  const repoReady = ingestionState
    ? progress.completed && !progress.failed
    : Boolean(activeChatId);

  const showIngestion = Boolean(ingestionState) && !progress.completed && !progress.failed;

  const { data: messagesData } = useMessages(activeChatId);
  const messages = messagesData?.messages ?? [];
  const sendMutation = useSendMessage(activeChatId ?? "");

  useEffect(() => {
    if (userError?.statusCode === 401) {
      router.replace("/");
    }
  }, [router, userError]);

  useEffect(() => {
    if (!user && !userLoading) {
      router.replace("/");
    }
  }, [user, userLoading, router]);

  const handleNewChat = () => {
    setNewOpen(true);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
  };

  const handleDeleteChat = async (chatId: string) => {
    const confirmed = window.confirm("Delete this chat? This cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteChat.mutateAsync({ chatId });
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    } catch {
      // errors handled via mutation state
    }
  };

  const handleCreateChat = async (values: { repoUrl: string; title?: string }): Promise<IngestRepositoryResult> => {
    try {
      setIngestionState(null);
      const ingestResult = await ingestRepo.mutateAsync({
        repoUrl: values.repoUrl.trim()
      });

      setIngestionState({
        jobIds: ingestResult.persistence.embeddingJobIds,
        totalChunks: ingestResult.chunking.totalChunks
      });
      setNewOpen(false);

      const chat = await createChat.mutateAsync({
        repositoryId: ingestResult.persistence.repositoryId,
        title: values.title?.trim() || null
      });

      setActiveChatId(chat.id);
      return ingestResult;
    } catch (error) {
      // Rethrow so NewChatModal can handle the error
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace("/");
    }
  };

  useEffect(() => {
    if (chatsLoading || chats.length > 0) return;
    const timeout = setTimeout(() => setNewOpen(true), 300);
    return () => clearTimeout(timeout);
  }, [chatsLoading, chats.length]);

  useEffect(() => {
    if (!activeChatId && chats.length > 0) setActiveChatId(chats[0].id);
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!ingestionState) return;

    if (progress.completed && !progress.failed) {
      setIngestionState(null);
    }
  }, [progress.completed, progress.failed]);

  const displayedMessages = useMemo(() => {
    if (!activeChatId) return [];
    const list = [...messages];
    if (pendingUserMessage) list.push(pendingUserMessage);
    return list;
  }, [activeChatId, messages, pendingUserMessage]);

  const handleSend = async (value: string) => {
    if (!activeChatId || !repoReady || sendMutation.isPending) return;

    setPendingUserMessage({
      id: "pending-user-" + Date.now(),
      chatId: activeChatId,
      role: "user",
      content: value,
      createdAt: new Date().toISOString()
    });

    try {
      await sendMutation.mutateAsync({ question: value });
    } finally {
      setPendingUserMessage(null);
    }
  };

  const progressEvent = ingestionState
    ? {
        stage: progress.anyFailed
          ? "error"
          : progress.allCompleted
            ? "complete"
            : progress.indeterminate
              ? "preparing"
              : "indexing",
        progress: progress.total
          ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
          : 0,
        message: progress.anyFailed
          ? "Ingestion failed."
          : progress.allCompleted
            ? "Repository indexed."
            : progress.indeterminate
              ? "Preparing repository..."
              : "Indexing repository..."
      }
    : null;

  if (userLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-aurora">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        isLoading={chatsLoading}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      <motion.main
        className="relative flex h-screen min-w-0 flex-1 flex-col bg-aurora"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0.24, 1] }}
      >
        <Topbar
          onOpenSettings={() => setSettingsOpen(true)}
          title={activeChat?.title?.trim() || "New conversation"}
          user={user}
          onLogout={handleLogout}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <MessageList
              messages={displayedMessages}
              pending={sendMutation.isPending}
              emptyTitle={
                activeChat
                  ? `Chatting with ${activeChat.title?.trim() || "this repository"}`
                  : "Start a new conversation"
              }
              emptySubtitle={
                activeChat
                  ? "Ask anything about this repository — architecture, files, functions, flows."
                  : "Create a new chat from a repo URL to begin."
              }
            />

            {!activeChat ? (
              <div className="px-6 pb-8">
                <button
                  onClick={() => setNewOpen(true)}
                  className="mx-auto block rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-brand-foreground shadow-glow transition-transform hover:-translate-y-0.5"
                >
                  + New chat
                </button>
              </div>
            ) : (
              <ChatInput
                disabled={!repoReady || sendMutation.isPending}
                placeholder={
                  !repoReady
                    ? "Ingestion in progress…"
                    : "Ask anything about the repository…"
                }
                onSend={handleSend}
              />
            )}
          </div>

          <NewChatModal
            open={newOpen || showIngestion}
            onClose={() => {
              setNewOpen(false);
              setIngestionState(null);
            }}
            onSubmit={handleCreateChat}
            isSubmitting={ingestRepo.isPending || createChat.isPending}
            error={ingestRepo.error?.message}
            progress={
              ingestionState
                ? {
                    processed: progress.processed,
                    remaining: progress.remaining,
                    total: progress.total,
                    indeterminate: progress.indeterminate,
                    failed: progress.failed,
                    completed: progress.completed
                  }
                : null
            }
          />
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </motion.main>
    </div>
  );
}
