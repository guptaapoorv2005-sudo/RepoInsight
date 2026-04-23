import { searchSimilarChunks } from "../chunks/chunk.repository.js";
import { RetrievalInput } from "./retrieval.types.js";

export async function retrieveSimilarChunks(input: RetrievalInput) {
    
    return searchSimilarChunks({
        repositoryId: input.repositoryId,
        queryEmbedding: input.queryEmbedding,
        limit: input.limit ?? 5
    });
}