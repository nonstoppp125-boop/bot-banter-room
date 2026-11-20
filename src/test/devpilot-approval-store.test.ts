import { describe, expect, it } from "vitest";
import { createDevPilotApprovalStore, createDevPilotApprovalVerifier } from "@/lib/agents/devpilot-approval-store";

const identity = {
  id: "approval-123",
  workspaceId: "workspace-1",
  userId: "user-1",
  taskId: "task-123",
  repository: "owner/repo",
  payloadHash: "a".repeat(64),
};
const approvedRow = {
  id: identity.id,
  workspace_id: identity.workspaceId,
  user_id: identity.userId,
  task_id: identity.taskId,
  repository: identity.repository,
  payload_hash: identity.payloadHash,
  status: "approved" as const,
  decided_by_user_id: "admin-1",
  decision_reason: "Reviewed proposal",
  expires_at: "2026-11-21T00:00:00.000Z",
  created_at: "2026-11-20T00:00:00.000Z",
  decided_at: "2026-11-20T01:00:00.000Z",
};
type ApprovalRow = Omit<typeof approvedRow, "status"> & { status: "pending" | "approved" | "rejected" | "expired" };
function database(row: ApprovalRow | null = approvedRow) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    db: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            calls.push({ sql, values });
            return {
              async run() { return { success: true, meta: { changes: 1 } }; },
              async first<T>() { return row as T | null; },
            };
          },
        };
      },
    },
  };
}

describe("DevPilot durable approval store", () => {
  it("creates an exact proposal approval only for a workspace member", async () => {
    const mock = database();
    const store = createDevPilotApprovalStore(mock.db);
    await store.create({
      ...identity,
      summary: "Review exact code proposal",
      createdAt: "2026-11-20T00:00:00.000Z",
      expiresAt: "2026-11-21T00:00:00.000Z",
    });
    expect(mock.calls[0]?.sql).toContain("EXISTS (SELECT 1 FROM workspace_members");
    expect(mock.calls[0]?.values).toContain(identity.payloadHash);
  });

  it("allows only an owner or admin to decide a pending unexpired approval", async () => {
    const mock = database();
    const store = createDevPilotApprovalStore(mock.db);
    const decided = await store.decide({
      id: identity.id,
      workspaceId: identity.workspaceId,
      actorUserId: "admin-1",
      decision: "approved",
      reason: "Reviewed proposal",
      now: "2026-11-20T01:00:00.000Z",
    });
    expect(decided).toBe(true);
    expect(mock.calls[0]?.sql).toContain("wm.role IN ('owner', 'admin')");
    expect(mock.calls[0]?.sql).toContain("status = 'pending'");
  });

  it("verifies workspace, user, task, repository, exact hash, status and expiry", async () => {
    const mock = database();
    const store = createDevPilotApprovalStore(mock.db);
    const allowed = await store.verify({ ...identity, now: "2026-11-20T02:00:00.000Z" });
    expect(allowed).toBe(true);
    expect(mock.calls[0]?.sql).toContain("a.task_id = ?");
    expect(mock.calls[0]?.sql).toContain("a.repository = ?");
    expect(mock.calls[0]?.values).toContain(identity.payloadHash);
  });

  it("fails closed for pending, expired or missing approval records", async () => {
    const pending = database({ ...approvedRow, status: "pending", decided_by_user_id: null, decided_at: null });
    expect(await createDevPilotApprovalStore(pending.db).verify({ ...identity, now: "2026-11-20T02:00:00.000Z" })).toBe(false);
    const expired = database({ ...approvedRow, expires_at: "2026-11-20T01:00:00.000Z" });
    expect(await createDevPilotApprovalStore(expired.db).verify({ ...identity, now: "2026-11-20T02:00:00.000Z" })).toBe(false);
    const missing = database(null);
    expect(await createDevPilotApprovalStore(missing.db).verify({ ...identity, now: "2026-11-20T02:00:00.000Z" })).toBe(false);
  });

  it("binds a trusted verifier to the current workspace and user", async () => {
    const mock = database();
    const verify = createDevPilotApprovalVerifier(mock.db, {
      workspaceId: identity.workspaceId,
      userId: identity.userId,
      now: () => new Date("2026-11-20T02:00:00.000Z"),
    });
    expect(await verify({
      approvalId: identity.id,
      taskId: identity.taskId,
      repository: identity.repository,
      payloadHash: identity.payloadHash,
    })).toBe(true);
    expect(mock.calls[0]?.values).toContain(identity.workspaceId);
    expect(mock.calls[0]?.values).toContain(identity.userId);
  });
});
