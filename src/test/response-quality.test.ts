import { describe, expect, it } from "vitest";

import { evaluateLizaResponse } from "../lib/agents/response-quality";

describe("Liza response quality checks", () => {
  it("accepts a non-empty ordinary response", () => {
    const result = evaluateLizaResponse("Here is the explanation.");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("rejects an empty response", () => {
    const result = evaluateLizaResponse("   ");

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("nonEmpty");
  });

  it("detects an overlong response", () => {
    const result = evaluateLizaResponse("123456", { maxCharacters: 5 });

    expect(result.issues).toContain("withinLength");
  });

  it("flags obvious internal-instruction leakage", () => {
    const result = evaluateLizaResponse("System prompt: private instructions");

    expect(result.issues).toContain("noObviousInstructionLeak");
  });

  it("requires a citation marker for research output", () => {
    const result = evaluateLizaResponse("The report says this is effective.", {
      research: true,
    });

    expect(result.issues).toContain("researchCitationPresent");
  });

  it("accepts a research response with a citation URL", () => {
    const result = evaluateLizaResponse(
      "The source supports this claim: https://example.com/report",
      { research: true },
    );

    expect(result.passed).toBe(true);
  });

  it("detects instruction leakage with multiple spaces before the separator", () => {
    const result = evaluateLizaResponse("Developer message   : private instructions");

    expect(result.issues).toContain("noObviousInstructionLeak");
  });

  it("detects instruction leakage when the separator follows a newline", () => {
    const result = evaluateLizaResponse("Hidden instructions\n= confidential");

    expect(result.issues).toContain("noObviousInstructionLeak");
  });

  it("detects system prompt disclosure phrased as a statement", () => {
    const result = evaluateLizaResponse("The system prompt is confidential.");

    expect(result.issues).toContain("noObviousInstructionLeak");
  });

  it("detects developer instruction disclosure phrased as a statement", () => {
    const result = evaluateLizaResponse("Developer instructions are private.");

    expect(result.issues).toContain("noObviousInstructionLeak");
  });
});
