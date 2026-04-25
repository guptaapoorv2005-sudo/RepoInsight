import { Router } from "express";
import { generateEmbeddingsController } from "../modules/embeddings/embeddings.controller.js";

const router = Router();

router.post("/run", generateEmbeddingsController);

export default router;