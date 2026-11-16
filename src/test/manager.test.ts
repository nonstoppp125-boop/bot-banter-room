import { describe, expect, it } from "vitest";
import { buildLLMAssistedManagerPlan, buildManagerPlan, buildManagerReplanPlan } from "@/lib/agents/manager";
import { routeTaskToAgents } from "@/lib/agents/coordination";
import { listAgents } from "@/lib/agents/registry";
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
    expect(plan.executionBudget.maxAttempts).toBe(2);
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


describe("LLM-assisted Manager decomposition", () => {
  it("accepts a bounded plan using only routed specialists", async () => {
    const base = buildManagerPlan("Research the API first, then implement the integration", agents);
    const plan = await buildLLMAssistedManagerPlan(
      "Research the API first, then implement the integration",
      base,
      async () =>
        JSON.stringify({
          subtasks: [
            { agentId: "coding", objective: "Implement the integration from research findings.", dependsOn: [] },
            { agentId: "research", objective: "Identify relevant API requirements.", dependsOn: [] },
          ],
        }),
      new AbortController().signal,
    );
    expect(plan.planningMode).toBe("llm-assisted");
    expect(plan.subtasks.find((task) => task.agentId === "coding")?.dependsOn).toEqual(["research"]);
    expect(plan.agentIds).toEqual(["coding", "research"]);
  });

  it("falls back when the model proposes an unregistered specialist", async () => {
    const base = buildManagerPlan("Research the API first, then implement the integration", agents);
    const plan = await buildLLMAssistedManagerPlan(
      "Research the API first, then implement the integration",
      base,
      async () =>
        JSON.stringify({
          subtasks: [{ agentId: "shell-executor", objective: "Run commands", dependsOn: [] }],
        }),
      new AbortController().signal,
    );
    expect(plan.planningMode).toBe("deterministic");
    expect(plan.planningFallbackReason).toContain("invalid subtask");
  });

  it("rejects dependency cycles and falls back safely", async () => {
    const base = buildManagerPlan("Research the API first, then implement the integration", agents);
    const plan = await buildLLMAssistedManagerPlan(
      "Research the API first, then implement the integration",
      base,
      async () =>
        JSON.stringify({
          subtasks: [
            { agentId: "research", objective: "Research.", dependsOn: ["coding"] },
            { agentId: "coding", objective: "Implement.", dependsOn: ["research"] },
          ],
        }),
      new AbortController().signal,
    );
    expect(plan.planningMode).toBe("deterministic");
    expect(plan.planningFallbackReason).toContain("dependency cycle");
  });

  it("does not invoke the model for a simple single-specialist task", async () => {
    const base = buildManagerPlan("Implement a small TypeScript helper", agents);
    const plan = await buildLLMAssistedManagerPlan(
      "Implement a small TypeScript helper",
      base,
      async () => {
        throw new Error("planner should not run");
      },
      new AbortController().signal,
    );
    expect(plan.planningMode).toBe("deterministic");
    expect(plan.planningFallbackReason).toBeUndefined();
  });
});


describe("bounded Manager replanning", () => {
  it("reassigns a failed task once to a different permitted specialist with overlapping capability", async () => {
    const extended = [
      ...agents,
      {
        id: "coding-backup",
        name: "Coding Backup",
        description: "Alternative coding specialist",
        capabilities: ["code-generation"] as const,
        permissions: ["llm:inference"] as const,
        role: "specialist" as const,
        generate: async () => "recovered",
      },
    ];
    const original = buildManagerPlan("Implement a TypeScript feature", agents);
    const replanned = buildManagerReplanPlan(
      original.subtasks,
      { "specialist-coding": { status: "rejected", error: "provider timeout" } },
      extended,
    );
    expect(replanned).toHaveLength(1);
    expect(replanned[0]).toMatchObject({
      agentId: "coding-backup",
      sourceAgentId: "coding",
      failureReason: "provider timeout",
      dependsOn: [],
    });
  });

  it("does not replan skipped tasks or tasks with failed prerequisites", () => {
    const extended = [
      ...agents,
      {
        id: "coding-backup",
        name: "Coding Backup",
        description: "Alternative coding specialist",
        capabilities: ["code-generation"] as const,
        permissions: ["llm:inference"] as const,
        role: "specialist" as const,
        generate: async () => "recovered",
      },
    ];
    const original = buildManagerPlan(
      "Research the API first, then implement the integration",
      extended,
    );
    const replanned = buildManagerReplanPlan(
      original.subtasks,
      {
        "specialist-research": { status: "rejected", error: "research failed" },
        "specialist-coding": { status: "skipped", error: "dependency failed" },
      },
      extended,
    );
    expect(replanned).toEqual([]);
  });

  it("never selects an already-used, unregistered, or permission-restricted replacement", () => {
    const restricted = {
      id: "coding-backup",
      name: "Restricted Backup",
      description: "No inference permission",
      capabilities: ["code-generation"] as const,
      permissions: [] as const,
      role: "specialist" as const,
      generate: async () => "must not run",
    };
    const original = buildManagerPlan("Implement TypeScript code", [...agents, restricted]);
    expect(
      buildManagerReplanPlan(
        original.subtasks,
        { "specialist-coding": { status: "rejected" } },
        [...agents, restricted],
      ),
    ).toEqual([]);
  });

  it("caps replanning at four tasks and never recursively replans replacements", () => {
    const extended: AgentDefinition[] = [
      ...agents,
      ...["coding-alt", "debugging-alt", "research-alt", "linkedin-alt", "security-alt"].map((id) => ({
        id,
        name: id,
        description: "Alternative specialist",
        capabilities: agents.find((agent) => agent.id === id.replace("-alt", ""))?.capabilities ?? ["problem-solving"],
        permissions: ["llm:inference"] as const,
        role: "specialist" as const,
        generate: async () => "ok",
      })),
    ];
    const originals = ["coding", "debugging", "research", "linkedin", "security"].map((agentId) => ({
      id: agentId,
      agentId,
      objective: "Complete task",
      dependsOn: [],
    }));
    const results = Object.fromEntries(originals.map((task) => [`specialist-${task.agentId}`, { status: "rejected" }]));
    expect(buildManagerReplanPlan(originals, results, extended)).toHaveLength(4);
  });
});


describe("platform-specific social specialist routing", () => {
  it.each([
    ["Create an Instagram Reels concept", "instagram"],
    ["Plan a Facebook Page campaign", "facebook"],
    ["Write a YouTube Shorts script", "youtube"],
    ["Create a TikTok video storyboard", "tiktok"],
    ["Draft an X thread", "x-platform"],
  ])("routes %s to the registered platform specialist", (request, agentId) => {
    expect(routeTaskToAgents(request, listAgents())).toContain(agentId);
  });
});
