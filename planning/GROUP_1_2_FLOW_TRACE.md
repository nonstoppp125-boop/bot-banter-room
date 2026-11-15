# Group 1.2 — End-to-End Architecture Trace

Generated: 2026-11-10T20:43

## 1. Request-to-response source trace

### `src/routes/api/chat.ts`
- Lines: 11
- **Imports:**
  - `import { createFileRoute } from "@tanstack/react-router";`
  - `import { handleChatRequest } from "@/lib/agents/orchestrator";`
- **Exports:**
  - `export const Route`
- **Control-flow evidence:**
  - `8: POST: async ({ request }) => handleChatRequest(request),`

### `src/lib/agents/orchestrator.ts`
- Lines: 74
- **Imports:**
  - `import { convertToModelMessages, streamText, type UIMessage } from "ai";`
  - `import { groqModel } from "./groq";`
  - `import { LIZA_SYSTEM } from "./liza-default";`
  - `import { getAgent, getSpecialist } from "./registry";`
  - `import type { AgentEnv, AgentRunInput } from "./types";`
- **Exports:**
  - `export function getAgentEnv`
  - `export function isMultiAgentEnabled`
  - `export async function runMultiAgent`
  - `export async function handleChatRequest`
- **Functions:**
  - `const env =`
  - `const apiKey =`
  - `const modelMessages =`
  - `const result =`
  - `const env =`
  - `const body =`
  - `const input =`
- **Control-flow evidence:**
  - `8: /** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */`
  - `9: export function getAgentEnv(request: Request): AgentEnv {`
  - `10: const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime`
  - `12: return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };`
  - `15: export function isMultiAgentEnabled(env: AgentEnv): boolean {`
  - `16: return env.DOOT_MULTI_AGENT === "true";`
  - `19: /** Problem Solver + Quality Reviewer in parallel, then one streamed synthesis. */`
  - `20: export async function runMultiAgent(input: AgentRunInput): Promise<Response> {`
  - `21: const { messages, env, signal } = input;`
  - `22: const apiKey = env.GROQ_API_KEY!;`
  - `23: const modelMessages = await convertToModelMessages(messages);`
  - `26: getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),`
  - `27: getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),`
  - `30: if (signal.aborted) return new Response(null, { status: 499 });`
  - `33: if (solver.status === "fulfilled" && solver.value.trim())`
  - `35: if (reviewer.status === "fulfilled" && reviewer.value.trim())`
  - `39: if (notes.length === 0) return getAgent(undefined).run!(input);`
  - `41: const result = streamText({`
  - `42: model: groqModel(apiKey),`
  - `43: instructions: `${LIZA_SYSTEM}\n\nWrite the final answer to the user using these internal specialist notes. Do not mention the specialists.\n\n${notes.join("\n\n")}`,`
  - `44: messages: modelMessages,`
  - `45: abortSignal: signal,`
  - `47: return result.toUIMessageStreamResponse({ originalMessages: messages });`
  - `50: /** Handles a chat request: checks the key, validates the body, delegates to an agent. */`
  - `51: export async function handleChatRequest(request: Request): Promise<Response> {`
  - `52: const env = getAgentEnv(request);`
  - `53: if (!env.GROQ_API_KEY) {`
  - `54: return Response.json(`
  - `55: { error: "GROQ_API_KEY is not configured on the server" },`
  - `56: { status: 500 },`
  - `60: let messages: UIMessage[];`
  - `61: let agentId: unknown;`
  - `63: const body = await request.json();`
  - `64: messages = body?.messages;`
  - `65: agentId = body?.agentId;`
  - `66: if (!Array.isArray(messages)) throw new Error("Invalid messages");`
  - `68: return Response.json({ error: "Invalid request" }, { status: 400 });`
  - `71: const input = { messages, env, signal: request.signal };`
  - `72: if (isMultiAgentEnabled(env)) return runMultiAgent(input);`
  - `73: return getAgent(typeof agentId === "string" ? agentId : undefined).run!(input);`

### `src/lib/agents/registry.ts`
- Lines: 26
- **Imports:**
  - `import { lizaDefaultAgent } from "./liza-default";`
  - `import { problemSolverAgent, qualityReviewerAgent } from "./specialists";`
  - `import type { AgentDefinition } from "./types";`
- **Exports:**
  - `export const DEFAULT_AGENT_ID`
  - `export function getAgent`
  - `export function getSpecialist`
  - `export function listAgents`
- **Functions:**
  - `const agents =`
  - `const found =`
  - `const found =`
- **Control-flow evidence:**
  - `5: export const DEFAULT_AGENT_ID = lizaDefaultAgent.id;`
  - `8: const agents = new Map<string, AgentDefinition>(`
  - `9: [lizaDefaultAgent, problemSolverAgent, qualityReviewerAgent].map((a) => [a.id, a]),`
  - `12: /** Returns a chat agent; unknown ids or specialists fall back to the default. */`
  - `13: export function getAgent(id: string | undefined | null): AgentDefinition {`
  - `14: const found = id ? agents.get(id) : undefined;`
  - `15: return found?.role === "chat" ? found : agents.get(DEFAULT_AGENT_ID)!;`
  - `18: export function getSpecialist(id: string): AgentDefinition {`
  - `19: const found = agents.get(id);`
  - `20: if (!found || found.role !== "specialist") throw new Error(`Unknown specialist ${id}`);`
  - `24: export function listAgents(): AgentDefinition[] {`
  - `25: return [...agents.values()];`

### `src/lib/agents/specialists.ts`
- Lines: 43
- **Imports:**
  - `import { generateText } from "ai";`
  - `import { groqModel } from "./groq";`
  - `import type { AgentDefinition, SpecialistInput } from "./types";`
- **Exports:**
  - `export const problemSolverAgent`
  - `export const qualityReviewerAgent`
- **Functions:**
  - `const SOLVER_SYSTEM =`
  - `const REVIEWER_SYSTEM =`
  - `function specialist`
- **Control-flow evidence:**
  - `7: const SOLVER_SYSTEM =`
  - `8: "You are the Problem Solver specialist. Work out a correct, complete, practical answer to the user's latest message. Be concrete and step-by-step where useful. Your notes go to a final writer, not the user.";`
  - `10: const REVIEWER_SYSTEM =`
  - `11: "You are the Quality Reviewer specialist. Identify what a good answer to the user's latest message must include, likely mistakes, missing caveats, and safety or accuracy issues. Output concise review notes for a final wr`
  - `13: function specialist(id: string, name: string, description: string, system: string): AgentDefinition {`
  - `18: role: "specialist",`
  - `19: generate: async ({ apiKey, messages, signal }: SpecialistInput) => {`
  - `20: const { text } = await generateText({`
  - `21: model: groqModel(apiKey),`
  - `22: instructions: system,`
  - `23: messages,`
  - `24: abortSignal: signal,`
  - `31: export const problemSolverAgent = specialist(`
  - `35: SOLVER_SYSTEM,`
  - `38: export const qualityReviewerAgent = specialist(`
  - `42: REVIEWER_SYSTEM,`

### `src/lib/agents/liza-default.ts`
- Lines: 33
- **Imports:**
  - `import { convertToModelMessages, streamText } from "ai";`
  - `import { groqModel } from "./groq";`
  - `import type { AgentDefinition } from "./types";`
- **Exports:**
  - `export const LIZA_SYSTEM`
  - `export const lizaDefaultAgent`
- **Functions:**
  - `const apiKey =`
  - `const result =`
- **Control-flow evidence:**
  - `7: export const LIZA_SYSTEM =`
  - `10: export const lizaDefaultAgent: AgentDefinition = {`
  - `15: run: async ({ messages, env, signal }) => {`
  - `16: const apiKey = env.GROQ_API_KEY;`
  - `17: if (!apiKey) {`
  - `18: return Response.json(`
  - `19: { error: "GROQ_API_KEY is not configured on the server" },`
  - `20: { status: 500 },`
  - `24: const result = streamText({`
  - `25: model: groqModel(apiKey),`
  - `26: instructions: LIZA_SYSTEM,`
  - `27: messages: await convertToModelMessages(messages),`
  - `28: abortSignal: signal,`
  - `31: return result.toUIMessageStreamResponse({ originalMessages: messages });`

### `src/lib/agents/groq.ts`
- Lines: 9
- **Imports:**
  - `import { createOpenAI } from "@ai-sdk/openai";`
- **Exports:**
  - `export const GROQ_BASE_URL`
  - `export const GROQ_MODEL`
  - `export function groqModel`
- **Control-flow evidence:**
  - `4: export const GROQ_MODEL = "openai/gpt-oss-20b";`
  - `6: /** The single Groq model every agent uses (same provider/model as the original chat). */`
  - `7: export function groqModel(apiKey: string) {`
  - `8: return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);`

### `src/lib/agents/types.ts`
- Lines: 30
- **Imports:**
  - `import type { ModelMessage, UIMessage } from "ai";`
- **Control-flow evidence:**
  - `4: export type AgentEnv = {`
  - `5: GROQ_API_KEY?: string | undefined;`
  - `6: /** Plain-text Worker variable; multi-agent runs only when exactly "true". */`
  - `7: DOOT_MULTI_AGENT?: string | undefined;`
  - `10: export type AgentRunInput = {`
  - `11: messages: UIMessage[];`
  - `12: env: AgentEnv;`
  - `13: signal: AbortSignal;`
  - `16: export type SpecialistInput = {`
  - `17: apiKey: string;`
  - `18: messages: ModelMessage[];`
  - `19: signal: AbortSignal;`
  - `22: /** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */`
  - `23: export type AgentDefinition = {`
  - `27: role: "chat" | "specialist";`
  - `28: run?: (input: AgentRunInput) => Promise<Response> | Response;`
  - `29: generate?: (input: SpecialistInput) => Promise<string>;`

### `src/server.ts`
- Lines: 61
- **Imports:**
  - `import "./lib/error-capture";`
  - `import { consumeLastCapturedError } from "./lib/error-capture";`
  - `import { renderErrorPage } from "./lib/error-page";`
- **Functions:**
  - `async function getServerEntry`
  - `async function normalizeCatastrophicSsrResponse`
  - `const contentType =`
  - `const body =`
  - `function isH3SwallowedErrorBody`
  - `const payload =`
  - `const handler =`
  - `const response =`
- **Control-flow evidence:**
  - `7: fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;`
  - `23: async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {`
  - `24: if (response.status < 500) return response;`
  - `25: const contentType = response.headers.get("content-type") ?? "";`
  - `26: if (!contentType.includes("application/json")) return response;`
  - `28: const body = await response.clone().text();`
  - `29: if (!isH3SwallowedErrorBody(body)) return response;`
  - `31: console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));`
  - `32: return new Response(renderErrorPage(), {`
  - `33: status: 500,`
  - `38: function isH3SwallowedErrorBody(body: string): boolean {`
  - `40: const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };`
  - `41: return payload.unhandled === true && payload.message === "HTTPError";`
  - `48: async fetch(request: Request, env: unknown, ctx: unknown) {`
  - `51: const response = await handler.fetch(request, env, ctx);`
  - `52: return await normalizeCatastrophicSsrResponse(response);`
  - `53: } catch (error) {`
  - `54: console.error(error);`
  - `55: return new Response(renderErrorPage(), {`
  - `56: status: 500,`

## 2. Agent flow model

```text
Client
  -> POST /api/chat (verify exact route behavior in source)
  -> Request parsing and validation
  -> Agent selection / registry
  -> Default Liza agent or specialist routing
  -> Groq provider / model execution
  -> Response construction / streaming
  -> Client
```

This is a trace checklist; each transition must be confirmed from the source evidence above.

## 3. Architecture questions to resolve
- Is request input schema-validated and size-limited?
- Is agent selection controlled by trusted server logic?
- Does the orchestrator actually delegate, or only select a specialist?
- Are specialist failures isolated and handled?
- Is there a review/synthesis stage before returning results?
- Are conversation history and memory persisted?
- Are user identity and workspace boundaries enforced?
- Are tool actions gated by explicit human approval?

## 4. Verification status
- Source trace: generated from remote main.
- Local checkout: not merged or modified.
- Runtime/build/tests: still unverified.
- Production deployment: not verified.