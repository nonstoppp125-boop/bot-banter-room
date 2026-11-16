# PART 20 — GROUP 19 Telegram and Cross-Platform Status

Date: 2026-11-16
Branch: `work/group06-manager-planner`

## Audit findings
- TG01–TG05 — This repository contains no Telegram bot runtime, command handlers, webhook route, bot hosting configuration or bot token. Bot ownership and external configuration cannot be verified from repository source.
- TG06 — Shared backend candidates are the existing chat API, Manager/orchestrator, specialist registry, D1 conversation store and approval schema.

## Implemented foundations
- TG07–TG09 — Webhook secret verification, strict private-chat update normalization, human-user check, Telegram-to-workspace identity lookup and D1 update replay claims.
- TG11–TG13 — Shared chat/agent capabilities and Bangla/English-ready update metadata can be reused; no Telegram message is executed through the agent runtime yet.
- TG17–TG18 — Existing social draft and analytics models can supply preview/report payloads once a bot runtime is connected.
- Telegram output chunking respects the 4096-code-point message limit without splitting Unicode surrogate pairs.

## Remaining / blocked
- No bot token, webhook secret or verified Telegram owner mapping is configured.
- A secret-authenticated webhook route and bounded Telegram sendMessage client are now implemented. `/start`, `/help`, `/link CODE` and private-chat Liza messaging are handled; no live bot hosting or webhook registration is configured.
- A five-minute, one-time link-code API now binds the Telegram user to the signed-in user's workspace. The webhook stores private-chat messages in the shared D1 conversation store and generates default-Liza Groq replies with Unicode-safe 4096-code-point chunking.
- Telegram runtime still requires D1 migration 0012, TELEGRAM_BOT_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, GROQ_API_KEY and a manually registered Telegram webhook. Manager/specialist delegation and approval callback handling are not wired into Telegram.
- Approval notifications/callbacks must be bound to persisted approval IDs and owner identity before activation.

GROUP 19: IN PROGRESS — webhook, one-time identity linking, shared conversation persistence and default-Liza reply path implemented; live Telegram credentials, webhook registration and runtime smoke remain blocked.
No merge to `main`; no production deployment.


## 2026-11-16 — Shared conversation continuity
- Added D1 chat-to-conversation mapping with strict bot/chat/user/workspace ownership checks and active-link/member predicates.
- Conversation links are created only for a non-deleted conversation owned by the mapped user in the linked workspace.
- CI verification pending.


## 2026-11-16 — Telegram approval callback signing
- Added compact HMAC-SHA256 callback data (under Telegram's 64-byte limit) bound to approval ID, Telegram user ID and workspace ID.
- Tampering, wrong user/workspace, malformed and oversized callback payloads fail closed. This is a signing primitive only; approval state is still checked against D1 by a future callback route.
- CI verification pending.


## 2026-11-16 — Telegram webhook, identity linking and chat runtime
- Added migration 0012 for hashed, five-minute, one-time Telegram link tokens.
- Added session-authenticated POST /api/telegram/link-token; raw link code is returned once to the signed-in user while only its SHA-256 hash is stored.
- Added POST /api/telegram/webhook with Telegram secret-token header verification, strict private-human message normalization, bounded JSON body, update replay claims and private-chat-only processing.
- /link CODE consumes the token once and binds the Telegram identity to the user's active workspace membership. Unlinked users receive linking instructions.
- Linked messages are stored in the shared D1 conversation model and answered by the default Liza Groq model; replies are chunked safely at 4096 Unicode code points. No Telegram message can trigger publishing, deployment or destructive actions.
- Settings → Integrations now includes a one-time Telegram link-code generator.
- Verification pending. Live bot token, webhook secret, bot ID, D1 binding/migration and Telegram setWebhook registration are not provisioned.
