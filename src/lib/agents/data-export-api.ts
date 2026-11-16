import { createD1UserDataExporter } from "./data-privacy";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type DataExportDatabase = Parameters<typeof createD1UserDataExporter>[0] &
  Parameters<typeof createD1SessionStore>[0];
export type DataExportApiEnv = { ACTION_DB?: DataExportDatabase };

const headers = {
  "Cache-Control": "no-store, private",
  "Content-Disposition": 'attachment; filename="liza-data-export.json"',
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Authenticated, same-user data export. The exporter omits credentials and redacts nested JSON. */
export async function handleDataExportRequest(
  request: Request,
  env: DataExportApiEnv,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Data export service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session) return json({ error: "Active session required." }, 401);
    const result = await createD1UserDataExporter(database).exportUser(session.userId, now);
    if (!result) return json({ error: "User data is unavailable." }, 404);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch {
    return json({ error: "Data export could not be completed." }, 500);
  }
}
