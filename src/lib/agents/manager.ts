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
  planningMode: "deterministic" | "llm-assisted";
  planningFallbackReason?: string;
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
    perTaskTimeoutMs: number;
    maxAttempts: number;
  };
  limitations: string[];
};

const MAX_SPECIALISTS = 4;
const MAX_TASK_CHARS = 20_000;
const MAX_TASK_TIMEOUT_MS = 45_000;

const HIGH_RISK_ACTIONS: readonly [RegExp, string][] = [
  [/\b(publish|post\s+(?:this|it|the|my)|send\s+(?:this|it|the|my)|message\s+(?:this|it|the|my)|send\s+(?:a|an|the)\s+(?:message|email|dm))\b/i, "External publishing or messaging"],
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
  const dependencies = new Map<string, Set<string>>(
    agentIds.map((id) => [id, new Set<string>()] as const),
  );
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
    planningMode: "deterministic",
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
      perTaskTimeoutMs: MAX_TASK_TIMEOUT_MS,
      maxAttempts: 2,
    },
    limitations: [
      "Complex multi-specialist decomposition is LLM-assisted and schema-validated; failures fall back to deterministic subtasks.",
      "Routing, permissions, risk classification and execution budgets remain deterministic; one bounded deterministic replacement pass is available after rejected specialist tasks.",
      "Token count is a rough character-based estimate, not provider billing telemetry; retries may increase actual model calls.",
      "High-risk intent is flagged for approval; this planner does not execute or approve external actions.",
      "Only registered specialists with llm:inference permission are eligible.",
    ],
  };
}


export type ManagerPlanGenerator = (input: {
  taskText: string;
  candidateAgentIds: readonly string[];
  signal: AbortSignal;
}) => Promise<string>;

/**
 * Uses an LLM only to decompose complex multi-specialist work.
 * Deterministic routing, permissions, risk and execution budgets remain authoritative.
 */
export async function buildLLMAssistedManagerPlan(
  taskText: string,
  basePlan: ManagerPlan,
  generate: ManagerPlanGenerator,
  signal: AbortSignal,
): Promise<ManagerPlan> {
  if (basePlan.complexity !== "complex" || basePlan.agentIds.length < 2) return basePlan;
  if (signal.aborted) throw new Error("Manager planning cancelled");

  try {
    const raw = await generate({
      taskText: taskText.slice(0, MAX_TASK_CHARS),
      candidateAgentIds: basePlan.agentIds,
      signal,
    });
    if (signal.aborted) throw new Error("Manager planning cancelled");

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("subtasks" in parsed) ||
      !Array.isArray(parsed.subtasks) ||
      parsed.subtasks.length === 0 ||
      parsed.subtasks.length > MAX_SPECIALISTS
    ) {
      throw new Error("Invalid Manager plan structure");
    }

    const allowed = new Set(basePlan.agentIds);
    const seen = new Set<string>();
    const subtasks: ManagerSubtask[] = parsed.subtasks.map((item: unknown) => {
      if (typeof item !== "object" || item === null) throw new Error("Invalid Manager subtask");
      const value = item as Record<string, unknown>;
      const { agentId, objective, dependsOn } = value;
      if (
        typeof agentId !== "string" ||
        !allowed.has(agentId) ||
        seen.has(agentId) ||
        typeof objective !== "string" ||
        objective.trim().length === 0 ||
        objective.length > 500 ||
        !Array.isArray(dependsOn) ||
        dependsOn.some((dependency) => typeof dependency !== "string")
      ) {
        throw new Error("Manager plan contains an invalid subtask");
      }
      seen.add(agentId);
      const requiredDependencies = basePlan.subtasks.find((task) => task.agentId === agentId)?.dependsOn ?? [];
      return {
        id: agentId,
        agentId,
        objective: objective.trim(),
        // LLM output may add dependencies but cannot remove deterministic ordering constraints.
        dependsOn: [...new Set([...requiredDependencies, ...(dependsOn as string[])])],
      };
    });

    subtasks.sort(
      (left, right) => basePlan.agentIds.indexOf(left.agentId) - basePlan.agentIds.indexOf(right.agentId),
    );
    const subtaskIds = new Set(subtasks.map((task) => task.id));
    for (const task of subtasks) {
      if (task.dependsOn.some((dependency) => !subtaskIds.has(dependency) || dependency === task.id)) {
        throw new Error("Manager plan contains an unknown or self dependency");
      }
    }

    const byId = new Map<string, ManagerSubtask>(subtasks.map((task) => [task.id, task] as const));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error("Manager plan contains a dependency cycle");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of byId.keys()) visit(id);

    return {
      ...basePlan,
      subtasks,
      agentIds: subtasks.map((task) => task.agentId),
      planningMode: "llm-assisted",
      estimatedModelCalls: basePlan.estimatedModelCalls + 1,
    };
  } catch (error) {
    if (signal.aborted) throw new Error("Manager planning cancelled");
    return {
      ...basePlan,
      planningFallbackReason:
        error instanceof Error ? error.message.slice(0, 160) : "LLM planning failed",
    };
  }
}


export type ManagerReplanTask = ManagerSubtask & {
  sourceAgentId: string;
  failureReason: string;
};

/**
 * Builds at most one deterministic replacement plan for failed specialist tasks.
 * Only a different registered specialist with inference permission and an
 * overlapping capability may replace the failed agent. Skipped descendants
 * are not replanned because their prerequisites did not complete.
 */
export function buildManagerReplanPlan(
  originalSubtasks: readonly ManagerSubtask[],
  results: Readonly<Record<string, { status: string; error?: string }>>,
  agents: readonly AgentDefinition[],
): ManagerReplanTask[] {
  const eligible = agents.filter(
    (agent) =>
      agent.role === "specialist" &&
      typeof agent.generate === "function" &&
      agent.permissions.includes("llm:inference"),
  );
  const byId = new Map(eligible.map((agent) => [agent.id, agent] as const));
  const alreadyAssigned = new Set(originalSubtasks.map((task) => task.agentId));
  const replans: ManagerReplanTask[] = [];

  for (const task of originalSubtasks) {
    if (replans.length >= MAX_SPECIALISTS) break;
    const failed = results[`specialist-${task.agentId}`];
    if (failed?.status !== "rejected") continue;

    const prerequisitesSucceeded = task.dependsOn.every(
      (dependency) => results[`specialist-${dependency}`]?.status === "fulfilled",
    );
    if (!prerequisitesSucceeded) continue;

    const failedAgent = byId.get(task.agentId);
    if (!failedAgent) continue;
    const failedCapabilities = new Set(failedAgent.capabilities);
    const replacement = eligible.find(
      (candidate) =>
        !alreadyAssigned.has(candidate.id) &&
        candidate.capabilities.some((capability) => failedCapabilities.has(capability)),
    );
    if (!replacement) continue;

    alreadyAssigned.add(replacement.id);
    replans.push({
      id: replacement.id,
      agentId: replacement.id,
      sourceAgentId: task.agentId,
      objective: task.objective,
      dependsOn: [],
      failureReason: (failed.error ?? "Specialist task failed").slice(0, 300),
    });
  }

  return replans;
}
