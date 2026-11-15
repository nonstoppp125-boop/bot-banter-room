export type AgentMessage = {
  id: string;
  from: string;
  to: string;
  kind: "task" | "result" | "review" | "handoff";
  content: string;
  createdAt: number;
};

export type AgentTaskContext = {
  taskId: string;
  agentId: string;
  messages: readonly AgentMessage[];
  dependencyResults: Readonly<Record<string, AgentTaskResult>>;
  sharedContext: Readonly<Record<string, unknown>>;
  signal: AbortSignal;
  attempt: number;
};

export type AgentTask = {
  id: string;
  agentId: string;
  dependsOn?: readonly string[];
  contextMode?: "shared" | "isolated";
  timeoutMs?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
  execute: (context: AgentTaskContext) => Promise<string>;
};

export type AgentTaskResult = {
  taskId: string;
  agentId: string;
  status: "fulfilled" | "rejected" | "skipped";
  output: string;
  error?: string;
  attempts: number;
  durationMs: number;
  startedAt?: number;
  finishedAt: number;
};

export type AgentWorkflowResult = {
  results: Readonly<Record<string, AgentTaskResult>>;
  messages: readonly AgentMessage[];
  metrics: {
    totalTasks: number;
    fulfilled: number;
    rejected: number;
    skipped: number;
    durationMs: number;
    maxConcurrency: number;
    byAgent: Readonly<
      Record<
        string,
        {
          total: number;
          fulfilled: number;
          rejected: number;
          skipped: number;
          attempts: number;
          durationMs: number;
        }
      >
    >;
  };
};

export type AgentWorkflowOptions = {
  signal: AbortSignal;
  concurrency?: number;
  sharedContext?: Readonly<Record<string, unknown>>;
};

const MAX_TASKS = 32;
const MAX_CONCURRENCY = 8;
const MAX_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;

function assertIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

function validateTasks(tasks: readonly AgentTask[]): Map<string, AgentTask> {
  if (!Array.isArray(tasks) || tasks.length === 0 || tasks.length > MAX_TASKS) {
    throw new Error("Workflow must contain between 1 and 32 tasks");
  }

  const byId = new Map<string, AgentTask>();
  const idempotencyKeys = new Set<string>();

  for (const task of tasks) {
    assertIdentifier(task.id, "task id");
    assertIdentifier(task.agentId, "agent id");

    if (byId.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    if (typeof task.execute !== "function") throw new Error(`Task ${task.id} has no executor`);

    const timeout = task.timeoutMs ?? 45_000;
    const attempts = task.maxAttempts ?? 1;

    if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
      throw new Error(`Invalid timeout for task ${task.id}`);
    }
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > MAX_ATTEMPTS) {
      throw new Error(`Invalid retry limit for task ${task.id}`);
    }
    if (
      task.contextMode !== undefined &&
      task.contextMode !== "shared" &&
      task.contextMode !== "isolated"
    ) {
      throw new Error(`Invalid context mode for task ${task.id}`);
    }

    if (task.idempotencyKey !== undefined) {
      assertIdentifier(task.idempotencyKey, "idempotency key");
      if (idempotencyKeys.has(task.idempotencyKey)) {
        throw new Error("Duplicate idempotency key");
      }
      idempotencyKeys.add(task.idempotencyKey);
    }

    byId.set(task.id, task);
  }

  for (const task of tasks) {
    const dependencies = task.dependsOn ?? [];
    if (new Set(dependencies).size !== dependencies.length) {
      throw new Error(`Duplicate dependency in task ${task.id}`);
    }
    for (const dependency of dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(`Unknown dependency ${dependency} in task ${task.id}`);
      }
      if (dependency === task.id) throw new Error(`Circular dependency at ${task.id}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): void {
    if (visiting.has(id)) throw new Error("Circular task dependency detected");
    if (visited.has(id)) return;

    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of byId.keys()) visit(id);
  return byId;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "Task execution failed";
}

async function executeWithControls(
  task: AgentTask,
  dependencyResults: Readonly<Record<string, AgentTaskResult>>,
  messages: readonly AgentMessage[],
  sharedContext: Readonly<Record<string, unknown>>,
  parentSignal: AbortSignal,
): Promise<AgentTaskResult> {
  const startedAt = Date.now();
  const timeoutMs = task.timeoutMs ?? 45_000;
  const maxAttempts = task.maxAttempts ?? 1;
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (parentSignal.aborted) {
      return {
        taskId: task.id,
        agentId: task.agentId,
        status: "rejected",
        output: "",
        error: "Workflow cancelled",
        attempts,
        durationMs: Date.now() - startedAt,
        startedAt,
        finishedAt: Date.now(),
      };
    }

    attempts++;
    const controller = new AbortController();
    let rejectAbort: ((reason?: unknown) => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      rejectAbort = reject;
    });
    const onAbort = () => {
      controller.abort(parentSignal.reason);
      rejectAbort?.(new Error("Workflow cancelled"));
    };
    parentSignal.addEventListener("abort", onAbort, { once: true });
    if (parentSignal.aborted) onAbort();

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error("Task timed out"));
        reject(new Error("Task timed out"));
      }, timeoutMs);
    });

    try {
      const execution = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("Workflow cancelled");
        const isolated = task.contextMode === "isolated";
        return task.execute({
          taskId: task.id,
          agentId: task.agentId,
          messages: isolated ? Object.freeze([]) : messages,
          dependencyResults: isolated ? Object.freeze({}) : dependencyResults,
          sharedContext: isolated ? Object.freeze({}) : sharedContext,
          signal: controller.signal,
          attempt: attempts,
        });
      });

      const output = await Promise.race([execution, timeoutPromise, abortPromise]);
      if (typeof output !== "string" || !output.trim()) {
        throw new Error("Task returned an empty result");
      }

      return {
        taskId: task.id,
        agentId: task.agentId,
        status: "fulfilled",
        output,
        attempts,
        durationMs: Date.now() - startedAt,
        startedAt,
        finishedAt: Date.now(),
      };
    } catch (error) {
      if (parentSignal.aborted || timedOut || attempts >= maxAttempts) {
        return {
          taskId: task.id,
          agentId: task.agentId,
          status: "rejected",
          output: "",
          error: parentSignal.aborted ? "Workflow cancelled" : errorMessage(error),
          attempts,
          durationMs: Date.now() - startedAt,
          startedAt,
          finishedAt: Date.now(),
        };
      }
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      parentSignal.removeEventListener("abort", onAbort);
    }
  }

  return {
    taskId: task.id,
    agentId: task.agentId,
    status: "rejected",
    output: "",
    error: "Task execution failed",
    attempts,
    durationMs: Date.now() - startedAt,
    startedAt,
    finishedAt: Date.now(),
  };
}

/**
 * Validates a proposed nested delegation before handing work to another agent.
 * The path must contain unique agent IDs and remain within the depth limit.
 */
export function assertDelegationAllowed(
  delegationPath: readonly string[],
  nextAgentId: string,
  maxDepth = 8,
): void {
  if (
    !Array.isArray(delegationPath) ||
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > 16
  ) {
    throw new Error("Invalid delegation limits");
  }
  for (const id of delegationPath) assertIdentifier(id, "delegation agent id");
  assertIdentifier(nextAgentId, "delegation agent id");
  if (new Set(delegationPath).size !== delegationPath.length) {
    throw new Error("Circular agent delegation detected");
  }
  if (delegationPath.includes(nextAgentId)) {
    throw new Error("Circular agent delegation detected");
  }
  if (delegationPath.length >= maxDepth) {
    throw new Error("Maximum agent delegation depth exceeded");
  }
}

/**
 * Executes a nested workflow only after validating its delegation path.
 * Callers must pass the complete ancestor path; this prevents a delegated
 * workflow from re-entering an agent already present in that path.
 */
export async function runDelegatedAgentWorkflow(
  delegationPath: readonly string[],
  tasks: readonly AgentTask[],
  options: AgentWorkflowOptions,
  maxDepth = 8,
): Promise<AgentWorkflowResult> {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("Delegated workflow requires at least one task");
  }

  const delegatedAgents = new Set<string>();
  for (const task of tasks) {
    if (!task || typeof task.agentId !== "string") {
      throw new Error("Invalid delegated task");
    }
    delegatedAgents.add(task.agentId);
  }

  for (const agentId of delegatedAgents) {
    assertDelegationAllowed(delegationPath, agentId, maxDepth);
  }

  return runAgentWorkflow(tasks, options);
}

/**
 * Executes a validated dependency graph with bounded concurrency.
 * Failed dependencies skip descendants; independent branches may still succeed.
 */
export async function runAgentWorkflow(
  tasks: readonly AgentTask[],
  options: AgentWorkflowOptions,
): Promise<AgentWorkflowResult> {
  const startedAt = Date.now();
  const byId = validateTasks(tasks);
  const requestedConcurrency = options.concurrency ?? 3;

  if (
    !Number.isInteger(requestedConcurrency) ||
    requestedConcurrency < 1 ||
    requestedConcurrency > MAX_CONCURRENCY
  ) {
    throw new Error("Concurrency must be between 1 and 8");
  }

  const results: Record<string, AgentTaskResult> = {};
  const messages: AgentMessage[] = [];
  const pending = new Set(byId.keys());
  let activeCount = 0;
  let observedMaxConcurrency = 0;
  const activePromises = new Set<Promise<void>>();

  while (pending.size > 0) {
    if (options.signal.aborted) {
      for (const id of pending) {
        const task = byId.get(id)!;
        results[id] = {
          taskId: id,
          agentId: task.agentId,
          status: "skipped",
          output: "",
          error: "Workflow cancelled before execution",
          attempts: 0,
          durationMs: 0,
          finishedAt: Date.now(),
        };
      }
      pending.clear();
      if (activePromises.size > 0) await Promise.all(activePromises);
      break;
    }

    let progressed = false;

    for (const id of [...pending]) {
      const task = byId.get(id)!;
      const dependencies = task.dependsOn ?? [];

      if (!dependencies.every((dependency) => results[dependency] !== undefined)) {
        continue;
      }

      const failedDependency = dependencies.some(
        (dependency) => results[dependency]?.status !== "fulfilled",
      );

      if (failedDependency) {
        results[id] = {
          taskId: id,
          agentId: task.agentId,
          status: "skipped",
          output: "",
          error: "A required dependency did not succeed",
          attempts: 0,
          durationMs: 0,
          finishedAt: Date.now(),
        };
        pending.delete(id);
        progressed = true;
        continue;
      }

      if (activeCount >= requestedConcurrency) break;

      const dependencyResults: Record<string, AgentTaskResult> = {};
      for (const dependency of dependencies) {
        dependencyResults[dependency] = results[dependency]!;
      }

      const handoffMessages: AgentMessage[] = dependencies.flatMap((dependency) => {
        const result = results[dependency]!;
        return [
          {
            id: `${dependency}->${id}`,
            from: result.agentId,
            to: task.agentId,
            kind: "handoff" as const,
            content: result.output,
            createdAt: Date.now(),
          },
        ];
      });

      messages.push(...handoffMessages);
      pending.delete(id);
      activeCount++;
      observedMaxConcurrency = Math.max(observedMaxConcurrency, activeCount);
      progressed = true;

      const activePromise = executeWithControls(
        task,
        dependencyResults,
        handoffMessages,
        options.sharedContext ?? {},
        options.signal,
      )
        .then((result) => {
          results[id] = result;
          if (result.status === "fulfilled") {
            messages.push({
              id: `${id}:result`,
              from: task.agentId,
              to: "orchestrator",
              kind: "result",
              content: result.output,
              createdAt: Date.now(),
            });
          }
        })
        .finally(() => {
          activeCount--;
          activePromises.delete(activePromise);
        });
      activePromises.add(activePromise);
    }

    if (activeCount > 0) {
      await new Promise<void>((resolve) => {
        const poll = () => {
          if (activeCount < requestedConcurrency || options.signal.aborted) resolve();
          else setTimeout(poll, 5);
        };
        poll();
      });
    } else if (!progressed && pending.size > 0) {
      throw new Error("Workflow scheduler could not make progress");
    }
  }

  // All launched tasks must settle before results and metrics are finalized.
  if (activePromises.size > 0) await Promise.all(activePromises);

  const byAgent: Record<
    string,
    {
      total: number;
      fulfilled: number;
      rejected: number;
      skipped: number;
      attempts: number;
      durationMs: number;
    }
  > = {};

  for (const result of Object.values(results)) {
    const metric = (byAgent[result.agentId] ??= {
      total: 0,
      fulfilled: 0,
      rejected: 0,
      skipped: 0,
      attempts: 0,
      durationMs: 0,
    });
    metric.total++;
    metric[result.status]++;
    metric.attempts += result.attempts;
    metric.durationMs += result.durationMs;
  }

  return {
    results,
    messages,
    metrics: {
      totalTasks: tasks.length,
      fulfilled: Object.values(results).filter((item) => item.status === "fulfilled").length,
      rejected: Object.values(results).filter((item) => item.status === "rejected").length,
      skipped: Object.values(results).filter((item) => item.status === "skipped").length,
      durationMs: Date.now() - startedAt,
      maxConcurrency: observedMaxConcurrency,
      byAgent,
    },
  };
}

/** Capability-based routing. The caller must still enforce authorization. */
export function routeTaskToAgents(
  taskText: string,
  agents: readonly {
    id: string;
    role: string;
    capabilities: readonly string[];
  }[],
): string[] {
  const text = taskText.toLowerCase();
  const rules: readonly [RegExp, string][] = [
    [/\b(sql|database|query|statistics|statistical|dataset|data analysis)\b/, "data-analysis"],
    [
      /\b(code|coding|program|implement|typescript|javascript|python|refactor)\b/,
      "code-generation",
    ],
    [/\b(debug|bug|exception|stack trace|crash|root cause)\b/, "debugging"],
    [/\b(linkedin|professional profile)\b/, "linkedin-strategy"],
    [/\b(instagram|social media|social post|content calendar)\b/, "social-strategy"],
    [/\b(seo|search engine|keyword research)\b/, "seo-analysis"],
    [/\b(marketing|campaign|growth strategy)\b/, "marketing-strategy"],
    [/\b(security|vulnerability|threat|prompt injection)\b/, "security-review"],
    [/\b(automation|workflow|trigger|scheduled task)\b/, "workflow-design"],
    [/\b(report|metrics|kpi|dashboard)\b/, "reporting"],
    [
      /\b(research|sources|evidence|fact check|competitor analysis|market analysis|industry analysis|audience research|product research|trend analysis)\b/,
      "research",
    ],
  ];

  const matchedCapabilities = new Set(
    rules.filter(([pattern]) => pattern.test(text)).map(([, capability]) => capability),
  );
  if (matchedCapabilities.size === 0) return ["problem-solver"];

  const selected = [
    ...new Set(
      agents
        .filter(
          (agent) =>
            agent.role === "specialist" &&
            agent.capabilities.some((capability) => matchedCapabilities.has(capability)),
        )
        .map((agent) => agent.id),
    ),
  ];

  return selected.length > 0 ? selected : ["problem-solver"];
}
