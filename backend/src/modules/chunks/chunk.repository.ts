//This is the repository layer (DAL – Data Access Layer)

import { Prisma } from "@prisma/client"; //for types like JSON
import { prisma } from "../../lib/prisma.js"; //DB client instance
import { EMBEDDING_DIMENSION } from "../../config/constants.js";

//Type for the input of the upsertRepository function
type UpsertRepositoryInput = {
  owner: string;
  name: string;
  defaultBranch?: string | null;
};

type UpsertCodeChunkInput = {
  repositoryId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  metadata?: Prisma.InputJsonValue;
};

//Type for the output of the findSimilarChunks function
export type SimilarChunk = {
  id: string;
  repositoryId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  score: number;
  distance: number;
};


function toVectorLiteral(embedding: number[]): string {
    if (embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(
            "Embedding dimension mismatch. Expected " + EMBEDDING_DIMENSION + ", received " + embedding.length
        );
    }
    for (const value of embedding) {
        if (!Number.isFinite(value)) {
            throw new Error("Embedding contains a non-finite number.");
        }
    }

    return "[" + embedding.join(",") + "]"; //Convert the array of numbers into a string representation of a vector literal
    //example: [0.1, 0.2, 0.3] => "[0.1,0.2,0.3]"
}

export async function upsertRepository(input: UpsertRepositoryInput) {
    return prisma.repository.upsert({ //Upsert means it will either update an existing record or create a new one if it doesn't exist
        where: {
            owner_name: {
                owner: input.owner,
                name: input.name
            }
        },
        update: {
            defaultBranch: input.defaultBranch ?? null
        },
        create: {
            owner: input.owner,
            name: input.name,
            defaultBranch: input.defaultBranch ?? null
        }
    });
}

export async function upsertCodeChunk(input: UpsertCodeChunkInput) {
    return prisma.codeChunk.upsert({
        where: {
            repositoryId_filePath_chunkIndex: {
                repositoryId: input.repositoryId,
                filePath: input.filePath,
                chunkIndex: input.chunkIndex
            }
        },
        update: {
            content: input.content,
            tokenCount: input.tokenCount ?? null,
            metadata: input.metadata ?? {}
        },
        create: {
            repositoryId: input.repositoryId,
            filePath: input.filePath,
            chunkIndex: input.chunkIndex,
            content: input.content,
            tokenCount: input.tokenCount ?? null,
            metadata: input.metadata ?? {}
        }
    });
}

export async function updateChunkEmbedding(chunkId: string, embedding: number[]) {
    const vectorLiteral = toVectorLiteral(embedding);
    await prisma.$executeRaw`
        UPDATE "code_chunks"  
        SET "embedding" = ${vectorLiteral}::vector  
        WHERE "id" = ${chunkId}::uuid
    `;
}

export async function searchSimilarChunks(input: {
    repositoryId: string;
    queryEmbedding: number[];
    limit?: number;
}) {
    const vectorLiteral = toVectorLiteral(input.queryEmbedding);
    const limit = input.limit ?? 5;

    const rows = await prisma.$queryRaw<SimilarChunk[]> `
        SELECT    
            "id"::text AS "id",    
            "repository_id"::text AS "repositoryId",    
            "file_path" AS "filePath",    
            "chunk_index" AS "chunkIndex",    
            "content",    
            1 - ("embedding" <=> ${vectorLiteral}::vector) AS "score", 
            ("embedding" <=> ${vectorLiteral}::vector) AS "distance"   
        FROM "code_chunks"  
        WHERE "repository_id" = ${input.repositoryId}::uuid    
            AND "embedding" IS NOT NULL  
        ORDER BY "embedding" <=> ${vectorLiteral}::vector  
        LIMIT ${limit}   
    `;
//The <=> operator calculates the distance between two vectors. We subtract it from 1 to convert it into a similarity score (where 1 means identical and 0 means completely different).
//Distance b/w two vectors lies between 0 and 1, where 0 means identical and 1 means completely different.
    return rows;
}


export type PendingChunk = {
  id: string;
  content: string;
};

export async function getChunksWithoutEmbedding(input: {
  repositoryId: string;
  limit: number;
}): Promise<PendingChunk[]> {
  return prisma.$queryRaw<PendingChunk[]>`
    SELECT
      "id"::text AS "id",
      "content"
    FROM "code_chunks"
    WHERE "repository_id" = ${input.repositoryId}::uuid
      AND "embedding" IS NULL
    ORDER BY "chunk_index" ASC
    LIMIT ${input.limit}
  `;
}

export async function countChunksWithoutEmbedding(repositoryId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM "code_chunks"
    WHERE "repository_id" = ${repositoryId}::uuid
      AND "embedding" IS NULL
  `;
  return rows[0]?.count ?? 0;
}
//TODO for above 2 functions:
/*
High Priority (before scaling)
 Add FOR UPDATE SKIP LOCKED
 Add partial index on (repository_id, chunk_index)
 Add embedding_status field
Medium Priority
 Add retry + failure tracking
 Add cursor-based pagination
 Avoid COUNT(*) or cache it
Low Priority
 Optimize memory usage
 Add batch size tuning
 Add metrics (processing speed, failures)
 */