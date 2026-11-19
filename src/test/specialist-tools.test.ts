import { describe, expect, it } from "vitest";
import { auditSpecialistOutput, invokeSpecialistTool, listSpecialistTools, prepareSpecialistToolContext } from "@/lib/agents/specialist-tools";

describe("permission-controlled specialist tools", () => {
  it("exposes only tools granted to the selected specialist", () => {
    expect(listSpecialistTools("research")).toEqual(["research.search", "research.extract"]);
    expect(listSpecialistTools("coding")).toEqual(["coding.validate-command"]);
    expect(listSpecialistTools("data-analyst")).toEqual(["data.profile", "report.aggregate"]);
  });



  it("runs authorized domain tools from structured user input before specialist generation", async () => {
    const signal = new AbortController().signal;
    const context = await prepareSpecialistToolContext("data-analyst", [{
      role: "user", content: JSON.stringify({ rows: [{ sales: 10 }, { sales: 20 }] }),
    }], signal);
    expect(context).toMatchObject({ rowCount: 2, fieldCount: 1 });
    await expect(prepareSpecialistToolContext("problem-solver", [{
      role: "user", content: JSON.stringify({ rows: [{ sales: 10 }] }),
    }], signal)).resolves.toBeNull();
  });

  it("does not execute structured specialist tools for malformed JSON", async () => {
    await expect(prepareSpecialistToolContext("data-analyst", [{
      role: "user", content: "{not-json}",
    }], new AbortController().signal)).resolves.toBeNull();
  });

  it("exposes domain-specific tools only to authorized specialists", () => {
    expect(listSpecialistTools("data-analyst")).toContain("data.profile");
    expect(listSpecialistTools("business-analyst")).toContain("business.requirements");
    expect(listSpecialistTools("seo")).toContain("seo.audit");
    expect(listSpecialistTools("marketing-strategist")).toContain("campaign.validate");
    expect(listSpecialistTools("automation")).toContain("workflow.validate");
    expect(listSpecialistTools("reporting")).toContain("report.aggregate");
    expect(listSpecialistTools("security-reviewer")).toContain("security.scan");
    expect(listSpecialistTools("instagram")).toContain("social.validate");
  });

  it("profiles bounded tabular data and aggregates numeric metrics", async () => {
    const signal = new AbortController().signal;
    const profile = await invokeSpecialistTool({ agentId: "data-analyst", toolId: "data.profile",
      args: { rows: [{ revenue: 10, region: "A" }, { revenue: 30, region: "B" }, { revenue: null, region: "A" }] }, signal });
    expect(profile).toMatchObject({ rowCount: 3, fieldCount: 2 });
    const aggregate = await invokeSpecialistTool({ agentId: "reporting", toolId: "report.aggregate",
      args: { values: [1, 2, 3, 4] }, signal });
    expect(aggregate).toMatchObject({ count: 4, min: 1, max: 4, mean: 2.5, median: 2.5 });
  });

  it("validates requirements, content and SEO metadata with explicit limitations", async () => {
    const signal = new AbortController().signal;
    const requirements = await invokeSpecialistTool({ agentId: "business-analyst", toolId: "business.requirements",
      args: { requirements: [{ id: "R1", statement: "User can sign in", acceptanceCriteria: ["Valid credentials create a session"] }] }, signal });
    expect(requirements).toMatchObject({ requirementCount: 1, issueCount: 0 });
    const content = await invokeSpecialistTool({ agentId: "content-writer", toolId: "content.validate",
      args: { text: "Useful draft #launch", maxChars: 10 }, signal });
    expect(content).toMatchObject({ characters: 20, hashtags: 1 });
    const seo = await invokeSpecialistTool({ agentId: "seo", toolId: "seo.audit",
      args: { title: "A sufficiently descriptive page title for search", metaDescription: "A".repeat(130), headings: ["Overview"], primaryKeyword: "page" }, signal });
    expect(seo).toMatchObject({ headingCount: 1, keywordOccurrences: 1 });
  });

  it("validates campaign, quality, workflow and social structures", async () => {
    const signal = new AbortController().signal;
    await expect(invokeSpecialistTool({ agentId: "marketing-strategist", toolId: "campaign.validate",
      args: { objective: "Increase signups", audience: "SMBs", channels: ["LinkedIn"], kpis: ["Signups"] }, signal })).resolves.toMatchObject({ valid: true });
    await expect(invokeSpecialistTool({ agentId: "quality-reviewer", toolId: "quality.check",
      args: { text: "The system validates user sessions", requirements: ["validates user sessions", "audit logging"] }, signal }))
      .resolves.toMatchObject({ checks: [{ lexicalMatch: true }, { lexicalMatch: false }] });
    await expect(invokeSpecialistTool({ agentId: "automation", toolId: "workflow.validate",
      args: { steps: [{ id: "a", dependsOn: [] }, { id: "b", dependsOn: ["a"] }] }, signal }))
      .resolves.toMatchObject({ valid: true, topologicalOrder: ["a", "b"] });
    await expect(invokeSpecialistTool({ agentId: "instagram", toolId: "social.validate",
      args: { platform: "instagram", text: "New launch #product" }, signal })).resolves.toMatchObject({ platform: "instagram", hashtags: 1 });
  });

  it("redacts security scan findings and runs post-generation audits", async () => {
    const signal = new AbortController().signal;
    const scan = await invokeSpecialistTool({ agentId: "security-reviewer", toolId: "security.scan",
      args: { text: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456" }, signal });
    expect(scan).toMatchObject({ findingCount: 1, findings: [{ valuesRedacted: true }] });
    await expect(auditSpecialistOutput("content-writer", "A short draft", signal)).resolves.toMatchObject({ characters: 13 });
    await expect(auditSpecialistOutput("problem-solver", "A solution", signal)).resolves.toBeNull();
  });

  it("rejects cross-domain specialist tool access", async () => {
    await expect(invokeSpecialistTool({ agentId: "data-analyst", toolId: "security.scan",
      args: { text: "test" }, signal: new AbortController().signal })).rejects.toThrow(/permission denied/i);
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
