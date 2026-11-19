import { createD1ConnectionStore, type D1ConnectionDatabase } from "./integration-hub";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type IntegrationListDatabase = D1ConnectionDatabase & Parameters<typeof createD1SessionStore>[0];
export type IntegrationListEnv = { ACTION_DB?: IntegrationListDatabase };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

/** Lists only safe metadata for connections owned by the active user in the active workspace. */
export async function handleIntegrationListRequest(request: Request, env: IntegrationListEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Integration storage is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);
  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const connections = await createD1ConnectionStore(database).listOwned({
      workspaceId: session.workspaceId,
      userId: session.userId,
      limit: 50,
    });
    return json({ connections });
  } catch {
    return json({ error: "Integration list could not be loaded." }, 500);
  }
}
