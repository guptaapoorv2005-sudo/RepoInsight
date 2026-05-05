import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";
import { createChat, deleteChatForUser, listChatsForUser } from "./chat.service.js";

const DEFAULT_CHAT_PAGE_SIZE = 20;
const MAX_CHAT_PAGE_SIZE = 100;

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;

  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new ApiError(400, "limit must be between 1 and " + max);
  }

  return parsed;
}

const createChatController = asyncHandler(async (req, res) => {
  const { repositoryId, title } = req.body as {
    repositoryId?: string;
    title?: string | null;
  };

  if (!repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  const normalizedTitle = typeof title === "string" && title.trim()
    ? title.trim()
    : null;

  const chat = await createChat({
    userId: req.user.id,
    repositoryId,
    title: normalizedTitle
  });

  return res
    .status(201)
    .json(new ApiResponse(201, chat, "Chat created successfully"));
});

const listChatsController = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit, DEFAULT_CHAT_PAGE_SIZE, MAX_CHAT_PAGE_SIZE);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  const result = await listChatsForUser({
    userId: req.user.id,
    limit,
    cursor
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Chats fetched successfully"));
});

const deleteChatController = asyncHandler(async (req, res) => {
  const chatIdParam = req.params.chatId;
  const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;

  if (!chatId) {
    throw new ApiError(400, "chatId is required");
  }

  const deleted = await deleteChatForUser(req.user.id, chatId);

  return res
    .status(200)
    .json(new ApiResponse(200, deleted, "Chat deleted successfully"));
});

export { createChatController, listChatsController, deleteChatController };
