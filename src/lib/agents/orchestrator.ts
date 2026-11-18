import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { groqModel } from "./groq";
import { buildChatMemoryInstruction } from "./chat-memory";
import { createD1SessionStore, readSessionCookie } from "./session-auth";
import { createD1WorkspaceAccessStore } from "./workspace-store";
import { buildLizaSystem } from "./liza-prompt";
import { getAgent, getSpecialist } from "./registry";
import type { AgentEnv, AgentRunInput } from "./types";

/** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */
export function getAgentEnv(request: Request): AgentEnv {
  const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime
    ?.cloudflare?.env;
  return {
    GROQ_API_KEY: env?.GROQ_API_KEY,
    DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT,
    ACTION_DB: env?.ACTION_DB,
  };
}


const MAX_CHAT_BODY_BYTES = 1_048_576;
type ChatBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

async function readChatBody(request: Request): Promise<ChatBodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\\d+$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > MAX_CHAT_BODY_BYTES) return { ok: false, status: 413 };
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
      if (total > MAX_CHAT_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    if (!total) return { ok: false, status: 400 };
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }; }
    catch { return { ok: false, status: 400 }; }
  } catch { return { ok: false, status: 400 }; }
  finally { reader.releaseLock(); }
}

export function isMultiAgentEnabled(env: AgentEnv): boolean {
  return env.DOOT_MULTI_AGENT === "true";
}

/** Problem Solver + Quality Reviewer in parallel, then one streamed synthesis. */
export async function runMultiAgent(input: AgentRunInput): Promise<Response> {
  const { messages, env, signal, systemInstruction } = input;
  const apiKey = env.GROQ_API_KEY!;
  const modelMessages = await convertToModelMessages(messages);

  const [solver, reviewer] = await Promise.allSettled([
    getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),
    getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),
  ]);

  if (signal.aborted) return new Response(null, { status: 499 });

  const notes: string[] = [];
  if (solver.status === "fulfilled" && solver.value.trim())
    notes.push(`Problem Solver notes:\n${solver.value}`);
  if (reviewer.status === "fulfilled" && reviewer.value.trim())
    notes.push(`Quality Reviewer notes:\n${reviewer.value}`);

  // Both specialists failed: answer exactly like the normal single agent.
  if (notes.length === 0) return getAgent(undefined).run!(input);

  const result = streamText({
    model: groqModel(apiKey),
    instructions: `${systemInstruction ?? "You are Liza, the assistant inside Doot."}\n\nWrite the final answer to the user using these internal specialist notes. Do not mention the specialists.\n\n${notes.join("\n\n")}`,
    messages: modelMessages,
    abortSignal: signal,
  });
  return result.toUIMessageStreamResponse({ originalMessages: messages });
}

/** Handles a chat request: checks the key, validates the body, delegates to an agent. */
export async function handleChatRequest(request: Request): Promise<Response> {
  const env = getAgentEnv(request);
  if (!env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  if (!env.ACTION_DB) return Response.json({ error: "Authentication service is not configured." }, { status: 503 });
  const sessionToken = readSessionCookie(request.headers.get("cookie"));
  if (!sessionToken) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const session = await createD1SessionStore(env.ACTION_DB).getActive(sessionToken, new Date().toISOString());
    if (!session?.workspaceId) return Response.json({ error: "An active workspace session is required." }, { status: 401 });
    const membership = await createD1WorkspaceAccessStore(env.ACTION_DB).getMembership(session.workspaceId, session.userId);
    if (!membership) return Response.json({ error: "Workspace membership is required." }, { status: 403 });
  } catch {
    return Response.json({ error: "Authentication could not be verified." }, { status: 503 });
  }

  const parsed = await readChatBody(request);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.status === 413 ? "Chat request is too large." : "Invalid request" },
      { status: parsed.status },
    );
  }
  const body = parsed.value as { messages?: unknown; agentId?: unknown } | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const messages = body.messages as UIMessage[];
  const agentId = body.agentId;

  const memoryInstruction = await buildChatMemoryInstruction(request, messages, env);
  const input: AgentRunInput = {
    messages,
    env,
    signal: request.signal,
    systemInstruction: buildLizaSystem(messages) + memoryInstruction,
  };
  if (isMultiAgentEnabled(env)) return runMultiAgent(input);
  return getAgent(typeof agentId === "string" ? agentId : undefined).run!(input);
}
