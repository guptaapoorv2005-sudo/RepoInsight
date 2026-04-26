import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { ApiError } from "./utils/ApiError.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "repoinsight-backend",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/v1/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      ready: true,
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      ready: false,
      database: "unreachable",
      timestamp: new Date().toISOString()
    });
  }
});


// Import routes
import retrievalRoutes from "./routes/retrieval.routes.js";
import indexingRoutes from "./routes/indexing.routes.js";
import ingestionRoutes from "./routes/ingestion.routes.js";
import embeddingsRoutes from "./routes/embeddings.routes.js";
import completionsRoutes from "./routes/completions.routes.js";

// Use routes
app.use("/api/v1/retrieval", retrievalRoutes);
app.use("/api/v1/indexing", indexingRoutes);
app.use("/api/v1/ingestion", ingestionRoutes);
app.use("/api/v1/embeddings", embeddingsRoutes);
app.use("/api/v1/completions", completionsRoutes);


app.use((req, _res, next) => {
  next(new ApiError(404, "Route not found: " + req.originalUrl));
});

app.use(errorHandler);

export default app;
