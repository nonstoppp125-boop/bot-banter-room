import { describe, expect, it } from "vitest";
import { createD1MemoryStore } from "@/lib/agents/memory-store";

function makeDatabase(rows = [{
    id: "memory-1", workspace_id: "workspace-1", user_id: "user-1",
    category: "preference", content: "Prefer concise Bangla explanations",
    source: "user-entered", created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-16T10:00:00.000Z", expires_at: null,
  }]) {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const writes: { query: string; values: unknown[] }[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return { bind(...values: unknown[]) {
        bindings.push(values);
        return {
          run: async () => { writes.push({ query, values }); return { success: true, meta: { changes: 1 } }; },
          all: async <T = Record<string, unknown>>() => ({ success: true, results: rows as unknown as T[] }),
        };
      }};
    },
  };
  return { database, queries, bindings, writes };
}
const now = "2026-11-16T12:00:00.000Z";
const sample = {
  id: "memory-2", workspaceId: "workspace-1", userId: "user-1",
  category: "project" as const, content: "XterLiza roadmap",
  source: "user-entered" as const, createdAt: now, updatedAt: now, expiresAt: null,
};

describe("workspace-scoped durable memory store", () => {
  it("writes only explicit user-entered memories with workspace membership guard", async () => {
    const { database, queries, bindings } = makeDatabase();
    await createD1MemoryStore(database).create(sample);
    expect(queries[0]).toContain("INSERT INTO memories");
    expect(queries[0]).toContain("WHERE EXISTS (SELECT 1 FROM workspace_members");
    expect(bindings[0]).toContain("workspace-1");
    expect(bindings[0]).toContain("user-1");
  });

  it("rejects credentials and invalid metadata before writing", async () => {
    const { database, writes } = makeDatabase();
    const store = createD1MemoryStore(database);
    await expect(store.create({ ...sample, content: "api_key=do-not-save" })).rejects.toThrow(/passwords, tokens or secrets/);
    await expect(store.create({ ...sample, category: "secret" as never })).rejects.toThrow(/invalid/);
    expect(writes).toHaveLength(0);
  });

  it("lists and searches only the active workspace and user, excluding deleted and expired rows", async () => {
    const { database, queries, bindings } = makeDatabase();
    const store = createD1MemoryStore(database);
    expect(await store.list({ workspaceId: "workspace-1", userId: "user-1", now })).toMatchObject([{ id: "memory-1" }]);
    expect(await store.search({ workspaceId: "workspace-1", userId: "user-1", query: "Bangla", now })).toMatchObject([{ id: "memory-1" }]);
    expect(queries.every((query) => query.includes("workspace_id = ? AND user_id = ?") && query.includes("deleted_at IS NULL"))).toBe(true);
    expect(bindings.every((values) => values.includes("workspace-1") && values.includes("user-1"))).toBe(true);
  });

  it("does not retrieve unrelated preferences but keeps global response preferences available", async () => {
    const unrelated = makeDatabase([{
      id: "memory-food", workspace_id: "workspace-1", user_id: "user-1",
      category: "preference", content: "I enjoy spicy food",
      source: "user-entered", created_at: now, updated_at: now, expires_at: null,
    }]);
    expect(await createD1MemoryStore(unrelated.database).search({
      workspaceId: "workspace-1", userId: "user-1", query: "write code", now,
    })).toEqual([]);

    const global = makeDatabase([{
      id: "memory-language", workspace_id: "workspace-1", user_id: "user-1",
      category: "preference", content: "Always reply in Bengali script",
      source: "user-entered", created_at: now, updated_at: now, expires_at: null,
    }]);
    expect(await createD1MemoryStore(global.database).search({
      workspaceId: "workspace-1", userId: "user-1", query: "write code", now,
    })).toMatchObject([{ id: "memory-language" }]);
  });

  it("rejects bearer tokens and provider credentials in addition to labelled secrets", async () => {
    const { database, writes } = makeDatabase();
    const store = createD1MemoryStore(database);
    await expect(store.create({ ...sample, content: "Bearer abcdefghijklmnop" })).rejects.toThrow(/passwords, tokens or secrets/);
    await expect(store.create({ ...sample, content: "ghp_abcdefghijklmnopqrstuvwxyz1234567890" })).rejects.toThrow(/passwords, tokens or secrets/);
    expect(writes).toHaveLength(0);
  });

  it("expires memories lazily before list and search", async () => {
    const { database, queries, writes } = makeDatabase();
    const store = createD1MemoryStore(database);
    await store.list({ workspaceId: "workspace-1", userId: "user-1", now });
    expect(writes[0]?.query).toContain("expires_at <= ?");
    await store.search({ workspaceId: "workspace-1", userId: "user-1", query: "Bangla", now });
    expect(writes[1]?.query).toContain("expires_at <= ?");
    expect(queries.filter((query) => query.startsWith("UPDATE memories"))).toHaveLength(2);
  });

  it("uses optimistic concurrency for edits and owner-scoped soft deletion", async () => {
    const { database, queries, bindings } = makeDatabase();
    const store = createD1MemoryStore(database);
    expect(await store.update({
      id: "memory-1", workspaceId: "workspace-1", userId: "user-1",
      expectedUpdatedAt: now, category: "workflow", content: "Use concise responses", updatedAt: now,
    })).toBe(true);
    expect(await store.delete({ id: "memory-1", workspaceId: "workspace-1", userId: "user-1", deletedAt: now })).toBe(true);
    expect(queries[0]).toContain("updated_at = ? AND deleted_at IS NULL");
    expect(bindings[0]).toContain(now);
    expect(queries[1]).toContain("SET deleted_at = ?");
    expect(queries[1]).toContain("workspace_id = ? AND user_id = ?");
  });
});
