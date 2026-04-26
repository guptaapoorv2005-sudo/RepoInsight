import dotenv from "dotenv";
import { ApiError } from "../utils/ApiError.js";

dotenv.config();

const portRaw = process.env.PORT ?? "4000";
const port = Number(portRaw);

if (Number.isNaN(port)) {
  throw new ApiError(500, "PORT must be a number");
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new ApiError(500, "DATABASE_URL is required");
}

const DIRECT_URL = process.env.DIRECT_URL;

if (!DIRECT_URL) {
  throw new ApiError(500, "DIRECT_URL is required");
}

const CORS_ORIGIN = process.env.CORS_ORIGIN;

if (!CORS_ORIGIN) {
  throw new ApiError(500, "CORS_ORIGIN is required");
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER ?? "openai").toLowerCase();
if (EMBEDDING_PROVIDER !== "openai" && EMBEDDING_PROVIDER !== "gemini") {
  throw new ApiError(500, "EMBEDDING_PROVIDER must be either 'openai' or 'gemini'");
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

const embeddingBatchRaw = process.env.EMBEDDING_BATCH_SIZE ?? "20";
const EMBEDDING_BATCH_SIZE = Number(embeddingBatchRaw);
if (Number.isNaN(EMBEDDING_BATCH_SIZE) || EMBEDDING_BATCH_SIZE <= 0) {
  throw new ApiError(500, "EMBEDDING_BATCH_SIZE must be a positive number");
}

const embeddingRetriesRaw = process.env.EMBEDDING_MAX_RETRIES ?? "3";
const EMBEDDING_MAX_RETRIES = Number(embeddingRetriesRaw);
if (Number.isNaN(EMBEDDING_MAX_RETRIES) || EMBEDDING_MAX_RETRIES < 0) {
  throw new ApiError(500, "EMBEDDING_MAX_RETRIES must be >= 0");
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
if (EMBEDDING_PROVIDER === "gemini" && !GEMINI_API_KEY) {
  throw new ApiError(500, "GEMINI_API_KEY is required when EMBEDDING_PROVIDER is 'gemini'");
}

const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2";
if (!GEMINI_EMBEDDING_MODEL.trim()) {
  throw new ApiError(500, "GEMINI_EMBEDDING_MODEL must not be empty");
}

const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
if (!GEMINI_CHAT_MODEL.trim()) {
  throw new ApiError(500, "GEMINI_CHAT_MODEL must not be empty");
}

const completionMaxOutputTokensRaw = process.env.COMPLETION_MAX_OUTPUT_TOKENS ?? "600";
const COMPLETION_MAX_OUTPUT_TOKENS = Number(completionMaxOutputTokensRaw);
if (!Number.isInteger(COMPLETION_MAX_OUTPUT_TOKENS) || COMPLETION_MAX_OUTPUT_TOKENS <= 0) {
  throw new ApiError(500, "COMPLETION_MAX_OUTPUT_TOKENS must be a positive integer");
}

const completionTemperatureRaw = process.env.COMPLETION_TEMPERATURE_DEFAULT ?? "0.2";
const COMPLETION_TEMPERATURE_DEFAULT = Number(completionTemperatureRaw);
if (
  !Number.isFinite(COMPLETION_TEMPERATURE_DEFAULT) ||
  COMPLETION_TEMPERATURE_DEFAULT < 0 ||
  COMPLETION_TEMPERATURE_DEFAULT > 2
) {
  throw new ApiError(500, "COMPLETION_TEMPERATURE_DEFAULT must be between 0 and 2");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port,
  DATABASE_URL: DATABASE_URL,
  DIRECT_URL: DIRECT_URL,
  CORS_ORIGIN: CORS_ORIGIN,
  GITHUB_TOKEN: GITHUB_TOKEN,
  EMBEDDING_PROVIDER: EMBEDDING_PROVIDER,
  OPENAI_API_KEY: OPENAI_API_KEY,
  OPENAI_EMBEDDING_MODEL: OPENAI_EMBEDDING_MODEL,
  EMBEDDING_BATCH_SIZE: EMBEDDING_BATCH_SIZE,
  EMBEDDING_MAX_RETRIES: EMBEDDING_MAX_RETRIES,
  GEMINI_API_KEY: GEMINI_API_KEY,
  GEMINI_EMBEDDING_MODEL: GEMINI_EMBEDDING_MODEL,
  GEMINI_CHAT_MODEL: GEMINI_CHAT_MODEL,
  COMPLETION_MAX_OUTPUT_TOKENS: COMPLETION_MAX_OUTPUT_TOKENS,
  COMPLETION_TEMPERATURE_DEFAULT: COMPLETION_TEMPERATURE_DEFAULT
};
