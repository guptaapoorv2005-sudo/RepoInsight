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
import type { IndexChunkInput } from "../indexing/indexing.types.js";

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

const DEFAULT_MAX_FILES = 300;
const DEFAULT_MAX_FILE_SIZE_BYTES = 200_000;
const DEFAULT_CHUNK_SIZE_LINES = 80;
const DEFAULT_CHUNK_OVERLAP_LINES = 10;
const DEFAULT_MAX_FETCH_FILES = 100;
const DEFAULT_MAX_FETCH_FILE_SIZE_BYTES = 200_000;

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

    const ext = extensionOf(path);
    if (!ALLOWED_EXTENSIONS.has(ext)) return false; //ALLOWED_EXTENSIONS is a Set, O(1) lookup.

    if (size !== null && size > maxFileSizeBytes) return false;

    return true;
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

    const repoMeta = await githubGet<GitHubRepoResponse>("https://api.github.com/repos/" + owner + "/" + repo); //this returns repositeries default branch and other metadata. We need the default branch to know which branch to scan if the user did not specify one.

    const branch = input.branch ?? repoMeta.default_branch;

    const treeResponse = await githubGet<GitHubTreeResponse>( //Gets file structure of the repository at the specified branch. 
        "https://api.github.com/repos/" +
        owner +
        "/" +
        repo +
        "/git/trees/" +
        encodeURIComponent(branch) +
        "?recursive=1"     //The "?recursive=1" query parameter tells GitHub to return the entire file tree recursively, not just the top-level files and directories.
    );

    const blobs = treeResponse.tree.filter((node) => node.type === "blob"); //We only care about blobs, which represent files. We ignore "tree" (directories) and "commit" (submodules).

    const keptFiles: ScannedFile[] = [];
    let skipped = 0;

    for (const node of blobs) {
        const size = typeof node.size === "number" ? node.size : null;
        if (!shouldKeep(node.path, size, maxFileSizeBytes)) {
            skipped += 1;
            continue;
        }

        keptFiles.push({
            path: node.path,
            size,
            extension: extensionOf(node.path)
        });

        if (keptFiles.length >= maxFiles)break;
    }
    return {
    owner,
    repo,
    branch,
    totalFromTree: blobs.length,
    kept: keptFiles.length,
    skipped,
    files: keptFiles
    };
}
//TODO for scanRepository:

// 1. Truncated tree ignored
// Large repos:
// "truncated": true
// silently miss files

// 2. Order bias
// stop early:
// break;
// may miss important files
// keep random ones

// 3. No prioritization
// All files treated equally
// Better:
// prioritize /src, /lib

function encodeGitHubPath(path: string): string {
    // if the file path contains special characters or spaces, encodeURIComponent will encode them. However, it will also encode "/" which we want to keep as it is for GitHub API. So we split the path by "/", encode each part, and then join them back with "/".
    return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function toLines(text: string): string[] {
    //This function normalizes line endings to "\n" and then splits the text into lines. This way, it can handle files with different line ending styles (Windows uses "\r\n", Unix uses "\n", old Mac used "\r").
    return text.replace(/\r\n/g, "\n").split("\n");
}

function isProbablyBinary(text: string): boolean {
    //This function checks if the text is likely to be binary by looking for null bytes. Binary files often contain null bytes, while text files typically do not. This is a heuristic and not foolproof, but it can help catch cases where a file is not actually text.
    return text.includes("\u0000");
}

function chunkTextByLines( //TODO: AST-based or token-based chunking 
  filePath: string,
  text: string,
  chunkSizeLines: number,
  overlapLines: number
): FileChunk[] {
  const lines = toLines(text);
  const chunks: FileChunk[] = [];

  if (lines.length === 0) return chunks;

  const step = chunkSizeLines - overlapLines; // This is how many new lines we move forward for each chunk. 
  // For example, if chunkSizeLines is 80 and overlapLines is 10, then step will be 70. 
  // This means that each chunk will start 70 lines after the previous chunk's start, resulting in a 10-line overlap between consecutive chunks.
  // We make overlap to preserve some context between chunks, which can be helpful for downstream processing that may need to understand the relationship between lines.

  for (let start = 0, chunkIndex = 0; start < lines.length; start += step, chunkIndex += 1) {
    const endExclusive = Math.min(start + chunkSizeLines, lines.length);
    const content = lines.slice(start, endExclusive).join("\n"); //We join the lines back together with "\n" to reconstruct the chunk's text content.

    chunks.push({
      filePath,
      chunkIndex,
      startLine: start + 1,
      endLine: endExclusive,
      content,
      charCount: content.length
    });

    if (endExclusive >= lines.length) break;
  }

  return chunks;
}

async function fetchFileContentFromGitHub( //TODO: add caching layer to avoid refetching the same file and timeout+retry logic for large files that may take a long time to fetch and decode.
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string> {
  const encodedPath = encodeGitHubPath(filePath);

  const payload = await githubGet<GitHubContentResponse>(
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

  const chunkSizeLines = input.chunkSizeLines ?? DEFAULT_CHUNK_SIZE_LINES;
  const overlapLines = input.overlapLines ?? DEFAULT_CHUNK_OVERLAP_LINES;
  const maxFilesToFetch = input.maxFilesToFetch ?? DEFAULT_MAX_FETCH_FILES;
  const maxFileSizeBytes = input.maxFileSizeBytes ?? DEFAULT_MAX_FETCH_FILE_SIZE_BYTES;

  if (chunkSizeLines <= 0) {
    throw new ApiError(400, "chunkSizeLines must be greater than 0");
  }

  if (overlapLines < 0 || overlapLines >= chunkSizeLines) {
    throw new ApiError(400, "overlapLines must be >= 0 and less than chunkSizeLines");
  }

  const selectedFiles = input.files.slice(0, maxFilesToFetch);

  const chunks: FileChunk[] = [];
  const errors: Array<{ filePath: string; reason: string }> = [];
  let processedFiles = 0;
  let skippedFiles = 0;

  for (const file of selectedFiles) {  //TODO: parallelize fetching and chunking by using Promise.all with a concurrency limit to speed up processing of multiple files, especially for large repositories. We can use a library like p-limit to control the concurrency and avoid overwhelming the GitHub API or our server resources.
    if (file.size !== null && file.size > maxFileSizeBytes) {
      skippedFiles += 1;
      errors.push({
        filePath: file.path,
        reason: "File exceeds maxFileSizeBytes"
      });
      continue;
    }

    try {
      const text = await fetchFileContentFromGitHub(
        input.owner,
        input.repo,
        input.branch,
        file.path
      );

      const fileChunks = chunkTextByLines(
        file.path,
        text,
        chunkSizeLines,
        overlapLines
      );

      chunks.push(...fileChunks);
      processedFiles += 1;
    } catch (error) {
      skippedFiles += 1;
      errors.push({
        filePath: file.path,
        reason: error instanceof Error ? error.message : "Unknown fetch/chunk error"
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

function mapChunksForIndexing(chunks: FileChunk[]): IndexChunkInput[] {
  return chunks.map((chunk) => ({
    filePath: chunk.filePath,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    tokenCount: null,
    metadata: {
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      charCount: chunk.charCount,
      source: "github"
    }
  }));
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
    chunkSizeLines: input.chunkSizeLines,
    overlapLines: input.overlapLines,
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
      embeddedChunks: persistResult.embeddedChunks
    }
  };
}

//TODO for ingestRepositoryToDb:
//1. Add token counting
//2. Language detection and store as metadata
//3. Add chunk id to enable deduplication and updates in the future
//4. Add retry logic for transient errors during fetching and indexing
//5. Add concurrency control by p-limit
//6. Batch indexing instead of one by one to optimize database operations and embedding generation