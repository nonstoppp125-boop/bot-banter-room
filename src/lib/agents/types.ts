import type { UIMessage } from "ai";

/** Worker bindings this app reads. Secret names must match the Cloudflare config. */
export type AgentEnv = { GROQ_API_KEY?: string };

export type AgentRunInput = {
  messages: UIMessage[];
  env: AgentEnv;
  signal?: AbortSignal;
};

/** A mountable agent. `run` must return a streaming UI-message Response. */
export type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  run: (input: AgentRunInput) => Promise<Response> | Response;
};
