import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { groqModel } from "./groq";
import { LIZA_SYSTEM } from "./liza-default";
import { getAgent, getSpecialist } from "./registry";
import type { AgentEnv, AgentRunInput } from "./types";

/** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */
export function getAgentEnv(request: Request): AgentEnv {
  const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime
    ?.cloudflare?.env;
  // Cloudflare binding names are case-sensitive. Support the legacy mixed-case
  // name already configured in this Worker as well as the canonical name.
  return {
    GROQ_API_KEY: env?.GROQ_API_KEY ?? env?.Groq_API_Key ?? env?.Groq_API_KEY,
    DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT,
  };
}

export function isMultiAgentEnabled(env: AgentEnv): boolean {
  return env.DOOT_MULTI_AGENT === "true";
}

/** Problem Solver + Quality Reviewer in parallel, then one streamed synthesis. */
export async function runMultiAgent(input: AgentRunInput): Promise<Response> {
  const { messages, env, signal } = input;
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
    instructions: `${LIZA_SYSTEM}\n\nWrite the final answer to the user using these internal specialist notes. Do not mention the specialists.\n\n${notes.join("\n\n")}`,
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

  let messages: UIMessage[];
  let agentId: unknown;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1_000_000) {
      return Response.json({ error: "Request is too large" }, { status: 413 });
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Invalid body");
    const data = body as { messages?: unknown; agentId?: unknown };
    if (!Array.isArray(data.messages) || data.messages.length === 0 || data.messages.length > 40) {
      throw new Error("Invalid messages");
    }
    const validMessages = data.messages.every((message) => {
      if (!message || typeof message !== "object") return false;
      const item = message as { role?: unknown; parts?: unknown };
      return ["user", "assistant"].includes(String(item.role)) &&
        Array.isArray(item.parts) &&
        item.parts.length > 0 &&
        item.parts.every((part) => part && typeof part === "object" &&
          (part as { type?: unknown }).type === "text" &&
          typeof (part as { text?: unknown }).text === "string" &&
          ((part as { text: string }).text.length <= 20_000));
    });
    if (!validMessages) throw new Error("Invalid message content");
    messages = data.messages as UIMessage[];
    agentId = data.agentId;
  } catch {
    return Response.json({ error: "Invalid request. Check message format and limits." }, { status: 400 });
  }

  const input = { messages, env, signal: request.signal };
  if (isMultiAgentEnabled(env)) return runMultiAgent(input);
  return getAgent(typeof agentId === "string" ? agentId : undefined).run!(input);
}
