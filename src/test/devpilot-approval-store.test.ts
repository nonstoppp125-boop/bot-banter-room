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
const approvedRow: ApprovalRow = {
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
type ApprovalRow = {
  id: string; workspace_id: string; user_id: string; task_id: string; repository: string;
  payload_hash: string; status: "pending" | "approved" | "rejected" | "expired";
  decided_by_user_id: string | null; decision_reason: string | null;
  expires_at: string; created_at: string; decided_at: string | null; checkpoint_json?: string;
};
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
              async all<T>() { return { success: true, results: row ? [row as T] : [] }; },
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
    expect(mock.calls[0]?.sql).toContain("r.status = 'awaiting_approval'");
    expect(mock.calls[0]?.sql).toContain("json_extract(r.checkpoint_json, '$.data.approvalPayloadHash')");
  });

  it("loads approval identity only for a workspace owner or admin", async () => {
    const mock = database();
    const record = await createDevPilotApprovalStore(mock.db).getForAdmin({
      id: identity.id, workspaceId: identity.workspaceId, actorUserId: "admin-1",
    });
    expect(record?.taskId).toBe(identity.taskId);
    expect(record?.payloadHash).toBe(identity.payloadHash);
    expect(mock.calls[0]?.sql).toContain("wm.role IN ('owner', 'admin')");
  });

  it("lists pending approvals only to workspace owners and admins", async () => {
    const mock = database({ ...approvedRow, checkpoint_json: JSON.stringify({ data: { proposalFiles: [
      { path: "src/app.ts", beforeSha: "abcdef123456", beforeContent: "export const value = 0;", content: "export const value = 1;" },
    ] } }) });
    const store = createDevPilotApprovalStore(mock.db);
    const pending = await store.listPending({
      workspaceId: identity.workspaceId, actorUserId: "admin-1", now: "2026-11-20T02:00:00.000Z",
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.taskId).toBe(identity.taskId);
    expect(pending[0]?.proposalFiles[0]?.path).toBe("src/app.ts");
    expect(mock.calls[0]?.sql).toContain("wm.role IN ('owner', 'admin')");
    expect(mock.calls[0]?.sql).toContain("a.status = 'pending'");
    expect(mock.calls[0]?.sql).toContain("JOIN devpilot_runs r");
  });

  it("rejects malformed approval metadata before any database write", async () => {
    const mock = database();
    const store = createDevPilotApprovalStore(mock.db);
    await expect(store.create({
      ...identity, payloadHash: "invalid", summary: "proposal",
      createdAt: "2026-11-20T00:00:00.000Z", expiresAt: "2026-11-21T00:00:00.000Z",
    })).rejects.toThrow("Invalid DevPilot approval request");
    expect(mock.calls).toHaveLength(0);
  });

  it("expires pending or unclaimed approved approvals and scrubs proposal source from waiting runs", async () => {
    const mock = database();
    const result = await createDevPilotApprovalStore(mock.db).expirePending({
      now: "2026-11-21T00:00:00.000Z",
    });
    expect(result).toEqual({ approvals: 1, runs: 1 });
    expect(mock.calls[0]?.sql).toContain("status IN ('pending', 'approved')");
    expect(mock.calls[1]?.sql).toContain("json_remove(checkpoint_json, '$.data.proposalFiles')");
    expect(mock.calls[1]?.sql).toContain("status IN ('awaiting_approval', 'queued')");
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
    expect(mock.calls[0]?.sql).toContain("json_array_length(json_extract(r.checkpoint_json, '$.data.proposalFiles')) > 0");
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
