import { describe, expect, it } from "vitest";
import { handleTelegramLinkTokenRequest, handleTelegramWebhookRequest } from "@/lib/agents/telegram-api";
import { createTelegramApprovalCallbackData } from "@/lib/agents/telegram-approval";

const webhookSecret = "x".repeat(40);
const botToken = "test-token";
const token = "A".repeat(43);
const linkUrl = "https://liza.example/api/telegram/link-token";
const webhookUrl = "https://liza.example/api/telegram/webhook";
const sessionCookie = "__Host-liza_session=" + token;

function databaseMock(mode: "session" | "link" | "linked" = "session") {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            run: async () => ({ success: true, meta: { changes: 1 } }),
            all: async <T = Record<string, unknown>>() => ({ success: true, results: [] as T[] }),
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM telegram_user_links")) return mode === "linked" ? {
                bot_id: "123456", telegram_user_id: "123456789", user_id: "user-1", workspace_id: "workspace-1",
              } as T : null;
              if (query.includes("FROM sessions")) return {
                id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
                expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
              } as T;
              if (mode === "link" && query.startsWith("UPDATE telegram_link_tokens")) {
                return { user_id: "user-1", workspace_id: "workspace-1" } as T;
              }
              return null;
            },
          };
        },
      };
    },
  };
  return { database, queries, bindings };
}

function webhookRequest(text: string) {
  return new Request(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": webhookSecret },
    body: JSON.stringify({
      update_id: 987654,
      message: {
        message_id: 44, date: Math.floor(Date.now() / 1000),
        from: { id: 123456789, is_bot: false, language_code: "en" },
        chat: { id: 123456789, type: "private" },
        text,
      },
    }),
  });
}

describe("Telegram link and webhook API", () => {
  it("creates a short-lived one-time code for the active workspace session", async () => {
    const state = databaseMock();
    const response = await handleTelegramLinkTokenRequest(new Request(linkUrl, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/json", cookie: sessionCookie },
      body: "{}",
    }), { ACTION_DB: state.database });
    expect(response.status).toBe(201);
    const data = await response.json() as { code: string; expiresAt: string };
    expect(data.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Date.parse(data.expiresAt)).toBeGreaterThan(Date.now());
    expect(state.queries.some((query) => query.includes("INSERT INTO telegram_link_tokens"))).toBe(true);
    expect(state.bindings.some((values) => values.includes(data.code))).toBe(false);
    expect(state.bindings.some((values) => values.some((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)))).toBe(true);
  });

  it("rejects cross-origin link-code creation", async () => {
    const response = await handleTelegramLinkTokenRequest(new Request(linkUrl, {
      method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}",
    }), {});
    expect(response.status).toBe(403);
  });

  it("rejects webhook requests with an invalid secret before touching storage", async () => {
    const response = await handleTelegramWebhookRequest(new Request(webhookUrl, {
      method: "POST", headers: { "x-telegram-bot-api-secret-token": "wrong" }, body: "{}",
    }), {});
    expect(response.status).toBe(403);
  });

  it("consumes a one-time code and links only the private Telegram identity", async () => {
    const state = databaseMock("link");
    let sent = "";
    const response = await handleTelegramWebhookRequest(webhookRequest("/link " + token), {
      ACTION_DB: state.database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    }, async (input, init) => {
      sent = String(input);
      expect(init?.redirect).toBe("error");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ linked: true });
    expect(sent).toContain("sendMessage");
    expect(state.queries.some((query) => query.startsWith("UPDATE telegram_link_tokens"))).toBe(true);
    expect(state.queries.some((query) => query.startsWith("INSERT INTO telegram_user_links"))).toBe(true);
  });
  it("responds with account-link instructions to an unlinked private user", async () => {
    const state = databaseMock();
    let sentBody = "";
    const response = await handleTelegramWebhookRequest(webhookRequest("Hello Liza"), {
      ACTION_DB: state.database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    }, async (_input, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ linked: false });
    expect(sentBody).toContain("link code");
  });

  it("saves a low-risk Manager plan from Telegram into the shared task workspace", async () => {
    const state = databaseMock("linked");
    let sentBody = "";
    const response = await handleTelegramWebhookRequest(webhookRequest("/task Prepare a research brief"), {
      ACTION_DB: state.database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    }, async (_input, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "queued" });
    expect(state.queries.some((query) => query.startsWith("INSERT INTO agent_tasks"))).toBe(true);
    expect(sentBody).toContain("Manager task saved");
    expect(sentBody).toContain("background execution is not enabled");
  });

  it("keeps high-risk Telegram Manager plans approval-gated", async () => {
    const state = databaseMock("linked");
    let sentBody = "";
    const response = await handleTelegramWebhookRequest(webhookRequest("/task Publish this LinkedIn post"), {
      ACTION_DB: state.database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    }, async (_input, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "needs_approval" });
    expect(state.queries.some((query) => query.startsWith("INSERT INTO approvals"))).toBe(true);
    expect(sentBody).toContain("Approval request created");
    expect(sentBody).toContain("will not execute from Telegram");
  });

  it("lists recent shared Manager tasks from Telegram", async () => {
    const state = databaseMock("linked");
    let sentBody = "";
    const response = await handleTelegramWebhookRequest(webhookRequest("/tasks"), {
      ACTION_DB: state.database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    }, async (_input, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ taskCount: 0 });
    expect(state.queries.some((query) => query.includes("FROM agent_tasks") && query.includes("workspace_id=? AND user_id=?"))).toBe(true);
    expect(sentBody).toContain("No Manager tasks");
  });

  it("lists pending approvals with user-bound buttons and accepts a signed admin decision", async () => {
    const workspaceId = "w_" + "a".repeat(64);
    const approvalRow = {
      id: "approval_123", workspace_id: workspaceId, user_id: "user-1",
      action_type: "social.publish", payload_hash: "a".repeat(64), summary: "Publish approved draft",
      status: "pending", decided_by_user_id: null, decision_reason: null,
      expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z", decided_at: null,
    };
    const queries: string[] = [];
    const database = {
      prepare(query: string) {
        queries.push(query);
        return {
          bind: (..._values: unknown[]) => ({
            run: async () => ({ success: true, meta: { changes: 1 } }),
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM telegram_user_links")) return {
                bot_id: "123456", telegram_user_id: "123456789", user_id: "user-1", workspace_id: workspaceId,
              } as T;
              if (query.includes("FROM approvals a JOIN")) return approvalRow as T;
              return null;
            },
            all: async <T = Record<string, unknown>>() => ({
              success: true, results: query.includes("FROM approvals a JOIN") ? [approvalRow as T] : [],
            }),
          }),
        };
      },
    };
    const callbackSecret = "k".repeat(48);
    let keyboardBody: Record<string, unknown> | null = null;
    const listResponse = await handleTelegramWebhookRequest(webhookRequest("/approvals"), {
      ACTION_DB: database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret, TELEGRAM_APPROVAL_CALLBACK_SECRET: callbackSecret,
    }, async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (body["reply_markup"]) keyboardBody = body;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({ count: 1 });
    expect(keyboardBody).not.toBeNull();

    const approveData = await createTelegramApprovalCallbackData({
      approvalId: "approval_123", telegramUserId: "123456789", workspaceId,
      decision: "approved", secret: callbackSecret,
    });
    const callbackRequest = new Request(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": webhookSecret },
      body: JSON.stringify({
        update_id: 987655,
        callback_query: {
          id: "callback-1",
          from: { id: 123456789, is_bot: false },
          message: { message_id: 45, chat: { id: 123456789, type: "private" } },
          data: approveData,
        },
      }),
    });
    const decisionResponse = await handleTelegramWebhookRequest(callbackRequest, {
      ACTION_DB: database, TELEGRAM_BOT_ID: "123456", TELEGRAM_BOT_TOKEN: botToken,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret, TELEGRAM_APPROVAL_CALLBACK_SECRET: callbackSecret,
    }, async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(decisionResponse.status).toBe(200);
    expect(await decisionResponse.json()).toMatchObject({ decided: true });
    expect(queries.some((query) => query.startsWith("UPDATE approvals SET status"))).toBe(true);
  });

});
