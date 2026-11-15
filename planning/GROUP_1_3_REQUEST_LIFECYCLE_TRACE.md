# Group 1.3.3 — Request Lifecycle & Failure Trace

Baseline: origin/main
Method: read-only static source inspection


## src/routes/api/chat.ts
Total lines: 11
...
L2: 
L3: import { handleChatRequest } from "@/lib/agents/orchestrator";
L4: 
L5: export const Route = createFileRoute("/api/chat")({
L6:   server: {
L7:     handlers: {
L8:       POST: async ({ request }) => handleChatRequest(request),
L9:     },

## src/lib/agents/groq.ts
Total lines: 9
...
L2: 
L3: export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
L4: export const GROQ_MODEL = "openai/gpt-oss-20b";
L5: 
L6: /** The single Groq model every agent uses (same provider/model as the original chat). */
L7: export function groqModel(apiKey: string) {
L8:   return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);
L9: }

## src/lib/agents/liza-default.ts
Total lines: 33
...
L1: import { convertToModelMessages, streamText } from "ai";
L2: 
L3: import { groqModel } from "./groq";
L4: import type { AgentDefinition } from "./types";
L5: 
L6: // Unchanged from the original /api/chat behavior.
L7: export const LIZA_SYSTEM =
L8:   "You are Doot, a friendly helpful assistant. Reply in the same language the user writes in (Bangla if they write Bangla). Use markdown when helpful.";
L9: 
L10: export const lizaDefaultAgent: AgentDefinition = {
L11:   id: "liza-default",
L12:   name: "Liza",
L13:   description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",
L14:   role: "chat",
L15:   run: async ({ messages, env, signal }) => {
L16:     const apiKey = env.GROQ_API_KEY;
L17:     if (!apiKey) {
L18:       return Response.json(
L19:         { error: "GROQ_API_KEY is not configured on the server" },
L20:         { status: 500 },
L21:       );
...
L23: 
L24:     const result = streamText({
L25:       model: groqModel(apiKey),
L26:       instructions: LIZA_SYSTEM,
L27:       messages: await convertToModelMessages(messages),
L28:       abortSignal: signal,
L29:     });
L30: 
L31:     return result.toUIMessageStreamResponse({ originalMessages: messages });
L32:   },

## src/lib/agents/orchestrator.ts
Total lines: 74
...
L1: import { convertToModelMessages, streamText, type UIMessage } from "ai";
L2: 
L3: import { groqModel } from "./groq";
L4: import { LIZA_SYSTEM } from "./liza-default";
L5: import { getAgent, getSpecialist } from "./registry";
L6: import type { AgentEnv, AgentRunInput } from "./types";
L7: 
L8: /** Nitro's cloudflare-module preset attaches Worker bindings at request.runtime.cloudflare.env. */
L9: export function getAgentEnv(request: Request): AgentEnv {
L10:   const env = (request as Request & { runtime?: { cloudflare?: { env?: AgentEnv } } }).runtime
L11:     ?.cloudflare?.env;
L12:   return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };
L13: }
L14: 
L15: export function isMultiAgentEnabled(env: AgentEnv): boolean {
L16:   return env.DOOT_MULTI_AGENT === "true";
L17: }
L18: 
L19: /** Problem Solver + Quality Reviewer in parallel, then one streamed synthesis. */
L20: export async function runMultiAgent(input: AgentRunInput): Promise<Response> {
L21:   const { messages, env, signal } = input;
L22:   const apiKey = env.GROQ_API_KEY!;
L23:   const modelMessages = await convertToModelMessages(messages);
L24: 
L25:   const [solver, reviewer] = await Promise.allSettled([
L26:     getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),
L27:     getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),
L28:   ]);
L29: 
L30:   if (signal.aborted) return new Response(null, { status: 499 });
L31: 
L32:   const notes: string[] = [];
L33:   if (solver.status === "fulfilled" && solver.value.trim())
L34:     notes.push(`Problem Solver notes:\n${solver.value}`);
L35:   if (reviewer.status === "fulfilled" && reviewer.value.trim())
L36:     notes.push(`Quality Reviewer notes:\n${reviewer.value}`);
L37: 
L38:   // Both specialists failed: answer exactly like the normal single agent.
L39:   if (notes.length === 0) return getAgent(undefined).run!(input);
L40: 
L41:   const result = streamText({
L42:     model: groqModel(apiKey),
L43:     instructions: `${LIZA_SYSTEM}\n\nWrite the final answer to the user using these internal specialist notes. Do not mention the specialists.\n\n${notes.join("\n\n")}`,
L44:     messages: modelMessages,
L45:     abortSignal: signal,
L46:   });
L47:   return result.toUIMessageStreamResponse({ originalMessages: messages });
L48: }
L49: 
L50: /** Handles a chat request: checks the key, validates the body, delegates to an agent. */
L51: export async function handleChatRequest(request: Request): Promise<Response> {
L52:   const env = getAgentEnv(request);
L53:   if (!env.GROQ_API_KEY) {
L54:     return Response.json(
L55:       { error: "GROQ_API_KEY is not configured on the server" },
L56:       { status: 500 },
L57:     );
...
L59: 
L60:   let messages: UIMessage[];
L61:   let agentId: unknown;
L62:   try {
L63:     const body = await request.json();
L64:     messages = body?.messages;
L65:     agentId = body?.agentId;
L66:     if (!Array.isArray(messages)) throw new Error("Invalid messages");
L67:   } catch {
L68:     return Response.json({ error: "Invalid request" }, { status: 400 });
L69:   }
L70: 
L71:   const input = { messages, env, signal: request.signal };
L72:   if (isMultiAgentEnabled(env)) return runMultiAgent(input);
L73:   return getAgent(typeof agentId === "string" ? agentId : undefined).run!(input);
L74: }

## src/lib/agents/types.ts
Total lines: 30
...
L1: import type { ModelMessage, UIMessage } from "ai";
L2: 
L3: /** Worker bindings this app reads. Names must match the Cloudflare config. */
L4: export type AgentEnv = {
L5:   GROQ_API_KEY?: string | undefined;
L6:   /** Plain-text Worker variable; multi-agent runs only when exactly "true". */
L7:   DOOT_MULTI_AGENT?: string | undefined;
L8: };
L9: 
L10: export type AgentRunInput = {
L11:   messages: UIMessage[];
L12:   env: AgentEnv;
L13:   signal: AbortSignal;
L14: };
L15: 
L16: export type SpecialistInput = {
L17:   apiKey: string;
L18:   messages: ModelMessage[];
L19:   signal: AbortSignal;
L20: };
L21: 
L22: /** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */
L23: export type AgentDefinition = {
L24:   id: string;
...
L27:   role: "chat" | "specialist";
L28:   run?: (input: AgentRunInput) => Promise<Response> | Response;
L29:   generate?: (input: SpecialistInput) => Promise<string>;
L30: };

## src/test/chat-api.test.ts
Total lines: 135
...
L2: 
L3: const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];
L4: const state = { failSpecialists: false, generateCalls: 0, streamSystems: [] as string[] };
L5: 
...
L10: 
L11: function systemOf(prompt: { role: string; content: unknown }[]) {
L12:   return prompt
L13:     .filter((m) => m.role === "system")
...
L17: 
L18: vi.mock("@ai-sdk/openai", async () => {
L19:   const { MockLanguageModelV3 } = await import("ai/test");
L20:   const { simulateReadableStream } = await import("ai");
L21:   return {
L22:     createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({
L23:       responses: (model: string) => {
L24:         calls.push({ ...opts, model });
L25:         return new MockLanguageModelV3({
L26:           doGenerate: async ({ prompt }) => {
L27:             state.generateCalls++;
L28:             if (state.failSpecialists) throw new Error("boom");
L29:             const sys = systemOf(prompt as never);
L30:             const text = sys.includes("Problem Solver") ? "SOLVER-NOTE" : "REVIEWER-NOTE";
L31:             return {
L32:               content: [{ type: "text", text }],
...
L37:           },
L38:           doStream: async ({ prompt }) => {
L39:             state.streamSystems.push(systemOf(prompt as never));
L40:             return {
L41:               stream: simulateReadableStream({
L42:                 chunks: [
...
L56: 
L57: import { handleChatRequest } from "@/lib/agents/orchestrator";
L58: import { DEFAULT_AGENT_ID, getAgent, listAgents } from "@/lib/agents/registry";
L59: 
L60: function req(body: unknown, env: Record<string, string> = {}) {
L61:   const r = new Request("http://x/api/chat", {
...
L65:   r.runtime = { cloudflare: { env } };
L66:   return r;
L67: }
...
L69: const msgs = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];
L70: const KEY = { GROQ_API_KEY: "secret-k" };
L71: 
...
L74:   state.failSpecialists = false;
L75:   state.generateCalls = 0;
L76:   state.streamSystems = [];
L77: });
L78: 
L79: describe("POST /api/chat orchestrator", () => {
L80:   it("returns 500 when GROQ_API_KEY is missing", async () => {
L81:     const res = await handleChatRequest(req({ messages: msgs }));
L82:     expect(res.status).toBe(500);
L83:     expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
L84:   });
L85: 
L86:   it("returns 400 for an invalid body", async () => {
L87:     expect((await handleChatRequest(req("not json", KEY))).status).toBe(400);
L88:     expect((await handleChatRequest(req({ messages: "x" }, KEY))).status).toBe(400);
L89:   });
L90: 
L91:   it("by default makes one Groq call (no specialists), even for unknown agentId", async () => {
L92:     const res = await handleChatRequest(req({ messages: msgs, agentId: "nope" }, KEY));
L93:     expect(res.status).toBe(200);
L94:     expect(await res.text()).toContain("হ্যালো");
L95:     expect(state.generateCalls).toBe(0);
L96:     expect(state.streamSystems).toHaveLength(1);
L97:     expect(calls[0]).toEqual({
L98:       apiKey: "secret-k",
L99:       baseURL: "https://api.groq.com/openai/v1",
L100:       model: "openai/gpt-oss-20b",
L101:     });
...
L103: 
L104:   it("stays single-agent unless DOOT_MULTI_AGENT is exactly 'true'", async () => {
L105:     await (await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "1" }))).text();
L106:     expect(state.generateCalls).toBe(0);
L107:   });
L108: 
L109:   it("when enabled runs both specialists then synthesizes with their notes", async () => {
L110:     const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));
L111:     expect(await res.text()).toContain("হ্যালো");
L112:     expect(state.generateCalls).toBe(2);
L113:     expect(state.streamSystems).toHaveLength(1);
L114:     expect(state.streamSystems[0]).toContain("SOLVER-NOTE");
L115:     expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");
L116:   });
L117: 
L118:   it("falls back to normal Liza when both specialists fail", async () => {
L119:     state.failSpecialists = true;
L120:     const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));
L121:     expect(res.status).toBe(200);
L122:     expect(await res.text()).toContain("হ্যালো");
L123:     expect(state.streamSystems[0]).not.toContain("specialist notes");
L124:   });
...
L126:   it("registry holds Liza plus the two real specialists; default is Liza", () => {
L127:     expect(listAgents().map((a) => a.id)).toEqual([
L128:       "liza-default",
...
L131:     ]);
L132:     expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
L133:     expect(getAgent("problem-solver").id).toBe(DEFAULT_AGENT_ID);
L134:   });
