import { prisma } from "../lib/prisma.js";
import { ingestRepositoryToDb } from "../modules/ingestion/ingestion.service.js";
import { generateEmbeddingsForRepository } from "../modules/embeddings/embeddings.service.js";
import { retrieveQuestionContext } from "../modules/retrieval/retrieval.service.js";
import { generateCompletion } from "../modules/completions/completions.service.js";

const repoUrl =
  process.env.PIPELINE_REPO_URL ??
  "https://github.com/guptaapoorv2005-sudo/password_generator";
const question =
  process.env.PIPELINE_QUESTION ??
  "How does the project generate a password, and where is the main entry point?";

function readInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

async function main() {
  const ingestion = await ingestRepositoryToDb({
    repoUrl,
    scanMaxFiles: readInt("PIPELINE_SCAN_MAX_FILES", 120),
    fetchMaxFiles: readInt("PIPELINE_FETCH_MAX_FILES", 60),
    chunkSizeTokens: readInt("PIPELINE_CHUNK_SIZE_TOKENS", 400),
    overlapTokens: readInt("PIPELINE_OVERLAP_TOKENS", 60)
  });

  console.log({
    step: "ingestion",
    repoUrl,
    repositoryId: ingestion.persistence.repositoryId,
    totalChunks: ingestion.persistence.totalChunks
  });

  const repositoryId = ingestion.persistence.repositoryId;

  const embeddings = await generateEmbeddingsForRepository({
    repositoryId,
    maxChunks: readInt("PIPELINE_MAX_CHUNKS", 80)
  });

  console.log({
    step: "embeddings",
    provider: embeddings.provider,
    model: embeddings.model,
    requestedChunks: embeddings.requestedChunks,
    processedChunks: embeddings.processedChunks,
    failedChunks: embeddings.failedChunks,
    remainingChunks: embeddings.remainingChunks,
    errorSamples: embeddings.errors.slice(0, 3)
  });

  const retrieval = await retrieveQuestionContext({
    repositoryId,
    question,
    topK: 5
  });

  console.log({
    step: "retrieval",
    question,
    matches: retrieval.matches.length,
    topMatch: retrieval.matches[0]?.filePath ?? null
  });

  const completion = await generateCompletion({
    repositoryId,
    question,
    topK: 5
  });

  console.log({
    step: "completion",
    model: completion.model,
    answerPreview: completion.answer.slice(0, 300)
  });
}

main()
  .catch((error) => {
    console.error("Pipeline smoke test failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
