import { describe, expect, it, vi } from "vitest";

import { createGroqFetch, readGroqRateLimitHeaders } from "@/lib/agents/groq";

describe("Groq quota telemetry", () => {
  it("extracts only known bounded rate-limit headers", () => {
    const headers = new Headers({
      "x-ratelimit-limit-requests": "30",
      "x-ratelimit-remaining-requests": "12",
      "x-ratelimit-reset-requests": "45s",
      "x-ratelimit-limit-tokens": "8000",
      "x-ratelimit-remaining-tokens": "7000",
      "retry-after": "2",
      "x-unrelated-header": "do-not-copy",
    });

    expect(readGroqRateLimitHeaders(headers)).toEqual({
      requestsLimit: "30",
      requestsRemaining: "12",
      requestsReset: "45s",
      tokensLimit: "8000",
      tokensRemaining: "7000",
      retryAfter: "2",
    });
  });

  it("returns null when no quota headers are present", () => {
    expect(readGroqRateLimitHeaders(new Headers({ "content-type": "application/json" }))).toBeNull();
  });

  it("emits quota metadata without consuming or changing the provider response", async () => {
    const response = new Response("provider-stream", {
      status: 200,
      headers: {
        "x-ratelimit-remaining-requests": "9",
        "x-ratelimit-remaining-tokens": "6000",
      },
    });
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;
    const emit = vi.fn();
    const wrapped = createGroqFetch(fetcher, emit);

    const result = await wrapped("https://api.groq.com/openai/v1/responses");

    expect(result).toBe(response);
    expect(await result.text()).toBe("provider-stream");
    expect(emit).toHaveBeenCalledWith({
      event: "groq.rate_limit",
      status: 200,
      requestsRemaining: "9",
      tokensRemaining: "6000",
    });
  });

  it("records 429 even when Groq omits quota headers", async () => {
    const response = new Response("do not log this body", {
      status: 429,
      headers: { "retry-after": "3" },
    });
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;
    const emit = vi.fn();
    const wrapped = createGroqFetch(fetcher, emit);

    await wrapped("https://api.groq.com/openai/v1/responses");

    expect(emit).toHaveBeenCalledWith({
      event: "groq.rate_limit",
      status: 429,
      retryAfter: "3",
    });
    expect(JSON.stringify(emit.mock.calls)).not.toContain("do not log this body");
  });

  it("does not emit a quota event for an ordinary response without quota headers", async () => {
    const fetcher = vi.fn(async () => new Response("ok")) as unknown as typeof fetch;
    const emit = vi.fn();
    await createGroqFetch(fetcher, emit)("https://api.groq.com/openai/v1/responses");
    expect(emit).not.toHaveBeenCalled();
  });
});
