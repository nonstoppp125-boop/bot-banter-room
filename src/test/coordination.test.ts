import { describe, expect, it } from "vitest";
import {
  assertDelegationAllowed,
  routeTaskToAgents,
  runAgentWorkflow,
  type AgentTask,
} from "@/lib/agents/coordination";

const signal = () => new AbortController().signal;

describe("multi-agent coordination engine", () => {
  it("routes domain tasks by registered capability and falls back safely", () => {
    const agents = [
      { id: "coding", role: "specialist", capabilities: ["code-generation"] },
      { id: "data-analyst", role: "specialist", capabilities: ["data-analysis"] },
    ];

    expect(routeTaskToAgents("Implement a TypeScript feature", agents)).toEqual(["coding"]);
    expect(routeTaskToAgents("Analyze this SQL dataset", agents)).toEqual(["data-analyst"]);
    expect(routeTaskToAgents("Hello", agents)).toEqual(["problem-solver"]);
  });

  it("routes requests matching multiple capabilities to every matching specialist", () => {
    const agents = [
      { id: "coding", role: "specialist", capabilities: ["code-generation"] },
      { id: "debugging", role: "specialist", capabilities: ["debugging"] },
      { id: "research", role: "specialist", capabilities: ["research"] },
      { id: "unrelated", role: "specialist", capabilities: ["reporting"] },
      { id: "liza-default", role: "primary", capabilities: ["chat"] },
    ];

    expect(
      routeTaskToAgents(
        "Implement and debug this TypeScript feature; research relevant API sources",
        agents,
      ),
    ).toEqual(["coding", "debugging", "research"]);
  });

  it("executes dependency tasks sequentially and hands off structured results", async () => {
    const order: string[] = [];
    const tasks: AgentTask[] = [
      {
        id: "plan",
        agentId: "planner",
        execute: async () => {
          order.push("plan");
          return "plan-output";
        },
      },
      {
        id: "review",
        agentId: "reviewer",
        dependsOn: ["plan"],
        execute: async ({ dependencyResults, messages }) => {
          order.push("review");
          expect(dependencyResults["plan"]?.output).toBe("plan-output");
          expect(messages[0]?.content).toBe("plan-output");
          return "review-output";
        },
      },
    ];

    const result = await runAgentWorkflow(tasks, { signal: signal() });
    expect(order).toEqual(["plan", "review"]);
    expect(result.metrics.fulfilled).toBe(2);
    expect(result.messages.some((message) => message.kind === "handoff")).toBe(true);
  });

  it("keeps isolated tasks separate from messages, dependency results, and shared context", async () => {
    const sharedContext = { workspaceSecret: "private-context" };
    let sharedObserved = false;
    let isolatedObserved = false;

    const tasks: AgentTask[] = [
      {
        id: "source",
        agentId: "planner",
        execute: async () => "dependency-output",
      },
      {
        id: "shared",
        agentId: "reviewer",
        dependsOn: ["source"],
        contextMode: "shared",
        execute: async ({ messages, dependencyResults, sharedContext: context }) => {
          sharedObserved =
            messages.some((message) => message.content === "dependency-output") &&
            dependencyResults["source"]?.output === "dependency-output" &&
            context["workspaceSecret"] === "private-context";
          return "shared-ok";
        },
      },
      {
        id: "isolated",
        agentId: "independent-reviewer",
        dependsOn: ["source"],
        contextMode: "isolated",
        execute: async ({ messages, dependencyResults, sharedContext: context }) => {
          isolatedObserved =
            messages.length === 0 &&
            Object.keys(dependencyResults).length === 0 &&
            Object.keys(context).length === 0;
          return "isolated-ok";
        },
      },
    ];

    const result = await runAgentWorkflow(tasks, {
      signal: signal(),
      sharedContext,
      concurrency: 2,
    });

    expect(result.metrics.fulfilled).toBe(3);
    expect(sharedObserved).toBe(true);
    expect(isolatedObserved).toBe(true);
  });

  it("runs independent tasks with bounded concurrency", async () => {
    let active = 0;
    let maximum = 0;

    const tasks: AgentTask[] = Array.from({ length: 5 }, (_, index) => ({
      id: `task-${index}`,
      agentId: "worker",
      execute: async () => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 15));
        active--;
        return "ok";
      },
    }));

    const result = await runAgentWorkflow(tasks, { signal: signal(), concurrency: 2 });
    expect(result.metrics.fulfilled).toBe(5);
    expect(maximum).toBeLessThanOrEqual(2);
    expect(result.metrics.maxConcurrency).toBeLessThanOrEqual(2);
  });

  it("skips descendants after dependency failure but preserves independent success", async () => {
    const tasks: AgentTask[] = [
      {
        id: "bad",
        agentId: "worker",
        execute: async () => {
          throw new Error("failure");
        },
      },
      {
        id: "child",
        agentId: "worker",
        dependsOn: ["bad"],
        execute: async () => "must-not-run",
      },
      { id: "independent", agentId: "worker", execute: async () => "survives" },
    ];

    const result = await runAgentWorkflow(tasks, { signal: signal() });
    expect(result.results["bad"]?.status).toBe("rejected");
    expect(result.results["child"]?.status).toBe("skipped");
    expect(result.results["independent"]?.status).toBe("fulfilled");
    expect(result.metrics.fulfilled).toBe(1);
  });

  it("rejects dependency cycles and duplicate idempotency keys", async () => {
    const cyclic: AgentTask[] = [
      { id: "a", agentId: "worker", dependsOn: ["b"], execute: async () => "a" },
      { id: "b", agentId: "worker", dependsOn: ["a"], execute: async () => "b" },
    ];
    await expect(runAgentWorkflow(cyclic, { signal: signal() })).rejects.toThrow(/Circular/);

    const duplicate: AgentTask[] = [
      { id: "a", agentId: "worker", idempotencyKey: "same", execute: async () => "a" },
      { id: "b", agentId: "worker", idempotencyKey: "same", execute: async () => "b" },
    ];
    await expect(runAgentWorkflow(duplicate, { signal: signal() })).rejects.toThrow(
      /Duplicate idempotency key/,
    );
  });

  it("enforces task timeouts and bounded retry counts", async () => {
    let attempts = 0;
    const tasks: AgentTask[] = [
      {
        id: "retry",
        agentId: "worker",
        maxAttempts: 2,
        timeoutMs: 100,
        execute: async () => {
          attempts++;
          if (attempts === 1) throw new Error("transient");
          return "recovered";
        },
      },
    ];

    const result = await runAgentWorkflow(tasks, { signal: signal() });
    expect(result.results["retry"]?.status).toBe("fulfilled");
    expect(result.results["retry"]?.attempts).toBe(2);

    const timeoutTask: AgentTask[] = [
      {
        id: "slow",
        agentId: "worker",
        timeoutMs: 10,
        execute: async () =>
          new Promise<string>((resolve) => setTimeout(() => resolve("late"), 50)),
      },
    ];
    const timed = await runAgentWorkflow(timeoutTask, { signal: signal() });
    expect(timed.results["slow"]?.status).toBe("rejected");
    expect(timed.results["slow"]?.error).toBe("Task timed out");
  });

  it("supports caller cancellation", async () => {
    const controller = new AbortController();
    const tasks: AgentTask[] = [
      {
        id: "cancel",
        agentId: "worker",
        execute: async ({ signal: taskSignal }) =>
          new Promise<string>((_, reject) => {
            taskSignal.addEventListener("abort", () => reject(new Error("aborted")), {
              once: true,
            });
            controller.abort();
          }),
      },
    ];

    const result = await runAgentWorkflow(tasks, { signal: controller.signal });
    expect(result.results["cancel"]?.status).toBe("rejected");
    expect(result.results["cancel"]?.error).toBe("Workflow cancelled");
  });

  it("cancels unresponsive active tasks and skips waiting tasks", async () => {
    const controller = new AbortController();
    const tasks: AgentTask[] = [
      {
        id: "running",
        agentId: "worker",
        execute: async () =>
          new Promise<string>(() => {
            setTimeout(() => controller.abort(), 5);
          }),
      },
      {
        id: "waiting",
        agentId: "worker",
        execute: async () => "must-not-run",
      },
    ];

    const result = await runAgentWorkflow(tasks, {
      signal: controller.signal,
      concurrency: 1,
    });

    expect(result.results["running"]?.status).toBe("rejected");
    expect(result.results["running"]?.error).toBe("Workflow cancelled");
    expect(result.results["waiting"]?.status).toBe("skipped");
  });

  it("reports per-agent execution metrics", async () => {
    const result = await runAgentWorkflow(
      [
        { id: "a", agentId: "worker-a", execute: async () => "ok" },
        { id: "b", agentId: "worker-a", execute: async () => "ok" },
        { id: "c", agentId: "worker-b", execute: async () => "ok" },
      ],
      { signal: signal(), concurrency: 2 },
    );

    expect(result.metrics.byAgent["worker-a"]?.total).toBe(2);
    expect(result.metrics.byAgent["worker-a"]?.fulfilled).toBe(2);
    expect(result.metrics.byAgent["worker-b"]?.fulfilled).toBe(1);
  });

  it("rejects circular and excessive nested delegation", () => {
    expect(() => assertDelegationAllowed(["liza", "research"], "liza")).toThrow(
      /Circular agent delegation/,
    );
    expect(() => assertDelegationAllowed(["a", "b"], "c", 2)).toThrow(
      /Maximum agent delegation depth/,
    );
    expect(() => assertDelegationAllowed(["a"], "b")).not.toThrow();
  });

  it("rejects invalid concurrency and unknown dependencies", async () => {
    const task: AgentTask[] = [{ id: "a", agentId: "worker", execute: async () => "a" }];
    await expect(runAgentWorkflow(task, { signal: signal(), concurrency: 0 })).rejects.toThrow(
      /Concurrency/,
    );

    const invalid: AgentTask[] = [
      {
        id: "a",
        agentId: "worker",
        dependsOn: ["missing"],
        execute: async () => "a",
      },
    ];
    await expect(runAgentWorkflow(invalid, { signal: signal() })).rejects.toThrow(
      /Unknown dependency/,
    );
  });
});
