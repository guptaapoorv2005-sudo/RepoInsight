CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw
ON code_chunks USING hnsw (embedding vector_cosine_ops);