import type { ModelMessage, UIMessage } from "ai";
import type { ChatMemoryEnv } from "./chat-memory";

/** Worker bindings this app reads. Names must match the Cloudflare config. */
export type AgentEnv = ChatMemoryEnv & {
  GROQ_API_KEY?: string | undefined;
  /** Plain-text Worker variable; multi-agent runs only when exactly "true". */
  DOOT_MULTI_AGENT?: string | undefined;
};

export type AgentRunInput = {
  messages: UIMessage[];
  env: AgentEnv;
  signal: AbortSignal;
  /** Per-request language and approved-memory context, built by the orchestrator. */
  systemInstruction?: string;
};

export type SpecialistInput = {
  apiKey: string;
  messages: ModelMessage[];
  signal: AbortSignal;
};

/** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */
export type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  role: "chat" | "specialist";
  run?: (input: AgentRunInput) => Promise<Response> | Response;
  generate?: (input: SpecialistInput) => Promise<string>;
};
