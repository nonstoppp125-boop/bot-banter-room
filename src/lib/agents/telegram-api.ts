import { generateText } from "ai";
import { groqModel } from "./groq";
import { LIZA_SYSTEM } from "./liza-default";
import { PROVIDER_REQUEST_OPTIONS } from "./request-policy";
import { createD1ConversationStore, type D1ConversationDatabase } from "./conversation-store";
import { createD1SessionStore, readSessionCookie, type D1SessionDatabase } from "./session-auth";
import {
  createD1TelegramBridgeStore,
  normalizeTelegramPrivateMessage,
  splitTelegramText,
  verifyTelegramWebhookSecret,
  toSharedConversationMessage,
  type D1TelegramDatabase,
} from "./telegram-bridge";
import { createD1TelegramConversationStore, type D1TelegramConversationDatabase } from "./telegram-conversation-store";

type TelegramDatabase = D1ConversationDatabase & D1SessionDatabase & D1TelegramDatabase & D1TelegramConversationDatabase;
export type TelegramApiEnv = {
  ACTION_DB?: TelegramDatabase;
  TELEGRAM_BOT_ID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function digestHex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function readJson(request: Request, limit = 32_768): Promise<unknown | null> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit) return null;
  if (!request.body) return null;
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) { void reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export async function handleTelegramLinkTokenRequest(request: Request, env: TelegramApiEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin link requests are blocked." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "JSON content type is required." }, 415);
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Telegram linking is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);
  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const code = randomCode();
    const expiresAt = new Date(Date.parse(now) + 5 * 60 * 1000).toISOString();
    const result = await database.prepare(
      "INSERT INTO telegram_link_tokens (token_hash,user_id,workspace_id,created_at,expires_at) VALUES (?,?,?,?,?)",
    ).bind(await digestHex(code), session.userId, session.workspaceId, now, expiresAt).run();
    if (result.success === false || result.meta?.changes !== 1) return json({ error: "Telegram link code could not be created." }, 500);
    return json({ code, expiresAt, instruction: "Send /link " + code + " to your Telegram bot in a private chat." }, 201);
  } catch {
    return json({ error: "Telegram link code could not be created." }, 500);
  }
}

async function sendTelegramText(input: {
  token: string; chatId: string; text: string; fetcher: typeof fetch;
}): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await input.fetcher("https://api.telegram.org/bot" + input.token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ chat_id: input.chatId, text: input.text }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) return false;
    const payload = await response.json() as { ok?: unknown };
    return payload.ok === true;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}

/** Telegram webhook: private chats only, secret authenticated, update-idempotent and workspace linked. */
export async function handleTelegramWebhookRequest(
  request: Request,
  env: TelegramApiEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!verifyTelegramWebhookSecret(
    request.headers.get("x-telegram-bot-api-secret-token"), env.TELEGRAM_WEBHOOK_SECRET,
  )) return json({ error: "Webhook authentication failed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "JSON content type is required." }, 415);
  }
  const database = env.ACTION_DB;
  const botId = env.TELEGRAM_BOT_ID?.trim() ?? "";
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!database || !/^[1-9][0-9]{4,15}$/.test(botId) || !botToken) {
    return json({ error: "Telegram runtime is not configured." }, 503);
  }
  const body = await readJson(request);
  const now = new Date().toISOString();
  const message = normalizeTelegramPrivateMessage(body, now);
  if (!message) return json({ ok: true, ignored: true });
  try {
    const bridge = createD1TelegramBridgeStore(database);
    const claimed = await bridge.claimUpdate(botId, message.updateId, now, new Date(Date.parse(now) + 86_400_000).toISOString());
    if (!claimed) return json({ ok: true, duplicate: true });

    const command = message.text.trim();
    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(command) || /^\/help(?:@\w+)?$/i.test(command)) {
      await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher,
        text: "Liza bot. Link your account first: open Liza → Settings → Integrations → Telegram, generate a link code, then send /link CODE here." });
      return json({ ok: true });
    }
    const linkMatch = command.match(/^\/link(?:@\w+)?\s+([A-Za-z0-9_-]{43})$/i);
    if (command.startsWith("/link")) {
      if (!linkMatch) {
        await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher, text: "Invalid link command. Generate a fresh code in Liza Settings → Integrations, then send /link CODE." });
        return json({ ok: true });
      }
      const tokenHash = await digestHex(linkMatch[1]!);
      const linked = await database.prepare(
        "UPDATE telegram_link_tokens SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING user_id,workspace_id",
      ).bind(now, tokenHash, now).first<{ user_id: string; workspace_id: string }>();
      if (!linked) {
        await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher, text: "This link code is invalid or expired. Generate a new code in Liza Settings." });
        return json({ ok: true });
      }
      const inserted = await database.prepare(
        "INSERT INTO telegram_user_links (bot_id,telegram_user_id,user_id,workspace_id,status,created_at,revoked_at) SELECT ?,?,?,?,'active',?,NULL WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=? AND user_id=?) ON CONFLICT(bot_id,telegram_user_id) DO UPDATE SET user_id=excluded.user_id,workspace_id=excluded.workspace_id,status='active',created_at=excluded.created_at,revoked_at=NULL",
      ).bind(botId, message.telegramUserId, linked.user_id, linked.workspace_id, now, linked.workspace_id, linked.user_id).run();
      if (inserted.success === false || inserted.meta?.changes !== 1) {
        return json({ error: "Telegram identity could not be linked." }, 500);
      }
      await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher, text: "Your Telegram account is now linked to Liza. You can chat with Liza here." });
      return json({ ok: true, linked: true });
    }

    const identity = await bridge.getIdentity(botId, message.telegramUserId);
    if (!identity) {
      await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher, text: "Your account is not linked yet. Open Liza Settings → Integrations, generate a Telegram link code, and send /link CODE here." });
      return json({ ok: true, linked: false });
    }
    const conversationLinks = createD1TelegramConversationStore(database);
    let link = await conversationLinks.get({
      botId, chatId: message.chatId, telegramUserId: message.telegramUserId, userId: identity.userId,
    });
    const conversations = createD1ConversationStore(database);
    if (!link) {
      const conversationId = "tg_" + crypto.randomUUID().replace(/-/g, "");
      await conversations.create({
        id: conversationId, workspaceId: identity.workspaceId, userId: identity.userId,
        title: message.text.slice(0, 80), createdAt: now, updatedAt: now,
      });
      await conversationLinks.create({
        botId, chatId: message.chatId, telegramUserId: message.telegramUserId,
        userId: identity.userId, workspaceId: identity.workspaceId, conversationId, now,
      });
      link = await conversationLinks.get({
        botId, chatId: message.chatId, telegramUserId: message.telegramUserId, userId: identity.userId,
      });
    }
    if (!link) throw new Error("Telegram conversation could not be initialized.");
    await conversations.appendMessage(toSharedConversationMessage({
      botId, message, identity, conversationId: link.conversationId,
    }));
    if (!env.GROQ_API_KEY) {
      await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher, text: "Liza's AI provider is not configured yet. Please try again later." });
      return json({ ok: true });
    }
    const history = await conversations.listMessages({
      conversationId: link.conversationId, workspaceId: identity.workspaceId, userId: identity.userId, limit: 30,
    });
    const generationController = new AbortController();
    const generationTimeout = setTimeout(() => generationController.abort(), 25_000);
    let answer = "";
    try {
      const result = await generateText({
      ...PROVIDER_REQUEST_OPTIONS,
      model: groqModel(env.GROQ_API_KEY, env.GROQ_MODEL?.trim() || undefined),
      instructions: LIZA_SYSTEM,
      abortSignal: generationController.signal,
      messages: history.filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({ role: item.role as "user" | "assistant", content: item.content })),
      });
      answer = result.text.trim();
    } finally { clearTimeout(generationTimeout); }
    answer = answer || "I could not produce a response. Please try again.";
    await conversations.appendMessage({
      id: "tga_" + message.updateId + "_" + botId,
      conversationId: link.conversationId,
      workspaceId: identity.workspaceId,
      userId: identity.userId,
      role: "assistant",
      content: answer,
      metadata: { channel: "telegram", botId, updateId: message.updateId },
      createdAt: new Date().toISOString(),
    });
    for (const chunk of splitTelegramText(answer)) {
      await sendTelegramText({ token: botToken, chatId: message.chatId, fetcher, text: chunk });
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Telegram update could not be processed." }, 500);
  }
}
