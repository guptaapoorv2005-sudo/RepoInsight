import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import type {
    ScanRepositoryInput,
    ScanRepositoryResult,
    ScannedFile,
    FetchAndChunkInput,
    FetchAndChunkResult,
    FileChunk,
    IngestRepositoryInput,
    IngestRepositoryResult
} from "./ingestion.types.js";
import { indexRepository } from "../indexing/indexing.service.js";
import { enqueueEmbeddingsForRepository } from "../embeddings/embeddings.service.js";
import type { IndexChunkInput } from "../indexing/indexing.types.js";
import pLimit from "p-limit";
import crypto from "crypto";
import { encode, decode } from "gpt-tokenizer";

type GitHubRepoResponse = {
    default_branch: string;
};

type GitHubTreeNode = {
    path: string;
    type: "blob" | "tree" | "commit";
    size?: number;
};

type GitHubTreeResponse = {
    truncated: boolean;
    tree: GitHubTreeNode[];
};

type GitHubContentResponse = {
    type: "file" | "dir" | "symlink" | "submodule";
    encoding?: string;
    size?: number;
    content?: string;
};

type FetchResult =
  | { type: "success"; fileChunks: FileChunk[] }
  | { type: "skipped"; filePath: string; reason: string }
  | { type: "error"; filePath: string; reason: string };

const DEFAULT_MAX_FILES = 300;
const DEFAULT_MAX_FILE_SIZE_BYTES = 200_000;
const DEFAULT_CHUNK_SIZE_TOKENS = 300;
const DEFAULT_CHUNK_OVERLAP_TOKENS = 60;
const DEFAULT_MAX_FETCH_FILES = 100;
const DEFAULT_MAX_FETCH_FILE_SIZE_BYTES = 200_000;
// Keep aligned with DEFAULT_MAX_CHUNKS in embeddings.service.ts
const DEFAULT_EMBEDDING_JOB_MAX_CHUNKS = 200;

const BLOCKED_DIR_PREFIXES = [
    ".git/",
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    "coverage/",
    "vendor/",
    "target/",
    "out/"
];

const ALLOWED_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".py", ".go", ".rs", ".java",
    ".kt", ".rb", ".php", ".cs", ".cpp", ".c",
    ".h", ".hpp", ".swift", ".sql", ".yaml", ".yml",
    ".toml", ".sh"
]);

const SPECIAL_FILES = new Set([
  "Dockerfile",
  "Makefile",
  "README",
  "README.md",
  "LICENSE"
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".swift": "swift",
  ".sql": "sql",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".sh": "bash",
  ".toml": "toml"
};

function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
    let parsed: URL;
    try {
        parsed = new URL(repoUrl);
    } catch {
        throw new ApiError(400, "repoUrl must be a valid URL");
    }

    if (parsed.hostname !== "github.com") {
        throw new ApiError(400, "Only github.com URLs are supported in this step");
    }

    const segments = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (segments.length < 2) {
        throw new ApiError(400, "repoUrl must include owner and repo");
    }

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/, "");

    if (!owner || !repo) {
        throw new ApiError(400, "Invalid GitHub URL format. Expected https://github.com/{owner}/{repo}");
    }

    return { owner, repo };
}

async function githubGet<T>(url: string): Promise<T> { //<T> is a generic type parameter that allows the caller to specify the expected return type of the function. This way, the function can be reused for different types of API responses while still providing type safety.
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json", //this header tells GitHub that we want the response in their custom JSON format.
        "User-Agent": "RepoInsight-Backend"  //GitHub API requires a User-Agent header. It can be anything, but it's good practice to identify your application.
    };
    if (env.GITHUB_TOKEN) { //Without token:60 requests/hour | With token: 5000 requests/hour
        headers.Authorization = "Bearer " + env.GITHUB_TOKEN;
    }

    const response = await fetch(url, { headers });
    //Fetch does not throw an error for HTTP error status codes (like 404 or 500). It only throws for network errors. So we need to check response.ok to see if the request was successful.

    if (!response.ok) {
        if (response.status === 404) {
            throw new ApiError(404, "Repository or branch not found on GitHub");
        }

        if (response.status === 403) {
            throw new ApiError(403, "GitHub API rate-limited or forbidden. Add GITHUB_TOKEN in env.");
        }

        throw new ApiError( response.status,"GitHub API request failed with status " + response.status);
    }

    return (await response.json()) as T; //response.json() parses the response body as JSON and returns it.
}

async function githubGetWithRetry<T>(url: string, retries = 3): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await githubGet<T>(url);
    } catch (err) {
      lastError = err;

      if (err instanceof ApiError) {
        if (err.statusCode === 400 || err.statusCode === 404) {
          throw err;
        }
      }

      // exponential backoff
      // If we hit a rate limit, we can retry after some delay. GitHub's rate limit resets every hour, but we can use exponential backoff to wait longer between retries.
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }

  throw lastError;
}

function extensionOf(path: string): string {
    const index = path.lastIndexOf("."); //Finds last occurrence of "." in the string. If there is no ".", it returns -1.
    if (index === -1) return "";
    return path.slice(index).toLowerCase(); //Returns the substring from the last "." to the end of the string, which is the file extension. for example, if path is "src/index.ts", it will return ".ts". If path is "README", it will return "".
}

function isBlockedByDirectory(path: string): boolean { //Checks if the file path starts with any of the blocked directory prefixes. For example, if path is "node_modules/lodash/index.js", it will return true because it starts with "node_modules/". If path is "src/index.ts", it will return false because it does not start with any of the blocked prefixes.
    return BLOCKED_DIR_PREFIXES.some((prefix) => path.startsWith(prefix)); //The some() method tests whether at least one element in the array passes the test implemented by the provided function.
}

function shouldKeep(path: string, size: number | null, maxFileSizeBytes: number): boolean {
    if (isBlockedByDirectory(path)) return false;

    const fileName = path.split("/").pop() || "";

    if (SPECIAL_FILES.has(fileName)) return true;

    const ext = extensionOf(path);
    if (!ALLOWED_EXTENSIONS.has(ext)) return false; //ALLOWED_EXTENSIONS is a Set, O(1) lookup.

    if (size !== null && size > maxFileSizeBytes) return false;

    return true;
}

//Since we may encounter repositories with a large number of files, we need to prioritize which files to keep when we reach the maxFiles limit.
function scoreFile(path: string): number {
  let score = 0;

  // prioritize important dirs
  if (path.startsWith("src/")) score += 5;
  if (path.startsWith("app/")) score += 5;
  if (path.startsWith("prisma/")) score += 5;
  if (path.startsWith("lib/")) score += 4;
  if (path.startsWith("components/")) score += 4;

  // deprioritize noise
  if (path.includes("test") || path.includes("__tests__")) score -= 3;
  if (path.includes(".lock")) score -= 5;

  // important standalone files
  if (path.endsWith("package.json")) score += 6;
  if (path.toLowerCase().includes("readme")) score += 6;

  return score;
}

export async function scanRepository(input: ScanRepositoryInput): Promise<ScanRepositoryResult> {
    if (!input.repoUrl) {
        throw new ApiError(400, "repoUrl is required");
    }
    const maxFiles = input.maxFiles ?? DEFAULT_MAX_FILES;
    const maxFileSizeBytes = input.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;

    if (maxFiles <= 0) {
        throw new ApiError(400, "maxFiles must be greater than 0");
    }

    if (maxFileSizeBytes <= 0) {
        throw new ApiError(400, "maxFileSizeBytes must be greater than 0");
    }

    const { owner, repo } = parseGitHubUrl(input.repoUrl);

    const repoMeta = await githubGetWithRetry<GitHubRepoResponse>("https://api.github.com/repos/" + owner + "/" + repo); //this returns repositeries default branch and other metadata. We need the default branch to know which branch to scan if the user did not specify one.

    const branch = input.branch ?? repoMeta.default_branch;

    const treeResponse = await githubGetWithRetry<GitHubTreeResponse>( //Gets file structure of the repository at the specified branch. 
        "https://api.github.com/repos/" +
        owner +
        "/" +
        repo +
        "/git/trees/" +
        encodeURIComponent(branch) +
        "?recursive=1"     //The "?recursive=1" query parameter tells GitHub to return the entire file tree recursively, not just the top-level files and directories.
    );

    if (treeResponse.truncated) {
      throw new ApiError(400,"Repository too large (truncated tree). Use smaller repo or implement pagination.");
    }

    const blobs = treeResponse.tree.filter((node) => node.type === "blob"); //We only care about blobs, which represent files. We ignore "tree" (directories) and "commit" (submodules).

    // Filter first
    const filtered = blobs
      .map((node) => ({
        path: node.path,
        size: typeof node.size === "number" ? node.size : null,
      }))
      .filter((file) => shouldKeep(file.path, file.size, maxFileSizeBytes));

    // Score + sort
    const sorted = filtered.sort((a, b) => scoreFile(b.path) - scoreFile(a.path));

    // Take top N
    const selected = sorted.slice(0, maxFiles);

    const keptFiles: ScannedFile[] = selected.map((file) => ({
      path: file.path,
      size: file.size,
      extension: extensionOf(file.path),
    }));

    return {
      owner,
      repo,
      branch,
      totalFromTree: blobs.length,
      kept: keptFiles.length,
      skipped: blobs.length - keptFiles.length,
      files: keptFiles
    };
}

function encodeGitHubPath(path: string): string {
    // if the file path contains special characters or spaces, encodeURIComponent will encode them. However, it will also encode "/" which we want to keep as it is for GitHub API. So we split the path by "/", encode each part, and then join them back with "/".
    return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function isProbablyBinary(text: string): boolean {
    //This function checks if the text is likely to be binary by looking for null bytes. Binary files often contain null bytes, while text files typically do not. This is a heuristic and not foolproof, but it can help catch cases where a file is not actually text.
    return text.includes("\u0000");
}

function chunkTextByTokens( //
  filePath: string,
  text: string,
  chunkSize = 350,
  overlap = 60
): FileChunk[] {

  const tokens = encode(text);

  if (tokens.length < 300) {
    // small file → no need to split aggressively
    return [{
      filePath,
      chunkIndex: 0,
      content: text,
      charCount: text.length,
      language: EXTENSION_LANGUAGE_MAP[extensionOf(filePath)] || "unknown",
      tokenCount: tokens.length
    }];
  }

  const chunks: FileChunk[] = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length);

    const tokenSlice = tokens.slice(start, end);
    let content = decode(tokenSlice);

    // If the chunk ends in the middle of a line, we can trim back to the last full line to avoid splitting code in awkward places. This is a heuristic that can help maintain better code readability in the chunks, which may lead to better embeddings and completions later on.
    const lastNewline = content.lastIndexOf("\n");
    if (lastNewline > 100) {
      content = content.slice(0, lastNewline);
    }

    chunks.push({
      filePath,
      chunkIndex,
      content,
      charCount: content.length,
      language: EXTENSION_LANGUAGE_MAP[extensionOf(filePath)] || "unknown",
      tokenCount: tokenSlice.length
    });

    if (end >= tokens.length) break;

    start += chunkSize - overlap;
    chunkIndex++;
  }

  return chunks;
}

async function fetchFileContentFromGitHub( //TODO: add caching layer to avoid refetching the same file.
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string> {
  const encodedPath = encodeGitHubPath(filePath);

  const payload = await githubGetWithRetry<GitHubContentResponse>(
    "https://api.github.com/repos/" +
      owner +
      "/" +
      repo +
      "/contents/" +
      encodedPath +
      "?ref=" +
      encodeURIComponent(branch)
  );

  if (payload.type !== "file") {
    throw new ApiError(400, "Path is not a file");
  }

  if (payload.encoding !== "base64" || !payload.content) { // GitHub API returns file content in base64 encoding.
    throw new ApiError(400, "Unsupported GitHub content encoding");
  }

  const decoded = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");

  if (decoded.length > 300_000) {
    throw new ApiError(400, "File too large after decoding");
  }

  if (isProbablyBinary(decoded)) {
    throw new ApiError(400, "Binary file detected");
  }

  return decoded;
}

export async function fetchAndChunkFiles(
  input: FetchAndChunkInput
): Promise<FetchAndChunkResult> {
  if (!input.owner || !input.repo || !input.branch) {
    throw new ApiError(400, "owner, repo, and branch are required");
  }

  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new ApiError(400, "files must be a non-empty array");
  }

  const chunkSizeTokens = input.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE_TOKENS;
  const overlapTokens = input.overlapTokens ?? DEFAULT_CHUNK_OVERLAP_TOKENS;
  const maxFilesToFetch = input.maxFilesToFetch ?? DEFAULT_MAX_FETCH_FILES;
  const maxFileSizeBytes = input.maxFileSizeBytes ?? DEFAULT_MAX_FETCH_FILE_SIZE_BYTES;

  if (chunkSizeTokens <= 0) {
    throw new ApiError(400, "chunkSizeTokens must be greater than 0");
  }

  if (overlapTokens < 0 || overlapTokens >= chunkSizeTokens) {
    throw new ApiError(400, "overlapTokens must be >= 0 and less than chunkSizeTokens");
  }

  const selectedFiles = input.files.slice(0, maxFilesToFetch);

  const chunks: FileChunk[] = [];
  const errors: Array<{ filePath: string; reason: string }> = [];
  let processedFiles = 0;
  let skippedFiles = 0;

  const limit = pLimit(5); // safe concurrency
// We use p-limit to control the concurrency of fetching and chunking files. This is important because if we try to fetch too many files at once, especially large ones, we might run into rate limits or memory issues. By limiting the concurrency to 5, we ensure that only 5 files are being processed at the same time, which can help balance speed and resource usage.
  const tasks: Promise<FetchResult>[] = selectedFiles.map((file) =>
    limit(async () => {
      if (file.size !== null && file.size > maxFileSizeBytes) {
        return {
          type: "skipped",
          filePath: file.path,
          reason: "File exceeds maxFileSizeBytes"
        };
      }

      try {
        const text = await fetchFileContentFromGitHub(
          input.owner,
          input.repo,
          input.branch,
          file.path
        );

        const fileChunks = chunkTextByTokens(
          file.path,
          text,
          chunkSizeTokens,
          overlapTokens
        );

        return { type: "success", fileChunks };
      } catch (error) {
        return {
          type: "error",
          filePath: file.path,
          reason: error instanceof Error ? error.message : "Unknown error"
        };
      }
    })
  );

  const results = await Promise.all(tasks); //Promise.all will wait for all the tasks to complete and then return an array of results.

  for (const result of results) {
    if (result.type === "success") {
      chunks.push(...result.fileChunks);
      processedFiles++;
    } else {
      skippedFiles++;
      errors.push({
        filePath: result.filePath,
        reason: result.reason
      });
    }
  }

  return {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    requestedFiles: selectedFiles.length,
    processedFiles,
    skippedFiles,
    totalChunks: chunks.length,
    chunks,
    errors
  };
}

function hashContent(content: string): string {
  // This function generates a SHA-256 hash of the file content. This can be used to create a unique identifier for the chunk, which can help with deduplication and updates in the future. If the content of a chunk changes, its hash will change, allowing us to detect that it has been modified.
  return crypto.createHash("sha256").update(content).digest("hex");
}

function mapChunksForIndexing(chunks: FileChunk[]): IndexChunkInput[] {

  return chunks.map((chunk) => {
    const hash = hashContent(chunk.content);
    return{
      id: `${chunk.filePath}:${hash}`, //By including the file path and content hash in the chunk ID, we can create a unique identifier for each chunk that reflects both its location and its content. This way, if the same chunk content appears in a different file, it will have a different ID. Additionally, if the content of the chunk changes, the hash will change, resulting in a new ID, which can help with tracking updates and avoiding duplicates.
      filePath: chunk.filePath,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: {
        charCount: chunk.charCount,
        source: "github",
        language: chunk.language,
        contentHash: hash
      }
    };
  });
}

export async function ingestRepositoryToDb( input: IngestRepositoryInput ): Promise<IngestRepositoryResult> {
  if (!input.repoUrl) {
    throw new ApiError(400, "repoUrl is required");
  }

  const scanResult = await scanRepository({
    repoUrl: input.repoUrl,
    branch: input.branch,
    maxFiles: input.scanMaxFiles,
    maxFileSizeBytes: input.scanMaxFileSizeBytes
  });

  const fetchResult = await fetchAndChunkFiles({
    owner: scanResult.owner,
    repo: scanResult.repo,
    branch: scanResult.branch,
    files: scanResult.files.map((file) => ({
      path: file.path,
      size: file.size
    })),
    chunkSizeTokens: input.chunkSizeTokens,
    overlapTokens: input.overlapTokens,
    maxFilesToFetch: input.fetchMaxFiles ?? scanResult.files.length,
    maxFileSizeBytes: input.fetchMaxFileSizeBytes ?? input.scanMaxFileSizeBytes
  });

  if (fetchResult.totalChunks === 0) {
    throw new ApiError(400, "No chunks generated to persist");
  }

  const persistResult = await indexRepository({
    owner: scanResult.owner,
    name: scanResult.repo,
    defaultBranch: scanResult.branch,
    chunks: mapChunksForIndexing(fetchResult.chunks)
  });

  const repositoryId = persistResult.repositoryId;
  const maxChunksPerJob = DEFAULT_EMBEDDING_JOB_MAX_CHUNKS;
  const jobsToQueue = Math.max(1, Math.ceil(persistResult.totalChunks / maxChunksPerJob));

  const embeddingJobs = await Promise.all(
    Array.from({ length: jobsToQueue }, (_, i) =>
      enqueueEmbeddingsForRepository({
        repositoryId,
        limit: maxChunksPerJob,
      })
    )
  );

  const embeddingJobIds = embeddingJobs.map((job) => job.jobId);

  return {
    owner: scanResult.owner,
    repo: scanResult.repo,
    branch: scanResult.branch,
    scan: {
      totalFromTree: scanResult.totalFromTree,
      kept: scanResult.kept,
      skipped: scanResult.skipped
    },
    chunking: {
      requestedFiles: fetchResult.requestedFiles,
      processedFiles: fetchResult.processedFiles,
      skippedFiles: fetchResult.skippedFiles,
      totalChunks: fetchResult.totalChunks,
      errors: fetchResult.errors
    },
    persistence: {
      repositoryId: persistResult.repositoryId,
      totalChunks: persistResult.totalChunks,
      embeddedChunks: persistResult.embeddedChunks,
      embeddingJobsQueued: embeddingJobIds.length,
      embeddingJobIds: embeddingJobIds
    }
  };
}


//TODO:
//Caching layer
//Commit SHA tracking to only re-ingest changed files