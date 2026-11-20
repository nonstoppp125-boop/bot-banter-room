import { describe, expect, it, vi } from "vitest";
import { createGitHubDevPilotAdapter } from "@/lib/agents/github-devpilot-adapter";

const env = {
  GITHUB_TOKEN: "fine-grained-token",
  GITHUB_REPOSITORY_ALLOWLIST: "owner/repo",
};

describe("GitHub DevPilot adapter", () => {
  it("fails closed without a token or an explicit repository allowlist", () => {
    expect(() => createGitHubDevPilotAdapter({}, "owner/repo", "devpilot/task-1"))
      .toThrow("GITHUB_TOKEN");
    expect(() => createGitHubDevPilotAdapter({ GITHUB_TOKEN: "token" }, "owner/repo", "devpilot/task-1"))
      .toThrow("GITHUB_REPOSITORY_ALLOWLIST");
    expect(() => createGitHubDevPilotAdapter(env, "other/repo", "devpilot/task-1"))
      .toThrow("not in GITHUB_REPOSITORY_ALLOWLIST");
  });

  it("dispatches only allowlisted validation commands and waits for the isolated workflow", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/dispatches")) return new Response(null, { status: 204 });
      return Response.json({
        workflow_runs: [{
          id: 123, name: "DevPilot validation: npm test", status: "completed",
          conclusion: "success", head_branch: "devpilot/task-1",
          created_at: new Date().toISOString(), html_url: "https://github.com/owner/repo/actions/runs/123",
        }],
      });
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch, pollIntervalMs: 1_000,
    });
    const result = await adapter.run({ command: "npm test", timeoutMs: 5_000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("123");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain("/actions/workflows/devpilot-validation.yml/dispatches");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: "Bearer fine-grained-token" });
    expect(calls[0]?.init?.body).toContain('"command":"npm test"');
  });

  it("rejects arbitrary validation commands before making a network request", async () => {
    const fetcher = vi.fn(async () => Response.json({}));
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    await expect(adapter.run({ command: "rm -rf /", timeoutMs: 5_000 }))
      .rejects.toThrow("not allowlisted");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects unsafe paths before repository reads", async () => {
    const fetcher = vi.fn(async () => Response.json({}));
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    await expect(adapter.readFiles({
      repository: "owner/repo", branch: "main", paths: ["../secrets.txt"],
    })).rejects.toThrow("unsafe");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses to apply changes when the branch HEAD no longer matches the inspected base", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/git/ref/heads/")) {
        return Response.json({ object: { sha: "b".repeat(40) } });
      }
      return Response.json({});
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    await expect(adapter.applyChanges({
      repository: "owner/repo", branch: "devpilot/task-1", baseSha: "a".repeat(40),
      changes: [{ path: "src/app.ts", beforeSha: "a".repeat(40), content: "export const x = 1;" }],
    })).rejects.toThrow("HEAD changed");
    expect(calls).toHaveLength(1);
  });

  it("inventories regular files but excludes symbolic links and truncated trees", async () => {
    const sha = "a".repeat(40);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha } });
      if (url.includes("/git/commits/")) return Response.json({ commit: { tree: { sha: "b".repeat(40) } } });
      return Response.json({
        truncated: false,
        tree: [
          { path: "src/app.ts", type: "blob", mode: "100644", sha: "c".repeat(40), size: 20 },
          { path: "link.ts", type: "blob", mode: "120000", sha: "d".repeat(40), size: 10 },
        ],
      });
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    const snapshot = await adapter.inspectRepository({ repository: "owner/repo", branch: "main" });
    expect(snapshot.workingTreeClean).toBe(true);
    expect(snapshot.files.map((file) => file.path)).toEqual(["src/app.ts"]);
  });
});
