# PART 04 — GROUP 04 Implementation Record

## Batch 1 — G04.01–G04.10

- Liza identity and persona prompt.
- Bangla-script, English and Banglish response-language detection.
- Latest-user-message language selection.
- Conversation-context, intent and response-style guidance.
- Compatibility export retained for the multi-agent orchestrator.

## Batch 2 — G04.11–G04.20

- Clarification and ambiguity-handling policy.
- Technical explanation depth and structured-output guidance.
- Research citation policy; fabricated citations explicitly prohibited.
- Prompt-injection resistance and internal-instruction protection guidance.
- Conflicting-instruction handling.
- Lightweight response-shape quality evaluator.
- Multilingual and policy regression tests.

## Verification limitations

- Prompt policies guide model behavior; they are not deterministic enforcement.
- The quality evaluator checks output shape and obvious patterns only. It does not establish factual correctness or semantic quality.
- Research citation presence is a heuristic, not source verification.
- Run the Vitest suite in a compatible Node runtime; Termux previously crashed with Illegal instruction (exit 132).
