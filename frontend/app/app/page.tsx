"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChatSidebar } from "@/features/chat/ChatSidebar";
import { ChatWindow } from "@/features/chat/ChatWindow";
import { IngestionCard } from "@/features/repository/IngestionCard";
import { useChats, useCreateChat, useDeleteChat } from "@/features/chat/chat.hooks";
import { useIngestRepository } from "@/features/repository/repository.hooks";
import { useJobProgress } from "@/features/repository/useJobProgress";
import { useCurrentUser, useLogout } from "@/features/auth/auth.hooks";
import { UserMenu } from "@/features/auth/UserMenu";
import { SettingsModal } from "@/features/auth/SettingsModal";
import { Spinner } from "@/components/ui/Spinner";

export default function AppPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser();
  const { data: chatData, isLoading: chatsLoading } = useChats(Boolean(user));

  const createChat = useCreateChat();
  const deleteChat = useDeleteChat();
  const ingestRepo = useIngestRepository();
  const logout = useLogout();

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isNewChat, setIsNewChat] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ingestionState, setIngestionState] = useState<{
    jobIds: string[];
    totalChunks: number | null;
  } | null>(null);

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
    ? progress.allCompleted && !progress.anyFailed
    : Boolean(activeChatId);

  const showIngestion = isNewChat || (ingestionState && !progress.allCompleted);
  const isIndexing = Boolean(ingestionState) && !progress.allCompleted && !progress.anyFailed;

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
    setIsNewChat(true);
    setActiveChatId(null);
    setIngestionState(null);
  };

  const handleSelectChat = (chatId: string) => {
    setIsNewChat(false);
    setActiveChatId(chatId);
    setIngestionState(null);
  };

  const handleDeleteChat = async (chatId: string) => {
    const confirmed = window.confirm("Delete this chat? This cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteChat.mutateAsync({ chatId });
      if (activeChatId === chatId) {
        setActiveChatId(null);
        setIsNewChat(true);
      }
    } catch {
      // errors handled via mutation state
    }
  };

  const handleCreateChat = async (values: { repoUrl: string; title?: string }) => {
    try {
      setIngestionState(null);
      const ingestResult = await ingestRepo.mutateAsync({
        repoUrl: values.repoUrl.trim()
      });

      setIngestionState({
        jobIds: ingestResult.persistence.embeddingJobIds,
        totalChunks: ingestResult.chunking.totalChunks
      });

      const chat = await createChat.mutateAsync({
        repositoryId: ingestResult.persistence.repositoryId,
        title: values.title?.trim() || null
      });

      setActiveChatId(chat.id);
      setIsNewChat(false);
    } catch {
      // errors handled via mutation state
    }
  };

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } finally {
      router.replace("/");
    }
  };

  const headerTitle = showIngestion
    ? "Repository ingestion"
    : activeChat?.title?.trim() || "Untitled chat";

  const headerSubtitle = showIngestion ? "Repository setup" : "Chat";

  if (userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-bg">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        isLoading={chatsLoading}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      <motion.main
        className="relative flex h-screen flex-1 flex-col pl-64 bg-surface-muted"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <header className="relative z-40 flex items-center justify-between border-b border-border bg-surface px-8 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              {headerSubtitle}
            </p>
            <h1 className="text-lg font-semibold text-ink font-display">
              {headerTitle}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {isIndexing ? (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Spinner size="sm" className="border-accent/20 border-t-accent" />
                Indexing repository...
              </div>
            ) : null}
            <UserMenu
              user={user}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={handleLogout}
              isLoggingOut={logout.isPending}
            />
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <AnimatePresence mode="wait">
            {showIngestion ? (
              <motion.div
                key="ingestion"
                className="absolute inset-0 flex items-center justify-center px-6 py-10 pointer-events-none"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <IngestionCard
                  onSubmit={handleCreateChat}
                  isSubmitting={ingestRepo.isPending || createChat.isPending}
                  error={ingestRepo.error?.message ?? createChat.error?.message}
                  progress={
                    ingestionState
                      ? {
                          processed: progress.processed,
                          remaining: progress.remaining,
                          total: progress.total,
                          indeterminate: progress.indeterminate,
                          failed: progress.anyFailed
                        }
                      : null
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                className="flex min-h-0 flex-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChatWindow chat={activeChat} locked={!repoReady} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </motion.main>
    </div>
  );
}
