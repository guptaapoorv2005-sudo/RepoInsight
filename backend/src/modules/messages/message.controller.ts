import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";
import { getChatForUser } from "../chat/chat.service.js";
import { listMessagesForChat } from "./message.service.js";

const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const MAX_MESSAGE_PAGE_SIZE = 200;

function parseLimit(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;

  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new ApiError(400, "limit must be between 1 and " + max);
  }

  return parsed;
}

const listMessagesController = asyncHandler(async (req, res) => {
  const chatIdParam = req.params.chatId;
  const chatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;

  if (!chatId) {
    throw new ApiError(400, "chatId is required");
  }

  await getChatForUser(req.user.id, chatId);

  const limit = parseLimit(req.query.limit, DEFAULT_MESSAGE_PAGE_SIZE, MAX_MESSAGE_PAGE_SIZE);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  const result = await listMessagesForChat({
    chatId,
    limit,
    cursor
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Messages fetched successfully"));
});

export { listMessagesController };
