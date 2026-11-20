import { describe, expect, it } from "vitest";
import { handleDevPilotRunRequest } from "@/lib/agents/devpilot-api";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/devpilot/runs";
const now = "2026-11-20T07:30:00.000Z";

function database() {
  const queries: string[] = [];
  const values: unknown[][] = [];
  const rows: Array<Record<string, unknown>> = [];
  const db = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...args: unknown[]) {
          values.push(args);
          return {
            async first<T>() {
              if (query.includes("FROM sessions")) return {
                id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
                expires_at: "2026-11-21T00:00:00.000Z", created_at: now,
              } as T;
              if (query.includes("FROM workspace_members")) return {
                workspace_id: "workspace-1", user_id: "user-1", role: "owner",
              } as T;
              if (query.includes("FROM devpilot_runs")) {
                const id = args[0];
                return rows.find((row) => row["id"] === id) as T ?? null;
              }
              return null;
            },
            async all<T>() { return { success: true, results: rows as unknown as T[] }; },
            async run() {
              if (query.startsWith("INSERT INTO devpilot_runs")) {
                const [id, workspaceId, userId, repository, baseBranch, task, checkpoint, createdAt, updatedAt] = args;
                rows.push({
                  id, workspace_id: workspaceId, user_id: userId, repository, base_branch: baseBranch,
                  task_text: task, status: "queued", progress: 0, worker_attempt_count: 0,
                  checkpoint_version: 0, checkpoint_json: checkpoint, lease_owner: null, lease_expires_at: null,
                  created_at: createdAt, updated_at: updatedAt,
                });
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { db, queries, values, rows };
}

const env = (ACTION_DB: ReturnType<typeof database>["db"]) => ({
  ACTION_DB,
  DEVPILOT_ENABLED: "true",
  GITHUB_TOKEN: "test-token",
  GITHUB_REPOSITORY_ALLOWLIST: "owner/repo",
  GROQ_API_KEY: "groq-test-key",
  CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) },
});

describe("authenticated DevPilot run API", () => {
  it("fails closed when D1 storage is unavailable", async () => {
    const response = await handleDevPilotRunRequest(new Request(url), {});
    expect(response.status).toBe(503);
  });

  it("requires an authenticated workspace session before listing runs", async () => {
    const response = await handleDevPilotRunRequest(new Request(url), env(database().db));
    expect(response.status).toBe(401);
  });

  it("redacts persisted proposal source and approval hashes from the user's run history", async () => {
    const state = database();
    state.rows.push({
      id: "run-1", workspace_id: "workspace-1", user_id: "user-1", repository: "owner/repo",
      base_branch: "main", task_text: "Deploy this", status: "awaiting_approval", progress: 25,
      worker_attempt_count: 1, checkpoint_version: 2,
      checkpoint_json: JSON.stringify({
        stage: "awaiting-approval",
        data: {
          approvalPayloadHash: "f".repeat(64),
          proposalFiles: [{ path: "src/app.ts", beforeSha: null, beforeContent: null, content: "source-secret" }],
        },
      }),
      lease_owner: null, lease_expires_at: null, created_at: now, updated_at: now,
    });
    const response = await handleDevPilotRunRequest(new Request(url, {
      headers: { Cookie: cookie },
    }), env(state.db));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("awaiting-approval");
    expect(text).not.toContain("source-secret");
    expect(text).not.toContain("approvalPayloadHash");
  });

  it("rejects cross-origin task creation before reading the request body", async () => {
    const response = await handleDevPilotRunRequest(new Request(url, {
      method: "POST", headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Do work", repository: "owner/repo" }),
    }), env(database().db));
    expect(response.status).toBe(403);
  });

  it("persists a workspace-scoped run only for an allowlisted repository", async () => {
    const state = database();
    const response = await handleDevPilotRunRequest(new Request(url, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://liza.example", "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Add a utility and tests", repository: "owner/repo", baseBranch: "main" }),
    }), env(state.db));
    expect(response.status).toBe(201);
    const payload = await response.json() as { run: { status: string; task: string; repository: string; workspaceId: string } };
    expect(payload.run).toMatchObject({
      status: "queued", task: "Add a utility and tests", repository: "owner/repo", workspaceId: "workspace-1",
    });
    expect(state.queries.some((query) => query.startsWith("INSERT INTO devpilot_runs"))).toBe(true);
  });

  it("rejects repositories outside the configured allowlist", async () => {
    const response = await handleDevPilotRunRequest(new Request(url, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://liza.example", "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Add a utility", repository: "other/repo" }),
    }), env(database().db));
    expect(response.status).toBe(403);
  });

  it("applies the shared per-user rate limiter before inserting a run", async () => {
    const state = database();
    const response = await handleDevPilotRunRequest(new Request(url, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://liza.example", "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Add a utility", repository: "owner/repo" }),
    }), {
      ...env(state.db),
      CHAT_RATE_LIMITER: { limit: async () => ({ success: false }) },
    });
    expect(response.status).toBe(429);
    expect(state.queries.some((query) => query.startsWith("INSERT INTO devpilot_runs"))).toBe(false);
  });

  it("fails closed when the shared rate limiter binding is missing", async () => {
    const state = database();
    const { CHAT_RATE_LIMITER: _limiter, ...withoutLimiter } = env(state.db);
    const response = await handleDevPilotRunRequest(new Request(url, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://liza.example", "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Add a utility", repository: "owner/repo" }),
    }), withoutLimiter);
    expect(response.status).toBe(503);
    expect(state.queries.some((query) => query.startsWith("INSERT INTO devpilot_runs"))).toBe(false);
  });

  it("does not accept task intake while the runtime is disabled", async () => {
    const state = database();
    const response = await handleDevPilotRunRequest(new Request(url, {
      method: "POST",
      headers: { Cookie: cookie, Origin: "https://liza.example", "Content-Type": "application/json" },
      body: JSON.stringify({ task: "Add a utility", repository: "owner/repo" }),
    }), { ...env(state.db), DEVPILOT_ENABLED: "false" });
    expect(response.status).toBe(503);
  });
});
