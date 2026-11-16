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

  it("rejects malformed and duplicate extraction metadata before provider access", async () => {
    const signal = new AbortController().signal;
    await expect(invokeSpecialistTool({
      agentId: "research", toolId: "research.extract",
      args: { sources: [{ id: "x", url: "https://example.com" }] },
      apiKey: "key", signal,
    })).rejects.toThrow(/metadata is invalid/i);

    const source = {
      id: "same-id", title: "Source", url: "https://example.com/report",
      retrievedAt: "2026-11-16T00:00:00.000Z", content: "Evidence",
    };
    await expect(invokeSpecialistTool({
      agentId: "research", toolId: "research.extract",
      args: { sources: [source, source] }, apiKey: "key", signal,
    })).rejects.toThrow(/IDs must be unique/i);
  });

  it("requires server-side credentials for extraction", async () => {
    await expect(invokeSpecialistTool({
      agentId: "research", toolId: "research.extract",
      args: { sources: [{
        id: "source-1", title: "Source", url: "https://example.com/report",
        retrievedAt: "2026-11-16T00:00:00.000Z", content: "Evidence",
      }] }, signal: new AbortController().signal,
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
