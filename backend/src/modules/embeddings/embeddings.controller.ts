import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { enqueueEmbeddingsForRepository } from "./embeddings.service.js";
import type { GenerateEmbeddingsInput } from "./embeddings.types.js";

const generateEmbeddingsController = asyncHandler(async (req, res) => {
  const result = await enqueueEmbeddingsForRepository(req.body as GenerateEmbeddingsInput);

  return res
    .status(202)
    .json(new ApiResponse(202, result, "Embeddings job queued"));
});

export { generateEmbeddingsController };