import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

type CreateChatInput = {
  userId: string;
  repositoryId: string;
  title?: string | null;
};

type ListChatsInput = {
  userId: string;
  limit: number;
  cursor?: string;
};

export async function createChat(input: CreateChatInput) {
  if (!input.userId) {
    throw new ApiError(400, "userId is required");
  }

  if (!input.repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  const repository = await prisma.repository.findFirst({
    where: {
      id: input.repositoryId,
      userId: input.userId
    }
  });

  if (!repository) {
    throw new ApiError(403, "Unauthorized: Repository does not belong to user");
  }

  return prisma.chat.create({
    data: {
      userId: input.userId,
      repositoryId: input.repositoryId,
      title: input.title ?? null
    }
  });
}

export async function listChatsForUser(input: ListChatsInput) {
  if (!input.userId) {
    throw new ApiError(400, "userId is required");
  }

  const take = Math.max(1, input.limit);
  const chats = await prisma.chat.findMany({
    where: { userId: input.userId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(input.cursor
      ? {
          cursor: { id: input.cursor },
          skip: 1
        }
      : {})
  });

  const hasMore = chats.length > take;
  const results = hasMore ? chats.slice(0, take) : chats;
  const nextCursor = hasMore ? results[results.length - 1]?.id ?? null : null;

  return {
    chats: results,
    nextCursor
  };
}

export async function getChatForUser(userId: string, chatId: string) {
  if (!userId) {
    throw new ApiError(400, "userId is required");
  }

  if (!chatId) {
    throw new ApiError(400, "chatId is required");
  }

  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      userId
    }
  });

  if (!chat) {
    throw new ApiError(403, "Unauthorized: Chat does not belong to user");
  }

  return chat;
}

export async function deleteChatForUser(userId: string, chatId: string) {
  const chat = await getChatForUser(userId, chatId);

  await prisma.chat.delete({
    where: { id: chatId }
  });

  return chat;
}
