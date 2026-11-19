import { createOpenAI } from "@ai-sdk/openai";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export type GroqRateLimitEvent = {
  event: "groq.rate_limit";
  status: number;
  requestsLimit?: string;
  requestsRemaining?: string;
  requestsReset?: string;
  tokensLimit?: string;
  tokensRemaining?: string;
  tokensReset?: string;
  retryAfter?: string;
};

const RATE_LIMIT_HEADERS = [
  ["x-ratelimit-limit-requests", "requestsLimit"],
  ["x-ratelimit-remaining-requests", "requestsRemaining"],
  ["x-ratelimit-reset-requests", "requestsReset"],
  ["x-ratelimit-limit-tokens", "tokensLimit"],
  ["x-ratelimit-remaining-tokens", "tokensRemaining"],
  ["x-ratelimit-reset-tokens", "tokensReset"],
  ["retry-after", "retryAfter"],
] as const;

/** Extract only quota metadata; never retain or log request/response bodies or credentials. */
export function readGroqRateLimitHeaders(headers: Headers): Omit<GroqRateLimitEvent, "event" | "status"> | null {
  const snapshot: Omit<GroqRateLimitEvent, "event" | "status"> = {};
  for (const [header, field] of RATE_LIMIT_HEADERS) {
    const value = headers.get(header)?.trim();
    if (value && value.length <= 64 && !/[\r\n]/.test(value)) {
      snapshot[field] = value;
    }
  }
  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

type GroqFetch = typeof fetch;
type GroqTelemetrySink = (event: GroqRateLimitEvent) => void;

/**
 * Wrap the provider fetch to capture Groq's per-response quota headers.
 * This is best-effort request-level telemetry, not account-wide quota polling.
 */
export function createGroqFetch(
  fetcher: GroqFetch = fetch,
  emit: GroqTelemetrySink = (event) => {
    const line = JSON.stringify(event);
    if (event.status === 429) console.warn(line);
    else console.info(line);
  },
): GroqFetch {
  return async (input, init) => {
    const response = await fetcher(input, init);
    const quota = readGroqRateLimitHeaders(response.headers);
    if (response.status === 429 || quota) {
      emit({
        event: "groq.rate_limit",
        status: response.status,
        ...(quota ?? {}),
      });
    }
    return response;
  };
}

/** The single Groq provider; model selection may be overridden by trusted Worker config. */
export function groqModel(apiKey: string, model = DEFAULT_GROQ_MODEL) {
  return createOpenAI({
    baseURL: GROQ_BASE_URL,
    apiKey,
    fetch: createGroqFetch(),
  }).responses(model);
}
