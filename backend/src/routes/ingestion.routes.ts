import { Router } from "express";
import { fetchAndChunkController, ingestRepositoryController, scanRepositoryController } from "../modules/ingestion/ingestion.controller.js";

const router = Router();

router.post("/scan", scanRepositoryController);

router.post("/fetch-chunk", fetchAndChunkController);

router.post("/run", ingestRepositoryController);

export default router;