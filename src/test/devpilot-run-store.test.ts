import { describe, expect, it } from "vitest";
import { createDevPilotRunStore } from "@/lib/agents/devpilot-run-store";

const now = "2026-11-20T06:00:00.000Z";
function database(changes = 1, rows: unknown[] = []) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    db: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return {
              async run() { return { success: true, meta: { changes } }; },
              async first<T>() { return null as T | null; },
              async all<T>() { return { success: true, results: rows as T[] }; },
            };
          },
        };
      },
    },
  };
}
const identity = { id: "run-123", workspaceId: "workspace-1", userId: "user-1" };

describe("DevPilot durable run store", () => {
  it("creates runs only for workspace members with a bounded initial checkpoint", async () => {
    const mock = database();
    await createDevPilotRunStore(mock.db).create({
      ...identity, repository: "owner/repo", baseBranch: "main", task: "Add tests", now,
      checkpoint: { stage: "planned" },
    });
    expect(mock.calls[0]?.sql).toContain("EXISTS (SELECT 1 FROM workspace_members");
    expect(mock.calls[0]?.sql).toContain("'queued', 0, 0");
  });

  it("claims queued work atomically and can recover only expired leases", async () => {
    const mock = database();
    const claimed = await createDevPilotRunStore(mock.db).claim({
      ...identity, owner: "worker-1", now, leaseUntil: "2026-11-20T06:01:00.000Z",
    });
    expect(claimed).toBe(true);
    expect(mock.calls[0]?.sql).toContain("status = 'queued'");
    expect(mock.calls[0]?.sql).toContain("lease_expires_at <= ?");
    expect(mock.calls[0]?.sql).toContain("worker_attempt_count < 2");
    expect(mock.calls[0]?.sql).toContain("worker_attempt_count = worker_attempt_count + 1");
  });

  it("claims the oldest queued or expired run atomically for a bounded worker lease", async () => {
    const mock = database();
    const claimed = await createDevPilotRunStore(mock.db).claimNext({
      owner: "worker-1", now, leaseUntil: "2026-11-20T06:01:00.000Z",
    });
    expect(claimed).toBeNull();
    expect(mock.calls[0]?.sql).toContain("RETURNING id, workspace_id, user_id");
    expect(mock.calls[0]?.sql).toContain("worker_attempt_count < 2");
    expect(mock.calls[0]?.sql).toContain("ORDER BY created_at ASC LIMIT 1");
    expect(mock.calls[0]?.sql).toContain("NOT EXISTS (SELECT 1 FROM devpilot_runs active");
    expect(mock.calls[0]?.sql).toContain("lease_expires_at <= ?");
  });

  it("recovers expired runs only after the bounded worker-attempt budget is exhausted", async () => {
    const mock = database();
    const recovered = await createDevPilotRunStore(mock.db).recoverExpired({ now });
    expect(recovered).toBe(1);
    expect(mock.calls[0]?.sql).toContain("worker_attempt_count >= 2");
    expect(mock.calls[0]?.sql).toContain("status = 'failed'");
    expect(mock.calls[0]?.sql).toContain("json_remove(checkpoint_json, '$.data.proposalFiles')");
  });

  it("rejects DevPilot worker leases longer than two minutes", async () => {
    const store = createDevPilotRunStore(database().db);
    await expect(store.claim({
      ...identity, owner: "worker-1", now,
      leaseUntil: new Date(Date.parse(now) + 121_000).toISOString(),
    })).rejects.toThrow("Invalid DevPilot lease claim");
  });

  it("uses owner-bound lease and checkpoint-version compare-and-swap", async () => {
    const mock = database();
    const saved = await createDevPilotRunStore(mock.db).checkpoint({
      ...identity, owner: "worker-1", expectedVersion: 2, progress: 50,
      checkpoint: { stage: "validation" }, now,
    });
    expect(saved).toBe(true);
    expect(mock.calls[0]?.sql).toContain("checkpoint_version = ?");
    expect(mock.calls[0]?.sql).toContain("lease_owner = ?");
    expect(mock.calls[0]?.sql).toContain("progress <= ?");
  });

  it("releases the lease when a run pauses for human approval", async () => {
    const mock = database();
    await createDevPilotRunStore(mock.db).checkpoint({
      ...identity, owner: "worker-1", expectedVersion: 1, progress: 25,
      checkpoint: { stage: "awaiting_approval" }, status: "awaiting_approval", now,
    });
    expect(mock.calls[0]?.sql).toContain("lease_owner = CASE WHEN ? = 1 THEN NULL");
    expect(mock.calls[0]?.values).toContain(1);
  });

  it("preserves the stored progress when a resumed worker replays earlier stages", async () => {
    const mock = database();
    const writer = (await import("@/lib/agents/devpilot-run-store")).createDevPilotCheckpointWriter(mock.db, {
      ...identity, owner: "worker-2", initialVersion: 4, initialProgress: 25, now: () => new Date(now),
    });
    await writer({ progress: 10, stage: "repository-verified", data: {} });
    expect(mock.calls).toHaveLength(0);
    await writer({ progress: 25, stage: "plan-created", data: {} });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.values).toContain(4);
  });

  it("resumes only when the exact DevPilot approval is approved and unexpired", async () => {
    const mock = database();
    const resumed = await createDevPilotRunStore(mock.db).resumeApproved({
      ...identity, approvalId: "approval-123", repository: "owner/repo",
      payloadHash: "a".repeat(64), now,
    });
    expect(resumed).toBe(true);
    expect(mock.calls[0]?.sql).toContain("status = 'awaiting_approval'");
    expect(mock.calls[0]?.sql).toContain("a.payload_hash = ?");
    expect(mock.calls[0]?.sql).toContain("a.status = 'approved'");
    expect(mock.calls[0]?.sql).toContain("a.expires_at > ?");
    expect(mock.calls[0]?.sql).toContain("json_remove(checkpoint_json, '$.data.proposalFiles')");
    expect(mock.calls[0]?.sql).toContain("worker_attempt_count = 0");
    expect(mock.calls[0]?.sql).toContain("json_set(json_remove(checkpoint_json");
    expect(mock.calls[0]?.values).toContain("approval-123");
    expect(mock.calls[0]?.values).toContain("a".repeat(64));
  });

  it("marks a waiting DevPilot run blocked after the exact approval is rejected", async () => {
    const mock = database();
    const blocked = await createDevPilotRunStore(mock.db).rejectAwaitingApproval({
      ...identity, approvalId: "approval-123", repository: "owner/repo",
      payloadHash: "a".repeat(64), now,
    });
    expect(blocked).toBe(true);
    expect(mock.calls[0]?.sql).toContain("status = 'awaiting_approval'");
    expect(mock.calls[0]?.sql).toContain("a.status = 'rejected'");
    expect(mock.calls[0]?.sql).toContain("a.payload_hash = ?");
  });

  it("appends evidence only when the run belongs to the same workspace and user", async () => {
    const mock = database();
    await createDevPilotRunStore(mock.db).appendEvent({
      ...identity, id: "event-1", runId: identity.id, type: "verified",
      timestamp: now, summary: "Typecheck passed", evidence: ["npm run typecheck"],
    });
    expect(mock.calls[0]?.sql).toContain("WHERE EXISTS (SELECT 1 FROM devpilot_runs");
    expect(mock.calls[0]?.values).toContain(identity.workspaceId);
    expect(mock.calls[0]?.values).toContain(identity.userId);
  });

  it("fails closed when a lease is lost or a compare-and-swap update affects no row", async () => {
    const mock = database(0);
    const saved = await createDevPilotRunStore(mock.db).checkpoint({
      ...identity, owner: "worker-1", expectedVersion: 0, progress: 25, checkpoint: {}, now,
    });
    expect(saved).toBe(false);
  });

  it("rejects invalid progress, oversized checkpoints and invalid event metadata", async () => {
    const store = createDevPilotRunStore(database().db);
    await expect(store.checkpoint({
      ...identity, owner: "worker-1", expectedVersion: 0, progress: 101, checkpoint: {}, now,
    })).rejects.toThrow("Invalid DevPilot checkpoint");
    await expect(store.checkpoint({
      ...identity, owner: "worker-1", expectedVersion: 0, progress: 20, checkpoint: "x".repeat(100_001), now,
    })).rejects.toThrow("storage limit");
    await expect(store.appendEvent({
      ...identity, id: "", runId: identity.id, type: "verified", timestamp: "invalid", summary: "",
    })).rejects.toThrow("Invalid DevPilot event");
  });
});
