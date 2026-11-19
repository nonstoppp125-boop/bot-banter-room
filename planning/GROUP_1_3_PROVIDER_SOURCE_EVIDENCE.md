# Provider Source Evidence

Baseline: origin/main

## src/lib/agents/types.ts
Source available: True
Lines: 30
- L1: `import type { ModelMessage, UIMessage } from "ai";`
- L4: `export type AgentEnv = {`
- L5: `GROQ_API_KEY?: string | undefined;`
- L10: `export type AgentRunInput = {`
- L13: `signal: AbortSignal;`
- L16: `export type SpecialistInput = {`
- L18: `messages: ModelMessage[];`
- L19: `signal: AbortSignal;`
- L22: `/** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */`
- L23: `export type AgentDefinition = {`
- L29: `generate?: (input: SpecialistInput) => Promise<string>;`

## src/lib/agents/groq.ts
Source available: True
Lines: 9
- L3: `export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";`
- L4: `export const GROQ_MODEL = "openai/gpt-oss-20b";`
- L6: `/** The single Groq model every agent uses (same provider/model as the original chat). */`
- L7: `export function groqModel(apiKey: string) {`
- L8: `return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);`

## src/lib/agents/liza-default.ts
Source available: True
Lines: 33
- L1: `import { convertToModelMessages, streamText } from "ai";`
- L3: `import { groqModel } from "./groq";`
- L4: `import type { AgentDefinition } from "./types";`
- L7: `export const LIZA_SYSTEM =`
- L10: `export const lizaDefaultAgent: AgentDefinition = {`
- L13: `description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",`
- L15: `run: async ({ messages, env, signal }) => {`
- L16: `const apiKey = env.GROQ_API_KEY;`
- L19: `{ error: "GROQ_API_KEY is not configured on the server" },`
- L24: `const result = streamText({`
- L25: `model: groqModel(apiKey),`
- L27: `messages: await convertToModelMessages(messages),`
- L28: `abortSignal: signal,`
- L31: `return result.toUIMessageStreamResponse({ originalMessages: messages });`

## src/lib/agents/orchestrator.ts
Source available: True
Lines: 74
- L1: `import { convertToModelMessages, streamText, type UIMessage } from "ai";`
- L3: `import { groqModel } from "./groq";`
- L6: `import type { AgentEnv, AgentRunInput } from "./types";`
- L9: `export function getAgentEnv(request: Request): AgentEnv {`
- L10: `const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime`
- L12: `return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };`
- L15: `export function isMultiAgentEnabled(env: AgentEnv): boolean {`
- L19: `/** Problem Solver + Quality Reviewer in parallel, then one streamed synthesis. */`
- L20: `export async function runMultiAgent(input: AgentRunInput): Promise<Response> {`
- L21: `const { messages, env, signal } = input;`
- L22: `const apiKey = env.GROQ_API_KEY!;`
- L23: `const modelMessages = await convertToModelMessages(messages);`
- L25: `const [solver, reviewer] = await Promise.allSettled([`
- L26: `getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),`
- L27: `getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),`
- L30: `if (signal.aborted) return new Response(null, { status: 499 });`
- L32: `const notes: string[] = [];`
- L41: `const result = streamText({`
- L42: `model: groqModel(apiKey),`
- L44: `messages: modelMessages,`
- L45: `abortSignal: signal,`
- L47: `return result.toUIMessageStreamResponse({ originalMessages: messages });`
- L51: `export async function handleChatRequest(request: Request): Promise<Response> {`
- L52: `const env = getAgentEnv(request);`
- L53: `if (!env.GROQ_API_KEY) {`
- L55: `{ error: "GROQ_API_KEY is not configured on the server" },`
- L63: `const body = await request.json();`
- L66: `if (!Array.isArray(messages)) throw new Error("Invalid messages");`
- L68: `return Response.json({ error: "Invalid request" }, { status: 400 });`
- L71: `const input = { messages, env, signal: request.signal };`

## src/routes/api/chat.ts
Source available: True
Lines: 11
- L5: `export const Route = createFileRoute("/api/chat")({`
