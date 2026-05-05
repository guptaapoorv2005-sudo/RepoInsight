import { IndexRepositoryInput } from "./indexing.types.js";
import {
  upsertRepository,
} from "../chunks/chunk.repository.js";
import { prisma } from "../../lib/prisma.js";

export async function indexRepository(input: IndexRepositoryInput) {
  return prisma.$transaction(async (tx) => {
    const repository = await upsertRepository(
      {
        userId: input.userId,
        owner: input.owner,
        name: input.name,
        defaultBranch: input.defaultBranch ?? null
      },
      tx
    );

    // Delete existing chunks for the repository before indexing new ones
    await tx.codeChunk.deleteMany({
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

    const batchSize = 200;

    for (let i = 0; i < dedupedChunks.length; i += batchSize) {
      const batch = dedupedChunks.slice(i, i + batchSize);
      await tx.codeChunk.createMany({
        data: batch.map((chunk) => ({
          repositoryId: repository.id,
          filePath: chunk.filePath,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount ?? null,
          metadata: chunk.metadata ?? {}
        }))
      });
    }

    return {
      repositoryId: repository.id,
      totalChunks: dedupedChunks.length,
      embeddedChunks: 0
    };
  });
}