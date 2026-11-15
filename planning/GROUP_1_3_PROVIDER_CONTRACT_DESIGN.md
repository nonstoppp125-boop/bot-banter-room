# Group 1.3 — Provider Contract & Failure Handling

Status: DESIGN PROPOSAL — NOT IMPLEMENTED
Baseline: remote main (origin/main)

## 1. Objective
Decouple agent logic from vendor-specific SDK calls through a stable provider contract.

## 2. Proposed contract

```ts
type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderRequest = {
  model?: string;
  messages: ProviderMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

type ProviderResult = {
  text: string;
  model: string;
  provider: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

interface LLMProvider {
  readonly id: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}
```

This is a proposal, not a description of the existing implementation.
Reconcile it with actual SDK types and current application behavior before coding.

## 3. Error taxonomy
- CONFIGURATION: missing or invalid server credentials.
- AUTHENTICATION: provider rejects credentials.
- RATE_LIMIT: provider throttles the request.
- TIMEOUT: bounded request deadline exceeded.
- CANCELLED: caller aborts the request.
- INVALID_REQUEST: malformed or unsupported input.
- PROVIDER_UNAVAILABLE: transient upstream failure.
- INVALID_RESPONSE: malformed provider response.
- INTERNAL: unexpected application failure.

Never expose API keys, authorization headers, or sensitive upstream payloads.

## 4. Reliability policy
1. Bound input size, output size, and request duration.
2. Propagate AbortSignal through the full request path.
3. Retry only transient failures when the operation is safe.
4. Use bounded attempts, exponential backoff, and jitter.
5. Respect Retry-After when available.
6. Do not retry authentication or invalid-request failures.
7. Do not silently switch provider or model.
8. Normalize public errors; retain safe server diagnostics.
9. Record provider, model, latency, outcome, and usage when available.

## 5. Streaming
Confirm the current chat route's streaming behavior before changing interfaces.
If required, define a typed streaming contract and test cancellation and interruption.
Do not silently replace streaming with a non-streaming response.

## 6. Provider verification matrix
| Scenario | Expected behavior |
|---|---|
| Valid request | Normalized result |
| Missing credentials | Safe configuration error |
| Invalid credentials | Authentication error; no retry |
| Rate limit | Normalized rate-limit error |
| Timeout | Bounded failure |
| Caller cancellation | Abort propagated |
| Transient 5xx | Bounded retry only if safe |
| Invalid response | Normalized provider error |
| Secret in upstream error | Secret never reaches client |
| Missing usage metadata | Usage omitted safely |
| Streaming interruption | Explicit stream failure |
| Oversized input | Rejected before provider call |

## 7. Implementation gates
- [ ] Reconcile proposal with existing source interfaces.
- [ ] Confirm SDK generation and streaming capabilities.
- [ ] Confirm cancellation and timeout semantics.
- [ ] Define public error response schema.
- [ ] Add provider contract tests.
- [ ] Add adapter without breaking current chat API.
- [ ] Verify Groq on a supported runtime.
- [ ] Implement fallback only when explicitly configured.

## 8. Constraints
- Provider credentials remain server-side.
- No hidden paid-provider fallback.
- Enforce per-user and global usage limits.
- Model output alone never authorizes external actions.
- Human approval remains mandatory for consequential actions.

## 9. Current limitations
No implementation, test, build, deployment, or live API call was performed.
