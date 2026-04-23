import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/AsyncHandler.js";
import { retrieveSimilarChunks } from "./retrieval.service.js";
import { EMBEDDING_DIMENSION } from "../../config/constants.js";

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

export { retrievalController };