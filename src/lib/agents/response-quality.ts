export type ResponseQualityOptions = {
  research?: boolean;
  maxCharacters?: number;
};

export type ResponseQualityResult = {
  passed: boolean;
  score: number;
  checks: {
    nonEmpty: boolean;
    withinLength: boolean;
    noObviousInstructionLeak: boolean;
    researchCitationPresent: boolean;
  };
  issues: string[];
};

/**
 * Lightweight output-shape checks only; this does not verify factual accuracy.
 */
export function evaluateLizaResponse(
  response: string,
  options: ResponseQualityOptions = {},
): ResponseQualityResult {
  const maxCharacters = options.maxCharacters ?? 20_000;
  const nonEmpty = response.trim().length > 0;
  const withinLength = response.length <= maxCharacters;

  const noObviousInstructionLeak = !(
    /(?:system prompt|developer (?:message|instructions?)|hidden instructions)\s*(?::|=|\bis\b|\bare\b)/i.test(
      response,
    ) || /you are ChatGPT's system prompt/i.test(response)
  );

  const researchCitationPresent =
    !options.research || /https?:\/\/|\[\d+\]|\(source:/i.test(response);

  const checks = {
    nonEmpty,
    withinLength,
    noObviousInstructionLeak,
    researchCitationPresent,
  };

  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  const passedCount = Object.values(checks).filter(Boolean).length;

  return {
    passed: passedCount === 4,
    score: Math.round((passedCount / 4) * 100),
    checks,
    issues,
  };
}
