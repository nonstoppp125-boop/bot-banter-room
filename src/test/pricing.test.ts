import { describe, expect, it } from "vitest";
import { estimateGroqCostUsd, getGroqTokenPricing } from "@/lib/agents/pricing";

describe("Groq token pricing", () => {
  it("uses published GPT OSS 20B and 120B rates", () => {
    expect(getGroqTokenPricing("openai/gpt-oss-20b")).toEqual({
      inputUsdPerMillion: 0.075,
      outputUsdPerMillion: 0.3,
    });
    expect(getGroqTokenPricing("openai/gpt-oss-120b")).toEqual({
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
  });

  it("estimates cost from input and output token counts", () => {
    expect(estimateGroqCostUsd("openai/gpt-oss-20b", 1_000_000, 1_000_000)).toBeCloseTo(0.375);
  });

  it("returns null for unknown pricing and invalid token counts", () => {
    expect(estimateGroqCostUsd("custom/model", 100, 100)).toBeNull();
    expect(estimateGroqCostUsd("openai/gpt-oss-20b", -1, 100)).toBeNull();
  });
});
