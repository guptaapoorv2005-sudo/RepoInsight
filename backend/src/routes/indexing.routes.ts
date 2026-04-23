import { Router } from "express";
import { indexingController } from "../modules/indexing/indexing.controller.js";


const router = Router();

router.post("/repository", indexingController);

export default router;