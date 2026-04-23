import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import type {
    ScanRepositoryInput,
    ScanRepositoryResult,
    ScannedFile
} from "./ingestion.types.js";

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

const DEFAULT_MAX_FILES = 300;
const DEFAULT_MAX_FILE_SIZE_BYTES = 200_000;

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

//TODO:

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