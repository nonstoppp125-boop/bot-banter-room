export type MemoryCategory = "preference" | "project" | "workflow" | "other";
export type UserMemory = {
  id: string;
  workspaceId: string;
  userId: string;
  category: MemoryCategory;
  content: string;
  source: "user-entered";
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type D1MemoryDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      all: <T = Record<string, unknown>>() => Promise<{ success?: boolean; results?: T[] }>;
    };
  };
};

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const CATEGORIES = new Set<MemoryCategory>(["preference", "project", "workflow", "other"]);
const SECRET_PATTERN = /(?:password|api[_ -]?key|secret|access token|refresh token|private key|one[- ]time password|\botp\b)\s*[:=]/i;

function clean(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function validTime(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
function restore(row: {
  id: string; workspace_id: string; user_id: string; category: string;
  content: string; source: string; created_at: string; updated_at: string; expires_at: string | null;
}): UserMemory {
  if (!CATEGORIES.has(row.category as MemoryCategory) || row.source !== "user-entered") {
    throw new Error("Stored memory metadata is invalid.");
  }
  const expire = async (input: { workspaceId: string; userId: string; now: string }) => {
    await database.prepare(
      "UPDATE memories SET deleted_at = ?, updated_at = ? WHERE workspace_id = ? AND user_id = ? AND deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ? AND " + membership
    ).bind(input.now, input.now, input.workspaceId, input.userId, input.now).run();
  };

  return {
    id: row.id, workspaceId: row.workspace_id, userId: row.user_id,
    category: row.category as MemoryCategory, content: row.content,
    source: "user-entered", createdAt: row.created_at,
    updatedAt: row.updated_at, expiresAt: row.expires_at,
  };
}

export function createD1MemoryStore(database: D1MemoryDatabase) {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 memory database is required.");
  const columns = "id, workspace_id, user_id, category, content, source, created_at, updated_at, expires_at";
  const membership = "EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = memories.workspace_id AND wm.user_id = memories.user_id)";
  const validate = (input: { id: string; workspaceId: string; userId: string; category: MemoryCategory; content: string; createdAt: string; updatedAt: string; expiresAt?: string | null }) => {
    if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) ||
      !CATEGORIES.has(input.category) || !input.content.trim() || input.content.length > 4_000 ||
      SECRET_PATTERN.test(input.content) || !validTime(input.createdAt) || !validTime(input.updatedAt) ||
      (input.expiresAt !== undefined && input.expiresAt !== null &&
        (!validTime(input.expiresAt) || Date.parse(input.expiresAt) <= Date.parse(input.updatedAt)))) {
      throw new Error("Memory content or metadata is invalid. Do not store passwords, tokens or secrets.");
    }
  };

  return {
    create: async (input: UserMemory) => {
      validate(input);
      if (input.source !== "user-entered" || (input.expiresAt !== null && (!validTime(input.expiresAt) || Date.parse(input.expiresAt) <= Date.parse(input.createdAt)))) {
        throw new Error("Only explicit user-entered memories with valid expiry are accepted.");
      }
      const result = await database.prepare(
        "INSERT INTO memories (id, workspace_id, user_id, category, content, source, created_at, updated_at, expires_at) SELECT ?, ?, ?, ?, ?, 'user-entered', ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?)"
      ).bind(input.id, input.workspaceId, input.userId, input.category, clean(input.content, 4_000), input.createdAt, input.updatedAt, input.expiresAt, input.workspaceId, input.userId).run();
      if (result.success === false || result.meta?.changes !== 1) throw new Error("D1 memory creation failed.");
    },

    list: async (input: { workspaceId: string; userId: string; now: string; limit?: number }) => {
      if (!ID.test(input.workspaceId) || !ID.test(input.userId) || !validTime(input.now)) return [];
      const limit = input.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Memory list limit must be between 1 and 100.");
      await expire(input);
      const result = await database.prepare(
        `SELECT ${columns} FROM memories WHERE workspace_id = ? AND user_id = ? AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND ${membership} ORDER BY updated_at DESC LIMIT ?`
      ).bind(input.workspaceId, input.userId, input.now, limit).all<Parameters<typeof restore>[0]>();
      if (result.success === false) throw new Error("D1 memory list failed.");
      return (result.results ?? []).map(restore);
    },

    search: async (input: { workspaceId: string; userId: string; query: string; now: string; limit?: number }) => {
      const query = clean(input.query, 200).toLocaleLowerCase();
      if (!ID.test(input.workspaceId) || !ID.test(input.userId) || !validTime(input.now) || query.length < 2) return [];
      const limit = input.limit ?? 10;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Memory search limit must be between 1 and 50.");
      await expire(input);
      const records = await database.prepare(
        `SELECT ${columns} FROM memories WHERE workspace_id = ? AND user_id = ? AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > ?) AND ${membership} ORDER BY updated_at DESC LIMIT 100`
      ).bind(input.workspaceId, input.userId, input.now).all<Parameters<typeof restore>[0]>();
      if (records.success === false) throw new Error("D1 memory search failed.");
      const terms = [...new Set(query.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1))].slice(0, 12);
      return (records.results ?? []).map(restore).map((memory) => {
        const text = memory.content.toLocaleLowerCase();
        // Preferences are broadly relevant across requests even when their wording
        // does not overlap with the current task (e.g. reply language or brevity).
        const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0) +
          (text.includes(query) ? terms.length + 1 : 0) +
          (memory.category === "preference" ? 1 : 0);
        return { memory, score };
      }).filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
        .slice(0, limit).map((item) => item.memory);
    },

    update: async (input: {
      id: string; workspaceId: string; userId: string; expectedUpdatedAt: string;
      category: MemoryCategory; content: string; updatedAt: string; expiresAt?: string | null;
    }) => {
      validate({ ...input, createdAt: input.updatedAt, expiresAt: input.expiresAt ?? null });
      if (!validTime(input.expectedUpdatedAt)) throw new Error("Invalid memory version.");
      const result = await database.prepare(
        `UPDATE memories SET category = ?, content = ?, source = 'user-entered', updated_at = ?, expires_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND updated_at = ? AND deleted_at IS NULL AND ${membership}`
      ).bind(input.category, clean(input.content, 4_000), input.updatedAt, input.expiresAt ?? null, input.id, input.workspaceId, input.userId, input.expectedUpdatedAt).run();
      if (result.success === false) throw new Error("D1 memory update failed.");
      return result.meta?.changes === 1;
    },

    delete: async (input: { id: string; workspaceId: string; userId: string; deletedAt: string }) => {
      if (!ID.test(input.id) || !ID.test(input.workspaceId) || !ID.test(input.userId) || !validTime(input.deletedAt)) {
        throw new Error("Invalid memory deletion request.");
      }
      const result = await database.prepare(
        `UPDATE memories SET deleted_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND deleted_at IS NULL AND ${membership}`
      ).bind(input.deletedAt, input.deletedAt, input.id, input.workspaceId, input.userId).run();
      if (result.success === false) throw new Error("D1 memory deletion failed.");
      return result.meta?.changes === 1;
    },
  };
}
