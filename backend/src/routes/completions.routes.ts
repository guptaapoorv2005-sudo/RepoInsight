import { Router } from "express";
import { generateCompletionController } from "../modules/completions/completions.controller.js";

const router = Router();

router.post("/query", generateCompletionController);

export default router;
