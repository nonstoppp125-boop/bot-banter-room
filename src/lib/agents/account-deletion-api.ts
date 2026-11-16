import { createAccountDeletionRequest, createD1AccountDeletionStore } from "./data-privacy";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type AccountDeletionApiDatabase = Parameters<typeof createD1AccountDeletionStore>[0] &
  Parameters<typeof createD1SessionStore>[0];
export type AccountDeletionApiEnv = { ACTION_DB?: AccountDeletionApiDatabase };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readSmallBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > 2048) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > 2048) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** Schedules or cancels a same-user deletion request; never executes account deletion. */
export async function handleAccountDeletionRequest(
  request: Request,
  env: AccountDeletionApiEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin account changes are blocked." }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "JSON content type is required." }, 415);
  }
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Account deletion service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session) return json({ error: "Active session required." }, 401);
    const store = createD1AccountDeletionStore(database);
    if (request.method === "GET") {
      const pending = await store.getPendingForUser({ userId: session.userId, now });
      return json({ pending });
    }
    const raw = await readSmallBody(request);
    if (!raw) return json({ error: "Invalid account deletion request." }, 400);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!isRecord(body)) return json({ error: "Invalid account deletion request." }, 400);

    if (body["operation"] === "request") {
      if (body["confirmationPhrase"] !== "DELETE MY ACCOUNT") {
        return json({ error: "Exact account deletion confirmation is required." }, 400);
      }
      const deletion = createAccountDeletionRequest({
        id: crypto.randomUUID().replace(/-/g, ""),
        actorUserId: session.userId,
        targetUserId: session.userId,
        confirmationPhrase: "DELETE MY ACCOUNT",
        now,
        graceDays: 30,
      });
      await store.create(deletion);
      return json({ id: deletion.id, status: "pending", scheduledFor: deletion.scheduledFor }, 201);
    }

    if (body["operation"] === "cancel" && typeof body["id"] === "string") {
      const cancelled = await store.cancel({ id: body["id"], userId: session.userId, now });
      if (!cancelled) return json({ error: "No cancellable deletion request was found." }, 409);
      return json({ status: "cancelled" });
    }
    return json({ error: "Unsupported account deletion operation." }, 400);
  } catch {
    return json({ error: "Account deletion request could not be completed." }, 500);
  }
}
