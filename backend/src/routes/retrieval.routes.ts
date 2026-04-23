import { Router } from "express";
import { retrievalController } from "../modules/retrieval/retrieval.controller.js";

const router = Router();

router.post("/search", retrievalController);

export default router;