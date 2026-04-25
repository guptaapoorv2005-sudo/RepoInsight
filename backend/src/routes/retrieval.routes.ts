import { Router } from "express";
import { retrievalController, retrievalQueryController } from "../modules/retrieval/retrieval.controller.js";

const router = Router();

router.post("/search", retrievalController);

router.post("/query", retrievalQueryController);

export default router;