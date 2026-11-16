import { describe, expect, it } from "vitest";
import { handleTaskRequest } from "@/lib/agents/task-api";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/tasks";

function makeDatabase(membership: "owner" | "member" | null = "owner") {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const rows: Record<string, unknown>[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM workspace_members")) {
                return membership ? { workspace_id: "workspace-1", user_id: "user-1", role: membership } as T : null;
              }
              if (query.includes("FROM sessions")) {
                return {
                  id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
                  expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
                } as T;
              }
              return null;
            },
            all: async <T = Record<string, unknown>>() => ({ success: true, results: rows as unknown as T[] }),
            run: async () => {
              if (query.startsWith("INSERT INTO agent_tasks")) {
                const [id, workspaceId, userId, status, inputSummary, plan, result, createdAt, updatedAt] = values;
                rows.push({
                  id, workspace_id: workspaceId, user_id: userId, status,
                  input_summary: inputSummary, plan_json: plan, result_json: result,
                  created_at: createdAt, updated_at: updatedAt,
                });
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { database, queries, bindings, rows };
}

function post(body: unknown, origin = "https://liza.example") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

describe("authenticated Manager task API", () => {
  it("rejects cross-origin creation before accessing D1", async () => {
    const { database, queries } = makeDatabase();
    const response = await handleTaskRequest(post({ task: "Research this" }, "https://evil.example"), { ACTION_DB: database });
    expect(response.status).toBe(403);
    expect(queries).toEqual([]);
  });

  it("requires a session and configured D1 binding", async () => {
    expect((await handleTaskRequest(new Request(url), {})).status).toBe(503);
    const { database } = makeDatabase();
    expect((await handleTaskRequest(new Request(url), { ACTION_DB: database })).status).toBe(401);
  });

  it("persists a workspace/user-scoped Manager plan without executing it", async () => {
    const { database, queries, rows } = makeDatabase();
    const response = await handleTaskRequest(post({ task: "Publish this LinkedIn post" }), { ACTION_DB: database });
    expect(response.status).toBe(201);
    const payload = await response.json() as { task: { status: string; plan: { approvalRequired: boolean } } };
    expect(payload.task.status).toBe("needs_approval");
    expect(payload.task.plan.approvalRequired).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workspace_id: "workspace-1", user_id: "user-1", status: "needs_approval" });
    expect(queries.some((query) => query.startsWith("INSERT INTO agent_tasks"))).toBe(true);
    expect(queries.some((query) => query.includes("UPDATE agent_tasks"))).toBe(false);
  });

  it("blocks a session whose workspace membership has been revoked", async () => {
    const { database } = makeDatabase(null);
    const response = await handleTaskRequest(new Request(url, { headers: { cookie } }), { ACTION_DB: database });
    expect(response.status).toBe(403);
  });

  it("lists only tasks scoped to the authenticated workspace and user", async () => {
    const { database, queries, bindings } = makeDatabase();
    const response = await handleTaskRequest(new Request(url, { headers: { cookie } }), { ACTION_DB: database });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tasks: [] });
    expect(queries.some((query) => query.includes("WHERE workspace_id=? AND user_id=?"))).toBe(true);
    expect(bindings.some((values) => values.includes("workspace-1") && values.includes("user-1"))).toBe(true);
  });

  it("rejects oversized streamed bodies before buffering the full payload", async () => {
    const { database } = makeDatabase();
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: "x".repeat(24_001),
    });
    expect((await handleTaskRequest(request, { ACTION_DB: database })).status).toBe(413);
  });

  it("rejects malformed JSON and oversized declared bodies", async () => {
    const { database } = makeDatabase();
    const malformed = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: "{",
    });
    expect((await handleTaskRequest(malformed, { ACTION_DB: database })).status).toBe(400);
    const oversized = new Request(url, {
      method: "POST",
      headers: {
        origin: "https://liza.example",
        "content-type": "application/json",
        "content-length": "24001",
        cookie,
      },
      body: "{}",
    });
    expect((await handleTaskRequest(oversized, { ACTION_DB: database })).status).toBe(413);
  });

  it("rejects malformed task payloads", async () => {
    const { database } = makeDatabase();
    expect((await handleTaskRequest(post({ task: "  " }), { ACTION_DB: database })).status).toBe(400);
    expect((await handleTaskRequest(post({ task: "x".repeat(20_001) }), { ACTION_DB: database })).status).toBe(400);
  });
});
