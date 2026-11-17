import type { UIMessage } from "ai";
import { runMultiAgent } from "./orchestrator";
import { restoreManagerPlan } from "./manager";
import { listAgents } from "./registry";
import { verifyManagerTaskApproval } from "./task-approval";
import type { AgentEnv } from "./types";
import type { D1TaskDatabase } from "./task-store";

type QueueRow = {
  id: string; workspace_id: string; user_id: string; status: string;
  input_summary: string; plan_json: string; worker_attempt_count: number;
};
type QueueDatabase = D1TaskDatabase;
type QueueEnv = Omit<AgentEnv, "ACTION_DB"> & { ACTION_DB?: QueueDatabase | undefined };
type QueueRunner = (input: { messages: UIMessage[]; env: AgentEnv; signal: AbortSignal; managerPlan?: unknown }) => Promise<Response>;

const LEASE_MS = 90_000;
const MAX_ATTEMPTS = 2;
const MAX_OUTPUT_CHARS = 180_000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

export function createD1QueueStore(database: QueueDatabase) {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 queue database is required.");
  return {
    recoverExpired: async (now: string) => {
      const result = await database.prepare(
        "UPDATE agent_tasks SET status = CASE WHEN worker_attempt_count < ? THEN 'queued' ELSE 'failed' END, lease_owner = NULL, lease_expires_at = NULL, heartbeat_at = NULL, updated_at = ? WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?"
      ).bind(MAX_ATTEMPTS, now, now).run();
      if (result.success === false) throw new Error("D1 expired-lease recovery failed.");
      return result.meta?.changes ?? 0;
    },
    claimNext: async (input: { owner: string; now: string; leaseUntil: string }) => {
      if (!ID.test(input.owner) || !Number.isFinite(Date.parse(input.now)) || !Number.isFinite(Date.parse(input.leaseUntil)) || Date.parse(input.leaseUntil) <= Date.parse(input.now)) {
        throw new Error("Invalid queue lease claim.");
      }
      const row = await database.prepare(
        "UPDATE agent_tasks SET status = 'running', lease_owner = ?, lease_expires_at = ?, heartbeat_at = ?, worker_attempt_count = worker_attempt_count + 1, updated_at = ? WHERE id = (SELECT id FROM agent_tasks WHERE status = 'queued' AND worker_attempt_count < ? ORDER BY created_at ASC LIMIT 1) AND status = 'queued' RETURNING id, workspace_id, user_id, status, input_summary, plan_json, worker_attempt_count"
      ).bind(input.owner, input.leaseUntil, input.now, input.now, MAX_ATTEMPTS).first<QueueRow>();
      return row;
    },
    heartbeat: async (input: { id: string; owner: string; now: string; leaseUntil: string }) => {
      const result = await database.prepare(
        "UPDATE agent_tasks SET heartbeat_at = ?, lease_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'running' AND lease_owner = ? AND lease_expires_at > ?"
      ).bind(input.now, input.leaseUntil, input.now, input.id, input.owner, input.now).run();
      if (result.success === false) throw new Error("D1 queue heartbeat failed.");
      return result.meta?.changes === 1;
    },
    finish: async (input: { id: string; owner: string; status: "completed" | "failed" | "cancelled"; result: unknown; now: string }) => {
      const payload = JSON.stringify(input.result);
      if (payload.length > 200_000) throw new Error("Queue result exceeds its storage limit.");
      const result = await database.prepare(
        "UPDATE agent_tasks SET status = ?, result_json = ?, lease_owner = NULL, lease_expires_at = NULL, heartbeat_at = NULL, updated_at = ? WHERE id = ? AND status = 'running' AND lease_owner = ?"
      ).bind(input.status, payload, input.now, input.id, input.owner).run();
      if (result.success === false) throw new Error("D1 queue task completion failed.");
      return result.meta?.changes === 1;
    },
  };
}

async function readOutput(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.ok || !response.body) throw new Error("Specialist execution returned no readable response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", output = "";
  try {
    while (true) {
      if (signal.aborted) throw new Error("Queue task execution timed out.");
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("0:")) continue;
        try {
          const part: unknown = JSON.parse(line.slice(2));
          if (typeof part === "string") output += part;
        } catch { /* Ignore non-text stream records. */ }
        if (output.length > MAX_OUTPUT_CHARS) throw new Error("Queue task output exceeded its storage limit.");
      }
      if (done) break;
    }
    if (buffer.startsWith("0:")) {
      try { const part: unknown = JSON.parse(buffer.slice(2)); if (typeof part === "string") output += part; } catch { /* Ignore malformed trailing record. */ }
    }
    if (!output.trim()) throw new Error("Specialist workflow returned no final text.");
    return output.trim();
  } finally { reader.releaseLock(); }
}

/** Runs one durable D1 task per scheduled invocation; leases make concurrent workers safe. */
export async function processD1TaskQueue(
  env: QueueEnv,
  options: { runner?: QueueRunner; now?: () => Date; owner?: () => string } = {},
): Promise<{ recovered: number; claimed: boolean; taskId?: string }> {
  if (!env.ACTION_DB) throw new Error("ACTION_DB is not configured for the task queue.");
  const nowFn = options.now ?? (() => new Date());
  const owner = (options.owner ?? (() => crypto.randomUUID().replace(/-/g, "")))();
  const store = createD1QueueStore(env.ACTION_DB);
  const now = nowFn().toISOString();
  const recovered = await store.recoverExpired(now);
  const task = await store.claimNext({ owner, now, leaseUntil: new Date(Date.parse(now) + LEASE_MS).toISOString() });
  if (!task) return { recovered, claimed: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Queue execution timeout."), 75_000);
  const heartbeat = setInterval(() => {
    const beat = nowFn().toISOString();
    void store.heartbeat({ id: task.id, owner, now: beat, leaseUntil: new Date(Date.parse(beat) + LEASE_MS).toISOString() })
      .then((ok) => { if (!ok) controller.abort("Queue lease was lost."); })
      .catch(() => controller.abort("Queue heartbeat failed."));
  }, 20_000);
  try {
    const plan = JSON.parse(task.plan_json) as unknown;
    const managerPlan = restoreManagerPlan(task.input_summary, plan, listAgents());
    if (!managerPlan) throw new Error("Persisted Manager plan is invalid or incompatible.");
    if (managerPlan.approvalRequired) {
      const approval = await verifyManagerTaskApproval(env.ACTION_DB, {
        taskId: task.id, workspaceId: task.workspace_id, userId: task.user_id,
        inputSummary: task.input_summary, plan, now: nowFn().toISOString(),
      });
      if (!approval.allowed) throw new Error("Human approval verification failed: " + approval.reason);
    }
    if (!env.GROQ_API_KEY?.trim()) throw new Error("GROQ_API_KEY is not configured.");
    const message: UIMessage = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: task.input_summary }] };
    const response = await (options.runner ?? runMultiAgent)({ messages: [message], env, signal: controller.signal, managerPlan });
    const output = await readOutput(response, controller.signal);
    const completedAt = nowFn().toISOString();
    await store.finish({ id: task.id, owner, status: "completed", result: { output, completedAt, execution: "d1-background-queue" }, now: completedAt });
    return { recovered, claimed: true, taskId: task.id };
  } catch (error) {
    const failedAt = nowFn().toISOString();
    const detail = error instanceof Error ? error.message.slice(0, 500) : "Queue execution failed.";
    await store.finish({ id: task.id, owner, status: controller.signal.aborted ? "cancelled" : "failed", result: { error: detail, failedAt }, now: failedAt });
    return { recovered, claimed: true, taskId: task.id };
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
}
