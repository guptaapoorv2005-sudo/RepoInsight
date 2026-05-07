"use client";

import { useState } from "react";

import { ChatSidebar } from "@/features/chat/ChatSidebar";

import { ChatWindow } from "@/features/chat/ChatWindow";

import { NewChatModal } from "@/features/chat/NewChatModal";

import type { Chat } from "@/types/chat";

const initialChats: Chat[] = [
  {
    id: "1",
    userId: "dev-user",
    repositoryId: "dev-repo",
    title: "Authentication Architecture",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "2",
    userId: "dev-user",
    repositoryId: "dev-repo",
    title: "API Flow Analysis",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "3",
    userId: "dev-user",
    repositoryId: "dev-repo",
    title: "Repository Structure",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
];

export default function DevPage() {
  const [chats, setChats] =
    useState(initialChats);

  const [
    activeChatId,
    setActiveChatId,
  ] = useState("1");

  const [open, setOpen] =
    useState(false);

  const activeChat =
    chats.find(
      (chat) =>
        chat.id === activeChatId
    ) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-white">

      <ChatSidebar
        chats={chats}
        activeChatId={
          activeChatId
        }
        isLoading={false}

        onNewChat={() =>
          setOpen(true)
        }

        onSelectChat={(id) =>
          setActiveChatId(id)
        }

        onDeleteChat={(id) => {
          setChats((prev) =>
            prev.filter(
              (chat) =>
                chat.id !== id
            )
          );

          if (
            activeChatId === id
          ) {
            setActiveChatId(
              chats[0]?.id ?? ""
            );
          }
        }}
      />

      <div className="flex flex-1 flex-col">
        <ChatWindow
          chat={activeChat}
          locked={false}
        />
      </div>

      <NewChatModal
        open={open}
        onClose={() =>
          setOpen(false)
        }
      />
    </div>
  );
}