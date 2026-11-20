import { createD1SessionStore, readSessionCookie } from "./session-auth";
import { createD1WorkspaceAccessStore } from "./workspace-store";
import { createDevPilotRunStore } from "./devpilot-run-store";

type DevPilotApiDatabase =
  Parameters<typeof createD1SessionStore>[0] &
  Parameters<typeof createD1WorkspaceAccessStore>[0] &
  Parameters<typeof createDevPilotRunStore>[0];

export type DevPilotApiEnv = {
  ACTION_DB?: DevPilotApiDatabase | undefined;
  DEVPILOT_ENABLED?: string | undefined;
  GITHUB_TOKEN?: string | undefined;
  GITHUB_REPOSITORY_ALLOWLIST?: string | undefined;
  GROQ_API_KEY?: string | undefined;
};

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", Vary: "Cookie" },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > 24_000)) return null;
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
      if (total > 24_000) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    if (total === 0) return null;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function allowedRepositories(env: DevPilotApiEnv): Set<string> {
  return new Set((env.GITHUB_REPOSITORY_ALLOWLIST ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function validBranch(value: string): boolean {
  return value.length > 0 && value.length <= 120 &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
    !value.includes("..") && !value.endsWith("/") && !value.endsWith(".") && !value.endsWith(".lock");
}

/** Authenticated, workspace-scoped DevPilot task intake and run listing. */
export async function handleDevPilotRunRequest(request: Request, env: DevPilotApiEnv): Promise<Response> {
  if (!["GET", "POST", "HEAD"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin DevPilot requests are blocked." }, 403);
    const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "application/json") return json({ error: "JSON content type is required." }, 415);
  }
  const database = env.ACTION_DB;
  if (!database) return json({ error: "DevPilot storage is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);
  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const membership = await createD1WorkspaceAccessStore(database).getMembership(session.workspaceId, session.userId);
    if (!membership) return json({ error: "Workspace membership required." }, 403);
    const store = createDevPilotRunStore(database);
    if (request.method === "GET") {
      const runs = await store.list({ workspaceId: session.workspaceId, userId: session.userId, limit: 50 });
      return json({ runs });
    }
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
    if (env.DEVPILOT_ENABLED !== "true" || !env.GITHUB_TOKEN || !env.GROQ_API_KEY) {
      return json({ error: "DevPilot execution is not enabled for this workspace runtime." }, 503);
    }
    const body = await readBody(request);
    if (!body || typeof body["task"] !== "string" || !body["task"].trim() || body["task"].length > 4_000) {
      return json({ error: "A task between 1 and 4,000 characters is required." }, 400);
    }
    const repository = body["repository"];
    const baseBranch = body["baseBranch"] ?? "main";
    if (typeof repository !== "string" || !allowedRepositories(env).has(repository.toLowerCase())) {
      return json({ error: "Repository is not in the DevPilot allowlist." }, 403);
    }
    if (typeof baseBranch !== "string" || !validBranch(baseBranch) || baseBranch.startsWith("devpilot/")) {
      return json({ error: "A valid base branch is required." }, 400);
    }
    const id = crypto.randomUUID().replace(/-/g, "");
    await store.create({
      id, workspaceId: session.workspaceId, userId: session.userId,
      repository, baseBranch, task: body["task"].trim(), now,
      checkpoint: { stage: "queued", data: {} },
    });
    const run = await store.get({ id, workspaceId: session.workspaceId, userId: session.userId });
    if (!run) return json({ error: "DevPilot run was not persisted." }, 500);
    return json({ run }, 201);
  } catch (error) {
    console.error("DevPilot run API failed.", error);
    return json({ error: "DevPilot run request failed safely." }, 500);
  }
}
