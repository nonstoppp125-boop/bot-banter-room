import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/devpilot-validation.yml", import.meta.url),
  "utf8",
);

const commands = [
  "npm run typecheck",
  "npm test",
  "npm run build",
  "git diff --check",
] as const;

describe("DevPilot validation workflow contract", () => {
  it("exposes only the adapter's fixed allowlisted commands", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("type: choice");
    for (const command of commands) {
      expect(workflow).toContain(`          - ${command}`);
      expect(workflow).toContain(`"${command}")`);
    }
    expect(workflow).toContain("Unsupported DevPilot validation command.");
  });

  it("runs with read-only repository contents permission", () => {
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("pull-requests: write");
  });
});
