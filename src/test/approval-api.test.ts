import { describe, expect, it } from "vitest";
import { handleApprovalRequest } from "@/lib/agents/approval-api";

function makeDatabase(role: "owner" | "admin" | "member" = "admin") {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM sessions")) {
                return {
                  id: "session-1",
                  user_id: "user-1",
                  workspace_id: "workspace-1",
                  expires_at: "2026-11-17T00:00:00.000Z",
                  created_at: "2026-11-16T00:00:00.000Z",
                } as T;
              }
              if (query.includes("FROM workspace_members")) {
                return { workspace_id: "workspace-1", user_id: "user-1", role } as T;
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
  return { database, queries, bindings };
}

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/approvals";

function post(body: unknown, origin = "https://liza.example") {
  return new Request(url, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}

describe("approval API authorization and workflow", () => {
  it("requires same-origin POST requests before accessing storage", async () => {
    const response = await handleApprovalRequest(post({ operation: "request" }, "https://evil.example"), {});
    expect(response.status).toBe(403);
  });

  it("requires the exact JSON media type before accessing storage", async () => {
    const { database, queries } = makeDatabase();
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/jsonp", cookie },
      body: JSON.stringify({ operation: "request" }),
    });
    expect((await handleApprovalRequest(request, { ACTION_DB: database })).status).toBe(415);
    expect(queries).toEqual([]);
  });

  it("rejects oversized streamed bodies and malformed JSON", async () => {
    const { database } = makeDatabase();
    const oversized = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: "x".repeat(8193),
    });
    expect((await handleApprovalRequest(oversized, { ACTION_DB: database })).status).toBe(413);
    const malformed = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie },
      body: "{",
    });
    expect((await handleApprovalRequest(malformed, { ACTION_DB: database })).status).toBe(400);
  });

  it("allows an authenticated workspace member to create a hash-bound request", async () => {
    const { database, queries, bindings } = makeDatabase("member");
    const payload = { draftId: "draft-1", content: "Do not persist this raw content" };
    const response = await handleApprovalRequest(
      post({ operation: "request", actionType: "social.publish", summary: "Publish the reviewed draft", payload }),
      { ACTION_DB: database },
    );
    expect(response.status).toBe(201);
    const result = await response.json() as { id: string; status: string };
    expect(result.status).toBe("pending");
    expect(result.id).toMatch(/^[a-f0-9]{32}$/);
    const insert = queries.findIndex((query) => query.includes("INSERT INTO approvals"));
    expect(insert).toBeGreaterThanOrEqual(0);
    expect(bindings[insert]).not.toContain(payload.content);
    expect(bindings[insert]).toContain("Publish the reviewed draft");
  });

  it("allows only workspace admins to list pending approvals", async () => {
    const { database } = makeDatabase("member");
    const response = await handleApprovalRequest(new Request(url, { headers: { cookie } }), { ACTION_DB: database });
    expect(response.status).toBe(403);
  });

  it("allows only workspace admins to decide an approval", async () => {
    const { database, queries } = makeDatabase("member");
    const response = await handleApprovalRequest(
      post({ approvalId: "approval-1", decision: "approved", reason: "Reviewed" }),
      { ACTION_DB: database },
    );
    expect(response.status).toBe(403);
    expect(queries.some((query) => query.startsWith("UPDATE approvals"))).toBe(false);
  });

  it("records an admin decision through the pending-only D1 transition", async () => {
    const { database, queries } = makeDatabase("owner");
    const response = await handleApprovalRequest(
      post({ approvalId: "approval-1", decision: "approved", reason: "Reviewed" }),
      { ACTION_DB: database },
    );
    expect(response.status).toBe(200);
    expect(queries.some((query) => query.includes("status = 'pending'"))).toBe(true);
  });
});
