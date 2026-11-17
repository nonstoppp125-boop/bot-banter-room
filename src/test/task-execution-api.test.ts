import { describe, expect, it } from "vitest";
import { handleTaskExecutionRequest } from "@/lib/agents/task-execution-api";
import { buildManagerPlan } from "@/lib/agents/manager";
import { listAgents } from "@/lib/agents/registry";
import { createManagerTaskApproval } from "@/lib/agents/task-approval";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/tasks/execute";

function makeDatabase(status: "queued" | "needs_approval" = "queued", claimAllowed = true, inputSummary = "Prepare a research brief") {
  const rows: Record<string, unknown>[] = [{
    id: "task-1", workspace_id: "workspace-1", user_id: "user-1", status,
    input_summary: inputSummary, plan_json: JSON.stringify(buildManagerPlan(inputSummary, listAgents())), result_json: null,
    created_at: "2026-11-16T00:00:00.000Z", updated_at: "2026-11-16T00:00:00.000Z",
  }];
  const queries: string[] = [];
  let approvalRow: Record<string, unknown> | null = null;
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM sessions")) return {
                id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
                expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
              } as T;
              if (query.includes("FROM workspace_members")) return {
                workspace_id: "workspace-1", user_id: "user-1", role: "owner",
              } as T;
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
              if (query.startsWith("UPDATE agent_tasks") && values.length === 6) {
                const [nextStatus, , id, workspaceId, userId, expectedStatus] = values;
                const row = rows.find((item) => item["id"] === id && item["workspace_id"] === workspaceId && item["user_id"] === userId && item["status"] === expectedStatus);
                if (!row || (expectedStatus === "queued" && !claimAllowed)) return { success: true, meta: { changes: 0 } };
                row["status"] = nextStatus;
                row["updated_at"] = values[1];
                return { success: true, meta: { changes: 1 } };
              }
              if (query.startsWith("UPDATE agent_tasks")) {
                const [nextStatus, , resultJson, updatedAt, id, workspaceId, userId, expectedStatus] = values;
                const row = rows.find((item) => item["id"] === id && item["workspace_id"] === workspaceId && item["user_id"] === userId && item["status"] === expectedStatus);
                if (!row) return { success: true, meta: { changes: 0 } };
                row["status"] = nextStatus;
                row["result_json"] = resultJson;
                row["updated_at"] = updatedAt;
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { database, rows, queries, get approvalRow() { return approvalRow; } };
}

function post(body: unknown, origin = "https://liza.example") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

const env = (ACTION_DB: ReturnType<typeof makeDatabase>["database"]) => ({
  ACTION_DB,
  GROQ_API_KEY: "test-key",
  DOOT_MULTI_AGENT: "true",
});

describe("authenticated Manager task execution", () => {
  it("runs the specialist workflow and persists only the completed text result", async () => {
    const { database, rows } = makeDatabase();
    let invoked = false;
    const response = await handleTaskExecutionRequest(
      post({ taskId: "task-1" }),
      env(database),
      async ({ messages, signal, managerPlan }) => {
        invoked = true;
        expect(messages[0]?.role).toBe("user");
        expect(signal.aborted).toBe(false);
        expect(managerPlan).toMatchObject({ summary: "Prepare a research brief", planningMode: "deterministic" });
        return new Response(`0:${JSON.stringify("Research brief completed.")}\n`, { status: 200 });
      },
    );
    expect(response.status).toBe(200);
    expect(invoked).toBe(true);
    expect(rows[0]?.["status"]).toBe("completed");
    expect(JSON.parse(String(rows[0]?.["result_json"]))).toMatchObject({ output: "Research brief completed.", execution: "manager-specialist-workflow" });
  });

  it("never executes high-risk tasks awaiting human approval", async () => {
    const { database } = makeDatabase("needs_approval");
    let invoked = false;
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), env(database), async () => {
      invoked = true;
      return new Response();
    });
    expect(response.status).toBe(409);
    expect(invoked).toBe(false);
  });

  it("recomputes risk from the saved task text and blocks a stale queued high-risk record", async () => {
    const { database, rows } = makeDatabase("queued", true, "Publish this LinkedIn post");
    let invoked = false;
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), env(database), async () => {
      invoked = true;
      return new Response();
    });
    expect(response.status).toBe(409);
    expect(invoked).toBe(false);
    expect(rows[0]?.["status"]).toBe("queued");
  });

  it("rejects a persisted plan whose task summary no longer matches before claiming", async () => {
    const { database, rows } = makeDatabase();
    rows[0]!["plan_json"] = JSON.stringify(buildManagerPlan("Different task text", listAgents()));
    let invoked = false;
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), env(database), async () => {
      invoked = true;
      return new Response();
    });
    expect(response.status).toBe(409);
    expect(invoked).toBe(false);
    expect(rows[0]?.["status"]).toBe("queued");
  });

  it("executes an approval-gated Manager task only after verifying the persisted payload-bound approval", async () => {
    const summary = "Publish this LinkedIn post";
    const state = makeDatabase("queued", true, summary);
    const { database, rows } = state;
    const plan = buildManagerPlan(summary, listAgents());
    const approvalNow = new Date(Date.now() - 60_000).toISOString();
    const approval = await createManagerTaskApproval(database as never, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan, now: approvalNow,
    });
    rows[0]!["plan_json"] = JSON.stringify({ ...plan, approval });
    expect(state.approvalRow).not.toBeNull();
    state.approvalRow!["status"] = "approved";
    state.approvalRow!["decided_by_user_id"] = "workspace-admin";
    state.approvalRow!["decision_reason"] = "Reviewed and approved";
    state.approvalRow!["decided_at"] = new Date(Date.parse(approvalNow) + 30_000).toISOString();
    let invoked = false;
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), env(database), async ({ managerPlan }) => {
      invoked = true;
      expect(managerPlan).toMatchObject({ approvalRequired: true });
      return new Response(`0:${JSON.stringify("Approved draft prepared; nothing was published.")}\n`, { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(invoked).toBe(true);
    expect(rows[0]?.["status"]).toBe("completed");
  });

  it("returns conflict when another worker already claimed the task", async () => {
    const { database, rows } = makeDatabase("queued", false);
    let invoked = false;
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), env(database), async () => {
      invoked = true;
      return new Response();
    });
    expect(response.status).toBe(409);
    expect(invoked).toBe(false);
    expect(rows[0]?.["status"]).toBe("queued");
  });

  it("marks a claimed task failed when the specialist workflow produces no text", async () => {
    const { database, rows } = makeDatabase();
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), env(database), async () => new Response("", { status: 200 }));
    expect(response.status).toBe(502);
    expect(rows[0]?.["status"]).toBe("failed");
  });

  it("propagates user cancellation and persists the cancelled task state", async () => {
    const { database, rows } = makeDatabase();
    const client = new AbortController();
    let announceStarted!: () => void;
    const started = new Promise<void>((resolve) => { announceStarted = resolve; });
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ taskId: "task-1" }),
      signal: client.signal,
    });
    const execution = handleTaskExecutionRequest(request, env(database), async ({ signal }) => {
      announceStarted();
      return await new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("execution aborted")), { once: true });
      });
    });
    await started;
    client.abort();
    const response = await execution;
    expect(response.status).toBe(504);
    expect(rows[0]?.["status"]).toBe("cancelled");
  });

  it("rejects cross-origin execution before touching D1", async () => {
    const { database, queries } = makeDatabase();
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }, "https://evil.example"), env(database), async () => new Response());
    expect(response.status).toBe(403);
    expect(queries).toEqual([]);
  });

  it("rejects oversized streamed commands before claiming a task", async () => {
    const { database, rows } = makeDatabase();
    const response = await handleTaskExecutionRequest(post({ taskId: "x".repeat(3_000) }), env(database), async () => {
      throw new Error("runner must not be invoked");
    });
    expect(response.status).toBe(413);
    expect(rows[0]?.["status"]).toBe("queued");
  });

  it("rejects malformed JSON without touching task state", async () => {
    const { database, rows } = makeDatabase();
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: "{",
    });
    const response = await handleTaskExecutionRequest(request, env(database), async () => {
      throw new Error("runner must not be invoked");
    });
    expect(response.status).toBe(400);
    expect(rows[0]?.["status"]).toBe("queued");
  });

  it("persists a final text delta even when the stream omits its trailing newline", async () => {
    const { database, rows } = makeDatabase();
    const response = await handleTaskExecutionRequest(
      post({ taskId: "task-1" }),
      env(database),
      async () => new Response(`0:${JSON.stringify("Complete without newline.")}`, { status: 200 }),
    );
    expect(response.status).toBe(200);
    expect(rows[0]?.["status"]).toBe("completed");
    expect(JSON.parse(String(rows[0]?.["result_json"]))).toMatchObject({ output: "Complete without newline." });
  });

  it("blocks missing provider configuration before claiming a task", async () => {
    const { database, rows } = makeDatabase();
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), { ACTION_DB: database }, async () => new Response());
    expect(response.status).toBe(503);
    expect(rows[0]?.["status"]).toBe("queued");
  });
});
