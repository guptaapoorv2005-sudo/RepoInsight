import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { searchSimilarChunks, SimilarChunk } from "../chunks/chunk.repository.js";
import { generateQueryEmbedding } from "../embeddings/embeddings.service.js";
import type {
  RetrievalInput,
  RetrievalQuestionInput,
  RetrievalContextResult
} from "./retrieval.types.js";
import { encode } from "gpt-tokenizer";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const MAX_CONTEXT_TOKENS = 3000;
const QUERY_OPTIMIZATION_MAX_OUTPUT_TOKENS = 64;
const QUERY_OPTIMIZATION_TEMPERATURE = 0.1;

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function retrieveSimilarChunks(input: RetrievalInput) {
  return searchSimilarChunks({
    repositoryId: input.repositoryId,
    queryEmbedding: input.queryEmbedding,
    limit: input.limit ?? DEFAULT_TOP_K
  });
}

async function searchKeywordChunks(
  repositoryId: string,
  query: string,
  limit: number
) {
  return prisma.$queryRawUnsafe<SimilarChunk[]>(`
    SELECT 
      id,
      repository_id as "repositoryId",
      file_path as "filePath",
      chunk_index as "chunkIndex",
      content,
      0.6 as score
    FROM code_chunks
    WHERE repository_id = $1::uuid
    AND to_tsvector('english', content) @@ plainto_tsquery($2)
    LIMIT $3
  `, repositoryId, query, limit);
}

function mergeHybrid(
  vector: SimilarChunk[],
  keyword: SimilarChunk[]
): SimilarChunk[] {
  const map = new Map<string, SimilarChunk>();

  for (const v of vector) {
    map.set(v.id, { ...v });
  }

  for (const k of keyword) {
    if (map.has(k.id)) {
      const existing = map.get(k.id)!;
      existing.score = (existing.score ?? 0.7) + 0.2;
    } else {
      map.set(k.id, { ...k, score: 0.6 });
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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
        "Content:\n" +
        m.content
      );
    })
    .join("\n\n");
}

function trimByTokens(matches: SimilarChunk[], maxTokens: number) {
  let total = 0;
  const result = [];

  for (const m of matches) {
    const tokens = encode(m.content).length;

    if (total + tokens > maxTokens) break;

    total += tokens;
    result.push(m);
  }

  return result;
}

function extractGeminiText(payload: GeminiGenerateResponse): string {
  const firstCandidate = payload.candidates?.[0];
  const parts = firstCandidate?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function cleanOptimizedQuery(text: string): string {
  const normalized = text.replace(/^"|"$/g, "").replace(/\s+/g, " ").trim();
  return normalized;
}

async function optimizeQuery(question: string): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) return trimmed;

  if (!env.GEMINI_API_KEY) {
    return trimmed;
  }

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(env.GEMINI_CHAT_MODEL) +
      ":generateContent?key=" +
      encodeURIComponent(env.GEMINI_API_KEY);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "Rewrite the user's question into a concise code-search query. " +
                "Keep identifiers, file paths, APIs, error strings, and key nouns. " +
                "Remove filler words. Output only the optimized query text, no quotes or markdown."
            }
          ]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: trimmed }]
          }
        ],
        generationConfig: {
          temperature: QUERY_OPTIMIZATION_TEMPERATURE,
          maxOutputTokens: QUERY_OPTIMIZATION_MAX_OUTPUT_TOKENS
        }
      })
    });

    const payload = (await response.json()) as GeminiGenerateResponse;

    if (!response.ok) {
      return trimmed;
    }

    const optimized = cleanOptimizedQuery(extractGeminiText(payload));
    return optimized || trimmed;
  } catch {
    return trimmed;
  }
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

  const optimizedQuery = await optimizeQuery(input.question);

  const embedding = await generateQueryEmbedding(optimizedQuery);

  const [vectorMatches, keywordMatches] = await Promise.all([
    searchSimilarChunks({
      repositoryId: input.repositoryId,
      queryEmbedding: embedding.vector,
      limit: topK
    }),
    searchKeywordChunks(input.repositoryId, optimizedQuery, 5)
  ]);

  let merged = mergeHybrid(vectorMatches, keywordMatches);

  // The topK filter is not enough, we need a minimum score threshold to ensure relevance
  const MIN_SCORE = 0.75;
  let filtered = merged.filter(m => (m.score ?? 0) >= MIN_SCORE);

  if (filtered.length === 0) {
    filtered = vectorMatches.slice(0, 2);
  }

  const trimmed = trimByTokens(filtered, MAX_CONTEXT_TOKENS);

  return {
    repositoryId: input.repositoryId,
    question: input.question,
    topK,
    embeddingProvider: embedding.provider,
    embeddingModel: embedding.model,
    matches: trimmed.map((m) => ({
      id: m.id,
      filePath: m.filePath,
      chunkIndex: m.chunkIndex,
      score: m.score,
      distance: m.distance,
      content: m.content
    })),
    contextText: buildContextText(trimmed)
  };
}