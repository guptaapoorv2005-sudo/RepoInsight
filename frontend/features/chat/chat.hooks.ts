import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/types/api";
import {
  createChat,
  deleteChat,
  fetchChats,
  fetchMessages,
  sendChatMessage
} from "@/features/chat/chat.api";
import type { Chat, CompletionResult, Message } from "@/types/chat";

type ChatListResponse = { chats: Chat[]; nextCursor: string | null };

type MessageListResponse = { messages: Message[]; nextCursor: string | null };

export function useChats(enabled = true) {
  return useQuery<ChatListResponse, ApiError>({
    queryKey: ["chats"],
    queryFn: () => fetchChats(50),
    enabled
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation<Chat, ApiError, { repositoryId: string; title?: string | null }>(
    {
      mutationFn: createChat,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    }
  );
}

export function useMessages(chatId: string | null) {
  return useQuery<MessageListResponse, ApiError>({
    queryKey: ["messages", chatId],
    queryFn: () => fetchMessages(chatId ?? ""),
    enabled: Boolean(chatId)
  });
}

export function useSendMessage(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation<CompletionResult, ApiError, { question: string }>({
    mutationFn: ({ question }) => sendChatMessage({ chatId, question }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    }
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation<Chat, ApiError, { chatId: string }>({
    mutationFn: ({ chatId }) => deleteChat(chatId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.removeQueries({ queryKey: ["messages", variables.chatId] });
    }
  });
}
