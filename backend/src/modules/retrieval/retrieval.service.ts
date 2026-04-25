import { ApiError } from "../../utils/ApiError.js";
import { searchSimilarChunks } from "../chunks/chunk.repository.js";
import { generateQueryEmbedding } from "../embeddings/embeddings.service.js";
import type {
  RetrievalInput,
  RetrievalQuestionInput,
  RetrievalContextResult
} from "./retrieval.types.js";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

export async function retrieveSimilarChunks(input: RetrievalInput) {
  return searchSimilarChunks({
    repositoryId: input.repositoryId,
    queryEmbedding: input.queryEmbedding,
    limit: input.limit ?? DEFAULT_TOP_K
  });
}

function buildContextText(
  matches: Array<{
    filePath: string;
    chunkIndex: number;
    score: number;
    content: string;
  }>
): string {
  return matches
    .map((m, idx) => {
      return (
        "Context " +
        (idx + 1) +
        "\n" +
        "File: " +
        m.filePath +
        "\n" +
        "Score: " +
        m.score.toFixed(6) +
        "\n" +
        "Content:\n" +
        m.content
      );
    })
    .join("\n\n");
}

export async function retrieveQuestionContext(
  input: RetrievalQuestionInput
): Promise<RetrievalContextResult> {
  if (!input.repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  if (!input.question || !input.question.trim()) {
    throw new ApiError(400, "question is required");
  }

  const topK = input.topK ?? DEFAULT_TOP_K;
  if (topK <= 0 || topK > MAX_TOP_K) {
    throw new ApiError(400, "topK must be between 1 and " + MAX_TOP_K);
  }

  const embedding = await generateQueryEmbedding(input.question);

  const matches = await searchSimilarChunks({
    repositoryId: input.repositoryId,
    queryEmbedding: embedding.vector,
    limit: topK
  });

  return {
    repositoryId: input.repositoryId,
    question: input.question,
    topK,
    embeddingProvider: embedding.provider,
    embeddingModel: embedding.model,
    matches: matches.map((m) => ({
      id: m.id,
      filePath: m.filePath,
      chunkIndex: m.chunkIndex,
      score: m.score,
      distance: m.distance,
      content: m.content
    })),
    contextText: buildContextText(matches)
  };
}

//TODO:
/*No score filtering (huge quality issue)

Right now you take topK blindly.

Problem:

Vector DB always returns something, even if irrelevant
Your LLM will hallucinate based on garbage context
*/

//No deduplication (same file spam)

/*
No token limit handling (CRITICAL)

If:

each chunk = 500 tokens
topK = 10

→ 5000 tokens → boom 💥 (context overflow)

👉 Fix:

track token count
trim dynamically
*/

//No hybrid search (biggest missing piece)

//No query optimization