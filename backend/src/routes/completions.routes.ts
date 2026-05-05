import { Router } from "express";
import { generateCompletionController } from "../modules/completions/completions.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/query", verifyJWT, generateCompletionController);

export default router;
