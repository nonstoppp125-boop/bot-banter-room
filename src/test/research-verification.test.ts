import { describe, expect, it, vi } from "vitest";
import { verifyResearchClaims, validateResearchClaimVerification } from "@/lib/agents/research-verification";
import type { ResearchSource } from "@/lib/agents/research";
const sources: ResearchSource[] = [
  { id: "src-1", title: "Revenue report", url: "https://example.com/report", retrievedAt: "2026-11-17T00:00:00.000Z", content: "Revenue increased 12% year over year according to the audited report." },
  { id: "src-2", title: "Market report", url: "https://example.org/market", retrievedAt: "2026-11-17T00:00:00.000Z", content: "The market expanded during the reporting period." },
];
describe("semantic research evidence verification", () => {
  it("accepts supported claims only when source IDs and exact quotations match", () => {
    const report = validateResearchClaimVerification(JSON.stringify({ claims: [{ claim: "Revenue increased 12% year over year.", verdict: "supported", evidence: [{ sourceId: "src-1", quote: "Revenue increased 12% year over year" }], rationale: "The cited passage states the same result." }] }), sources);
    expect(report).toMatchObject({ status: "completed", supported: 1, contradicted: 0, unknown: 0 });
  });
  it("downgrades fabricated quotations and unknown source IDs to unknown", () => {
    const report = validateResearchClaimVerification(JSON.stringify({ claims: [
      { claim: "The market doubled.", verdict: "supported", evidence: [{ sourceId: "src-2", quote: "The market doubled last year." }] },
      { claim: "Revenue fell.", verdict: "contradicted", evidence: [{ sourceId: "not-a-source", quote: "Revenue increased 12%" }] },
    ] }), sources);
    expect(report).toMatchObject({ status: "completed", supported: 0, contradicted: 0, unknown: 2 });
  });
  it("fails closed on malformed or empty verifier responses", () => {
    expect(validateResearchClaimVerification("not-json", sources).status).toBe("unavailable");
    expect(validateResearchClaimVerification(JSON.stringify({ claims: [] }), sources).status).toBe("unavailable");
  });
  it("bounds claims and source content before calling the verifier", async () => {
    const verify = vi.fn(async ({ claimsText, sources: supplied }: { claimsText: string; sources: readonly ResearchSource[] }) => {
      expect(claimsText.length).toBe(12_000); expect(supplied).toHaveLength(8); expect(supplied[0]?.content.length).toBe(3_000);
      return JSON.stringify({ claims: [{ claim: "Only a check.", verdict: "unknown", evidence: [], rationale: "No support." }] });
    });
    const manySources = Array.from({ length: 10 }, (_, index) => ({ ...sources[0]!, id: "source-" + index, content: "x".repeat(4_000) }));
    const report = await verifyResearchClaims({ claimsText: "c".repeat(15_000), sources: manySources, signal: new AbortController().signal, verify });
    expect(report).toMatchObject({ status: "completed", unknown: 1 }); expect(verify).toHaveBeenCalledTimes(1);
  });
  it("returns explicit unavailable status when the verifier provider fails", async () => {
    const report = await verifyResearchClaims({ claimsText: "A factual claim.", sources, signal: new AbortController().signal,
      verify: async () => { throw new Error("provider unavailable"); } });
    expect(report).toMatchObject({ status: "unavailable", reason: "provider unavailable" });
  });
  it("propagates caller cancellation instead of returning an invented assessment", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(verifyResearchClaims({ claimsText: "A claim.", sources, signal: controller.signal, verify: async () => "{}" })).rejects.toThrow(/cancelled/i);
  });
});
