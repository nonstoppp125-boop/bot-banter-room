import { describe, expect, it } from "vitest";
import { handleMemoryRequest } from "@/lib/agents/memory-api";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/memories";

function makeDatabase(role: "owner" | "admin" | "member" = "owner") {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const writes: { query: string; values: unknown[] }[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return { bind(...values: unknown[]) {
        bindings.push(values);
        return {
          first: async <T = Record<string, unknown>>() => {
            if (query.includes("FROM sessions")) return {
              id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
              expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
            } as T;
            if (query.includes("FROM workspace_members")) return {
              workspace_id: "workspace-1", user_id: "user-1", role,
            } as T;
            return null;
          },
          all: async <T = Record<string, unknown>>() => ({
            success: true,
            results: [{
              id: "memory-1", workspace_id: "workspace-1", user_id: "user-1",
              category: "preference", content: "Prefer concise replies", source: "user-entered",
              created_at: "2026-11-16T10:00:00.000Z", updated_at: "2026-11-16T10:00:00.000Z", expires_at: null,
            }] as unknown as T[],
          }),
          run: async () => { writes.push({ query, values }); return { success: true, meta: { changes: 1 } }; },
        };
      }};
    },
  };
  return { database, queries, bindings, writes };
}
function post(body: unknown, origin = "https://liza.example", contentType = "application/json") {
  return new Request(url, { method: "POST", headers: { origin, "content-type": contentType, cookie }, body: JSON.stringify(body) });
}

describe("authenticated user-controlled memory API", () => {
  it("rejects cross-origin writes before accessing D1", async () => {
    const { database, queries } = makeDatabase();
    expect((await handleMemoryRequest(post({ content: "x", category: "other" }, "https://evil.example"), { ACTION_DB: database })).status).toBe(403);
    expect(queries).toEqual([]);
  });

  it("requires a configured database, active session and workspace membership", async () => {
    expect((await handleMemoryRequest(new Request(url), {})).status).toBe(503);
    const { database } = makeDatabase();
    expect((await handleMemoryRequest(new Request(url), { ACTION_DB: database })).status).toBe(401);
  });

  it("creates and lists user-entered workspace memories", async () => {
    const { database, queries, writes } = makeDatabase();
    const response = await handleMemoryRequest(post({ content: "Prefer Bangla explanations", category: "preference" }), { ACTION_DB: database });
    expect(response.status).toBe(201);
    expect((await response.json()).memory).toMatchObject({ userId: "user-1", workspaceId: "workspace-1", source: "user-entered" });
    expect(writes[0]?.query).toContain("INSERT INTO memories");
    const list = await handleMemoryRequest(new Request(url, { headers: { cookie } }), { ACTION_DB: database });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ memories: [{ id: "memory-1" }] });
    expect(queries.some((query) => query.includes("deleted_at IS NULL"))).toBe(true);
  });

  it("rejects secret-like content and invalid categories", async () => {
    const { database, writes } = makeDatabase();
    expect((await handleMemoryRequest(post({ content: "api_key=abc", category: "other" }), { ACTION_DB: database })).status).toBe(400);
    expect((await handleMemoryRequest(post({ content: "valid", category: "secret" }), { ACTION_DB: database })).status).toBe(400);
    expect(writes).toHaveLength(0);
  });

  it("supports optimistic edits and owner-scoped soft deletion", async () => {
    const { database, writes } = makeDatabase();
    const patch = new Request(url, {
      method: "PATCH", headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ id: "memory-1", expectedUpdatedAt: "2026-11-16T10:00:00.000Z", category: "workflow", content: "Keep replies concise" }),
    });
    expect((await handleMemoryRequest(patch, { ACTION_DB: database })).status).toBe(200);
    const del = new Request(url, {
      method: "DELETE", headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: JSON.stringify({ id: "memory-1" }),
    });
    expect((await handleMemoryRequest(del, { ACTION_DB: database })).status).toBe(200);
    expect(writes[0]?.query).toContain("updated_at = ? AND deleted_at IS NULL");
    expect(writes[1]?.query).toContain("SET deleted_at = ?");
  });

  it("bounds streamed request bodies and enforces JSON content type", async () => {
    const { database } = makeDatabase();
    const oversized = new Request(url, { method: "POST", headers: { origin: "https://liza.example", "content-type": "application/json", cookie }, body: "x".repeat(8193) });
    expect((await handleMemoryRequest(oversized, { ACTION_DB: database })).status).toBe(413);
    expect((await handleMemoryRequest(post({}, "https://liza.example", "application/jsonp"), { ACTION_DB: database })).status).toBe(415);
  });
});
