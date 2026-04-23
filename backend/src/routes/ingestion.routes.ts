import { Router } from "express";
import { scanRepositoryController } from "../modules/ingestion/ingestion.controller.js";

const router = Router();

router.post("/scan", scanRepositoryController);

export default router;