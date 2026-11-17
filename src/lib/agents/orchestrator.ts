import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { groqModel } from "./groq";
import { buildChatMemoryInstruction } from "./chat-memory";
import { createD1SessionStore, readSessionCookie } from "./session-auth";
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
  } catch {
    return Response.json({ error: "Authentication could not be verified." }, { status: 503 });
  }

  let messages: UIMessage[];
  let agentId: unknown;
  try {
    const body = await request.json();
    messages = body?.messages;
    agentId = body?.agentId;
    if (!Array.isArray(messages)) throw new Error("Invalid messages");
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

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
