import { createD1SessionStore, readSessionCookie } from "./session-auth";
import { buildManagerPlan } from "./manager";
import { listAgents } from "./registry";
import { createD1TaskStore, type D1TaskDatabase } from "./task-store";
import { createD1WorkspaceAccessStore } from "./workspace-store";
import type { D1SessionDatabase } from "./session-auth";

type TaskApiDatabase = D1TaskDatabase & D1SessionDatabase & Parameters<typeof createD1WorkspaceAccessStore>[0];
export type TaskApiEnv = { ACTION_DB?: TaskApiDatabase };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type TaskBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

async function readTaskBody(request: Request): Promise<TaskBodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > 24_000) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > 24_000) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    if (totalBytes === 0) return { ok: false, status: 400 };
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { ok: false, status: 400 };
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}

/**
 * Session-bound durable Manager task intake and owner-scoped listing.
 * This API queues plans only; it never executes specialists or external actions.
 */
export async function handleTaskRequest(request: Request, env: TaskApiEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return json({ error: "Cross-origin task creation is blocked." }, 403);
    }
    const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return json({ error: "JSON content type is required." }, 415);
    }
  }

  const database = env.ACTION_DB;
  if (!database) return json({ error: "Task service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const membership = await createD1WorkspaceAccessStore(database).getMembership(session.workspaceId, session.userId);
    if (!membership) return json({ error: "Workspace membership required." }, 403);
    let body: unknown = null;
    if (request.method === "POST") {
      const parsed = await readTaskBody(request);
      if (!parsed.ok) {
        return json(
          { error: parsed.status === 413 ? "Task request body is too large." : "Invalid JSON task payload." },
          parsed.status,
        );
      }
      body = parsed.value;
    }

    if (request.method === "POST") {
      if (!isRecord(body) || typeof body["task"] !== "string" ||
          !body["task"].trim() || body["task"].length > 20_000) {
        return json({ error: "A task between 1 and 20,000 characters is required." }, 400);
      }
      const taskText = body["task"].trim();
      const plan = buildManagerPlan(taskText, listAgents());
      const task = {
        id: crypto.randomUUID().replace(/-/g, ""),
        workspaceId: session.workspaceId,
        userId: session.userId,
        status: plan.approvalRequired ? "needs_approval" as const : "queued" as const,
        inputSummary: taskText,
        plan,
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      await createD1TaskStore(database).create(task);
      return json({ task }, 201);
    }

    const tasks = await createD1TaskStore(database).list({
      workspaceId: session.workspaceId,
      userId: session.userId,
      limit: 50,
    });
    return json({ tasks });
  } catch {
    return json({ error: "Task request could not be completed." }, 500);
  }
}
