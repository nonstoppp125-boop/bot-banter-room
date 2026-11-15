import { describe, expect, it } from "vitest";
import {
  buildResearchReport,
  evaluateResearchQuality,
  prepareResearchSources,
  type ResearchSource,
} from "@/lib/agents/research";

const source: ResearchSource = {
  id: "quality-source",
  title: "Research evidence",
  publisher: "Publisher A",
  url: "https://example.com/report",
  publishedAt: "2026-11-01T00:00:00.000Z",
  retrievedAt: "2026-11-12T00:00:00.000Z",
  content: "Evidence",
};

describe("research quality evaluation", () => {
  it("rewards sourced factual claims and reports evidence coverage", () => {
    const refs = prepareResearchSources([source], Date.parse("2026-11-12"));
    const report = buildResearchReport(
      [{ text: "Supported fact", classification: "fact", sourceIds: ["quality-source"] }],
      refs,
    );
    const quality = evaluateResearchQuality(report);

    expect(quality.factualClaims).toBe(1);
    expect(quality.sourcedFactualClaims).toBe(1);
    expect(quality.unsupportedFactualClaims).toBe(0);
    expect(quality.score).toBe(100);
  });

  it("flags stale and undated evidence", () => {
    const undatedSource = { ...source };
    delete undatedSource.publishedAt;

    const refs = prepareResearchSources(
      [
        source,
        {
          ...source,
          id: "old-source",
          publishedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          ...undatedSource,
          id: "undated-source",
        },
      ],
      Date.parse("2026-11-12"),
      180,
    );

    const report = buildResearchReport(
      [{ text: "Fact", classification: "fact", sourceIds: ["quality-source"] }],
      refs,
    );
    const quality = evaluateResearchQuality(report);

    expect(quality.staleSources).toBe(1);
    expect(quality.undatedSources).toBe(1);
    expect(quality.flags).toContain("stale-sources-present");
    expect(quality.flags).toContain("undated-sources-present");
  });

  it("does not treat interpretations as factual claims", () => {
    const report = buildResearchReport(
      [{ text: "Possible explanation", classification: "interpretation", sourceIds: [] }],
      [],
    );
    const quality = evaluateResearchQuality(report);

    expect(quality.factualClaims).toBe(0);
    expect(quality.unsupportedFactualClaims).toBe(0);
    expect(quality.flags).toContain("no-references");
  });
});
