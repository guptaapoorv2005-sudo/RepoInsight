import dotenv from "dotenv";

dotenv.config();

const portRaw = process.env.PORT ?? "4000";
const port = Number(portRaw);

if (Number.isNaN(port)) {
  throw new Error("PORT must be a number");
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const DIRECT_URL = process.env.DIRECT_URL;

if (!DIRECT_URL) {
  throw new Error("DIRECT_URL is required");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port,
  DATABASE_URL: DATABASE_URL,
  DIRECT_URL: DIRECT_URL
};
