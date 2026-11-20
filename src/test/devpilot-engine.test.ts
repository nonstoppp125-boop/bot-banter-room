import { describe, expect, it } from "vitest";
import { runDevPilotTask, type DevPilotRepositoryAdapter } from "@/lib/agents/devpilot-engine";
import type { CodeChangeProposal } from "@/lib/agents/coding-workforce";

const snapshot = {
  repository: "owner/repo",
  branch: "main",
  headSha: "abcdef1234567890",
  workingTreeClean: true,
  files: [
    { path: "src/app.ts", sha: "abcdef123456", size: 100, status: "tracked" as const },
    { path: "src/app.test.ts", sha: "abcdef234567", size: 100, status: "tracked" as const },
  ],
};
const changes: CodeChangeProposal["changes"] = [
  { path: "src/app.ts", beforeSha: "abcdef123456", content: "export const value = 1;\n" },
  { path: "src/app.test.ts", beforeSha: "abcdef234567", content: "import { value } from './app';\nexpect(value).toBe(1);\n" },
];
function adapter(overrides: Partial<DevPilotRepositoryAdapter> = {}) {
  const state = { writes: 0, commits: 0, pullRequests: 0, commands: [] as string[] };
  const base: DevPilotRepositoryAdapter = {
    async inspectRepository() { return snapshot; },
    async readFiles({ paths }) {
      return paths.map((path) => ({
        path,
        sha: path === "src/app.ts" ? "abcdef123456" : "abcdef234567",
        content: path === "src/app.ts" ? "export const value = 0;\n" : "expect(true).toBe(true);\n",
      }));
    },
    async createBranch() { state.writes++; },
    async applyChanges() { state.writes++; return { headSha: "fedcba1234567890" }; },
    async run({ command }) { state.commands.push(command); return { exitCode: 0, stdout: "passed", stderr: "", durationMs: 10 }; },
    async inspectDiff() { return { files: changes, testsChanged: true }; },
    async commit() { state.commits++; return { commitSha: "aabbccddeeff0011" }; },
    async createPullRequest() { state.pullRequests++; return { number: 42, url: "https://github.com/owner/repo/pull/42" }; },
    ...overrides,
  };
  return { adapter: base, state };
}
const baseInput = (task = "Add a small utility and tests") => ({
  taskId: "task-123",
  task,
  repository: "owner/repo",
  baseBranch: "main",
  now: () => new Date("2026-11-19T16:00:00.000Z"),
  proposeChanges: async () => changes,
});

describe("bounded DevPilot repository workflow engine", () => {
  it.each(["task..123", "task.", "task.lock"])("rejects invalid branch identifiers before repository access: %s", async (taskId) => {
    let inspections = 0;
    const state = adapter({ async inspectRepository() { inspections++; return snapshot; } });
    const result = await runDevPilotTask({ ...baseInput(), taskId, adapter: state.adapter });
    expect(result.status).toBe("blocked");
    expect(inspections).toBe(0);
    expect(state.state.writes).toBe(0);
  });

  it("creates a branch, applies reviewed changes, validates, commits and opens a PR", async () => {
    const state = adapter();
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("completed");
    expect(result.progress).toBe(100);
    expect(result.validation?.status).toBe("passed");
    expect(result.pullRequest?.number).toBe(42);
    expect(state.state.writes).toBe(2);
    expect(state.state.commands).toEqual(["npm run typecheck", "npm test", "npm run build", "git diff --check"]);
    expect(state.state.commits).toBe(1);
    expect(state.state.pullRequests).toBe(1);
  });

  it("emits durable checkpoints and append-only events through the complete workflow", async () => {
    const state = adapter();
    const checkpoints: string[] = [];
    const events: string[] = [];
    const result = await runDevPilotTask({
      ...baseInput(),
      adapter: state.adapter,
      onCheckpoint: async (checkpoint) => { checkpoints.push(checkpoint.stage); },
      onEvent: async (event) => { events.push(event.type); },
    });
    expect(result.status).toBe("completed");
    expect(checkpoints).toEqual([
      "repository-verified", "plan-created", "proposal-created", "branch-created",
      "changes-applied", "validation-passed", "diff-reviewed", "pull-request-created",
    ]);
    expect(events).toContain("proposal-created");
    expect(events).toContain("reviewed");
    expect(events).toContain("verified");
  });

  it("returns an exact proposal approval hash before any repository write for high-risk tasks", async () => {
    const state = adapter();
    const checkpoints: Array<{ stage: string; status?: string }> = [];
    const result = await runDevPilotTask({
      ...baseInput("Deploy this to production"), adapter: state.adapter,
      onCheckpoint: async (checkpoint) => { checkpoints.push({ stage: checkpoint.stage, ...(checkpoint.status ? { status: checkpoint.status } : {}) }); },
    });
    expect(checkpoints.at(-1)).toEqual({ stage: "awaiting-approval", status: "awaiting_approval" });
    expect(result.status).toBe("awaiting_approval");
    expect(result.progress).toBe(25);
    expect(result.approvalPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.state.writes).toBe(0);
    expect(state.state.commits).toBe(0);
    expect(state.state.pullRequests).toBe(0);
  });

  it("executes a high-risk task only when the approval hash matches the exact proposal", async () => {
    const state = adapter();
    const first = await runDevPilotTask({ ...baseInput("Deploy this to production"), adapter: state.adapter });
    const result = await runDevPilotTask({
      ...baseInput("Deploy this to production"),
      adapter: state.adapter,
      approval: { approvalId: "approval-123", payloadHash: first.approvalPayloadHash! },
      verifyApproval: async ({ approvalId, taskId, repository, payloadHash }) => approvalId === "approval-123" && taskId === "task-123" && repository === "owner/repo" && payloadHash === first.approvalPayloadHash,
    });
    expect(result.status).toBe("completed");
    expect(state.state.commits).toBe(1);
    expect(state.state.pullRequests).toBe(1);
  });

  it("requires approval when a proposal changes deployment, migration or auth-control files", async () => {
    const state = adapter();
    const sensitiveChanges: CodeChangeProposal["changes"] = [
      { path: ".github/workflows/deploy.yml", beforeSha: null, content: "name: guarded deploy\n" },
      { path: "src/app.test.ts", beforeSha: "abcdef234567", content: "expect(true).toBe(true);\n" },
    ];
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter, proposeChanges: async () => sensitiveChanges });
    expect(result.status).toBe("awaiting_approval");
    expect(result.plan?.approvalRequired).toBe(true);
    expect(state.state.writes).toBe(0);
  });

  it("blocks a mismatched approval before any repository write", async () => {
    const state = adapter();
    const result = await runDevPilotTask({
      ...baseInput("Deploy this to production"),
      adapter: state.adapter,
      approval: { approvalId: "approval-123", payloadHash: "0".repeat(64) },
      verifyApproval: async () => true,
    });
    expect(result.status).toBe("blocked");
    expect(state.state.writes).toBe(0);
  });

  it("blocks a high-risk task when persisted approval verification returns false", async () => {
    const state = adapter();
    const first = await runDevPilotTask({ ...baseInput("Deploy this to production"), adapter: state.adapter });
    const result = await runDevPilotTask({
      ...baseInput("Deploy this to production"),
      adapter: state.adapter,
      approval: { approvalId: "approval-123", payloadHash: first.approvalPayloadHash! },
      verifyApproval: async () => false,
    });
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("Persisted approval");
    expect(state.state.writes).toBe(0);
    expect(state.state.commits).toBe(0);
  });

  it("rejects duplicate or missing source paths returned by the repository adapter", async () => {
    const state = adapter({
      async readFiles() {
        return [
          { path: "src/app.ts", sha: "abcdef123456", content: "export const value = 0;\\n" },
          { path: "src/app.ts", sha: "abcdef123456", content: "export const value = 0;\\n" },
        ];
      },
    });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("out-of-scope");
    expect(state.state.writes).toBe(0);
  });

  it("preserves dirty working trees and refuses to create a branch", async () => {
    const state = adapter({ async inspectRepository() { return { ...snapshot, workingTreeClean: false }; } });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("not clean");
    expect(state.state.writes).toBe(0);
  });

  it("blocks unsafe proposals before creating a branch", async () => {
    const state = adapter();
    const result = await runDevPilotTask({
      ...baseInput(),
      adapter: state.adapter,
      proposeChanges: async () => [{ path: "../../.env", beforeSha: null, content: "secret" }],
    });
    expect(result.status).toBe("failed");
    expect(state.state.writes).toBe(0);
  });

  it("rejects a post-validation diff that adds an unapproved file", async () => {
    const state = adapter({
      async inspectDiff() {
        return { files: [...changes, { path: "src/unapproved.ts", content: "export const injected = true;\\n" }], testsChanged: true };
      },
    });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("exactly match");
    expect(state.state.commits).toBe(0);
    expect(state.state.pullRequests).toBe(0);
  });

  it("rejects duplicate paths in the post-validation diff", async () => {
    const state = adapter({
      async inspectDiff() { return { files: [...changes, changes[0]!], testsChanged: true }; },
    });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("blocked");
    expect(result.reason).toContain("malformed");
    expect(state.state.commits).toBe(0);
    expect(state.state.pullRequests).toBe(0);
  });

  it("derives final test coverage from actual changed paths instead of adapter metadata", async () => {
    const state = adapter({
      async inspectDiff() { return { files: changes, testsChanged: false }; },
    });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("completed");
    expect(state.state.commits).toBe(1);
    expect(state.state.pullRequests).toBe(1);
  });

  it("does not commit or open a PR when validation fails", async () => {
    const state = adapter({ async run({ command }) { state.state.commands.push(command); return { exitCode: command === "npm test" ? 1 : 0, stdout: "", stderr: "failed", durationMs: 10 }; } });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("failed");
    expect(result.validation?.status).toBe("failed");
    expect(state.state.commits).toBe(0);
    expect(state.state.pullRequests).toBe(0);
  });

  it("blocks if repository inspection returns files outside the declared plan scope", async () => {
    const state = adapter({ async readFiles() { return [{ path: ".env", sha: "abcdef123456", content: "SECRET" }]; } });
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter });
    expect(result.status).toBe("blocked");
    expect(state.state.writes).toBe(0);
  });

  it("does not start when already cancelled", async () => {
    const state = adapter();
    const controller = new AbortController();
    controller.abort();
    const result = await runDevPilotTask({ ...baseInput(), adapter: state.adapter, signal: controller.signal });
    expect(result.status).toBe("cancelled");
    expect(state.state.writes).toBe(0);
  });
});
