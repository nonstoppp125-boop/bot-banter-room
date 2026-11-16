import { describe, expect, it } from "vitest";
import { canTransitionTaskStatus, createD1TaskStore } from "@/lib/agents/task-store";

describe("durable agent task store", () => {
  it("scopes task reads by workspace and user and uses optimistic status updates", async () => {
    let row: Record<string, unknown> = {
      id: "task-1",
      workspace_id: "w1",
      user_id: "u1",
      status: "queued",
      input_summary: "Do task",
      plan_json: "{}",
      result_json: null,
      created_at: "2026-11-16T10:00:00Z",
      updated_at: "2026-11-16T10:00:00Z",
    };
    let lastQuery = "";
    const db = {
      prepare: (query: string) => ({
        bind: (...values: unknown[]) => ({
          first: async () => {
            lastQuery = query;
            return values[0] === "task-1" && values[1] === "w1" && values[2] === "u1" ? row : null;
          },
          all: async () => ({ success: true, results: [row] }),
          run: async () => ({ success: true, meta: { changes: query.startsWith("UPDATE") ? 1 : 1 } }),
        }),
      }),
    };
    const store = createD1TaskStore(db as unknown as Parameters<typeof createD1TaskStore>[0]);
    expect(await store.get({ id: "task-1", workspaceId: "w1", userId: "u1" })).toMatchObject({ status: "queued" });
    expect(lastQuery).toContain("workspace_id=? AND user_id=?");
    expect(await store.update({
      id: "task-1", workspaceId: "w1", userId: "u1",
      expectedStatus: "queued", status: "running", updatedAt: "2026-11-16T10:01:00Z",
    })).toBe(true);
    expect(await store.list({ workspaceId: "w1", userId: "u1" })).toHaveLength(1);
  });

  it("atomically claims only queued tasks within the requested workspace and owner", async () => {
    let statement = "";
    let values: unknown[] = [];
    const db = {
      prepare: (query: string) => ({
        bind: (...bound: unknown[]) => ({
          first: async () => null,
          all: async () => ({ success: true, results: [] }),
          run: async () => {
            statement = query;
            values = bound;
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    };
    const store = createD1TaskStore(db as unknown as Parameters<typeof createD1TaskStore>[0]);
    expect(await store.claim({
      id: "task-1", workspaceId: "w1", userId: "u1", updatedAt: "2026-11-16T10:02:00Z",
    })).toBe(true);
    expect(statement).toContain("WHERE id=? AND workspace_id=? AND user_id=? AND status=?");
    expect(values).toEqual(["running", "2026-11-16T10:02:00Z", "task-1", "w1", "u1", "queued"]);
  });

  it("rejects malformed task claim identities before touching D1", async () => {
    let calls = 0;
    const db = {
      prepare: () => {
        calls++;
        throw new Error("D1 must not be called");
      },
    };
    const store = createD1TaskStore(db as unknown as Parameters<typeof createD1TaskStore>[0]);
    await expect(store.claim({
      id: "bad id", workspaceId: "w1", userId: "u1", updatedAt: "2026-11-16T10:02:00Z",
    })).rejects.toThrow("Invalid task claim.");
    expect(calls).toBe(0);
  });

  it("allows only forward execution transitions", () => {
    expect(canTransitionTaskStatus("queued", "running")).toBe(true);
    expect(canTransitionTaskStatus("running", "completed")).toBe(true);
    expect(canTransitionTaskStatus("running", "failed")).toBe(true);
    expect(canTransitionTaskStatus("queued", "cancelled")).toBe(true);
    expect(canTransitionTaskStatus("running", "cancelled")).toBe(true);
    expect(canTransitionTaskStatus("needs_approval", "cancelled")).toBe(true);
    expect(canTransitionTaskStatus("needs_approval", "queued")).toBe(false);
    expect(canTransitionTaskStatus("queued", "completed")).toBe(false);
    expect(canTransitionTaskStatus("completed", "queued")).toBe(false);
    expect(canTransitionTaskStatus("failed", "running")).toBe(false);
    expect(canTransitionTaskStatus("cancelled", "running")).toBe(false);
  });

  it("rejects invalid transitions before issuing a database update", async () => {
    let updateCalls = 0;
    const db = {
      prepare: (query: string) => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ success: true, results: [] }),
          run: async () => {
            if (query.startsWith("UPDATE")) updateCalls++;
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    };
    const store = createD1TaskStore(db as unknown as Parameters<typeof createD1TaskStore>[0]);
    await expect(store.update({
      id: "task-1", workspaceId: "w1", userId: "u1",
      expectedStatus: "needs_approval", status: "queued", updatedAt: "2026-11-16T10:01:00Z",
    })).rejects.toThrow("Invalid task status transition.");
    await expect(store.update({
      id: "task-1", workspaceId: "w1", userId: "u1",
      expectedStatus: "completed", status: "running", updatedAt: "2026-11-16T10:01:00Z",
    })).rejects.toThrow("Invalid task status transition.");
    expect(updateCalls).toBe(0);
  });
});
