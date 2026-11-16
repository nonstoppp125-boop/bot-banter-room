import { createD1SessionStore, readSessionCookie } from "./session-auth";
import { buildManagerPlan, restoreManagerPlan } from "./manager";
import { listAgents } from "./registry";
import { createManagerTaskApproval, verifyManagerTaskApproval } from "./task-approval";
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
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "PATCH") {
    return json({ error: "Method not allowed." }, 405);
  }
  if (request.method === "POST" || request.method === "PATCH") {
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
    if (request.method === "POST" || request.method === "PATCH") {
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
      const taskId = crypto.randomUUID().replace(/-/g, "");
      const approval = plan.approvalRequired
        ? await createManagerTaskApproval(database, {
            taskId, workspaceId: session.workspaceId, userId: session.userId,
            inputSummary: taskText, plan, now,
          })
        : null;
      const task = {
        id: taskId,
        workspaceId: session.workspaceId,
        userId: session.userId,
        status: plan.approvalRequired ? "needs_approval" as const : "queued" as const,
        inputSummary: taskText,
        plan: approval ? { ...plan, approval } : plan,
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      await createD1TaskStore(database).create(task);
      return json({ task }, 201);
    }

    if (request.method === "PATCH") {
      if (!isRecord(body) || (body["action"] !== "cancel" && body["action"] !== "retry" && body["action"] !== "unlock") || typeof body["taskId"] !== "string") {
        return json({ error: "A taskId and supported cancel/retry/unlock action are required." }, 400);
      }
      const store = createD1TaskStore(database);
      const task = await store.get({
        id: body["taskId"],
        workspaceId: session.workspaceId,
        userId: session.userId,
      });
      if (!task) return json({ error: "Task not found." }, 404);
      if (body["action"] === "unlock") {
        if (task.status !== "needs_approval") return json({ error: "Only approval-gated tasks can be unlocked." }, 409);
        const verification = await verifyManagerTaskApproval(database, {
          taskId: task.id, workspaceId: session.workspaceId, userId: session.userId,
          inputSummary: task.inputSummary, plan: task.plan, now: new Date().toISOString(),
        });
        if (!verification.allowed) return json({ error: verification.reason }, 409);
        const metadata = (task.plan as Record<string, unknown>)["approval"] as Record<string, unknown>;
        const unlockedAt = new Date().toISOString();
        const unlocked = await store.unlockApproved({
          id: task.id, workspaceId: session.workspaceId, userId: session.userId,
          approvalId: metadata["approvalId"] as string,
          actionType: metadata["actionType"] as string,
          payloadHash: metadata["payloadHash"] as string,
          updatedAt: unlockedAt,
        });
        if (!unlocked) return json({ error: "Task or persisted approval state changed; refresh and verify approval again." }, 409);
        return json({ task: { ...task, status: "queued", updatedAt: unlockedAt } });
      }
      if (body["action"] === "retry") {
        if (task.status !== "failed") return json({ error: "Only failed tasks can be retried." }, 409);
        const plan = restoreManagerPlan(task.inputSummary, task.plan, listAgents());
        if (!plan) return json({ error: "Saved Manager plan is stale or invalid. Create a new task instead." }, 409);
        if (plan.approvalRequired) return json({ error: "High-risk tasks cannot be retried without a separate approval workflow." }, 409);
        const retriedAt = new Date().toISOString();
        const retried = await store.retry({
          id: task.id, workspaceId: session.workspaceId, userId: session.userId, updatedAt: retriedAt,
        });
        if (!retried) return json({ error: "Retry budget is exhausted or task status changed." }, 409);
        return json({ task: { ...task, status: "queued", updatedAt: retriedAt }, retryLimit: 2 });
      }
      if (task.status !== "queued" && task.status !== "needs_approval") {
        return json({ error: "Only queued or approval-gated tasks can be cancelled." }, 409);
      }
      const cancelledAt = new Date().toISOString();
      const cancelled = await store.update({
        id: task.id,
        workspaceId: session.workspaceId,
        userId: session.userId,
        expectedStatus: task.status,
        status: "cancelled",
        updatedAt: cancelledAt,
      });
      if (!cancelled) return json({ error: "Task status changed; refresh and try again." }, 409);
      return json({ task: { ...task, status: "cancelled", updatedAt: cancelledAt } });
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
