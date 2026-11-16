import { describe, expect, it } from "vitest";
import { handleTaskExecutionRequest } from "@/lib/agents/task-execution-api";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/tasks/execute";

function makeDatabase(status: "queued" | "needs_approval" = "queued", claimAllowed = true) {
  const rows: Record<string, unknown>[] = [{
    id: "task-1", workspace_id: "workspace-1", user_id: "user-1", status,
    input_summary: "Prepare a research brief", plan_json: "{}", result_json: null,
    created_at: "2026-11-16T00:00:00.000Z", updated_at: "2026-11-16T00:00:00.000Z",
  }];
  const queries: string[] = [];
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
              return null;
            },
            all: async <T = Record<string, unknown>>() => ({ success: true, results: rows as unknown as T[] }),
            run: async () => {
              if (query.includes("SET status=?") && query.includes("status=?")) {
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
  return { database, rows, queries };
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
      async ({ messages, signal }) => {
        invoked = true;
        expect(messages[0]?.role).toBe("user");
        expect(signal.aborted).toBe(false);
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

  it("rejects cross-origin execution before touching D1", async () => {
    const { database, queries } = makeDatabase();
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }, "https://evil.example"), env(database), async () => new Response());
    expect(response.status).toBe(403);
    expect(queries).toEqual([]);
  });

  it("blocks missing provider configuration before claiming a task", async () => {
    const { database, rows } = makeDatabase();
    const response = await handleTaskExecutionRequest(post({ taskId: "task-1" }), { ACTION_DB: database }, async () => new Response());
    expect(response.status).toBe(503);
    expect(rows[0]?.["status"]).toBe("queued");
  });
});
