import type { UIMessage } from "ai";
import { runMultiAgent } from "./orchestrator";
import { createD1SessionStore, readSessionCookie, type D1SessionDatabase } from "./session-auth";
import { createD1TaskStore, type D1TaskDatabase } from "./task-store";
import { createD1WorkspaceAccessStore } from "./workspace-store";
import type { AgentEnv } from "./types";

type ExecutionDatabase = D1TaskDatabase & D1SessionDatabase & Parameters<typeof createD1WorkspaceAccessStore>[0];
export type TaskExecutionEnv = AgentEnv & { ACTION_DB?: ExecutionDatabase };
type Runner = (input: { messages: UIMessage[]; env: AgentEnv; signal: AbortSignal }) => Promise<Response>;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Decode only AI SDK text-delta records; never persist opaque stream protocol data. */
async function readAssistantText(response: Response): Promise<string> {
  if (!response.ok || !response.body) throw new Error("Specialist execution did not return a readable response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("0:")) continue;
        let chunk: unknown;
        try { chunk = JSON.parse(line.slice(2)); } catch { continue; }
        if (typeof chunk === "string") {
          total += chunk.length;
          if (total > 180_000) throw new Error("Task output exceeded the storage limit.");
          output += chunk;
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  return output.trim();
}

/**
 * Explicit, authenticated synchronous execution for low-risk queued tasks.
 * This is not a background queue consumer. High-risk tasks remain approval-gated.
 */
export async function handleTaskExecutionRequest(
  request: Request,
  env: TaskExecutionEnv,
  runner: Runner = runMultiAgent,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ error: "Cross-origin task execution is blocked." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return json({ error: "JSON content type is required." }, 415);
  }
  if (!env.ACTION_DB) return json({ error: "Task service is not configured." }, 503);
  if (!env.GROQ_API_KEY?.trim()) return json({ error: "GROQ_API_KEY is not configured." }, 503);

  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON payload." }, 400); }
  if (!isRecord(body) || typeof body["taskId"] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(body["taskId"])) {
    return json({ error: "A valid taskId is required." }, 400);
  }

  const database = env.ACTION_DB;
  const now = new Date().toISOString();
  try {
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const membership = await createD1WorkspaceAccessStore(database).getMembership(session.workspaceId, session.userId);
    if (!membership) return json({ error: "Workspace membership required." }, 403);
    const store = createD1TaskStore(database);
    const task = await store.get({ id: body["taskId"], workspaceId: session.workspaceId, userId: session.userId });
    if (!task) return json({ error: "Task not found." }, 404);
    if (task.status === "needs_approval") return json({ error: "This task requires human approval before execution." }, 409);
    if (task.status !== "queued") return json({ error: "Only queued tasks can be executed." }, 409);

    const claimedAt = new Date().toISOString();
    if (!await store.claim({ id: task.id, workspaceId: session.workspaceId, userId: session.userId, updatedAt: claimedAt })) {
      return json({ error: "Task was already claimed or its state changed. Refresh the task list." }, 409);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Task execution time limit reached."), 110_000);
    try {
      const message: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: task.inputSummary }],
      };
      const response = await runner({ messages: [message], env, signal: controller.signal });
      const output = await readAssistantText(response);
      if (!output) throw new Error("Specialist workflow returned no final text.");
      const completedAt = new Date().toISOString();
      const saved = await store.update({
        id: task.id, workspaceId: session.workspaceId, userId: session.userId,
        expectedStatus: "running", status: "completed",
        result: { output, completedAt, execution: "manager-specialist-workflow" },
        updatedAt: completedAt,
      });
      if (!saved) return json({ error: "Execution finished, but task state changed before the result could be saved." }, 409);
      return json({ task: { id: task.id, status: "completed", result: { output }, updatedAt: completedAt } });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const reason = error instanceof Error ? error.message.slice(0, 500) : "Specialist execution failed.";
      await store.update({
        id: task.id, workspaceId: session.workspaceId, userId: session.userId,
        expectedStatus: "running", status: "failed",
        result: { error: reason, failedAt },
        updatedAt: failedAt,
      }).catch(() => false);
      return json({ error: "Task execution failed.", detail: reason }, 502);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return json({ error: "Task execution request could not be completed." }, 500);
  }
}
