CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "repositories" (
    "id" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_branch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_chunks" (
    "id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "embedding" vector,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositories_owner_name_key" ON "repositories"("owner", "name");

-- CreateIndex
CREATE INDEX "code_chunks_repository_id_idx" ON "code_chunks"("repository_id");

-- CreateIndex
CREATE INDEX "code_chunks_repository_id_chunk_index_idx" ON "code_chunks"("repository_id", "chunk_index");

-- CreateIndex
CREATE INDEX "code_chunks_embedding_hnsw" ON "code_chunks"("embedding");

-- CreateIndex
CREATE UNIQUE INDEX "code_chunks_repository_id_file_path_chunk_index_key" ON "code_chunks"("repository_id", "file_path", "chunk_index");

-- AddForeignKey
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
