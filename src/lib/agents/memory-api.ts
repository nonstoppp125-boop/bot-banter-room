import { createD1SessionStore, readSessionCookie, type D1SessionDatabase } from "./session-auth";
import { createD1MemoryStore, type D1MemoryDatabase, type MemoryCategory } from "./memory-store";
import { createD1WorkspaceAccessStore } from "./workspace-store";

type MemoryDatabase = D1MemoryDatabase & D1SessionDatabase & Parameters<typeof createD1WorkspaceAccessStore>[0];
export type MemoryApiEnv = { ACTION_DB?: MemoryDatabase };
const CATEGORIES = new Set<MemoryCategory>(["preference", "project", "workflow", "other"]);
const MAX_BODY_BYTES = 8_192;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });

function resolveExpiry(value: unknown, now: string): { valid: boolean; expiresAt: string | null } {
  if (value === undefined || value === null || value === "") return { valid: true, expiresAt: null };
  if (typeof value !== "string") return { valid: false, expiresAt: null };
  const timestamp = Date.parse(value);
  const current = Date.parse(now);
  if (!Number.isFinite(timestamp) || timestamp <= current || timestamp > current + 3_650 * 86_400_000) {
    return { valid: false, expiresAt: null };
  }
  return { valid: true, expiresAt: new Date(timestamp).toISOString() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

async function readBody(request: Request): Promise<BodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > MAX_BODY_BYTES) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    if (!total) return { ok: false, status: 400 };
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }; }
    catch { return { ok: false, status: 400 }; }
  } catch { return { ok: false, status: 400 }; }
  finally { reader.releaseLock(); }
}

/** User-controlled memory CRUD. No automatic extraction or external side effect occurs here. */
export async function handleMemoryRequest(request: Request, env: MemoryApiEnv): Promise<Response> {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
  const writing = request.method !== "GET";
  if (writing) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin memory changes are blocked." }, 403);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
      return json({ error: "JSON content type is required." }, 415);
    }
  }
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Memory service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const membership = await createD1WorkspaceAccessStore(database).getMembership(session.workspaceId, session.userId);
    if (!membership) return json({ error: "Workspace membership required." }, 403);
    const store = createD1MemoryStore(database);

    if (request.method === "GET") {
      const query = new URL(request.url).searchParams.get("q");
      const memories = query
        ? await store.search({ workspaceId: session.workspaceId, userId: session.userId, query, now, limit: 50 })
        : await store.list({ workspaceId: session.workspaceId, userId: session.userId, now, limit: 100 });
      return json({ memories });
    }

    const parsed = await readBody(request);
    if (!parsed.ok) return json({ error: parsed.status === 413 ? "Memory request is too large." : "Invalid JSON payload." }, parsed.status);
    if (!isRecord(parsed.value)) return json({ error: "A JSON object is required." }, 400);
    const body = parsed.value;

    if (request.method === "POST") {
      if (typeof body["content"] !== "string" || !body["content"].trim() ||
        body["content"].length > 4_000 || !CATEGORIES.has(body["category"] as MemoryCategory)) {
        return json({ error: "Provide memory content (max 4,000 characters) and a valid category." }, 400);
      }
      const expiry = resolveExpiry(body["expiresAt"], now);\n      if (!expiry.valid) return json({ error: "Expiry must be a future date within 10 years." }, 400);\n      const memory = {
        id: crypto.randomUUID().replace(/-/g, ""),
        workspaceId: session.workspaceId,
        userId: session.userId,
        category: body["category"] as MemoryCategory,
        content: body["content"].trim(),
        source: "user-entered" as const,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiry.expiresAt,
      };
      await store.create(memory);
      return json({ memory }, 201);
    }

    if (typeof body["id"] !== "string") return json({ error: "A valid memory ID is required." }, 400);
    if (request.method === "PATCH") {
      if (typeof body["content"] !== "string" || !body["content"].trim() ||
        body["content"].length > 4_000 || !CATEGORIES.has(body["category"] as MemoryCategory) ||
        typeof body["expectedUpdatedAt"] !== "string") {
        return json({ error: "Memory content, category and expectedUpdatedAt are required." }, 400);
      }
      const expiry = resolveExpiry(body["expiresAt"], now);\n      if (!expiry.valid) return json({ error: "Expiry must be a future date within 10 years." }, 400);\n      const updated = await store.update({
        id: body["id"], workspaceId: session.workspaceId, userId: session.userId,
        expectedUpdatedAt: body["expectedUpdatedAt"], category: body["category"] as MemoryCategory,
        content: body["content"].trim(), updatedAt: now, expiresAt: expiry.expiresAt,
      });
      return updated ? json({ updated: true }) : json({ error: "Memory not found or changed. Refresh and try again." }, 409);
    }

    const deleted = await store.delete({ id: body["id"], workspaceId: session.workspaceId, userId: session.userId, deletedAt: now });
    return deleted ? json({ deleted: true }) : json({ error: "Memory not found or already deleted." }, 404);
  } catch (error) {
    if (error instanceof Error && /Do not store passwords, tokens or secrets/.test(error.message)) {
      return json({ error: error.message }, 400);
    }
    return json({ error: "Memory request could not be completed." }, 500);
  }
}
