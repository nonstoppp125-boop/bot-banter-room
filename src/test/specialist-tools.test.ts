import { describe, expect, it } from "vitest";
import { invokeSpecialistTool, listSpecialistTools } from "@/lib/agents/specialist-tools";

describe("permission-controlled specialist tools", () => {
  it("exposes only tools granted to the selected specialist", () => {
    expect(listSpecialistTools("research")).toEqual(["research.search", "research.extract"]);
    expect(listSpecialistTools("coding")).toEqual(["coding.validate-command"]);
    expect(listSpecialistTools("data-analyst")).toEqual([]);
  });

  it("denies a specialist access to another agent's tool", async () => {
    await expect(invokeSpecialistTool({
      agentId: "coding", toolId: "research.search", args: { query: "test" },
      apiKey: "key", signal: new AbortController().signal,
    })).rejects.toThrow(/permission denied/i);
  });

  it("fails closed when live research credentials are missing", async () => {
    await expect(invokeSpecialistTool({
      agentId: "research", toolId: "research.search", args: { query: "market" },
      signal: new AbortController().signal,
    })).rejects.toThrow(/provider key/i);
  });

  it("allows only exact non-composed coding validation commands", async () => {
    const signal = new AbortController().signal;
    await expect(invokeSpecialistTool({
      agentId: "coding", toolId: "coding.validate-command",
      args: { command: "npm run typecheck" }, signal,
    })).resolves.toMatchObject({ allowed: true });
    await expect(invokeSpecialistTool({
      agentId: "coding", toolId: "coding.validate-command",
      args: { command: "npm run typecheck && rm -rf ." }, signal,
    })).resolves.toMatchObject({ allowed: false });
  });
});
