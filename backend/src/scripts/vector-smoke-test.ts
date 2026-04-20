import { prisma } from "../lib/prisma.js";
import {
upsertCodeChunk,
upsertRepository,
updateChunkEmbedding,
searchSimilarChunks
} from "../modules/chunks/chunk.repository.js";

function buildEmbedding(seed: number): number[] {
    const vector: number[] = [];
    for (let i = 0; i < 1536; i += 1) {
        const value = Math.sin(seed + i) * 0.01;
        vector.push(Number(value.toFixed(6)));
    }
    return vector;
}

async function main() {
    const repo = await upsertRepository({
        owner: "smoke-test",
        name: "repo-" + Date.now(),
        defaultBranch: "main"
    });

    const chunk = await upsertCodeChunk({
        repositoryId: repo.id,
        filePath: "src/example.ts",
        chunkIndex: 0,
        content: "export const answer = 42;",
        tokenCount: 5,
        metadata: { language: "typescript" }
    });

    const embedding = buildEmbedding(42);
    await updateChunkEmbedding(chunk.id, embedding);

    const matches = await searchSimilarChunks({
        repositoryId: repo.id,
        queryEmbedding: embedding,
        limit: 3
    });

    console.log({
        repositoryId: repo.id,
        chunkId: chunk.id,
        hits: matches.length,
        topScore: matches[0]?.score ?? null
    });
}

main()
.catch((error) => {
    console.error("Vector smoke test failed", error);
    process.exitCode = 1;
})
.finally(async () => {
    await prisma.$disconnect();
});