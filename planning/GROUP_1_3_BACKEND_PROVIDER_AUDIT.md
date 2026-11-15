# Group 1.3 — Backend & Provider Audit

Source baseline: origin/main

## 1. Provider and API source evidence

### `src/lib/agents/groq.ts`
- Source lines: 9
- L1: `import { createOpenAI } from "@ai-sdk/openai";`
- L3: `export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";`
- L4: `export const GROQ_MODEL = "openai/gpt-oss-20b";`
- L6: `/** The single Groq model every agent uses (same provider/model as the original chat). */`
- L7: `export function groqModel(apiKey: string) {`
- L8: `return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);`

### `src/lib/agents/liza-default.ts`
- Source lines: 33
- L1: `import { convertToModelMessages, streamText } from "ai";`
- L3: `import { groqModel } from "./groq";`
- L7: `export const LIZA_SYSTEM =`
- L13: `description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",`
- L15: `run: async ({ messages, env, signal }) => {`
- L16: `const apiKey = env.GROQ_API_KEY;`
- L17: `if (!apiKey) {`
- L18: `return Response.json(`
- L19: `{ error: "GROQ_API_KEY is not configured on the server" },`
- L20: `{ status: 500 },`
- L24: `const result = streamText({`
- L25: `model: groqModel(apiKey),`
- L26: `instructions: LIZA_SYSTEM,`
- L27: `messages: await convertToModelMessages(messages),`
- L28: `abortSignal: signal,`
- L31: `return result.toUIMessageStreamResponse({ originalMessages: messages });`

### `src/lib/agents/types.ts`
- Source lines: 30
- L1: `import type { ModelMessage, UIMessage } from "ai";`
- L5: `GROQ_API_KEY?: string | undefined;`
- L11: `messages: UIMessage[];`
- L13: `signal: AbortSignal;`
- L17: `apiKey: string;`
- L18: `messages: ModelMessage[];`
- L19: `signal: AbortSignal;`
- L28: `run?: (input: AgentRunInput) => Promise<Response> | Response;`

### `src/lib/agents/registry.ts`
- Source lines: 26
- L20: `if (!found || found.role !== "specialist") throw new Error(`Unknown specialist ${id}`);`

### `src/lib/agents/orchestrator.ts`
- Source lines: 74
- L1: `import { convertToModelMessages, streamText, type UIMessage } from "ai";`
- L3: `import { groqModel } from "./groq";`
- L4: `import { LIZA_SYSTEM } from "./liza-default";`
- L8: `/** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */`
- L9: `export function getAgentEnv(request: Request): AgentEnv {`
- L10: `const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime`
- L12: `return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };`
- L20: `export async function runMultiAgent(input: AgentRunInput): Promise<Response> {`
- L21: `const { messages, env, signal } = input;`
- L22: `const apiKey = env.GROQ_API_KEY!;`
- L23: `const modelMessages = await convertToModelMessages(messages);`
- L26: `getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),`
- L27: `getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),`
- L30: `if (signal.aborted) return new Response(null, { status: 499 });`
- L41: `const result = streamText({`
- L42: `model: groqModel(apiKey),`
- L43: `instructions: `${LIZA_SYSTEM}\n\nWrite the final answer to the user using these internal specialist notes. Do not mention the specialists.\n\n${notes.join("\n\n")}`,`
- L44: `messages: modelMessages,`
- L45: `abortSignal: signal,`
- L47: `return result.toUIMessageStreamResponse({ originalMessages: messages });`
- L50: `/** Handles a chat request: checks the key, validates the body, delegates to an agent. */`
- L51: `export async function handleChatRequest(request: Request): Promise<Response> {`
- L52: `const env = getAgentEnv(request);`
- L53: `if (!env.GROQ_API_KEY) {`
- L54: `return Response.json(`
- L55: `{ error: "GROQ_API_KEY is not configured on the server" },`
- L56: `{ status: 500 },`
- L60: `let messages: UIMessage[];`
- L62: `try {`
- L63: `const body = await request.json();`
- L64: `messages = body?.messages;`
- L66: `if (!Array.isArray(messages)) throw new Error("Invalid messages");`
- L67: `} catch {`
- L68: `return Response.json({ error: "Invalid request" }, { status: 400 });`
- L71: `const input = { messages, env, signal: request.signal };`

### `src/lib/agents/specialists.ts`
- Source lines: 43
- L1: `import { generateText } from "ai";`
- L3: `import { groqModel } from "./groq";`
- L7: `const SOLVER_SYSTEM =`
- L10: `const REVIEWER_SYSTEM =`
- L13: `function specialist(id: string, name: string, description: string, system: string): AgentDefinition {`
- L19: `generate: async ({ apiKey, messages, signal }: SpecialistInput) => {`
- L20: `const { text } = await generateText({`
- L21: `model: groqModel(apiKey),`
- L22: `instructions: system,`
- L23: `messages,`
- L24: `abortSignal: signal,`
- L35: `SOLVER_SYSTEM,`
- L42: `REVIEWER_SYSTEM,`

### `src/routes/api/chat.ts`
- Source lines: 11
- L3: `import { handleChatRequest } from "@/lib/agents/orchestrator";`
- L8: `POST: async ({ request }) => handleChatRequest(request),`

### `src/test/chat-api.test.ts`
- Source lines: 135
- L3: `const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];`
- L4: `const state = { failSpecialists: false, generateCalls: 0, streamSystems: [] as string[] };`
- L11: `function systemOf(prompt: { role: string; content: unknown }[]) {`
- L13: `.filter((m) => m.role === "system")`
- L19: `const { MockLanguageModelV3 } = await import("ai/test");`
- L22: `createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({`
- L23: `responses: (model: string) => {`
- L24: `calls.push({ ...opts, model });`
- L25: `return new MockLanguageModelV3({`
- L28: `if (state.failSpecialists) throw new Error("boom");`
- L29: `const sys = systemOf(prompt as never);`
- L39: `state.streamSystems.push(systemOf(prompt as never));`
- L57: `import { handleChatRequest } from "@/lib/agents/orchestrator";`
- L61: `const r = new Request("http://x/api/chat", {`
- L64: `}) as Request & { runtime?: unknown };`
- L70: `const KEY = { GROQ_API_KEY: "secret-k" };`
- L76: `state.streamSystems = [];`
- L80: `it("returns 500 when GROQ_API_KEY is missing", async () => {`
- L81: `const res = await handleChatRequest(req({ messages: msgs }));`
- L83: `expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });`
- L87: `expect((await handleChatRequest(req("not json", KEY))).status).toBe(400);`
- L88: `expect((await handleChatRequest(req({ messages: "x" }, KEY))).status).toBe(400);`
- L91: `it("by default makes one Groq call (no specialists), even for unknown agentId", async () => {`
- L92: `const res = await handleChatRequest(req({ messages: msgs, agentId: "nope" }, KEY));`
- L96: `expect(state.streamSystems).toHaveLength(1);`
- L98: `apiKey: "secret-k",`
- L99: `baseURL: "https://api.groq.com/openai/v1",`
- L100: `model: "openai/gpt-oss-20b",`
- L105: `await (await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "1" }))).text();`
- L110: `const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));`
- L113: `expect(state.streamSystems).toHaveLength(1);`
- L114: `expect(state.streamSystems[0]).toContain("SOLVER-NOTE");`
- L115: `expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");`
- L120: `const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));`
- L123: `expect(state.streamSystems[0]).not.toContain("specialist notes");`

### `src/server.ts`
- Source lines: 61
- L1: `import "./lib/error-capture";`
- L3: `import { consumeLastCapturedError } from "./lib/error-capture";`
- L4: `import { renderErrorPage } from "./lib/error-page";`
- L7: `fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;`
- L21: `// h3 swallows in-handler throws into a normal 500 Response with body`
- L22: `// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.`
- L23: `async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {`
- L24: `if (response.status < 500) return response;`
- L25: `const contentType = response.headers.get("content-type") ?? "";`
- L26: `if (!contentType.includes("application/json")) return response;`
- L28: `const body = await response.clone().text();`
- L29: `if (!isH3SwallowedErrorBody(body)) return response;`
- L31: `console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));`
- L32: `return new Response(renderErrorPage(), {`
- L33: `status: 500,`
- L38: `function isH3SwallowedErrorBody(body: string): boolean {`
- L39: `try {`
- L41: `return payload.unhandled === true && payload.message === "HTTPError";`
- L42: `} catch {`
- L48: `async fetch(request: Request, env: unknown, ctx: unknown) {`
- L49: `try {`
- L51: `const response = await handler.fetch(request, env, ctx);`
- L52: `return await normalizeCatastrophicSsrResponse(response);`
- L53: `} catch (error) {`
- L54: `console.error(error);`
- L55: `return new Response(renderErrorPage(), {`
- L56: `status: 500,`

## 2. Backend acceptance checklist
- [ ] Provider interface is independent of business logic.
- [ ] Provider configuration is server-only.
- [ ] API validates request body and message size.
- [ ] API handles missing credentials safely.
- [ ] Provider errors are normalized and do not leak secrets.
- [ ] Timeouts, cancellation, and retry policy are defined.
- [ ] Streaming and non-streaming behavior are explicit.
- [ ] Model/provider selection is controlled server-side.
- [ ] Usage limits and abuse controls are enforced.
- [ ] Tests cover success, invalid input, provider failure, and cancellation.

## 3. Current verified baseline
- Groq provider integration exists in remote source.
- Configured model reference: `openai/gpt-oss-20b`.
- Server key reference: `GROQ_API_KEY`.
- Chat API tests exist in remote source.
- Legacy `LOVABLE_API_KEY` template reference remains to be reconciled.
- Local checkout is still 13 commits behind remote.
- No source merge or source modification performed.

## 4. Not yet verified
- Live Groq connectivity and account quota.
- Actual streaming behavior in deployment runtime.
- Retry, timeout, and cancellation guarantees.
- Production secret binding and deployment health.
- Full tests/build/lint due unresolved Termux runtime blocker.

## 5. Proposed next work
1. Define a typed provider adapter contract.
2. Separate provider configuration from agent orchestration.
3. Normalize provider errors and usage metadata.
4. Add bounded timeout/cancellation and safe retry behavior.
5. Add provider contract tests before implementation.