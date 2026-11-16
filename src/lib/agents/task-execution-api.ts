import type { UIMessage } from "ai";
import { runMultiAgent } from "./orchestrator";
import { createD1SessionStore, readSessionCookie, type D1SessionDatabase } from "./session-auth";
import { createD1TaskStore, type D1TaskDatabase } from "./task-store";
import { createD1WorkspaceAccessStore } from "./workspace-store";
import type { AgentEnv } from "./types";
import { restoreManagerPlan } from "./manager";
import { listAgents } from "./registry";

type ExecutionDatabase = D1TaskDatabase & D1SessionDatabase & Parameters<typeof createD1WorkspaceAccessStore>[0];
export type TaskExecutionEnv = Omit<AgentEnv, "ACTION_DB"> & { ACTION_DB?: ExecutionDatabase | undefined };
type Runner = (input: { messages: UIMessage[]; env: AgentEnv; signal: AbortSignal; managerPlan?: unknown }) => Promise<Response>;

const MAX_REQUEST_BYTES = 2_048;
const MAX_OUTPUT_CHARS = 180_000;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 };

/** Read the tiny task-execution command with a hard streaming byte ceiling. */
async function readBoundedJson(request: Request): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return { ok: false, status: 413 };
    }
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
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
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

/** Decode only AI SDK text-delta records; never persist opaque stream protocol data. */
async function readAssistantText(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.ok || !response.body) throw new Error("Specialist execution did not return a readable response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let total = 0;

  const cancelOnAbort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancelOnAbort, { once: true });

  const consumeLine = (line: string) => {
    if (!line.startsWith("0:")) return;
    let chunk: unknown;
    try { chunk = JSON.parse(line.slice(2)); } catch { return; }
    if (typeof chunk !== "string") return;
    total += chunk.length;
    if (total > MAX_OUTPUT_CHARS) throw new Error("Task output exceeded the storage limit.");
    output += chunk;
  };

  try {
    while (true) {
      if (signal.aborted) throw new Error("Task execution was cancelled.");
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    if (buffer) consumeLine(buffer);
    if (signal.aborted) throw new Error("Task execution was cancelled.");
    return output.trim();
  } finally {
    signal.removeEventListener("abort", cancelOnAbort);
    reader.releaseLock();
  }
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

  const parsed = await readBoundedJson(request);
  if (!parsed.ok) {
    return json({ error: parsed.status === 413 ? "Request body is too large." : "Invalid JSON payload." }, parsed.status);
  }
  const body = parsed.value;
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
    const managerPlan = restoreManagerPlan(task.inputSummary, task.plan, listAgents());
    if (!managerPlan) return json({ error: "The saved Manager plan is invalid or no longer compatible. Create a new task plan." }, 409);
    if (managerPlan.approvalRequired) return json({ error: "This task requires human approval before execution." }, 409);

    const claimedAt = new Date().toISOString();
    if (!await store.claim({ id: task.id, workspaceId: session.workspaceId, userId: session.userId, updatedAt: claimedAt })) {
      return json({ error: "Task was already claimed or its state changed. Refresh the task list." }, 409);
    }

    const controller = new AbortController();
    const abortForRequest = () => controller.abort("Client disconnected.");
    request.signal.addEventListener("abort", abortForRequest, { once: true });
    if (request.signal.aborted) abortForRequest();
    const timeout = setTimeout(() => controller.abort("Task execution time limit reached."), 110_000);
    try {
      const message: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: task.inputSummary }],
      };
      const response = await runner({ messages: [message], env, signal: controller.signal, managerPlan });
      const output = await readAssistantText(response, controller.signal);
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
      const cancelled = controller.signal.aborted;
      const reason = cancelled
        ? "Task execution was cancelled or exceeded its time limit."
        : error instanceof Error ? error.message.slice(0, 500) : "Specialist execution failed.";
      await store.update({
        id: task.id, workspaceId: session.workspaceId, userId: session.userId,
        expectedStatus: "running", status: cancelled ? "cancelled" : "failed",
        result: { error: reason, failedAt },
        updatedAt: failedAt,
      }).catch(() => false);
      return json({ error: cancelled ? "Task execution was cancelled." : "Task execution failed.", detail: reason }, cancelled ? 504 : 502);
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abortForRequest);
    }
  } catch {
    return json({ error: "Task execution request could not be completed." }, 500);
  }
}
