import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";
import { retrieveSimilarChunks } from "./retrieval.service.js";
import { EMBEDDING_DIMENSION } from "../../config/constants.js";
import { retrieveQuestionContext } from "./retrieval.service.js";
import type { RetrievalQuestionInput } from "./retrieval.types.js";

const retrievalController = asyncHandler(async(req,res) => {
    const input = req.body;

    if (!input.repositoryId) {
        throw new ApiError(400, "repositoryId is required");
    }

    if (!Array.isArray(input.queryEmbedding) || input.queryEmbedding.length === 0) {
        throw new ApiError(400, "queryEmbedding must be a non-empty array");
    }

    if (input.queryEmbedding.length !== EMBEDDING_DIMENSION) {
        throw new ApiError(400, "queryEmbedding length must be " + EMBEDDING_DIMENSION);
    }

    if (input.limit !== undefined && input.limit <= 0) {
        throw new ApiError(400, "limit must be greater than 0");
    }

    const matches = await retrieveSimilarChunks(input);

    return res
        .status(200)
        .json(new ApiResponse(200, { matches }, "Retrieval successful"));
})

const retrievalQueryController = asyncHandler(async (req, res) => {
  const input = req.body as RetrievalQuestionInput;

  if (!input.repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  if (!input.question || !input.question.trim()) {
    throw new ApiError(400, "question is required");
  }

  if (input.topK !== undefined && input.topK <= 0) {
    throw new ApiError(400, "topK must be greater than 0");
  }

  const result = await retrieveQuestionContext(input);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Retrieval context generated successfully"));
});

export { retrievalController, retrievalQueryController };