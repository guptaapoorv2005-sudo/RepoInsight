import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

export type MessageRole = "user" | "assistant";

type CreateMessageInput = {
  chatId: string;
  role: MessageRole;
  content: string;
};

type ListMessagesInput = {
  chatId: string;
  limit: number;
  cursor?: string;
};

export async function createMessage(input: CreateMessageInput) {
  if (!input.chatId) {
    throw new ApiError(400, "chatId is required");
  }

  if (!input.content || !input.content.trim()) {
    throw new ApiError(400, "content is required");
  }

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        chatId: input.chatId,
        role: input.role,
        content: input.content
      }
    });

    await tx.chat.update({
      where: { id: input.chatId },
      data: { updatedAt: new Date() }
    });

    return message;
  });
}

export async function listMessagesForChat(input: ListMessagesInput) {
  if (!input.chatId) {
    throw new ApiError(400, "chatId is required");
  }

  const take = Math.max(1, input.limit);
  const messages = await prisma.message.findMany({
    where: { chatId: input.chatId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(input.cursor
      ? {
          cursor: { id: input.cursor },
          skip: 1
        }
      : {})
  });

  const hasMore = messages.length > take;
  const results = hasMore ? messages.slice(0, take) : messages;
  const nextCursor = hasMore ? results[results.length - 1]?.id ?? null : null;

  return {
    messages: results,
    nextCursor
  };
}

export async function getRecentMessagesForChat(chatId: string, limit: number) {
  if (!chatId) {
    throw new ApiError(400, "chatId is required");
  }

  const take = Math.max(1, limit);
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take
  });

  return messages
    .reverse()
    .map((message) => ({
      role: message.role as MessageRole,
      content: message.content
    }));
}
