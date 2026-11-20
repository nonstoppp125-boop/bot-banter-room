import type {
  DevPilotFileContent,
  DevPilotPullRequest,
  DevPilotRepositoryAdapter,
  DevPilotRepositorySnapshot,
} from "./devpilot-engine";
import type { CodeChangeProposal, DiffReviewInput } from "./coding-workforce";

type GitHubEnv = {
  GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY_ALLOWLIST?: string;
  DEVPILOT_VALIDATION_WORKFLOW?: string;
};
type GitHubApiOptions = { fetcher?: typeof fetch; pollIntervalMs?: number };
type ApiRef = { object: { sha: string } };
type ApiCommit = { sha: string; commit: { tree: { sha: string } } };
type ApiTree = { truncated: boolean; tree: Array<{ path: string; type: string; sha: string; size?: number }> };
type ApiContent = { type: string; encoding: string; content: string; sha: string; size: number };
type ApiWorkflowRun = {
  id: number; name: string; status: string; conclusion: string | null;
  head_branch: string; created_at: string; html_url: string;
};
type ApiCompare = { files?: Array<{ filename: string; status: string }> };

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_REPOSITORY_FILES = 5_000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_CHANGE_BYTES = 500_000;
const VALIDATION_COMMANDS = new Set([
  "npm run typecheck",
  "npm test",
  "npm run build",
  "git diff --check",
]);

function encodePath(path: string): string {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error("DevPilot GitHub operation was cancelled.");
}

function assertSha(value: string): void {
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new Error("GitHub returned an invalid commit SHA.");
}

function assertBranch(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(value) || value.includes("..") || value.endsWith("/") || value.endsWith(".") || value.endsWith(".lock")) {
    throw new Error("DevPilot branch name is invalid.");
  }
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

export function createGitHubDevPilotAdapter(
  env: GitHubEnv,
  repository: string,
  targetBranch: string,
  options: GitHubApiOptions = {},
): DevPilotRepositoryAdapter {
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error("DevPilot GitHub adapter is not configured: GITHUB_TOKEN is missing.");
  if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    throw new Error("DevPilot repository identifier is invalid.");
  }
  const allowlist = new Set((env.GITHUB_REPOSITORY_ALLOWLIST ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (allowlist.size === 0 || !allowlist.has(repository.toLowerCase())) {
    throw new Error("DevPilot repository is not in GITHUB_REPOSITORY_ALLOWLIST.");
  }
  assertBranch(targetBranch);
  const fetcher = options.fetcher ?? fetch;
  const pollIntervalMs = Math.max(1_000, Math.min(options.pollIntervalMs ?? 4_000, 10_000));
  const workflow = env.DEVPILOT_VALIDATION_WORKFLOW?.trim() || "devpilot-validation.yml";
  if (!/^[A-Za-z0-9._/-]+\.ya?ml$/i.test(workflow)) throw new Error("DevPilot validation workflow filename is invalid.");
  let activeBranch = targetBranch;

  async function api<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    abortIfNeeded(signal);
    const response = await fetcher(new URL(path, API), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    if (response.status === 204) return null as T;
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`GitHub API ${method} ${path} failed with HTTP ${response.status}.`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("GitHub API returned malformed JSON.");
    }
  }

  async function getRef(branch: string, signal?: AbortSignal): Promise<ApiRef> {
    assertBranch(branch);
    return api<ApiRef>("GET", `/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, undefined, signal);
  }

  async function getContent(path: string, branch: string, signal?: AbortSignal): Promise<DevPilotFileContent> {
    const item = await api<ApiContent>(
      "GET",
      `/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
      undefined,
      signal,
    );
    if (item.type !== "file" || item.encoding !== "base64" || item.size > MAX_FILE_BYTES) {
      throw new Error(`DevPilot cannot read this repository file safely: ${path}`);
    }
    const content = decodeBase64Utf8(item.content);
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
      throw new Error(`DevPilot repository file exceeds the read limit: ${path}`);
    }
    return { path, sha: item.sha, content };
  }

  return {
    async inspectRepository(input): Promise<DevPilotRepositorySnapshot> {
      if (input.repository.toLowerCase() !== repository.toLowerCase()) throw new Error("GitHub adapter repository scope mismatch.");
      assertBranch(input.branch);
      const ref = await getRef(input.branch, input.signal);
      const headSha = ref.object.sha;
      assertSha(headSha);
      const commit = await api<ApiCommit>("GET", `/repos/${repository}/git/commits/${headSha}`, undefined, input.signal);
      const tree = await api<ApiTree>("GET", `/repos/${repository}/git/trees/${commit.commit.tree.sha}?recursive=1`, undefined, input.signal);
      if (tree.truncated || tree.tree.length > MAX_REPOSITORY_FILES) {
        throw new Error("Repository inventory is too large or truncated; DevPilot refuses an incomplete inspection.");
      }
      const files = tree.tree
        .filter((entry) => entry.type === "blob" && typeof entry.path === "string" && typeof entry.sha === "string")
        .map((entry) => ({
          path: entry.path,
          sha: entry.sha,
          size: Number.isInteger(entry.size) ? entry.size ?? 0 : 0,
          status: "tracked" as const,
        }));
      return { repository, branch: input.branch, headSha, workingTreeClean: true, files };
    },

    async readFiles(input): Promise<DevPilotFileContent[]> {
      if (input.repository.toLowerCase() !== repository.toLowerCase() || input.paths.length > 20 ||
        new Set(input.paths).size !== input.paths.length) throw new Error("GitHub adapter file-read scope is invalid.");
      const ref = await getRef(input.branch, input.signal);
      assertSha(ref.object.sha);
      const files = await Promise.all(input.paths.map((path) => getContent(path, input.branch, input.signal)));
      return files;
    },

    async createBranch(input): Promise<void> {
      if (input.repository.toLowerCase() !== repository.toLowerCase()) throw new Error("GitHub adapter repository scope mismatch.");
      assertBranch(input.branch);
      assertSha(input.baseSha);
      activeBranch = input.branch;
      try {
        await api("POST", `/repos/${repository}/git/refs`, {
          ref: `refs/heads/${input.branch}`,
          sha: input.baseSha,
        }, input.signal);
      } catch (error) {
        const existing = await getRef(input.branch, input.signal).catch(() => null);
        if (!existing || existing.object.sha !== input.baseSha) throw error;
      }
    },

    async applyChanges(input): Promise<{ headSha: string }> {
      if (input.repository.toLowerCase() !== repository.toLowerCase() || input.branch !== activeBranch ||
        input.changes.length === 0 || input.changes.length > 8) throw new Error("GitHub adapter change scope is invalid.");
      assertSha(input.baseSha);
      const ref = await getRef(input.branch, input.signal);
      if (ref.object.sha !== input.baseSha) throw new Error("DevPilot branch HEAD changed; refusing a non-fast-forward write.");
      const totalBytes = input.changes.reduce((sum, change) => sum + new TextEncoder().encode(change.content).byteLength, 0);
      if (totalBytes > MAX_CHANGE_BYTES || new Set(input.changes.map((change) => change.path)).size !== input.changes.length) {
        throw new Error("DevPilot proposed changes exceed GitHub adapter limits.");
      }
      const baseCommit = await api<ApiCommit>("GET", `/repos/${repository}/git/commits/${input.baseSha}`, undefined, input.signal);
      const blobs = await Promise.all(input.changes.map(async (change) => {
        const result = await api<{ sha: string }>("POST", `/repos/${repository}/git/blobs`, {
          content: change.content,
          encoding: "utf-8",
        }, input.signal);
        return { path: change.path, mode: "100644", type: "blob", sha: result.sha };
      }));
      const tree = await api<{ sha: string }>("POST", `/repos/${repository}/git/trees`, {
        base_tree: baseCommit.commit.tree.sha,
        tree: blobs,
      }, input.signal);
      const commit = await api<{ sha: string }>("POST", `/repos/${repository}/git/commits`, {
        message: "DevPilot: apply approved repository proposal",
        tree: tree.sha,
        parents: [input.baseSha],
      }, input.signal);
      assertSha(commit.sha);
      await api("PATCH", `/repos/${repository}/git/refs/heads/${encodeURIComponent(input.branch)}`, {
        sha: commit.sha,
        force: false,
      }, input.signal);
      return { headSha: commit.sha };
    },

    async inspectDiff(input): Promise<DiffReviewInput> {
      if (input.repository.toLowerCase() !== repository.toLowerCase() || input.branch !== activeBranch) {
        throw new Error("GitHub adapter diff scope mismatch.");
      }
      assertSha(input.baseSha);
      const ref = await getRef(input.branch, input.signal);
      const headSha = ref.object.sha;
      assertSha(headSha);
      const comparison = await api<ApiCompare>(
        "GET",
        `/repos/${repository}/compare/${input.baseSha}...${headSha}`,
        undefined,
        input.signal,
      );
      const changed = comparison.files ?? [];
      if (changed.length > 8 || changed.some((file) => file.status === "removed" || file.status === "renamed")) {
        throw new Error("DevPilot diff contains unsupported file operations.");
      }
      const files = await Promise.all(changed.map((file) => getContent(file.filename, input.branch, input.signal)));
      const testsChanged = files.some((file) =>
        /(?:^|\/)(?:[^/]*\.)?(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(__tests__|tests)\//i.test(file.path));
      return { files: files.map((file) => ({ path: file.path, content: file.content })), testsChanged };
    },

    async commit(input): Promise<{ commitSha: string }> {
      if (input.repository.toLowerCase() !== repository.toLowerCase() || input.branch !== activeBranch) {
        throw new Error("GitHub adapter commit scope mismatch.");
      }
      const ref = await getRef(input.branch, input.signal);
      if (ref.object.sha !== input.expectedHeadSha) throw new Error("DevPilot branch HEAD changed after diff review.");
      return { commitSha: ref.object.sha };
    },

    async createPullRequest(input): Promise<DevPilotPullRequest> {
      if (input.repository.toLowerCase() !== repository.toLowerCase() || input.headBranch !== activeBranch) {
        throw new Error("GitHub adapter pull-request scope mismatch.");
      }
      assertSha(input.commitSha);
      const owner = repository.split("/")[0];
      const existing = await api<Array<{ number: number; html_url: string }>>(
        "GET",
        `/repos/${repository}/pulls?state=open&head=${encodeURIComponent(owner + ":" + input.headBranch)}&base=${encodeURIComponent(input.baseBranch)}`,
        undefined,
        input.signal,
      );
      if (existing[0]) return { number: existing[0].number, url: existing[0].html_url };
      const created = await api<{ number: number; html_url: string }>(
        "POST",
        `/repos/${repository}/pulls`,
        { title: input.title, body: input.body, head: input.headBranch, base: input.baseBranch, draft: true },
        input.signal,
      );
      return { number: created.number, url: created.html_url };
    },

    async run(input): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
      if (!VALIDATION_COMMANDS.has(input.command)) throw new Error("DevPilot validation command is not allowlisted.");
      if (!activeBranch) throw new Error("DevPilot validation branch is not initialized.");
      const startedAt = Date.now();
      const workflowPath = encodeURIComponent(workflow);
      await api("POST", `/repos/${repository}/actions/workflows/${workflowPath}/dispatches`, {
        ref: activeBranch,
        inputs: { command: input.command },
      }, input.signal);
      while (Date.now() - startedAt <= input.timeoutMs) {
        abortIfNeeded(input.signal);
        const result = await api<{ workflow_runs: ApiWorkflowRun[] }>(
          "GET",
          `/repos/${repository}/actions/workflows/${workflowPath}/runs?branch=${encodeURIComponent(activeBranch)}&event=workflow_dispatch&per_page=20`,
          undefined,
          input.signal,
        );
        const run = result.workflow_runs.find((candidate) =>
          candidate.head_branch === activeBranch &&
          candidate.name === `DevPilot validation: ${input.command}` &&
          Date.parse(candidate.created_at) >= startedAt - 15_000);
        if (run?.status === "completed") {
          const durationMs = Date.now() - startedAt;
          return {
            exitCode: run.conclusion === "success" ? 0 : 1,
            stdout: `GitHub Actions validation run ${run.id}: ${run.conclusion ?? "unknown"}.`,
            stderr: run.conclusion === "success" ? "" : run.html_url,
            durationMs,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, Math.max(1, input.timeoutMs - (Date.now() - startedAt)))));
      }
      throw new Error(`DevPilot validation timed out: ${input.command}`);
    },
  };
}
