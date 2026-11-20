export type DevPilotApprovalStatus = "pending" | "approved" | "rejected" | "expired";
type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
    };
  };
};
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const HASH = /^[a-f0-9]{64}$/;
const iso = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
type ApprovalRow = {
  id: string; workspace_id: string; user_id: string; task_id: string; repository: string;
  payload_hash: string; status: DevPilotApprovalStatus; decided_by_user_id: string | null;
  decision_reason: string | null; expires_at: string; created_at: string; decided_at: string | null;
};
export interface DevPilotApprovalIdentity {
  id: string; workspaceId: string; userId: string; taskId: string; repository: string; payloadHash: string;
}
export function createDevPilotApprovalStore(database: D1Database) {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 database is required.");
  return {
    create: async (input: DevPilotApprovalIdentity & { summary: string; expiresAt: string; createdAt: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) ||
        !ID.test(input.taskId) || !REPOSITORY.test(input.repository) || !HASH.test(input.payloadHash) ||
        !input.summary.trim() || input.summary.length > 500 || !iso(input.createdAt) || !iso(input.expiresAt) ||
        Date.parse(input.expiresAt) <= Date.parse(input.createdAt)) throw new Error("Invalid DevPilot approval request.");
      const result = await database.prepare(
        "INSERT INTO devpilot_approvals (id, workspace_id, user_id, task_id, repository, payload_hash, summary, status, expires_at, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ? WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?)"
      ).bind(input.id, input.workspaceId, input.userId, input.taskId, input.repository, input.payloadHash,
        input.summary.trim(), input.expiresAt, input.createdAt, input.workspaceId, input.userId).run();
      if (result.success === false || result.meta?.changes !== 1) throw new Error("DevPilot approval request rejected or duplicate.");
    },
    decide: async (input: { id: string; workspaceId: string; actorUserId: string; decision: "approved" | "rejected"; reason: string; now: string }) => {
      const reason = input.reason.trim().slice(0, 1000);
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.actorUserId) || !reason || !iso(input.now)) {
        throw new Error("Invalid DevPilot approval decision.");
      }
      const result = await database.prepare(
        "UPDATE devpilot_approvals SET status = ?, decided_by_user_id = ?, decision_reason = ?, decided_at = ? WHERE id = ? AND workspace_id = ? AND status = 'pending' AND expires_at > ? AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = devpilot_approvals.workspace_id AND wm.user_id = ? AND wm.role IN ('owner', 'admin'))"
      ).bind(input.decision, input.actorUserId, reason, input.now, input.id, input.workspaceId, input.now, input.actorUserId).run();
      if (result.success === false) throw new Error("D1 DevPilot approval decision failed.");
      return result.meta?.changes === 1;
    },
    verify: async (input: DevPilotApprovalIdentity & { now: string }) => {
      if (!iso(input.now) || !ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) ||
        !ID.test(input.taskId) || !REPOSITORY.test(input.repository) || !HASH.test(input.payloadHash)) return false;
      const row = await database.prepare(
        "SELECT a.* FROM devpilot_approvals a JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ? WHERE a.id = ? AND a.workspace_id = ? AND a.user_id = ? AND a.task_id = ? AND a.repository = ? AND a.payload_hash = ? LIMIT 1"
      ).bind(input.userId, input.id, input.workspaceId, input.userId, input.taskId, input.repository, input.payloadHash).first<ApprovalRow>();
      if (!row || row.status !== "approved" || !row.decided_by_user_id || !row.decided_at) return false;
      if (!iso(row.expires_at) || !iso(row.decided_at) || Date.parse(row.expires_at) <= Date.parse(input.now) ||
        Date.parse(row.decided_at) > Date.parse(input.now)) return false;
      return true;
    },
  };
}
