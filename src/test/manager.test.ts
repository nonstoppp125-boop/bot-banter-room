import { describe, expect, it } from "vitest";
import { buildManagerPlan } from "@/lib/agents/manager";
import type { AgentDefinition } from "@/lib/agents/types";

const agents: AgentDefinition[] = [
  {
    id: "liza-default",
    name: "Liza",
    description: "Default chat agent",
    capabilities: ["chat"],
    permissions: ["llm:inference"],
    role: "chat",
    run: () => new Response("ok"),
  },
  ...[
    ["problem-solver", ["problem-solving"]],
    ["coding", ["code-generation"]],
    ["debugging", ["debugging"]],
    ["research", ["research"]],
    ["linkedin", ["linkedin-strategy"]],
    ["security", ["security-review"]],
    ["reporting", ["reporting"]],
  ].map(([id, capabilities]) => ({
    id: id as string,
    name: id as string,
    description: "Test specialist",
    capabilities: capabilities as AgentDefinition["capabilities"],
    permissions: ["llm:inference"] as const,
    role: "specialist" as const,
    generate: async () => "ok",
  })),
];

describe("deterministic Manager planning", () => {
  it("selects a registered specialist for a matching task", () => {
    const plan = buildManagerPlan("Implement a TypeScript feature", agents);
    expect(plan.agentIds).toContain("coding");
    expect(plan.complexity).toBe("simple");
    expect(plan.risk).toBe("low");
    expect(plan.approvalRequired).toBe(false);
  });

  it("selects multiple specialists and marks multi-domain work complex", () => {
    const plan = buildManagerPlan(
      "Implement and debug this TypeScript feature, then research relevant API sources",
      agents,
    );
    expect(plan.agentIds).toEqual(["coding", "debugging", "research"]);
    expect(plan.complexity).toBe("complex");
    expect(plan.executionBudget.maxParallelAgents).toBe(3);
  });

  it("flags publishing and destructive intent for human approval", () => {
    const plan = buildManagerPlan("Publish this LinkedIn post and delete the old draft", agents);
    expect(plan.risk).toBe("high");
    expect(plan.approvalRequired).toBe(true);
    expect(plan.approvalReasons).toContain("External publishing or messaging");
    expect(plan.approvalReasons).toContain("Destructive or irreversible change");
  });

  it("does not flag a request to draft a post as an external action", () => {
    const plan = buildManagerPlan("Write a LinkedIn post draft about SQL learning", agents);
    expect(plan.approvalRequired).toBe(false);
    expect(plan.agentIds).toContain("linkedin");
  });

  it("caps specialist fan-out and execution budget", () => {
    const plan = buildManagerPlan(
      "Research market trends, write code, debug errors, review security and create a report",
      agents,
    );
    expect(plan.agentIds.length).toBeLessThanOrEqual(4);
    expect(plan.executionBudget.maxSpecialists).toBe(4);
    expect(plan.executionBudget.perTaskTimeoutMs).toBe(45_000);
  });


  it("creates an ordered dependency when research is requested before implementation", () => {
    const plan = buildManagerPlan(
      "Research the API first, then implement the integration",
      agents,
    );
    expect(plan.subtasks.find((task) => task.agentId === "coding")?.dependsOn).toContain("research");
    expect(plan.subtasks.find((task) => task.agentId === "research")?.dependsOn).toEqual([]);
  });

  it("orders debugging after implementation when the request says then debug", () => {
    const plan = buildManagerPlan("Implement a fix and then debug the result", agents);
    expect(plan.subtasks.find((task) => task.agentId === "debugging")?.dependsOn).toContain("coding");
  });

  it("keeps unrelated specialist tasks parallel", () => {
    const plan = buildManagerPlan("Research the market and review security", agents);
    expect(plan.subtasks.every((task) => task.dependsOn.length === 0)).toBe(true);
  });

  it("falls back to problem solver for a general request", () => {
    const plan = buildManagerPlan("Hello there", agents);
    expect(plan.agentIds).toEqual(["problem-solver"]);
  });

  it("excludes specialists without the required inference permission", () => {
    const restricted = agents.map((agent) =>
      agent.id === "coding" ? { ...agent, permissions: [] } : agent,
    );
    const plan = buildManagerPlan("Implement TypeScript code", restricted);
    expect(plan.agentIds).not.toContain("coding");
    expect(plan.agentIds).toContain("problem-solver");
  });
});
