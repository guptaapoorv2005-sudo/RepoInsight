import dotenv from "dotenv";

dotenv.config();

const portRaw = process.env.PORT ?? "4000";
const port = Number(portRaw);

if (Number.isNaN(port)) {
  throw new Error("PORT must be a number");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: port
};
