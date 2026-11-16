import { createD1AnalyticsStore, normalizeAnalyticsRecord, type AnalyticsIngestionInput, type AnalyticsPlatform, type AnalyticsMetricName } from "./analytics";
import { createD1SessionStore, readSessionCookie } from "./session-auth";
import { authorizeWorkspaceRole, createD1WorkspaceAccessStore } from "./workspace-store";

type Database = Parameters<typeof createD1AnalyticsStore>[0] & Parameters<typeof createD1SessionStore>[0] & Parameters<typeof createD1WorkspaceAccessStore>[0];
export type AnalyticsApiEnv = { ACTION_DB?: Database };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });
const platforms = new Set<AnalyticsPlatform>(["linkedin", "instagram", "facebook", "youtube", "x", "tiktok"]);
const metrics = new Set<AnalyticsMetricName>(["impressions", "reach", "views", "reactions", "likes", "comments", "shares", "clicks", "followersGained", "followersLost", "saves"]);

async function readBody(request: Request): Promise<unknown | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 256_000)) return null;
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
      if (total > 256_000) { void reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    if (!total) return null;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

/** Workspace-authenticated analytics import and retrieval. Imported provenance is never trusted as provider-authenticated. */
export async function handleAnalyticsRequest(request: Request, env: AnalyticsApiEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin analytics writes are blocked." }, 403);
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return json({ error: "JSON content type is required." }, 415);
  }
  const database = env.ACTION_DB;
  if (!database) return json({ error: "Analytics service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);
  try {
    const session = await createD1SessionStore(database).getActive(token, new Date().toISOString());
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const access = createD1WorkspaceAccessStore(database);
    const membership = await access.getMembership(session.workspaceId, session.userId);
    if (!membership) return json({ error: "Workspace membership required." }, 403);
    const store = createD1AnalyticsStore(database, session.workspaceId);
    if (request.method === "GET") {
      const url = new URL(request.url);
      const platform = url.searchParams.get("platform") || undefined;
      const metric = url.searchParams.get("metric") || undefined;
      if (platform && !platforms.has(platform as AnalyticsPlatform)) return json({ error: "Unsupported platform filter." }, 400);
      if (metric && !metrics.has(metric as AnalyticsMetricName)) return json({ error: "Unsupported metric filter." }, 400);
      const rows = await store.list({ platform: platform as AnalyticsPlatform | undefined, metric: metric as AnalyticsMetricName | undefined });
      return json({ records: rows });
    }
    const role = authorizeWorkspaceRole({ membership, workspaceId: session.workspaceId, userId: session.userId, requiredRole: "admin" });
    if (!role.allowed) return json({ error: "Workspace administrator access required." }, 403);
    const body = await readBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray((body as Record<string, unknown>).records)) return json({ error: "A records array is required; maximum 100 records." }, 400);
    const records = (body as { records: unknown[] }).records;
    if (records.length < 1 || records.length > 100) return json({ error: "Import must contain between 1 and 100 records." }, 400);
    const normalized = records.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid record at index " + index);
      const input = item as Partial<AnalyticsIngestionInput>;
      const metricName = typeof input.metricName === "string" ? input.metricName : (item as Record<string, unknown>).metric;
      if (typeof metricName !== "string") throw new Error("Invalid metric at index " + index);
      return normalizeAnalyticsRecord({ ...input, metricName, source: "user-import", limitations: [...(Array.isArray(input.limitations) ? input.limitations.filter((v): v is string => typeof v === "string") : []), "User-imported data; provider authenticity was not independently verified."] } as AnalyticsIngestionInput);
    });
    for (const record of normalized) await store.append(record);
    return json({ imported: normalized.length, provenance: "user-import-unverified" }, 201);
  } catch (error) {
    if (error instanceof Error && /Unsupported|invalid|Invalid|Analytics|record|metric|period|value|ID/i.test(error.message)) return json({ error: error.message }, 400);
    return json({ error: "Analytics request could not be completed." }, 500);
  }
}
