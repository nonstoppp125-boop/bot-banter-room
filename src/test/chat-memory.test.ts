import { describe, expect, it } from "vitest";
import { buildChatMemoryInstruction } from "@/lib/agents/chat-memory";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const savedRow = {
  id: "m-memory-1", workspace_id: "w-user-1", user_id: "u-user-1",
  category: "preference", content: "Always reply in Bengali script",
  source: "user-entered", created_at: "2026-11-17T10:00:00.000Z",
  updated_at: "2026-11-17T10:00:00.000Z", expires_at: null,
};

function makeDatabase() {
  const queries: string[] = [];
  const writes: string[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(..._values: unknown[]) {
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM sessions")) return {
                id: "s-session-1", user_id: "u-user-1", workspace_id: "w-user-1",
                expires_at: "2026-11-18T10:00:00.000Z", created_at: "2026-11-17T10:00:00.000Z",
              } as T;
              if (query.includes("FROM workspace_members")) return {
                workspace_id: "w-user-1", user_id: "u-user-1", role: "owner",
              } as T;
              return null;
            },
            run: async () => {
              writes.push(query);
              return { success: true, meta: { changes: 1 } };
            },
            all: async <T = Record<string, unknown>>() => ({
              success: true,
              results: [savedRow] as unknown as T[],
            }),
          };
        },
      };
    },
  };
  return { database, queries, writes };
}

function request(withCookie = true) {
  return new Request("https://liza.example/api/chat", {
    method: "POST",
    headers: withCookie ? { cookie } : {},
  });
}

const messages = [{
  id: "message-1",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "মনে রেখো: Always reply in Bengali script" }],
}];

describe("authenticated chat memory integration", () => {
  it("does not read or write memory for ordinary chat without a first-party session cookie", async () => {
    const { database, queries, writes } = makeDatabase();
    const ordinary = [{
      id: "message-ordinary",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Hello, can you help me?" }],
    }];
    expect(await buildChatMemoryInstruction(request(false), ordinary, { ACTION_DB: database })).toBe("");
    expect(queries).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("stores only an explicit remember command and supplies workspace-scoped retrieved context", async () => {
    const { database, queries, writes } = makeDatabase();
    const instruction = await buildChatMemoryInstruction(request(), messages, { ACTION_DB: database });
    expect(writes.some((query) => query.includes("INSERT INTO memories"))).toBe(true);
    expect(queries.some((query) => query.includes("FROM sessions"))).toBe(true);
    expect(queries.some((query) => query.includes("FROM workspace_members"))).toBe(true);
    expect(instruction).toContain("USER-APPROVED DURABLE MEMORY");
    expect(instruction).toContain("Always reply in Bengali script");
    expect(instruction).toContain("successfully saved");
  });

  it("does not claim an explicit memory was saved when no session exists", async () => {
    const { database, writes } = makeDatabase();
    const instruction = await buildChatMemoryInstruction(request(false), messages, { ACTION_DB: database });
    expect(instruction).toContain("No new durable memory was saved");
    expect(instruction).not.toContain("successfully saved");
    expect(writes).toEqual([]);
  });

  it("does not persist ordinary chat as durable memory", async () => {
    const { database, writes } = makeDatabase();
    const ordinary = [{
      id: "message-2",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "I am working on a project today." }],
    }];
    await buildChatMemoryInstruction(request(), ordinary, { ACTION_DB: database });
    expect(writes.some((query) => query.includes("INSERT INTO memories"))).toBe(false);
  });
});
