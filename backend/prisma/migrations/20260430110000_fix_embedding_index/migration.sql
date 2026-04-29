DROP INDEX IF EXISTS "code_chunks_embedding_hnsw";

ALTER TABLE "code_chunks"
ALTER COLUMN "embedding" TYPE vector(1536);

CREATE INDEX "code_chunks_embedding_hnsw"
ON "code_chunks" USING hnsw ("embedding" vector_cosine_ops);
