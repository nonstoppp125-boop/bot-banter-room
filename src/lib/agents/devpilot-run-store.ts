export type DevPilotRunStatus = "queued" | "running" | "awaiting_approval" | "completed" | "blocked" | "failed" | "cancelled";
export type DevPilotEventType = "planned" | "proposal-created" | "reviewed" | "verified" | "blocked" | "checkpoint" | "approval";
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
const STATUSES = new Set<DevPilotRunStatus>(["queued", "running", "awaiting_approval", "completed", "blocked", "failed", "cancelled"]);
const EVENT_TYPES = new Set<DevPilotEventType>(["planned", "proposal-created", "reviewed", "verified", "blocked", "checkpoint", "approval"]);
const iso = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const serialize = (value: unknown, max: number) => {
  const json = JSON.stringify(value ?? {});
  if (json.length > max) throw new Error("DevPilot checkpoint exceeds its storage limit.");
  return json;
};
function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { throw new Error("Stored DevPilot checkpoint is invalid."); }
}
export function createDevPilotRunStore(database: D1Database) {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 database is required.");
  const select = "SELECT id, workspace_id, user_id, repository, base_branch, task_text, status, progress, worker_attempt_count, checkpoint_version, checkpoint_json, lease_owner, lease_expires_at, created_at, updated_at FROM devpilot_runs";
  const restore = (row: {
    id: string; workspace_id: string; user_id: string; repository: string; base_branch: string; task_text: string;
    status: string; progress: number; worker_attempt_count: number; checkpoint_version: number; checkpoint_json: string;
    lease_owner: string | null; lease_expires_at: string | null; created_at: string; updated_at: string;
  }) => {
    if (!STATUSES.has(row.status as DevPilotRunStatus) || !Number.isInteger(row.progress) ||
      row.progress < 0 || row.progress > 100 || !Number.isInteger(row.worker_attempt_count) || row.worker_attempt_count < 0 || row.worker_attempt_count > 2 || !Number.isInteger(row.checkpoint_version) || row.checkpoint_version < 0) {
      throw new Error("Stored DevPilot run metadata is invalid.");
    }
    return {
      id: row.id, workspaceId: row.workspace_id, userId: row.user_id, repository: row.repository,
      baseBranch: row.base_branch, task: row.task_text, status: row.status as DevPilotRunStatus,
      progress: row.progress, workerAttemptCount: row.worker_attempt_count, checkpointVersion: row.checkpoint_version, checkpoint: parseJson(row.checkpoint_json),
      leaseOwner: row.lease_owner, leaseExpiresAt: row.lease_expires_at, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  };
  return {
    create: async (input: {
      id: string; workspaceId: string; userId: string; repository: string; baseBranch: string;
      task: string; now: string; checkpoint?: unknown;
    }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) ||
        !REPOSITORY.test(input.repository) || !input.baseBranch.trim() || input.baseBranch.length > 120 ||
        !input.task.trim() || input.task.length > 4000 || !iso(input.now)) throw new Error("Invalid DevPilot run.");
      const checkpoint = serialize(input.checkpoint, 100_000);
      const result = await database.prepare(
        "INSERT INTO devpilot_runs (id, workspace_id, user_id, repository, base_branch, task_text, status, progress, checkpoint_version, checkpoint_json, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'queued', 0, 0, ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?) AND (SELECT COUNT(*) FROM devpilot_runs WHERE workspace_id = ? AND user_id = ? AND status IN ('queued', 'running', 'awaiting_approval')) < 3 AND (SELECT COUNT(*) FROM devpilot_runs WHERE workspace_id = ? AND status IN ('queued', 'running', 'awaiting_approval')) < 20"
      ).bind(input.id, input.workspaceId, input.userId, input.repository, input.baseBranch, input.task,
        checkpoint, input.now, input.now, input.workspaceId, input.userId, input.workspaceId, input.userId, input.workspaceId).run();
      if (result.success === false || result.meta?.changes !== 1) throw new Error("DevPilot queue limit reached or run creation rejected.");
    },
    get: async (input: { id: string; workspaceId: string; userId: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId)) return null;
      const row = await database.prepare(select + " WHERE id = ? AND workspace_id = ? AND user_id = ? LIMIT 1")
        .bind(input.id, input.workspaceId, input.userId).first<Parameters<typeof restore>[0]>();
      return row ? restore(row) : null;
    },
    list: async (input: { workspaceId: string; userId: string; limit?: number }) => {
      const limit = input.limit ?? 50;
      if (!ID.test(input.workspaceId) || !ID.test(input.userId) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("Invalid DevPilot run list request.");
      }
      const result = await database.prepare(select + " WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?")
        .bind(input.workspaceId, input.userId, limit).all<Parameters<typeof restore>[0]>();
      if (result.success === false) throw new Error("D1 DevPilot run list failed.");
      return (result.results ?? []).map(restore);
    },
    claimNext: async (input: { owner: string; repository: string; now: string; leaseUntil: string }) => {
      const repositoryParts = input.repository.split("/");
      if (!ID.test(input.owner) || repositoryParts.length !== 2 ||
        !/^[A-Za-z0-9_.-]{1,100}$/.test(repositoryParts[0] ?? "") ||
        !/^[A-Za-z0-9_.-]{1,100}$/.test(repositoryParts[1] ?? "") ||
        !iso(input.now) || !iso(input.leaseUntil) ||
        Date.parse(input.leaseUntil) <= Date.parse(input.now) ||
        Date.parse(input.leaseUntil) - Date.parse(input.now) > 120_000) {
        throw new Error("Invalid DevPilot queue lease claim.");
      }
      const row = await database.prepare(
        "UPDATE devpilot_runs SET status = 'running', lease_owner = ?, lease_expires_at = ?, worker_attempt_count = worker_attempt_count + 1, updated_at = ? WHERE id = (SELECT id FROM devpilot_runs WHERE repository = ? AND worker_attempt_count < 2 AND (status = 'queued' OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?)) AND NOT EXISTS (SELECT 1 FROM devpilot_runs active WHERE active.status = 'running' AND active.lease_expires_at > ?) ORDER BY created_at ASC LIMIT 1) AND repository = ? AND worker_attempt_count < 2 AND (status = 'queued' OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?)) RETURNING id, workspace_id, user_id, repository, base_branch, task_text, status, progress, worker_attempt_count, checkpoint_version, checkpoint_json, lease_owner, lease_expires_at, created_at, updated_at"
      ).bind(input.owner, input.leaseUntil, input.now, input.repository, input.now, input.now, input.repository, input.now).first<Parameters<typeof restore>[0]>();
      return row ? restore(row) : null;
    },
    claim: async (input: { id: string; workspaceId: string; userId: string; owner: string; now: string; leaseUntil: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !ID.test(input.owner) ||
        !iso(input.now) || !iso(input.leaseUntil) || Date.parse(input.leaseUntil) <= Date.parse(input.now) || Date.parse(input.leaseUntil) - Date.parse(input.now) > 120_000) throw new Error("Invalid DevPilot lease claim.");
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = 'running', lease_owner = ?, lease_expires_at = ?, worker_attempt_count = worker_attempt_count + 1, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND worker_attempt_count < 2 AND (status = 'queued' OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?))"
      ).bind(input.owner, input.leaseUntil, input.now, input.id, input.workspaceId, input.userId, input.now).run();
      if (result.success === false) throw new Error("D1 DevPilot lease claim failed.");
      return result.meta?.changes === 1;
    },
    heartbeat: async (input: { id: string; workspaceId: string; userId: string; owner: string; now: string; leaseUntil: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !ID.test(input.owner) ||
        !iso(input.now) || !iso(input.leaseUntil) || Date.parse(input.leaseUntil) <= Date.parse(input.now) || Date.parse(input.leaseUntil) - Date.parse(input.now) > 120_000) throw new Error("Invalid DevPilot heartbeat.");
      const result = await database.prepare(
        "UPDATE devpilot_runs SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND status = 'running' AND lease_owner = ? AND lease_expires_at > ?"
      ).bind(input.leaseUntil, input.now, input.id, input.workspaceId, input.userId, input.owner, input.now).run();
      if (result.success === false) throw new Error("D1 DevPilot heartbeat failed.");
      return result.meta?.changes === 1;
    },
    checkpoint: async (input: {
      id: string; workspaceId: string; userId: string; owner: string; expectedVersion: number;
      progress: number; checkpoint: unknown; status?: "running" | "awaiting_approval"; now: string;
    }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !ID.test(input.owner) ||
        !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0 || !Number.isInteger(input.progress) ||
        input.progress < 0 || input.progress > 100 || !iso(input.now) ||
        (input.status !== undefined && input.status !== "running" && input.status !== "awaiting_approval")) {
        throw new Error("Invalid DevPilot checkpoint.");
      }
      const json = serialize(input.checkpoint, 100_000);
      const nextStatus = input.status ?? "running";
      const clearLease = nextStatus === "awaiting_approval";
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = ?, progress = ?, checkpoint_json = ?, checkpoint_version = checkpoint_version + 1, lease_owner = CASE WHEN ? = 1 THEN NULL ELSE lease_owner END, lease_expires_at = CASE WHEN ? = 1 THEN NULL ELSE lease_expires_at END, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND status = 'running' AND lease_owner = ? AND lease_expires_at > ? AND checkpoint_version = ? AND progress <= ?"
      ).bind(nextStatus, input.progress, json, clearLease ? 1 : 0, clearLease ? 1 : 0, input.now,
        input.id, input.workspaceId, input.userId, input.owner, input.now, input.expectedVersion, input.progress).run();
      if (result.success === false) throw new Error("D1 DevPilot checkpoint failed.");
      return result.meta?.changes === 1;
    },
    finish: async (input: {
      id: string; workspaceId: string; userId: string; owner: string;
      status: "completed" | "blocked" | "failed" | "cancelled"; progress: number;
      checkpoint: unknown; now: string;
    }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !ID.test(input.owner) ||
        !["completed", "blocked", "failed", "cancelled"].includes(input.status) ||
        !Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100 || !iso(input.now)) {
        throw new Error("Invalid DevPilot run completion.");
      }
      const json = serialize(input.checkpoint, 100_000);
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = ?, progress = ?, checkpoint_json = ?, checkpoint_version = checkpoint_version + 1, lease_owner = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND status = 'running' AND lease_owner = ? AND lease_expires_at > ? AND progress <= ?"
      ).bind(input.status, input.progress, json, input.now, input.id, input.workspaceId, input.userId, input.owner, input.now, input.progress).run();
      if (result.success === false) throw new Error("D1 DevPilot run completion failed.");
      return result.meta?.changes === 1;
    },
    recoverExpired: async (input: { now: string }) => {
      if (!iso(input.now)) throw new Error("Invalid DevPilot lease recovery timestamp.");
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = 'failed', checkpoint_json = json_remove(checkpoint_json, '$.data.proposalFiles'), checkpoint_version = checkpoint_version + 1, lease_owner = NULL, lease_expires_at = NULL, updated_at = ? WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ? AND worker_attempt_count >= 2"
      ).bind(input.now, input.now).run();
      if (result.success === false) throw new Error("D1 expired DevPilot lease recovery failed.");
      return result.meta?.changes ?? 0;
    },
    blockAwaitingApproval: async (input: { id: string; workspaceId: string; userId: string; now: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !iso(input.now)) {
        throw new Error("Invalid DevPilot approval failure transition.");
      }
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = 'blocked', checkpoint_json = json_remove(checkpoint_json, '$.data.proposalFiles'), checkpoint_version = checkpoint_version + 1, lease_owner = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND status = 'awaiting_approval'"
      ).bind(input.now, input.id, input.workspaceId, input.userId).run();
      if (result.success === false) throw new Error("D1 DevPilot approval failure transition failed.");
      return result.meta?.changes === 1;
    },
    resumeApproved: async (input: {
      id: string; workspaceId: string; userId: string; approvalId: string;
      repository: string; payloadHash: string; now: string;
    }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !ID.test(input.approvalId) ||
        !REPOSITORY.test(input.repository) || !/^[a-f0-9]{64}$/.test(input.payloadHash) || !iso(input.now)) {
        throw new Error("Invalid DevPilot approval resume.");
      }
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = 'queued', worker_attempt_count = 0, checkpoint_json = json_set(json_remove(checkpoint_json, '$.data.proposalFiles'), '$.data.approvalId', ?, '$.data.approvalPayloadHash', ?), checkpoint_version = checkpoint_version + 1, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND repository = ? AND status = 'awaiting_approval' AND EXISTS (SELECT 1 FROM devpilot_approvals a WHERE a.id = ? AND a.workspace_id = devpilot_runs.workspace_id AND a.user_id = devpilot_runs.user_id AND a.task_id = devpilot_runs.id AND a.repository = devpilot_runs.repository AND a.payload_hash = ? AND a.status = 'approved' AND a.decided_by_user_id IS NOT NULL AND a.decided_at IS NOT NULL AND a.expires_at > ?)"
      ).bind(input.approvalId, input.payloadHash, input.now, input.id, input.workspaceId, input.userId, input.repository, input.approvalId, input.payloadHash, input.now).run();
      if (result.success === false) throw new Error("D1 DevPilot approved resume failed.");
      return result.meta?.changes === 1;
    },
    rejectAwaitingApproval: async (input: {
      id: string; workspaceId: string; userId: string; approvalId: string;
      repository: string; payloadHash: string; now: string;
    }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !ID.test(input.approvalId) ||
        !REPOSITORY.test(input.repository) || !/^[a-f0-9]{64}$/.test(input.payloadHash) || !iso(input.now)) {
        throw new Error("Invalid DevPilot approval rejection.");
      }
      const checkpoint = serialize({ stage: "approval-rejected", reason: "Human approval was rejected." }, 4_000);
      const result = await database.prepare(
        "UPDATE devpilot_runs SET status = 'blocked', checkpoint_json = ?, checkpoint_version = checkpoint_version + 1, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND repository = ? AND status = 'awaiting_approval' AND EXISTS (SELECT 1 FROM devpilot_approvals a WHERE a.id = ? AND a.workspace_id = devpilot_runs.workspace_id AND a.user_id = devpilot_runs.user_id AND a.task_id = devpilot_runs.id AND a.repository = devpilot_runs.repository AND a.payload_hash = ? AND a.status = 'rejected')"
      ).bind(checkpoint, input.now, input.id, input.workspaceId, input.userId, input.repository, input.approvalId, input.payloadHash).run();
      if (result.success === false) throw new Error("D1 DevPilot approval rejection failed.");
      return result.meta?.changes === 1;
    },
    appendEvent: async (input: {
      id: string; runId: string; workspaceId: string; userId: string; type: DevPilotEventType;
      timestamp: string; summary: string; evidence?: unknown;
    }) => {
      if (!ID.test(input.id) || !ID.test(input.runId) || !ID.test(input.workspaceId) || !ID.test(input.userId) ||
        !EVENT_TYPES.has(input.type) || !iso(input.timestamp) || !input.summary.trim() || input.summary.length > 500) {
        throw new Error("Invalid DevPilot event.");
      }
      const evidence = serialize(input.evidence ?? [], 8_000);
      const result = await database.prepare(
        "INSERT INTO devpilot_events (id, run_id, workspace_id, user_id, event_type, timestamp, summary, evidence_json) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM devpilot_runs WHERE id = ? AND workspace_id = ? AND user_id = ?)"
      ).bind(input.id, input.runId, input.workspaceId, input.userId, input.type, input.timestamp,
        input.summary.trim(), evidence, input.runId, input.workspaceId, input.userId).run();
      if (result.success === false || result.meta?.changes !== 1) throw new Error("DevPilot event rejected or duplicated.");
    },
    listEvents: async (input: { runId: string; workspaceId: string; userId: string; limit?: number }) => {
      const limit = input.limit ?? 100;
      if (!ID.test(input.runId) || !ID.test(input.workspaceId) || !ID.test(input.userId) ||
        !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Invalid DevPilot event list request.");
      const result = await database.prepare(
        "SELECT e.id, e.event_type, e.timestamp, e.summary, e.evidence_json FROM devpilot_events e JOIN devpilot_runs r ON r.id = e.run_id AND r.workspace_id = e.workspace_id AND r.user_id = e.user_id WHERE e.run_id = ? AND e.workspace_id = ? AND e.user_id = ? ORDER BY e.timestamp ASC LIMIT ?"
      ).bind(input.runId, input.workspaceId, input.userId, limit).all<{
        id: string; event_type: DevPilotEventType; timestamp: string; summary: string; evidence_json: string;
      }>();
      if (result.success === false) throw new Error("D1 DevPilot event list failed.");
      return (result.results ?? []).map(row => ({
        id: row.id, type: row.event_type, timestamp: row.timestamp, summary: row.summary,
        evidence: parseJson(row.evidence_json),
      }));
    },
  };
}

export function createDevPilotCheckpointWriter(
  database: D1Database,
  identity: { id: string; workspaceId: string; userId: string; owner: string; initialVersion: number; initialProgress?: number; now?: () => Date },
) {
  const store = createDevPilotRunStore(database);
  let version = identity.initialVersion;
  let progress = identity.initialProgress ?? 0;
  return async (input: { progress: number; stage: string; data: unknown; status?: "running" | "awaiting_approval" }) => {
    if (input.progress < progress) return;
    const saved = await store.checkpoint({
      id: identity.id,
      workspaceId: identity.workspaceId,
      userId: identity.userId,
      owner: identity.owner,
      expectedVersion: version,
      progress: input.progress,
      checkpoint: { stage: input.stage, data: input.data },
      ...(input.status ? { status: input.status } : {}),
      now: (identity.now ?? (() => new Date()))().toISOString(),
    });
    if (!saved) throw new Error("DevPilot checkpoint rejected: lease lost, stale version or invalid progress.");
    version += 1;
    progress = input.progress;
  };
}
export function createDevPilotEventWriter(
  database: D1Database,
  identity: { runId: string; workspaceId: string; userId: string },
) {
  const store = createDevPilotRunStore(database);
  return async (event: {
    id: string; type: DevPilotEventType; timestamp: string; summary: string; evidence: string[];
  }) => store.appendEvent({
    id: event.id, runId: identity.runId, workspaceId: identity.workspaceId, userId: identity.userId,
    type: event.type, timestamp: event.timestamp, summary: event.summary, evidence: event.evidence,
  });
}
