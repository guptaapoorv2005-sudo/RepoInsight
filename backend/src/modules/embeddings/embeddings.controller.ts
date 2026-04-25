import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { generateEmbeddingsForRepository } from "./embeddings.service.js";
import type { GenerateEmbeddingsInput } from "./embeddings.types.js";

const generateEmbeddingsController = asyncHandler(async (req, res) => {
  const result = await generateEmbeddingsForRepository(req.body as GenerateEmbeddingsInput);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Embeddings generation completed"));
});

export { generateEmbeddingsController };