import type { UIMessage } from "ai";

import { getAgent } from "./registry";
import type { AgentEnv } from "./types";

/** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */
export function getAgentEnv(request: Request): AgentEnv {
  const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime
    ?.cloudflare?.env;
  return { GROQ_API_KEY: env?.GROQ_API_KEY };
}

/** Handles a chat request: checks the key, validates the body, delegates to the agent. */
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
    const body = await request.json();
    messages = body?.messages;
    agentId = body?.agentId;
    if (!Array.isArray(messages)) throw new Error("Invalid messages");
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const agent = getAgent(typeof agentId === "string" ? agentId : undefined);
  return agent.run({ messages, env, signal: request.signal });
}
