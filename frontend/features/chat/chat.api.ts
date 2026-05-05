import { apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { Chat, CompletionResult, Message } from "@/types/chat";

type ChatListResponse = {
  chats: Chat[];
  nextCursor: string | null;
};

type MessageListResponse = {
  messages: Message[];
  nextCursor: string | null;
};

export function fetchChats(limit = 50) {
  return apiGet<ChatListResponse>("/chat", { params: { limit } });
}

export function createChat(input: { repositoryId: string; title?: string | null }) {
  return apiPost<Chat>("/chat", input);
}

export function fetchMessages(chatId: string, limit = 100) {
  return apiGet<MessageListResponse>(`/chat/${chatId}/messages`, {
    params: { limit }
  });
}

export function sendChatMessage(input: { chatId: string; question: string }) {
  return apiPost<CompletionResult>("/completions/query", input);
}

export function deleteChat(chatId: string) {
  return apiDelete<Chat>(`/chat/${chatId}`);
}
