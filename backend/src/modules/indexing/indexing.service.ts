import { IndexRepositoryInput } from "./indexing.types.js";
import {
  upsertCodeChunk,
  upsertRepository,
  updateChunkEmbedding
} from "../chunks/chunk.repository.js";

export async function indexRepository(input: IndexRepositoryInput) {

  const repository = await upsertRepository({
    owner: input.owner,
    name: input.name,
    defaultBranch: input.defaultBranch ?? null
  });

  let embeddedChunks = 0;

  for (const chunk of input.chunks) { //TODO: optimize this by doing bulk upsert and embedding(batching)
    const saved = await upsertCodeChunk({
      repositoryId: repository.id,
      filePath: chunk.filePath,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount ?? null,
      metadata: chunk.metadata ?? {}
    });

    if (chunk.embedding && chunk.embedding.length > 0) {
      await updateChunkEmbedding(saved.id, chunk.embedding);
      embeddedChunks += 1;
    }
  }

  return {
    repositoryId: repository.id,
    totalChunks: input.chunks.length,
    embeddedChunks
  };
}