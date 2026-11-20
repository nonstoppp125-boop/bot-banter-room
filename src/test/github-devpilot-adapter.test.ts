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
    expect(() => createGitHubDevPilotAdapter(env, "owner/repo", "main"))
      .toThrow("task-scoped branches");
  });

  it("dispatches only allowlisted validation commands and waits for the isolated workflow", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith("/actions/workflows/devpilot-validation.yml")) {
        return Response.json({ path: ".github/workflows/devpilot-validation.yml", state: "active" });
      }
      if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: "a".repeat(40) } });
      if (url.endsWith("/dispatches")) return new Response(null, { status: 204 });
      if (url.includes("/runs?")) {
        const runReads = calls.filter((call) => call.url.includes("/runs?")).length;
        const previous = { id: 122, name: "DevPilot isolated validation", display_title: "DevPilot validation: npm test", status: "completed", conclusion: "success", head_branch: "devpilot/task-1", head_sha: "a".repeat(40), event: "workflow_dispatch", created_at: new Date().toISOString(), html_url: "https://github.com/owner/repo/actions/runs/122" };
        const current = { id: 123, name: "DevPilot isolated validation", display_title: "DevPilot validation: npm test", status: "completed", conclusion: "success", head_branch: "devpilot/task-1", head_sha: "a".repeat(40), event: "workflow_dispatch", created_at: new Date().toISOString(), html_url: "https://github.com/owner/repo/actions/runs/123" };
        return Response.json({ workflow_runs: runReads === 1 ? [previous] : [previous, current] });
      }
      return Response.json({ workflow_runs: [] });
    });
    const overrideEnv = { ...env, DEVPILOT_VALIDATION_WORKFLOW: "untrusted/other-workflow.yml" };
    const adapter = createGitHubDevPilotAdapter(overrideEnv, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch, pollIntervalMs: 1_000,
    });
    const result = await adapter.run({ command: "npm test", timeoutMs: 5_000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("123");
    expect(calls).toHaveLength(5);
    expect(calls[0]?.url).toContain("/actions/workflows/devpilot-validation.yml");
    expect(calls[3]?.url).toContain("/actions/workflows/devpilot-validation.yml/dispatches");
    expect(calls[3]?.init?.method).toBe("POST");
    expect(calls[3]?.init?.headers).toMatchObject({ Authorization: "Bearer fine-grained-token" });
    expect(calls[3]?.init?.body).toContain('"command":"npm test"');
  });

  it.each([
    { label: "inactive workflow", response: { path: ".github/workflows/devpilot-validation.yml", state: "disabled" } },
    { label: "unexpected workflow path", response: { path: ".github/workflows/other.yml", state: "active" } },
  ])("fails closed for an $label before dispatch", async ({ response }) => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/actions/workflows/devpilot-validation.yml")) return Response.json(response);
      return Response.json({});
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    await expect(adapter.run({ command: "npm test", timeoutMs: 5_000 }))
      .rejects.toThrow(response.state === "disabled" ? "not active" : "not active");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/actions/workflows/devpilot-validation.yml");
  });

  it("fails clearly before dispatch when the fixed workflow is missing from the default branch", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/actions/workflows/devpilot-validation.yml")) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      return Response.json({});
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    await expect(adapter.run({ command: "npm test", timeoutMs: 5_000 }))
      .rejects.toThrow("Merge the reviewed Group 06 workflow before enabling DevPilot");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/actions/workflows/devpilot-validation.yml");
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
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/git/commits/");
  });

  it("commits a bounded proposal with one non-force Git ref update", async () => {
    const baseSha = "a".repeat(40);
    const commitSha = "b".repeat(40);
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      calls.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: baseSha } });
      if (url.includes("/git/commits/" + baseSha)) return Response.json({ commit: { tree: { sha: "c".repeat(40) } } });
      if (url.includes("/git/trees/")) return Response.json({ truncated: false, tree: [{ path: "src/app.ts", type: "blob", mode: "100755", sha: "d".repeat(40) }] });
      if (url.endsWith("/git/blobs")) return Response.json({ sha: "e".repeat(40) });
      if (url.endsWith("/git/trees")) return Response.json({ sha: "f".repeat(40) });
      if (url.endsWith("/git/commits")) return Response.json({ sha: commitSha });
      if (url.includes("/git/refs/heads/")) return Response.json({ ref: "refs/heads/devpilot/task-1" });
      return Response.json({});
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    const result = await adapter.applyChanges({
      repository: "owner/repo", branch: "devpilot/task-1", baseSha,
      changes: [{ path: "src/app.ts", beforeSha: "d".repeat(40), content: "export const value = 2;" }],
    });
    expect(result.headSha).toBe(commitSha);
    const blob = calls.find((call) => call.url.endsWith("/git/blobs"));
    const tree = calls.find((call) => call.url.endsWith("/git/trees"));
    const update = calls.find((call) => call.method === "PATCH");
    expect(blob?.body).toContain('"encoding":"utf-8"');
    expect(tree?.body).toContain('"mode":"100755"');
    expect(update?.body).toContain('"force":false');
    expect(update?.body).toContain(commitSha);
  });

  it("rejects a proposal whose before-SHA differs from the exact base tree", async () => {
    const baseSha = "a".repeat(40);
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); calls.push(url);
      if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: baseSha } });
      if (url.includes("/git/commits/" + baseSha)) return Response.json({ commit: { tree: { sha: "b".repeat(40) } } });
      return Response.json({ truncated: false, tree: [{ path: "src/app.ts", type: "blob", mode: "100644", sha: "c".repeat(40) }] });
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", { fetcher: fetcher as typeof fetch });
    await expect(adapter.applyChanges({ repository: "owner/repo", branch: "devpilot/task-1", baseSha, changes: [
      { path: "src/app.ts", beforeSha: "d".repeat(40), content: "export const value = 1;" },
    ] })).rejects.toThrow("does not match the inspected base");
    expect(calls.some((url) => url.endsWith("/git/blobs"))).toBe(false);
  });

  it("reuses an identical task-owned commit after a worker retry", async () => {
    const baseSha = "a".repeat(40);
    const commitSha = "b".repeat(40);
    const source = "export const value = 2;";
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: commitSha } });
      if (url.includes("/git/commits/" + commitSha)) {
        return Response.json({ parents: [{ sha: baseSha }], commit: { tree: { sha: "c".repeat(40) } } });
      }
      if (url.includes("/contents/src/app.ts")) {
        return Response.json({
          type: "file", encoding: "base64", content: btoa(source), sha: "d".repeat(40), size: source.length,
        });
      }
      return Response.json({});
    });
    const adapter = createGitHubDevPilotAdapter(env, "owner/repo", "devpilot/task-1", {
      fetcher: fetcher as typeof fetch,
    });
    const result = await adapter.applyChanges({
      repository: "owner/repo", branch: "devpilot/task-1", baseSha,
      changes: [{ path: "src/app.ts", beforeSha: "e".repeat(40), content: source }],
    });
    expect(result.headSha).toBe(commitSha);
    expect(calls.some((url) => url.endsWith("/git/blobs"))).toBe(false);
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
