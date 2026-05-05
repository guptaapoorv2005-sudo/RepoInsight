import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createChatController, deleteChatController, listChatsController } from "../modules/chat/chat.controller.js";
import { listMessagesController } from "../modules/messages/message.controller.js";

const router = Router();

router.use(verifyJWT);

router.post("/", createChatController);
router.get("/", listChatsController);
router.delete("/:chatId", deleteChatController);
router.get("/:chatId/messages", listMessagesController);

export default router;
