export type DevPilotApprovalStatus = "pending" | "approved" | "rejected" | "expired";
type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      all: <T = Record<string, unknown>>() => Promise<{ success?: boolean; results?: T[] }>;
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
        "INSERT INTO devpilot_approvals (id, workspace_id, user_id, task_id, repository, payload_hash, summary, status, expires_at, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ? WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?) AND EXISTS (SELECT 1 FROM devpilot_runs r WHERE r.id = ? AND r.workspace_id = ? AND r.user_id = ? AND r.repository = ? AND r.status = 'awaiting_approval' AND json_extract(r.checkpoint_json, '$.data.approvalPayloadHash') = ?)"
      ).bind(input.id, input.workspaceId, input.userId, input.taskId, input.repository, input.payloadHash,
        input.summary.trim(), input.expiresAt, input.createdAt, input.workspaceId, input.userId,
        input.taskId, input.workspaceId, input.userId, input.repository, input.payloadHash).run();
      if (result.success === false || result.meta?.changes !== 1) throw new Error("DevPilot approval request rejected or duplicate.");
    },
    getForAdmin: async (input: { id: string; workspaceId: string; actorUserId: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.actorUserId)) return null;
      const row = await database.prepare(
        "SELECT a.id, a.workspace_id, a.user_id, a.task_id, a.repository, a.payload_hash, a.status, a.summary, a.expires_at FROM devpilot_approvals a JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ? AND wm.role IN ('owner', 'admin') WHERE a.id = ? AND a.workspace_id = ? LIMIT 1"
      ).bind(input.actorUserId, input.id, input.workspaceId).first<{
        id: string; workspace_id: string; user_id: string; task_id: string; repository: string;
        payload_hash: string; status: DevPilotApprovalStatus; summary: string; expires_at: string;
      }>();
      return row ? {
        id: row.id, workspaceId: row.workspace_id, userId: row.user_id, taskId: row.task_id,
        repository: row.repository, payloadHash: row.payload_hash, status: row.status,
        summary: row.summary, expiresAt: row.expires_at,
      } : null;
    },
    listPending: async (input: { workspaceId: string; actorUserId: string; now: string; limit?: number }) => {
      const limit = input.limit ?? 50;
      if (!iso(input.now) || !ID.test(input.workspaceId) || !ID.test(input.actorUserId) ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid DevPilot approval list request.");
      const result = await database.prepare(
        "SELECT a.id, a.user_id, a.task_id, a.repository, a.summary, a.status, a.expires_at, a.created_at, r.checkpoint_json FROM devpilot_approvals a JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ? AND wm.role IN ('owner', 'admin') JOIN devpilot_runs r ON r.id = a.task_id AND r.workspace_id = a.workspace_id AND r.user_id = a.user_id AND r.repository = a.repository WHERE a.workspace_id = ? AND r.status = 'awaiting_approval' AND ((a.status = 'pending' AND a.expires_at > ?) OR (a.status = 'approved' AND a.expires_at > ?)) ORDER BY a.created_at ASC LIMIT ?"
      ).bind(input.actorUserId, input.workspaceId, input.now, input.now, limit).all<{
        id: string; user_id: string; task_id: string; repository: string; summary: string; status: DevPilotApprovalStatus; expires_at: string; created_at: string; checkpoint_json: string;
      }>();
      if (result.success === false) throw new Error("D1 DevPilot approval list failed.");
      return (result.results ?? []).map(row => {
        let proposalFiles: Array<{ path: string; beforeSha: string | null; beforeContent: string | null; content: string }> = [];
        try {
          const checkpoint = JSON.parse(row.checkpoint_json) as { data?: { proposalFiles?: unknown } };
          if (Array.isArray(checkpoint.data?.proposalFiles)) {
            proposalFiles = checkpoint.data.proposalFiles.filter((file): file is { path: string; beforeSha: string | null; beforeContent: string | null; content: string } =>
              typeof file === "object" && file !== null &&
              typeof (file as { path?: unknown }).path === "string" &&
              ((file as { beforeSha?: unknown }).beforeSha === null || typeof (file as { beforeSha?: unknown }).beforeSha === "string") &&
              ((file as { beforeContent?: unknown }).beforeContent === null || typeof (file as { beforeContent?: unknown }).beforeContent === "string") &&
              typeof (file as { content?: unknown }).content === "string" &&
              (file as { content: string }).content.length <= 500_000
            );
          }
        } catch { /* malformed checkpoints never expose proposal content */ }
        return {
          id: row.id, userId: row.user_id, taskId: row.task_id, repository: row.repository,
          summary: row.summary, status: row.status, expiresAt: row.expires_at, createdAt: row.created_at, proposalFiles,
        };
      });
    },
    expirePending: async (input: { now: string }) => {
      if (!iso(input.now)) throw new Error("Invalid DevPilot approval expiry timestamp.");
      const approvals = await database.prepare(
        "UPDATE devpilot_approvals SET status = 'expired' WHERE status IN ('pending', 'approved') AND expires_at <= ?"
      ).bind(input.now).run();
      if (approvals.success === false) throw new Error("D1 DevPilot approval expiry failed.");
      const runs = await database.prepare(
        "UPDATE devpilot_runs SET status = 'blocked', checkpoint_json = json_remove(checkpoint_json, '$.data.proposalFiles'), checkpoint_version = checkpoint_version + 1, lease_owner = NULL, lease_expires_at = NULL, updated_at = ? WHERE status IN ('awaiting_approval', 'queued') AND id IN (SELECT a.task_id FROM devpilot_approvals a WHERE a.task_id = devpilot_runs.id AND a.workspace_id = devpilot_runs.workspace_id AND a.user_id = devpilot_runs.user_id AND a.status = 'expired' AND a.expires_at <= ?)"
      ).bind(input.now, input.now).run();
      if (runs.success === false) throw new Error("D1 DevPilot expired-run cleanup failed.");
      return { approvals: approvals.meta?.changes ?? 0, runs: runs.meta?.changes ?? 0 };
    },
    decide: async (input: { id: string; workspaceId: string; actorUserId: string; decision: "approved" | "rejected"; reason: string; now: string }) => {
      const reason = input.reason.trim().slice(0, 1000);
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.actorUserId) || !reason || !iso(input.now)) {
        throw new Error("Invalid DevPilot approval decision.");
      }
      const result = await database.prepare(
        "UPDATE devpilot_approvals SET status = ?, decided_by_user_id = ?, decision_reason = ?, decided_at = ? WHERE id = ? AND workspace_id = ? AND status = 'pending' AND expires_at > ? AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = devpilot_approvals.workspace_id AND wm.user_id = ? AND wm.role IN ('owner', 'admin')) AND (? = 'rejected' OR EXISTS (SELECT 1 FROM devpilot_runs r WHERE r.id = devpilot_approvals.task_id AND r.workspace_id = devpilot_approvals.workspace_id AND r.user_id = devpilot_approvals.user_id AND r.status = 'awaiting_approval' AND json_array_length(json_extract(r.checkpoint_json, '$.data.proposalFiles')) > 0))"
      ).bind(input.decision, input.actorUserId, reason, input.now, input.id, input.workspaceId, input.now, input.actorUserId, input.decision).run();
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

export function createDevPilotApprovalVerifier(
  database: D1Database,
  identity: { workspaceId: string; userId: string; now?: () => Date },
) {
  const store = createDevPilotApprovalStore(database);
  return (input: { approvalId: string; taskId: string; repository: string; payloadHash: string }) =>
    store.verify({
      id: input.approvalId,
      workspaceId: identity.workspaceId,
      userId: identity.userId,
      taskId: input.taskId,
      repository: input.repository,
      payloadHash: input.payloadHash,
      now: (identity.now ?? (() => new Date()))().toISOString(),
    });
}
