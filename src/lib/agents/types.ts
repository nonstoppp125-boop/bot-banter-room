import type { ModelMessage, UIMessage } from "ai";
import type { D1TaskDatabase } from "./task-store";

/** Cloudflare Workers Rate Limiting binding. */
export type ChatRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

/** Worker bindings this app reads. Names must match the Cloudflare config. */
export type AgentEnv = {
  /** Optional D1 binding used only for authenticated, user-scoped memory retrieval. */
  ACTION_DB?: D1TaskDatabase | undefined;
  CHAT_RATE_LIMITER?: ChatRateLimiter | undefined;
  GROQ_API_KEY?: string | undefined;
  /** Fine-grained GitHub token scoped to the repository allowlist; required only for DevPilot execution. */
  /** Explicit opt-in switch; DevPilot execution stays disabled unless exactly "true". */
  DEVPILOT_ENABLED?: string | undefined;
  GITHUB_TOKEN?: string | undefined;
  /** Comma-separated owner/repository allowlist for the DevPilot GitHub adapter. */
  GITHUB_REPOSITORY_ALLOWLIST?: string | undefined;
  /** Optional workflow filename used for isolated DevPilot validation. */
  /** Optional server-side Tavily key; research falls back safely when absent. */
  TAVILY_API_KEY?: string | undefined;
  /** Optional Groq model override; defaults to DEFAULT_GROQ_MODEL. */
  GROQ_MODEL?: string | undefined;
  /** Plain-text Worker variable; multi-agent runs only when exactly "true". */
  DOOT_MULTI_AGENT?: string | undefined;
};

export type AgentRunInput = {
  messages: UIMessage[];
  env: AgentEnv;
  signal: AbortSignal;
  /** Optional server-restored durable Manager plan; validated again by the orchestrator. */
  managerPlan?: unknown;
  /** Bounded, user-authored memory context loaded from the active session. */
  memoryContext?: string | undefined;
};

export type SpecialistInput = {
  apiKey: string;
  model?: string | undefined;
  messages: ModelMessage[];
  signal: AbortSignal;
};

export type SpecialistGenerationResult = {
  text: string;
  usage: { inputTokens: number | undefined; outputTokens: number | undefined };
};

/** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */
export type AgentPermission =
  | "llm:inference" | "research:search" | "research:extract" | "coding:validate-command"
  | "data:profile" | "business:requirements" | "content:validate" | "seo:audit"
  | "campaign:validate" | "quality:check" | "security:scan" | "workflow:validate"
  | "report:aggregate" | "social:validate";

export type AgentCapability =
  | "chat"
  | "research"
  | "evidence-analysis"
  | "web-content-analysis"
  | "code-generation"
  | "code-review"
  | "debugging"
  | "root-cause-analysis"
  | "data-analysis"
  | "sql-analysis"
  | "statistics"
  | "requirements-analysis"
  | "business-process-analysis"
  | "linkedin-strategy"
  | "social-strategy"
  | "instagram-strategy"
  | "facebook-strategy"
  | "youtube-strategy"
  | "x-strategy"
  | "tiktok-strategy"
  | "content-planning"
  | "content-generation"
  | "copywriting"
  | "content-review"
  | "fact-checking"
  | "seo-analysis"
  | "content-optimization"
  | "problem-solving"
  | "marketing-strategy"
  | "campaign-planning"
  | "quality-review"
  | "security-review"
  | "risk-analysis"
  | "workflow-design"
  | "automation-planning"
  | "reporting"
  | "metrics-analysis";

export type BaseAgent = {
  id: string;
  name: string;
  description: string;
  capabilities: readonly AgentCapability[];
  permissions: readonly AgentPermission[];
  role: "chat" | "specialist";
  run?: (input: AgentRunInput) => Promise<Response> | Response;
  generate?: (input: SpecialistInput) => Promise<string>;
  generateWithUsage?: (input: SpecialistInput) => Promise<SpecialistGenerationResult>;
};

/** Backward-compatible name for existing agent integrations. */
export type AgentDefinition = BaseAgent;
