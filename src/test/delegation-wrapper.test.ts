import { describe, expect, it } from "vitest";
import { runDelegatedAgentWorkflow } from "@/lib/agents/coordination";

describe("delegated workflow guard", () => {
  it("rejects circular delegation before executing tasks", async () => {
    let executed = false;

    await expect(
      runDelegatedAgentWorkflow(
        ["manager", "research"],
        [
          {
            id: "task-1",
            agentId: "research",
            execute: async () => {
              executed = true;
              return "unexpected";
            },
          },
        ],
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow(/circular/i);

    expect(executed).toBe(false);
  });

  it("rejects delegation back to an ancestor agent", async () => {
    await expect(
      runDelegatedAgentWorkflow(
        ["manager", "coding"],
        [
          {
            id: "task-2",
            agentId: "coding",
            execute: async () => "unexpected",
          },
        ],
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow(/circular/i);
  });

  it("allows multiple distinct specialist agents in one delegated workflow", async () => {
    const result = await runDelegatedAgentWorkflow(
      ["manager"],
      [
        {
          id: "research-task",
          agentId: "research",
          execute: async () => "research complete",
        },
        {
          id: "review-task",
          agentId: "quality-reviewer",
          execute: async () => "review complete",
        },
      ],
      { signal: new AbortController().signal, concurrency: 2 },
    );

    expect(result.metrics.fulfilled).toBe(2);
  });
});
