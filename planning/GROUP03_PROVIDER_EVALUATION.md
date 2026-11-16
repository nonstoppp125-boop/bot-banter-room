# Group 03 — LLM Provider Evaluation

Evaluation date: 2026-11-16  
Context: free-first, privacy-conscious deployment; current implementation uses Groq.

## Decision summary

**Retain Groq as the sole default LLM provider. Do not enable automatic cross-provider fallback.** A provider fallback can silently move user prompts and saved context to a different processor with different retention, training, residency and quota policies. Provider changes must be explicit and tested.

## Provider comparison

| Provider | Free-tier / pricing characteristics | Privacy / operational considerations | Decision |
|---|---|---|---|
| **Groq** | Free-plan model limits are account/model-specific; the current rate-limit documentation lists model-level request/token caps. Published paid rate for `openai/gpt-oss-20b` is $0.075/M input and $0.30/M output tokens. | Inference is not retained by default for standard API use; reliability/abuse logs may be retained temporarily. Zero Data Retention controls are available to eligible accounts. Rate-limit headers expose remaining requests/tokens and reset windows. | **Keep primary.** Already integrated, fast and quota headers are now captured. Enable ZDR in the Groq account controls if required. |
| **Cloudflare Workers AI** | Includes 10,000 neurons/day free allocation; paid usage is billed per 1,000 neurons. Default text-generation rate limit is documented at 300 requests/minute, with model-specific exceptions; some models require paid billing. | Same Cloudflare account/runtime reduces another vendor boundary. Requires an `AI` binding and evaluation of model quality, context, tokenization and cost. | **Best future alternative to benchmark**, not configured yet. |
| **Google Gemini API** | Limited models have a free tier; quotas vary by project/model and can change. Paid usage is token-priced. | Google's pricing/terms distinguish free-tier content from paid-tier handling; free-tier prompts/responses may be used to improve products. | Do not use the free tier for private workspace data. Consider paid tier only after explicit data-policy approval. |
| **OpenRouter** | Free model variants are available; current free-plan limits include 20 requests/minute and 50 requests/day for free model traffic. Model/provider availability can change. | Free routing can select different upstream providers. Provider data policies vary; free plan does not provide the same data-policy-based routing controls as paid plans. | Suitable for experiments, not default production routing for private user data. |

## Source references

- Groq model pricing: https://groq.com/pricing/
- Groq model catalog: https://console.groq.com/docs/models
- Groq rate limits and response headers: https://console.groq.com/docs/rate-limits
- Groq data controls: https://console.groq.com/docs/your-data
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Workers AI limits: https://developers.cloudflare.com/workers-ai/platform/limits/
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Gemini API terms/data handling: https://ai.google.dev/gemini-api/terms
- OpenRouter limits: https://openrouter.ai/docs/limits
- OpenRouter provider routing/data policies: https://openrouter.ai/docs/features/provider-routing

## Selection criteria

1. Free quota must be sufficient for multi-step agentic calls, not just one prompt. One multi-agent user request may invoke planning, multiple specialists, review and final synthesis.
2. User prompts and memory are private workspace data; free-tier training/data-use terms are a first-class selection constraint.
3. Do not fail over to a provider whose retention policy has not been approved.
4. Capture rate-limit headers and bounded retry metadata without logging prompts, completions, API keys or user identifiers.
5. Keep provider-specific model IDs, price tables and API behavior behind the server-side adapter.
6. Benchmark latency, context window, structured output, streaming, refusal behavior and cost on the actual task suite before selecting a second provider.

## Result

Groq remains primary. Workers AI is the preferred future candidate for a controlled fallback benchmark. Gemini free and OpenRouter free are not selected for private production traffic. No alternative credentials were requested, added or exposed.
