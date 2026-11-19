import { createD1ConnectionStore, type D1ConnectionDatabase } from "./integration-hub";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type DisconnectDatabase = D1ConnectionDatabase & Parameters<typeof createD1SessionStore>[0];
export type DisconnectApiEnv = { ACTION_DB?: DisconnectDatabase };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readBody(request: Request): Promise<unknown | null> {
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
      if (total > 2048) { void reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** Clears local encrypted credentials for the active user/workspace; it never exposes token material. */
export async function handleIntegrationDisconnectRequest(request: Request, env: DisconnectApiEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin integration changes are blocked." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "JSON content type is required." }, 415);
  }
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Integration storage is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const body = await readBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "A valid connection ID is required." }, 400);
    }
    const connectionId = (body as Record<string, unknown>)["connectionId"];
    if (typeof connectionId !== "string") return json({ error: "A valid connection ID is required." }, 400);
    const revoked = await createD1ConnectionStore(database).revokeOwned({
      id: connectionId,
      workspaceId: session.workspaceId,
      userId: session.userId,
      now,
    });
    if (!revoked) return json({ error: "Connection was not found or is not owned by this user." }, 404);
    return json({
      status: "disconnected",
      note: "Local encrypted credentials were cleared. Provider-side token revocation may still be required in the provider's security settings.",
    });
  } catch {
    return json({ error: "Integration disconnect could not be completed." }, 500);
  }
}
