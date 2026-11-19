import { describe, expect, it } from "vitest";
import { loadUserMemoryContext, saveExplicitMemoryFromMessage } from "@/lib/agents/orchestrator";
import type { AgentEnv } from "@/lib/agents/types";
import type { UIMessage } from "ai";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
function makeDatabase(active = true) {
  const queries: string[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return { bind(..._values: unknown[]) {
        return {
          first: async <T = Record<string, unknown>>() => {
            if (query.includes("FROM sessions")) return active ? {
              id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
              expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
            } as T : null;
            return null;
          },
          all: async <T = Record<string, unknown>>() => ({
            success: true,
            results: [{
              id: "memory-1", workspace_id: "workspace-1", user_id: "user-1",
              category: "preference", content: "Prefer concise Bengali script responses",
              source: "user-entered", created_at: "2026-11-16T10:00:00.000Z",
              updated_at: "2026-11-16T10:00:00.000Z", expires_at: null,
            }] as unknown as T[],
          }),
          run: async () => ({ success: true, meta: { changes: 1 } }),
        };
      }};
    },
  };
  return { database: database as NonNullable<AgentEnv["ACTION_DB"]>, queries };
}
const messages = [{
  id: "message-1", role: "user",
  parts: [{ type: "text", text: "How should I write my project update?" }],
}] as UIMessage[];

describe("authenticated chat memory context", () => {
  it("loads only bounded, relevant user memories for an active workspace session", async () => {
    const { database, queries } = makeDatabase();
    const context = await loadUserMemoryContext(new Request("https://liza.example/api/chat", { headers: { cookie } }), { ACTION_DB: database }, messages);
    expect(context).toContain("USER-AUTHORED SAVED MEMORY");
    expect(context).toContain("Prefer concise Bengali script responses");
    expect(context).toContain("untrusted reference data");
    expect(context).toContain("If saved memories conflict, do not guess which is current");
    expect(queries.some((query) => query.includes("workspace_id = ? AND user_id = ?"))).toBe(true);
  });

  it("does not access memory without a valid session cookie", async () => {
    const { database, queries } = makeDatabase();
    expect(await loadUserMemoryContext(new Request("https://liza.example/api/chat"), { ACTION_DB: database }, messages)).toBeUndefined();
    expect(queries).toEqual([]);
  });

  it("does not load memory for an expired or workspace-less session", async () => {
    const { database } = makeDatabase(false);
    const context = await loadUserMemoryContext(new Request("https://liza.example/api/chat", { headers: { cookie } }), { ACTION_DB: database }, messages);
    expect(context).toBeUndefined();
  });

  it("persists only explicit remember requests in the authenticated workspace", async () => {
    const { database, queries } = makeDatabase();
    const explicit = [{
      id: "message-remember", role: "user",
      parts: [{ type: "text", text: "মনে রেখো, আমি বাংলা লিপিতে উত্তর পছন্দ করি" }],
    }] as UIMessage[];
    expect(await saveExplicitMemoryFromMessage(
      new Request("https://liza.example/api/chat", { headers: { cookie } }),
      { ACTION_DB: database },
      explicit,
    )).toBe(true);
    expect(queries.some((query) => query.includes("INSERT INTO memories"))).toBe(true);
  });

  it("does not store ordinary chat, duplicate memories or unauthenticated requests", async () => {
    const ordinary = [{
      id: "message-ordinary", role: "user",
      parts: [{ type: "text", text: "I prefer concise replies." }],
    }] as UIMessage[];
    const { database, queries } = makeDatabase();
    expect(await saveExplicitMemoryFromMessage(
      new Request("https://liza.example/api/chat", { headers: { cookie } }),
      { ACTION_DB: database },
      ordinary,
    )).toBe(false);
    expect(queries).toEqual([]);

    const duplicate = [{
      id: "message-duplicate", role: "user",
      parts: [{ type: "text", text: "Remember that Prefer concise Bengali script responses" }],
    }] as UIMessage[];
    expect(await saveExplicitMemoryFromMessage(
      new Request("https://liza.example/api/chat", { headers: { cookie } }),
      { ACTION_DB: database },
      duplicate,
    )).toBe(false);
    expect(queries.some((query) => query.includes("INSERT INTO memories"))).toBe(false);
  });

  it("does not query on a short, non-searchable user message", async () => {
    const { database, queries } = makeDatabase();
    const short = [{ id: "message-2", role: "user", parts: [{ type: "text", text: "OK" }] }] as UIMessage[];
    const context = await loadUserMemoryContext(new Request("https://liza.example/api/chat", { headers: { cookie } }), { ACTION_DB: database }, short);
    expect(context).toBeUndefined();
    expect(queries).toHaveLength(1);
  });
});
