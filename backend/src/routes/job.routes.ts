import {  Router } from "express";
import { streamJobStatusController } from "../modules/jobs/job.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/:jobId", verifyJWT, streamJobStatusController);

export default router;