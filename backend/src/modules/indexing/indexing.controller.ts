import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { indexRepository } from "./indexing.service.js";
import { EMBEDDING_DIMENSION } from "../../config/constants.js";

const indexingController = asyncHandler(async (req, res) => {
    const input = req.body;

    if (!input.owner || !input.name) {
        throw new ApiError(400, "owner and name are required");
    }
    
    if (!Array.isArray(input.chunks) || input.chunks.length === 0) {
        throw new ApiError(400, "chunks must be a non-empty array");
    }

    for (const chunk of input.chunks){ // TODO: optimize this by zod
        if (!chunk.filePath || typeof chunk.chunkIndex !== "number" || !chunk.content) {
            throw new ApiError(400, "Each chunk needs filePath, chunkIndex, and content");
        }
        if (chunk.embedding && chunk.embedding.length !== EMBEDDING_DIMENSION) {
            throw new ApiError(400, "Embedding length must be " + EMBEDDING_DIMENSION);
        }
    }

    const result = await indexRepository(input);

    return res
        .status(200)
        .json(new ApiResponse(200, result, "Repository indexed successfully"));
});

export { indexingController };