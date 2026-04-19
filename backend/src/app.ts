import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "repoinsight-backend",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

export default app;
