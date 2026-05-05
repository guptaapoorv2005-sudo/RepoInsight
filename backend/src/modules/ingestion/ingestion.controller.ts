import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ingestRepositoryToDb } from "./ingestion.service.js";
import type { IngestRepositoryInput } from "./ingestion.types.js";

const ingestRepositoryController = asyncHandler(async (req, res) => {
  const input = {
    ...(req.body as Omit<IngestRepositoryInput, "userId">),
    userId: req.user.id
  } as IngestRepositoryInput;

  const result = await ingestRepositoryToDb(input);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Repository ingested and embedding jobs queued"));
});

export { ingestRepositoryController };