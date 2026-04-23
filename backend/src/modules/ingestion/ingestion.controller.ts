import { asyncHandler } from "../../utils/AsyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { scanRepository } from "./ingestion.service.js";
import type { ScanRepositoryInput } from "./ingestion.types.js";

const scanRepositoryController = asyncHandler(async (req, res) => {
    const result = await scanRepository(req.body as ScanRepositoryInput);

    return res
    .status(200)
    .json(new ApiResponse(200, result, "Repository scan successful"));
});

export { scanRepositoryController };