import { describe, expect, it, vi } from "vitest";
import { createD1QueueStore, processD1TaskQueue } from "@/lib/agents/task-queue-worker";
import { buildManagerPlan } from "@/lib/agents/manager";
import { listAgents } from "@/lib/agents/registry";

function fakeDb(firstResult: unknown = null) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() { calls.push({ sql, values }); return { success: true, meta: { changes: 1 } }; },
            async first<T>() { calls.push({ sql, values }); return firstResult as T | null; },
            async all<T>() { calls.push({ sql, values }); return { success: true, results: [] as T[] }; },
          };
        },
      };
    },
  };
  return { db, calls };
}

describe("D1 background task queue", () => {
  it("atomically claims only one queued task and increments its bounded attempt", async () => {
    const row = { id: "task-1", workspace_id: "workspace-1", user_id: "user-1", status: "running", input_summary: "research", plan_json: "{}", worker_attempt_count: 1 };
    const { db, calls } = fakeDb(row);
    const store = createD1QueueStore(db);
    const claimed = await store.claimNext({ owner: "worker-1", now: "2026-11-17T10:00:00.000Z", leaseUntil: "2026-11-17T10:01:30.000Z" });
    expect(claimed).toEqual(row);
    expect(calls[0]?.sql).toContain("UPDATE agent_tasks");
    expect(calls[0]?.sql).toContain("RETURNING");
    expect(calls[0]?.sql).toContain("status = 'queued'");
    expect(calls[0]?.values).toContain(2);
  });

  it("recovers expired leases and makes the task eligible for a bounded retry", async () => {
    const { db, calls } = fakeDb();
    const store = createD1QueueStore(db);
    await store.recoverExpired("2026-11-17T10:00:00.000Z");
    expect(calls[0]?.sql).toContain("lease_expires_at <= ?");
    expect(calls[0]?.sql).toContain("worker_attempt_count < ?");
    expect(calls[0]?.values).toEqual([2, "2026-11-17T10:00:00.000Z", "2026-11-17T10:00:00.000Z"]);
  });

  it("requires the current lease owner to heartbeat or finish", async () => {
    const { db, calls } = fakeDb();
    const store = createD1QueueStore(db);
    await store.heartbeat({ id: "task-1", owner: "worker-1", now: "2026-11-17T10:00:20.000Z", leaseUntil: "2026-11-17T10:01:50.000Z" });
    await store.finish({ id: "task-1", owner: "worker-1", status: "completed", result: { output: "ok" }, now: "2026-11-17T10:00:21.000Z" });
    expect(calls[0]?.sql).toContain("lease_owner = ?");
    expect(calls[1]?.sql).toContain("lease_owner = ?");
    expect(calls[1]?.sql).toContain("status = 'running'");
  });

  it("rejects completion after the lease has expired, even if the old worker still owns the row", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = { prepare(sql: string) { return { bind(...values: unknown[]) { return { async run() { calls.push({ sql, values }); return { success: true, meta: { changes: 0 } }; }, async first<T>() { return null as T | null; }, async all<T>() { return { success: true, results: [] as T[] }; } }; } }; } };
    const store = createD1QueueStore(db);
    const now = "2026-11-17T10:02:00.000Z";
    const finished = await store.finish({ id: "task-1", owner: "worker-old", status: "completed", result: { output: "late" }, now });
    expect(finished).toBe(false);
    expect(calls[0]?.sql).toContain("lease_expires_at > ?");
    expect(calls[0]?.values).toEqual(["completed", JSON.stringify({ output: "late" }), now, "task-1", "worker-old", now]);
  });

  it("rejects malformed completion metadata before issuing a D1 write", async () => {
    const { db, calls } = fakeDb();
    const store = createD1QueueStore(db);
    await expect(store.finish({ id: "bad id", owner: "worker-1", status: "completed", result: {}, now: "2026-11-17T10:00:00.000Z" })).rejects.toThrow("Invalid queue task completion");
    expect(calls).toHaveLength(0);
  });

  it("executes a claimed low-risk Manager task and persists its final output", async () => {
    const inputSummary = "Research current trends in cloud computing";
    const plan = buildManagerPlan(inputSummary, listAgents());
    const row = {
      id: "task-queue-1", workspace_id: "workspace-1", user_id: "user-1",
      status: "running", input_summary: inputSummary, plan_json: JSON.stringify(plan),
      worker_attempt_count: 1,
    };
    const { db, calls } = fakeDb(row);
    const result = await processD1TaskQueue(
      { ACTION_DB: db, GROQ_API_KEY: "test-key" },
      {
        now: () => new Date("2026-11-17T10:00:00.000Z"),
        owner: () => "worker-test-1",
        runner: async () => new Response('0:"Queue execution result"\n'),
      },
    );
    expect(result).toEqual({ recovered: 1, claimed: true, taskId: "task-queue-1" });
    expect(calls).toHaveLength(3);
    expect(calls[2]?.sql).toContain("lease_owner = ?");
    expect(calls[2]?.values[0]).toBe("completed");
    expect(String(calls[2]?.values[1])).toContain("Queue execution result");
  });

  it("fails closed when a high-risk queued task has no valid approval", async () => {
    const inputSummary = "Publish this announcement to LinkedIn";
    const plan = buildManagerPlan(inputSummary, listAgents());
    const row = {
      id: "task-queue-risk", workspace_id: "workspace-1", user_id: "user-1",
      status: "running", input_summary: inputSummary, plan_json: JSON.stringify(plan),
      worker_attempt_count: 1,
    };
    const { db, calls } = fakeDb(row);
    const runner = vi.fn(async () => new Response('0:"must not run"\n'));
    await processD1TaskQueue(
      { ACTION_DB: db, GROQ_API_KEY: "test-key" },
      {
        now: () => new Date("2026-11-17T10:00:00.000Z"),
        owner: () => "worker-risk-1",
        runner,
      },
    );
    expect(runner).not.toHaveBeenCalled();
    expect(calls.at(-1)?.values[0]).toBe("failed");
  });

  it("cancels a stalled output stream on timeout and records failure, not user cancellation", async () => {
    const inputSummary = "Research current trends in cloud computing";
    const plan = buildManagerPlan(inputSummary, listAgents());
    const row = {
      id: "task-queue-timeout", workspace_id: "workspace-1", user_id: "user-1",
      status: "running", input_summary: inputSummary, plan_json: JSON.stringify(plan),
      worker_attempt_count: 1,
    };
    const { db, calls } = fakeDb(row);
    await processD1TaskQueue(
      { ACTION_DB: db, GROQ_API_KEY: "test-key" },
      {
        now: () => new Date("2026-11-17T10:00:00.000Z"),
        owner: () => "worker-timeout-1",
        timeoutMs: 5,
        runner: async () => new Response(new ReadableStream<Uint8Array>({ start() {} })),
      },
    );
    expect(calls.at(-1)?.values[0]).toBe("failed");
    expect(String(calls.at(-1)?.values[1])).toContain("timed out");
  });

  it("does not process without a configured D1 binding", async () => {
    await expect(processD1TaskQueue({})).rejects.toThrow("ACTION_DB is not configured");
  });
});
