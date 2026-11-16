# Group 03 — Provider Contract Design and Implementation Decision

## Current implementation

The current application deliberately uses a narrow server-side Groq adapter:

- `groqModel(apiKey, model?)` creates `createOpenAI({ baseURL, apiKey, fetch })` and returns the Responses API model.
- The fetch wrapper captures only Groq rate-limit headers and 429 status; it preserves the provider response stream unchanged.
- Provider request limits are centralized in `request-policy.ts`.
- Pricing is centralized in `pricing.ts`.
- Tavily is a separate research tool provider, not a text-generation provider.

## Decision

Do not introduce a speculative generic multi-provider abstraction before a second provider is selected. A provider interface that is not exercised by two real implementations risks hiding incompatible streaming, structured-output, usage, tool-call, cancellation and privacy semantics.

When a second provider is approved, introduce a contract that explicitly covers:

1. text generation and streaming response;
2. structured output and tool-call capability flags;
3. abort/cancellation and per-request timeout;
4. provider-reported usage and unknown usage handling;
5. model ID and price metadata;
6. quota/rate-limit headers and retry-after;
7. provider-specific error normalization;
8. data retention/training policy metadata;
9. provider routing/fallback as an explicit caller decision, never silent automatic failover.

## Not implemented yet

- Multi-provider routing or automatic failover.
- Durable provider usage/quota storage and dashboard.
- Provider health checks against live accounts.
- Production Worker streaming with real Groq credentials.
- Cloudflare D1 provisioning and production deployment.

This document is a design decision, not a claim that the generic interface already exists.
