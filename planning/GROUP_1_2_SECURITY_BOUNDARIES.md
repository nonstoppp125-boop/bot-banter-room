# Group 1.2 — State, Identity & Security Boundary Audit

Source: origin/main (read-only Git inspection)

## Findings

### `src/components/ai-elements/prompt-input.tsx`
- `310: // Cleanup blob URLs on unmount to prevent memory leaks`

### `src/components/ui/alert.tsx`
- `2: import { cva, type VariantProps } from "class-variance-authority";`

### `src/components/ui/badge.tsx`
- `2: import { cva, type VariantProps } from "class-variance-authority";`

### `src/components/ui/button-group.tsx`
- `2: import { cva, type VariantProps } from "class-variance-authority"`

### `src/components/ui/button.tsx`
- `3: import { cva, type VariantProps } from "class-variance-authority";`

### `src/components/ui/input-group.tsx`
- `4: import { cva, type VariantProps } from "class-variance-authority"`

### `src/components/ui/label.tsx`
- `5: import { cva, type VariantProps } from "class-variance-authority";`

### `src/components/ui/navigation-menu.tsx`
- `3: import { cva } from "class-variance-authority";`

### `src/components/ui/sheet.tsx`
- `5: import { cva, type VariantProps } from "class-variance-authority";`

### `src/components/ui/sidebar.tsx`
- `3: import { cva, type VariantProps } from "class-variance-authority";`
- `21: const SIDEBAR_COOKIE_NAME = "sidebar_state";`
- `22: const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;`
- `85: // This sets the cookie to keep the sidebar state.`
- `86: document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;`

### `src/components/ui/toggle-group.tsx`
- `5: import { type VariantProps } from "class-variance-authority";`

### `src/components/ui/toggle.tsx`
- `3: import { cva, type VariantProps } from "class-variance-authority";`

### `src/lib/agents/liza-default.ts`
- `16: const apiKey = env.GROQ_API_KEY;`
- `19: { error: "GROQ_API_KEY is not configured on the server" },`

### `src/lib/agents/orchestrator.ts`
- `8: /** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */`
- `12: return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };`
- `22: const apiKey = env.GROQ_API_KEY!;`
- `53: if (!env.GROQ_API_KEY) {`
- `55: { error: "GROQ_API_KEY is not configured on the server" },`

### `src/lib/agents/types.ts`
- `3: /** Worker bindings this app reads. Names must match the Cloudflare config. */`
- `5: GROQ_API_KEY?: string | undefined;`

### `src/lib/lovable-error-reporting.ts`
- `55: // Loaders and server fns throw raw Responses and plain objects (a Supabase`

### `src/routes/__root.tsx`
- `86: { name: "author", content: "Lovable" },`

### `src/start.ts`
- `1: import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";`
- `23: const csrfMiddleware = createCsrfMiddleware({`
- `28: requestMiddleware: [errorMiddleware, csrfMiddleware],`

### `src/test/chat-api.test.ts`
- `7: inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },`
- `8: outputTokens: { total: 1, text: 1, reasoning: 0 },`
- `70: const KEY = { GROQ_API_KEY: "secret-k" };`
- `80: it("returns 500 when GROQ_API_KEY is missing", async () => {`
- `83: expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });`
- `98: apiKey: "secret-k",`

## Required architecture controls
- Authentication: must be verified before private user data access.
- Authorization: enforce ownership and workspace boundaries server-side.
- Memory: isolate each user's durable memory and conversation history.
- Secrets: server-side only; never expose provider keys to browser bundles.
- Rate limits: enforce per-user/IP limits and request-size constraints.
- External actions: require explicit user approval before execution.
- Auditability: log action metadata without recording secrets.

## Evidence limitations
- Absence of a matching source pattern is not proof that a control is absent.
- Static source inspection does not prove runtime enforcement.
- Production configuration and live deployment remain unverified.