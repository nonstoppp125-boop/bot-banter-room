import { describe, expect, it } from "vitest";
import { handleTaskRequest } from "@/lib/agents/task-api";
import { buildManagerPlan } from "@/lib/agents/manager";
import { listAgents } from "@/lib/agents/registry";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/tasks";

function makeDatabase(membership: "owner" | "member" | null = "owner") {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const rows: Record<string, unknown>[] = [];
  let approvalRow: Record<string, unknown> | null = null;
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
              if (query.includes("FROM agent_tasks")) {
                const [id, workspaceId, userId] = values;
                return rows.find((row) => row["id"] === id && row["workspace_id"] === workspaceId && row["user_id"] === userId) as T ?? null;
              }
              if (query.includes("FROM approvals a JOIN workspace_members")) return approvalRow as T ?? null;
              return null;
            },
            all: async <T = Record<string, unknown>>() => ({ success: true, results: rows as unknown as T[] }),
            run: async () => {
              if (query.startsWith("INSERT INTO approvals")) {
                const [id, workspaceId, userId, actionType, payloadHash, summary, expiresAt, createdAt] = values;
                approvalRow = {
                  id, workspace_id: workspaceId, user_id: userId, action_type: actionType,
                  payload_hash: payloadHash, summary, status: "pending", expires_at: expiresAt,
                  created_at: createdAt, decided_by_user_id: null, decision_reason: null, decided_at: null,
                };
                return { success: true, meta: { changes: 1 } };
              }
              if (query.startsWith("INSERT INTO agent_tasks")) {
                const [id, workspaceId, userId, status, inputSummary, plan, result, createdAt, updatedAt] = values;
                rows.push({
                  id, workspace_id: workspaceId, user_id: userId, status,
                  input_summary: inputSummary, plan_json: plan, result_json: result,
                  created_at: createdAt, updated_at: updatedAt,
                });
              }
              if (query.startsWith("UPDATE agent_tasks")) {
                if (query.includes("EXISTS (SELECT 1 FROM approvals a")) {
                  const [updatedAt, id, workspaceId, userId, approvalId, approvalWorkspace, actionType, payloadHash, expiresAt] = values;
                  const row = rows.find((item) => item["id"] === id && item["workspace_id"] === workspaceId && item["user_id"] === userId && item["status"] === "needs_approval");
                  const validApproval = approvalRow && approvalRow["id"] === approvalId && approvalRow["workspace_id"] === approvalWorkspace &&
                    approvalRow["status"] === "approved" && approvalRow["action_type"] === actionType &&
                    approvalRow["payload_hash"] === payloadHash && Date.parse(String(approvalRow["expires_at"])) > Date.parse(String(expiresAt));
                  if (row && validApproval) { row["status"] = "queued"; row["updated_at"] = updatedAt; return { success: true, meta: { changes: 1 } }; }
                  return { success: true, meta: { changes: 0 } };
                }
                if (query.includes("attempt_count = attempt_count + 1")) {
                  const [updatedAt, id, workspaceId, userId] = values;
                  const row = rows.find((item) => item["id"] === id && item["workspace_id"] === workspaceId && item["user_id"] === userId && item["status"] === "failed" && Number(item["attempt_count"] ?? 0) < 2);
                  if (row) { row["status"] = "queued"; row["attempt_count"] = Number(row["attempt_count"] ?? 0) + 1; row["updated_at"] = updatedAt; return { success: true, meta: { changes: 1 } }; }
                  return { success: true, meta: { changes: 0 } };
                }
                const [status, , , updatedAt, id, workspaceId, userId, expectedStatus] = values;
                const row = rows.find((item) => item["id"] === id && item["workspace_id"] === workspaceId && item["user_id"] === userId && item["status"] === expectedStatus);
                if (row) { row["status"] = status; row["updated_at"] = updatedAt; return { success: true, meta: { changes: 1 } }; }
                return { success: true, meta: { changes: 0 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { database, queries, bindings, rows, get approvalRow() { return approvalRow; } };
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

  it("requires the exact JSON media type before accessing storage", async () => {
    const { database, queries } = makeDatabase();
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/jsonp", cookie },
      body: JSON.stringify({ task: "Research this" }),
    });
    expect((await handleTaskRequest(request, { ACTION_DB: database })).status).toBe(415);
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
    expect(queries.some((query) => query.startsWith("INSERT INTO approvals"))).toBe(true);
    expect(queries.some((query) => query.startsWith("INSERT INTO agent_tasks"))).toBe(true);
    expect((JSON.parse(String(rows[0]?.["plan_json"])) as Record<string, unknown>)["approval"]).toBeDefined();
    expect(queries.some((query) => query.includes("UPDATE agent_tasks"))).toBe(false);
  });

  it("unlocks a high-risk task only after a matching persisted approval is decided", async () => {
    const state = makeDatabase();
    const create = await handleTaskRequest(post({ task: "Publish this LinkedIn post" }), { ACTION_DB: state.database });
    expect(create.status).toBe(201);
    const created = await create.json() as { task: { id: string; status: string } };
    expect(created.task.status).toBe("needs_approval");
    expect(state.approvalRow).not.toBeNull();
    const patch = () => new Request(url, {
      method: "PATCH",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "unlock", taskId: created.task.id }),
    });
    const pending = await handleTaskRequest(patch(), { ACTION_DB: state.database });
    expect(pending.status).toBe(409);
    expect(state.rows[0]?.["status"]).toBe("needs_approval");
    state.approvalRow!["status"] = "approved";
    state.approvalRow!["decided_by_user_id"] = "workspace-admin";
    state.approvalRow!["decision_reason"] = "Reviewed and approved";
    state.approvalRow!["decided_at"] = new Date().toISOString();
    const unlocked = await handleTaskRequest(patch(), { ACTION_DB: state.database });
    expect(unlocked.status).toBe(200);
    expect((await unlocked.json() as { task: { status: string } }).task.status).toBe("queued");
    expect(state.rows[0]?.["status"]).toBe("queued");
    expect(state.queries.some((query) => query.includes("a.status = 'approved'") && query.includes("a.payload_hash = ?"))).toBe(true);
  });

  it("cancels only an owned queued task with a same-origin PATCH", async () => {
    const { database, rows } = makeDatabase();
    const create = await handleTaskRequest(post({ task: "Prepare a research brief" }), { ACTION_DB: database });
    expect(create.status).toBe(201);
    const created = await create.json() as { task: { id: string; status: string } };
    expect(created.task.status).toBe("queued");
    const response = await handleTaskRequest(new Request(url, {
      method: "PATCH",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "cancel", taskId: created.task.id }),
    }), { ACTION_DB: database });
    expect(response.status).toBe(200);
    expect((await response.json() as { task: { status: string } }).task.status).toBe("cancelled");
    expect(rows[0]?.["status"]).toBe("cancelled");
  });

  it("rejects cross-origin task cancellation before accessing D1", async () => {
    const { database, queries } = makeDatabase();
    const response = await handleTaskRequest(new Request(url, {
      method: "PATCH",
      headers: { origin: "https://evil.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "cancel", taskId: "task-1" }),
    }), { ACTION_DB: database });
    expect(response.status).toBe(403);
    expect(queries).toEqual([]);
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
  it("requeues failed low-risk tasks atomically within a two-retry budget", async () => {
    const { database, rows, queries } = makeDatabase();
    const plan = buildManagerPlan("Prepare a research brief", listAgents());
    rows.push({
      id: "failed-task", workspace_id: "workspace-1", user_id: "user-1", status: "failed",
      input_summary: "Prepare a research brief", plan_json: JSON.stringify(plan), result_json: JSON.stringify({ error: "provider timeout" }),
      created_at: "2026-11-16T10:00:00.000Z", updated_at: "2026-11-16T10:00:00.000Z", attempt_count: 0,
    });
    const patch = () => new Request(url, {
      method: "PATCH", headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "retry", taskId: "failed-task" }),
    });
    const first = await handleTaskRequest(patch(), { ACTION_DB: database });
    expect(first.status).toBe(200);
    const row = rows.find((item) => item["id"] === "failed-task")!;
    expect(row["status"]).toBe("queued");
    row["status"] = "failed";
    const second = await handleTaskRequest(patch(), { ACTION_DB: database });
    expect(second.status).toBe(200);
    row["status"] = "failed";
    const exhausted = await handleTaskRequest(patch(), { ACTION_DB: database });
    expect(exhausted.status).toBe(409);
    expect(queries.some((query) => query.includes("attempt_count = attempt_count + 1") && query.includes("attempt_count < 2"))).toBe(true);
  });

  it("never retries a high-risk persisted plan", async () => {
    const { database, rows } = makeDatabase();
    const summary = "Publish this LinkedIn post";
    rows.push({
      id: "high-risk-task", workspace_id: "workspace-1", user_id: "user-1", status: "failed",
      input_summary: summary, plan_json: JSON.stringify(buildManagerPlan(summary, listAgents())), result_json: null,
      created_at: "2026-11-16T10:00:00.000Z", updated_at: "2026-11-16T10:00:00.000Z", attempt_count: 0,
    });
    const response = await handleTaskRequest(new Request(url, {
      method: "PATCH", headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ action: "retry", taskId: "high-risk-task" }),
    }), { ACTION_DB: database });
    expect(response.status).toBe(409);
    expect(rows.find((item) => item["id"] === "high-risk-task")?.["status"]).toBe("failed");
  });

});
