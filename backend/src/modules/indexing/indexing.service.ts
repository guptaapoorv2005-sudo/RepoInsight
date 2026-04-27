import { IndexRepositoryInput } from "./indexing.types.js";
import {
  upsertCodeChunk,
  upsertRepository,
} from "../chunks/chunk.repository.js";
import pLimit from "p-limit";
import { prisma } from "../../lib/prisma.js";

export async function indexRepository(input: IndexRepositoryInput) {
  const repository = await upsertRepository({
    owner: input.owner,
    name: input.name,
    defaultBranch: input.defaultBranch ?? null
  });

  // Delete existing chunks for the repository before indexing new ones
  await prisma.codeChunk.deleteMany({
    where: { repositoryId: repository.id }
  });

  // Step 1: Deduplicate chunks
  const unique = new Map<string, typeof input.chunks[number]>();

  for (const chunk of input.chunks) {
    const key = `${chunk.filePath}:${chunk.chunkIndex}`;
    if (!unique.has(key)) {
      unique.set(key, chunk);
    }
  }

  const dedupedChunks = Array.from(unique.values());

  // Step 2: Concurrency control
  const limit = pLimit(10); // safe DB concurrency

  const batchSize = 50;

  for (let i = 0; i < dedupedChunks.length; i += batchSize) {
    const batch = dedupedChunks.slice(i, i + batchSize);

    await Promise.all(
      batch.map((chunk) =>
        limit(() =>
          upsertCodeChunk({
            repositoryId: repository.id,
            filePath: chunk.filePath,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount ?? null,
            metadata: chunk.metadata ?? {}
          })
        )
      )
    );

    // optional logging
    // console.log(`Indexed batch ${i / batchSize + 1}`);
  }

  return {
    repositoryId: repository.id,
    totalChunks: dedupedChunks.length
  };
}