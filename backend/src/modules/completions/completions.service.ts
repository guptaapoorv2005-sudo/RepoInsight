import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { retrieveQuestionContext } from "../retrieval/retrieval.service.js";
import type {
  GenerateCompletionInput,
  GenerateCompletionResult,
  CompletionCitation,
} from "./completions.types.js";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const MAX_QUESTION_LENGTH = 8000;

const SYSTEM_PROMPT =
  "You are RepoInsight Copilot, an expert software engineer.\n" +
  "Answer using ONLY the provided repository context.\n" +
  "Focus on:\n" +
  "- Explaining code behavior clearly\n" +
  "- Referencing file paths and functions\n" +
  "- Suggesting improvements when relevant\n" +
  "- Being precise and technical\n" +
  "If context is insufficient, explicitly say what is missing.";

type ProviderCompletionResult = {
  answer: string;
  model: string;
};


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

function buildUserPrompt(question: string, contextText: string): string {
  return (
    "Question:\n" +
    question +
    "\n\n" +
    "Repository Context:\n" +
    contextText +
    "\n\n" +
    "Instructions:\n" +
    "1) Use only this context.\n" +
    "2) Mention uncertainty when context is incomplete.\n" +
    "3) Cite relevant files inline when useful."
  );
}

// Extract readable text from a structured Gemini API response.
function extractGeminiText(payload: GeminiGenerateResponse): string {
//Gemini can return multiple candidates(responses).
//Usually, we only care about the best (first) one.
  const firstCandidate = payload.candidates?.[0];
  const parts = firstCandidate?.content?.parts ?? [];
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function buildCitations(
  matches: Array<{
    id: string;
    filePath: string;
    chunkIndex: number;
    score: number;
    distance: number;
  }>
): CompletionCitation[] {
  return matches.map((m) => ({
    id: m.id,
    filePath: m.filePath,
    chunkIndex: m.chunkIndex,
    score: m.score,
    distance: m.distance
  }));
}

function validateInput(input: GenerateCompletionInput): {
  repositoryId: string;
  question: string;
  topK: number;
  temperature: number;
  maxOutputTokens: number;
} {
  const repositoryId = input.repositoryId?.trim();
  if (!repositoryId) {
    throw new ApiError(400, "repositoryId is required");
  }

  const question = input.question?.trim();
  if (!question) {
    throw new ApiError(400, "question is required");
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    throw new ApiError(400, "question is too long");
  }

  const topK = input.topK ?? DEFAULT_TOP_K;
  if (!Number.isInteger(topK) || topK <= 0 || topK > MAX_TOP_K) {
    throw new ApiError(400, "topK must be between 1 and " + MAX_TOP_K);
  }

  //Temperature controls how “random” or “creative” the model is when choosing words. Higher values (e.g., 0.8) make output more diverse and unpredictable, while lower values (e.g., 0.2) make it more focused and deterministic.
  const temperature = input.temperature ?? env.COMPLETION_TEMPERATURE_DEFAULT;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new ApiError(400, "temperature must be between 0 and 2");
  }

  //maxOutputTokens limits the length of the generated answer. Setting it too low may truncate important information, while setting it too high may lead to unnecessarily long responses.
  const maxOutputTokens = input.maxOutputTokens ?? env.COMPLETION_MAX_OUTPUT_TOKENS;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0) {
    throw new ApiError(400, "maxOutputTokens must be a positive integer");
  }

  return {
    repositoryId,
    question,
    topK,
    temperature,
    maxOutputTokens
  };
}

async function generateWithGemini(input: {
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<ProviderCompletionResult> {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is required for gemini provider");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(env.GEMINI_CHAT_MODEL) +
    ":generateContent?key=" +
    encodeURIComponent(env.GEMINI_API_KEY);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.userPrompt }]
        }
      ],
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens
      }
    }),
    signal: controller.signal
  });

  clearTimeout(timeout);

  const payload = (await response.json()) as GeminiGenerateResponse;

  if (!response.ok) {
    const providerMessage = payload.error?.message ?? "Unknown Gemini error";
    throw new ApiError(
      response.status,
      "Gemini completion request failed with status " + response.status + ": " + providerMessage
    );
  }

  const answer = extractGeminiText(payload);
  if (!answer) {
    throw new ApiError(502, "Gemini completion response was empty");
  }

  return {
    answer,
    model: env.GEMINI_CHAT_MODEL
  };
}

export async function generateCompletion(
  input: GenerateCompletionInput
): Promise<GenerateCompletionResult> {
  const normalized = validateInput(input);
  const started = Date.now();

  const retrieval = await retrieveQuestionContext({
    repositoryId: normalized.repositoryId,
    question: normalized.question,
    topK: normalized.topK
  });

  if (retrieval.matches.length === 0) {
    throw new ApiError(404, "No relevant context found for this question");
  }

  const providerResult = await generateWithGemini({
    userPrompt: buildUserPrompt(normalized.question, retrieval.contextText),
    temperature: normalized.temperature,
    maxOutputTokens: normalized.maxOutputTokens
  });

  return {
    repositoryId: normalized.repositoryId,
    question: normalized.question,
    topK: retrieval.topK,
    model: providerResult.model,
    temperature: normalized.temperature,
    maxOutputTokens: normalized.maxOutputTokens,
    answer: providerResult.answer,
    citations: buildCitations(retrieval.matches),
    durationMs: Date.now() - started
  };
}

//TODO;
//rerank topK using LLM or cross-encoder
//Add cache layer for completions to speed up repeated questions

