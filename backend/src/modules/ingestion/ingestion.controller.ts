import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { scanRepository, fetchAndChunkFiles, ingestRepositoryToDb  } from "./ingestion.service.js";
import type { ScanRepositoryInput, FetchAndChunkInput, IngestRepositoryInput } from "./ingestion.types.js";

const scanRepositoryController = asyncHandler(async (req, res) => {
    const result = await scanRepository(req.body as ScanRepositoryInput);

    return res
    .status(200)
    .json(new ApiResponse(200, result, "Repository scan successful"));
});

const fetchAndChunkController = asyncHandler(async (req, res) => {
  const result = await fetchAndChunkFiles(req.body as FetchAndChunkInput);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Files fetched and chunked successfully"));
});

const ingestRepositoryController = asyncHandler(async (req, res) => {
  const result = await ingestRepositoryToDb(req.body as IngestRepositoryInput);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Repository ingested and persisted successfully"));
});

export { 
    scanRepositoryController, 
    fetchAndChunkController, 
    ingestRepositoryController 
};