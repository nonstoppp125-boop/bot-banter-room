import { beforeEach, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateText: generateTextMock }));

import { createGroqDevPilotProposalGenerator } from "@/lib/agents/groq-devpilot-proposer";

const input = {
  task: "Add a safe utility",
  repository: "owner/repo",
  baseBranch: "main",
  targetBranch: "devpilot/task-1",
  baseSha: "a".repeat(40),
  plan: {
    task: "Add a safe utility", baseSha: "a".repeat(40), targetBranch: "main",
    complexity: "simple", risk: "low", filesToInspect: ["src/app.ts"],
    acceptanceCriteria: [], validationCommands: [], approvalRequired: false, limitations: [],
  } as never,
  files: [{ path: "src/app.ts", sha: "b".repeat(40), content: "export const oldValue = 1;" }],
};

describe("Groq DevPilot proposal generator", () => {
  beforeEach(() => generateTextMock.mockReset());

  it("requires a configured Groq key", () => {
    expect(() => createGroqDevPilotProposalGenerator({})).toThrow("GROQ_API_KEY");
  });

  it("derives before-SHA values from inspected files instead of trusting model output", async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ changes: [
        { path: "src/app.ts", content: "export const newValue = 2;" },
        { path: "src/app.test.ts", content: "expect(true).toBe(true);" },
      ] }),
    });
    const generator = createGroqDevPilotProposalGenerator({ GROQ_API_KEY: "groq-test-key" });
    const changes = await generator(input);
    expect(changes).toEqual([
      { path: "src/app.ts", beforeSha: "b".repeat(40), content: "export const newValue = 2;" },
      { path: "src/app.test.ts", beforeSha: null, content: "expect(true).toBe(true);" },
    ]);
    expect(generateTextMock).toHaveBeenCalledOnce();
  });

  it("rejects unsafe or duplicate model-proposed paths", async () => {
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ changes: [
        { path: "../secrets.txt", content: "bad" },
      ] }),
    });
    const generator = createGroqDevPilotProposalGenerator({ GROQ_API_KEY: "groq-test-key" });
    await expect(generator(input)).rejects.toThrow("unsafe or duplicate");
  });

  it("rejects malformed model JSON and oversized source context", async () => {
    generateTextMock.mockResolvedValue({ text: "not json" });
    const generator = createGroqDevPilotProposalGenerator({ GROQ_API_KEY: "groq-test-key" });
    await expect(generator(input)).rejects.toThrow("invalid DevPilot JSON");
    await expect(generator({
      ...input,
      files: [{ path: "src/huge.ts", sha: "c".repeat(40), content: "x".repeat(150_000) }],
    })).rejects.toThrow("source context exceeds");
  });
});
