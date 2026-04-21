import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/ApiError.js";

type ErrorPayload = {
  statusCode: number;
  message: string;
  success: false;
  errors: unknown[];
  stack?: string;
};

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const normalized =
    err instanceof ApiError
      ? err
      : new ApiError(
          500,
          err instanceof Error ? err.message : "Internal server error"
        );

  const response: ErrorPayload = {
    statusCode: normalized.statusCode,
    message: normalized.message,
    success: false,
    errors: normalized.errors
  };

  if (process.env.NODE_ENV === "development") {
    response.stack = normalized.stack;
  }

  return res.status(response.statusCode).json(response);
};

export { errorHandler };