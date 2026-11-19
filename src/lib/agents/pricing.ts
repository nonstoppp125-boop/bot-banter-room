export type GroqTokenPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

// Public Groq model-list prices, checked 2026-11-16:
// https://console.groq.com/docs/models
const GROQ_TOKEN_PRICING: Readonly<Record<string, GroqTokenPricing>> = {
  "openai/gpt-oss-20b": { inputUsdPerMillion: 0.075, outputUsdPerMillion: 0.3 },
  "openai/gpt-oss-120b": { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
};

export function getGroqTokenPricing(modelId: string): GroqTokenPricing | null {
  return GROQ_TOKEN_PRICING[modelId.trim().toLowerCase()] ?? null;
}

export function estimateGroqCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (
    !Number.isFinite(inputTokens) ||
    !Number.isFinite(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    return null;
  }
  const pricing = getGroqTokenPricing(modelId);
  if (!pricing) return null;
  return (
    (inputTokens * pricing.inputUsdPerMillion +
      outputTokens * pricing.outputUsdPerMillion) /
    1_000_000
  );
}
