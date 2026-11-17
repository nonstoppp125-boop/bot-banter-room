import { describe, expect, it, vi } from "vitest";
import { createD1QueueStore, processD1TaskQueue } from "@/lib/agents/task-queue-worker";

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
    const row = { id: "task-1", workspace_id: "workspace-1", user_id: "user-1", status: "running", input_summary: "research", plan_json: "{}", attempt_count: 1 };
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
    expect(calls[0]?.sql).toContain("attempt_count < ?");
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

  it("does not process without a configured D1 binding", async () => {
    await expect(processD1TaskQueue({})).rejects.toThrow("ACTION_DB is not configured");
  });
});
