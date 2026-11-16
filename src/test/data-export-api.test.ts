import { describe, expect, it } from "vitest";
import { handleDataExportRequest } from "@/lib/agents/data-export-api";

function makeDatabase() {
  const queries: string[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind() {
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM sessions")) {
                return {
                  id: "session-1", user_id: "user-1", workspace_id: null,
                  expires_at: "2026-11-17T00:00:00.000Z",
                  created_at: "2026-11-16T00:00:00.000Z",
                } as T;
              }
              if (query.includes("FROM users")) {
                return { id: "user-1", email: "user@example.com" } as T;
              }
              return null;
            },
            all: async <T = Record<string, unknown>>() => ({
              success: true,
              results: [] as T[],
            }),
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return { database, queries };
}

const url = "https://liza.example/api/account/export";
const cookie = "__Host-liza_session=" + "B".repeat(43);

describe("authenticated personal data export API", () => {
  it("rejects requests without an active session cookie", async () => {
    const { database } = makeDatabase();
    const response = await handleDataExportRequest(new Request(url), { ACTION_DB: database });
    expect(response.status).toBe(401);
  });

  it("exports only the active session user's data and omits encrypted credentials", async () => {
    const { database, queries } = makeDatabase();
    const response = await handleDataExportRequest(
      new Request(url, { headers: { cookie } }),
      { ACTION_DB: database },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const exported = await response.json() as { userId: string; data: { users: unknown[] } };
    expect(exported.userId).toBe("user-1");
    expect(exported.data.users).toHaveLength(1);
    const connectionQuery = queries.find((query) => query.includes("FROM app_connections")) ?? "";
    expect(connectionQuery).not.toContain("encrypted_token_blob");
  });

  it("does not accept state-changing methods", async () => {
    const { database } = makeDatabase();
    const response = await handleDataExportRequest(
      new Request(url, { method: "POST", headers: { cookie } }),
      { ACTION_DB: database },
    );
    expect(response.status).toBe(405);
  });
});
