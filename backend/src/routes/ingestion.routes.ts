import { Router } from "express";
import { ingestRepositoryController } from "../modules/ingestion/ingestion.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/run", verifyJWT, ingestRepositoryController);

export default router;