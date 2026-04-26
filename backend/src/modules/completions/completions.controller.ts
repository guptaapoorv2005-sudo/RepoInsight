import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";
import { generateCompletion } from "./completions.service.js";
import type { GenerateCompletionInput } from "./completions.types.js";

const generateCompletionController = asyncHandler(async (req, res) => {
  const input = req.body as GenerateCompletionInput;

  if (!input.repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  if (!input.question || !input.question.trim()) {
    throw new ApiError(400, "question is required");
  }

  if (input.topK !== undefined && (!Number.isInteger(input.topK) || input.topK <= 0)) {
    throw new ApiError(400, "topK must be a positive integer");
  }

  if (
    input.temperature !== undefined &&
    (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2)
  ) {
    throw new ApiError(400, "temperature must be between 0 and 2");
  }

  if (
    input.maxOutputTokens !== undefined &&
    (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0)
  ) {
    throw new ApiError(400, "maxOutputTokens must be a positive integer");
  }

  const result = await generateCompletion(input);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Completion generated successfully"));
});

export { generateCompletionController };
