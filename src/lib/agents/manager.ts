import { routeTaskToAgents } from "./coordination";
import type { AgentDefinition } from "./types";

export type ManagerComplexity = "simple" | "moderate" | "complex";
export type ManagerRisk = "low" | "medium" | "high";

export type ManagerSubtask = {
  id: string;
  agentId: string;
  objective: string;
  dependsOn: string[];
};

export type ManagerPlan = {
  summary: string;
  subtasks: ManagerSubtask[];
  agentIds: string[];
  capabilities: string[];
  complexity: ManagerComplexity;
  risk: ManagerRisk;
  riskFactors: string[];
  approvalRequired: boolean;
  approvalReasons: string[];
  estimatedInputTokens: number;
  estimatedModelCalls: number;
  executionBudget: {
    maxSpecialists: number;
    maxParallelAgents: number;
    maxDurationMs: number;
  };
  limitations: string[];
};

const MAX_SPECIALISTS = 4;
const MAX_TASK_CHARS = 20_000;
const MAX_EXECUTION_MS = 45_000;

const HIGH_RISK_ACTIONS: readonly [RegExp, string][] = [
  [/\b(publish|post\s+(?:this|it|the|my)|send|message)\b/i, "External publishing or messaging"],
  [/\b(delete|remove|destroy|overwrite)\b/i, "Destructive or irreversible change"],
  [/\b(deploy|release|ship\s+to\s+production)\b/i, "Production deployment or release"],
  [/\b(purchase|buy|pay|transfer|withdraw)\b/i, "Financial or purchase action"],
  [/\b(change|update|modify)\s+(?:my\s+)?(?:profile|account|permissions|settings)\b/i, "Account or permission modification"],
];

const MEDIUM_RISK_PATTERNS: readonly [RegExp, string][] = [
  [/\b(api key|secret|password|credential|access token|private key)\b/i, "Credential or secret handling"],
  [/\b(personal data|private data|customer data|sensitive information)\b/i, "Sensitive data handling"],
  [/\b(security|vulnerability|exploit|incident response)\b/i, "Security-sensitive analysis"],
];

function assessRisk(taskText: string): {
  risk: ManagerRisk;
  riskFactors: string[];
  approvalReasons: string[];
} {
  const approvalReasons = HIGH_RISK_ACTIONS
    .filter(([pattern]) => pattern.test(taskText))
    .map(([, reason]) => reason);
  const mediumFactors = MEDIUM_RISK_PATTERNS
    .filter(([pattern]) => pattern.test(taskText))
    .map(([, reason]) => reason);
  const riskFactors = [...approvalReasons, ...mediumFactors];

  if (approvalReasons.length > 0) {
    return { risk: "high", riskFactors, approvalReasons };
  }
  if (mediumFactors.length > 0) {
    return { risk: "medium", riskFactors, approvalReasons: [] };
  }
  return { risk: "low", riskFactors: [], approvalReasons: [] };
}

/**
 * Deterministic Manager planning contract.
 * This produces a bounded routing/risk plan; it does not execute external
 * actions, grant permissions, or claim LLM-based task decomposition.
 */
export function buildManagerPlan(
  taskText: string,
  agents: readonly AgentDefinition[],
): ManagerPlan {
  const normalizedTask = typeof taskText === "string" ? taskText.trim().slice(0, MAX_TASK_CHARS) : "";
  const routed = routeTaskToAgents(normalizedTask, agents);
  const available = new Map(
    agents
      .filter((agent) => agent.role === "specialist" && agent.permissions.includes("llm:inference"))
      .map((agent) => [agent.id, agent]),
  );
  const agentIds = routed
    .filter((id) => available.has(id))
    .slice(0, MAX_SPECIALISTS);
  if (agentIds.length === 0) {
    const fallback = available.has("problem-solver") ? "problem-solver" : "";
    if (fallback) agentIds.push(fallback);
  }

  const selected = agentIds.map((id) => available.get(id)!);
  const capabilities = [...new Set(selected.flatMap((agent) => agent.capabilities))].sort();
  const taskIsLong = normalizedTask.length > 1_000;
  const taskIsMultiStep = /\b(first|then|after that|step\s*\d+|end[- ]to[- ]end|complete workflow)\b/i.test(
    normalizedTask,
  );
  const complexity: ManagerComplexity =
    selected.length >= 3 || taskIsLong || taskIsMultiStep
      ? "complex"
      : selected.length > 1 || normalizedTask.length > 350
        ? "moderate"
        : "simple";
  const riskAssessment = assessRisk(normalizedTask);
  const estimatedInputTokens = Math.ceil(normalizedTask.length / 4);
  const dependencies = new Map(agentIds.map((id) => [id, new Set<string>()]));
  const addDependency = (agentId: string, dependencyId: string) => {
    if (agentId !== dependencyId && dependencies.has(agentId) && dependencies.has(dependencyId)) {
      dependencies.get(agentId)!.add(dependencyId);
    }
  };

  // Add only explicit, predictable sequencing edges; otherwise tasks remain parallel.
  if (/research[\s\S]*?(?:then|before|first)[\s\S]*?(?:implement|build|code)/i.test(normalizedTask)) {
    addDependency("coding", "research");
  }
  if (/(?:implement|write|create|fix)[\s\S]*?(?:then|and then|after that)[\s\S]*?debug/i.test(normalizedTask)) {
    addDependency("debugging", "coding");
  }
  if (dependencies.has("reporting") && dependencies.has("data-analyst")) {
    addDependency("reporting", "data-analyst");
  }
  if (dependencies.has("content-reviewer") && dependencies.has("content-writer")) {
    addDependency("content-reviewer", "content-writer");
  }
  const subtasks: ManagerSubtask[] = agentIds.map((agentId) => {
    const agent = available.get(agentId)!;
    return {
      id: agentId,
      agentId,
      objective: `Provide a focused ${agent.name} analysis of the user's request.`,
      dependsOn: [...dependencies.get(agentId)!],
    };
  });

  return {
    summary: normalizedTask.slice(0, 240),
    subtasks,
    agentIds,
    capabilities,
    complexity,
    risk: riskAssessment.risk,
    riskFactors: riskAssessment.riskFactors,
    approvalRequired: riskAssessment.approvalReasons.length > 0,
    approvalReasons: riskAssessment.approvalReasons,
    estimatedInputTokens,
    estimatedModelCalls: agentIds.length + 1,
    executionBudget: {
      maxSpecialists: MAX_SPECIALISTS,
      maxParallelAgents: Math.max(1, Math.min(MAX_SPECIALISTS, agentIds.length)),
      maxDurationMs: MAX_EXECUTION_MS,
    },
    limitations: [
      "Routing and risk classification are deterministic heuristics, not an autonomous LLM planner.",
      "Token count is a rough character-based estimate, not provider billing telemetry.",
      "High-risk intent is flagged for approval; this planner does not execute or approve external actions.",
      "Only registered specialists with llm:inference permission are eligible.",
    ],
  };
}
