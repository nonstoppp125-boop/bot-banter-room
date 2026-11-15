# Group 1.3.9 — Integration Contract Extraction
Read-only inspection of synchronized local main.

### src/lib/agents/types.ts
LINES=30 DECLARATIONS/INTEGRATION=5
4: export type AgentEnv = {
5: GROQ_API_KEY?: string | undefined;
10: export type AgentRunInput = {
16: export type SpecialistInput = {
23: export type AgentDefinition = {

### src/lib/agents/groq.ts
LINES=9 DECLARATIONS/INTEGRATION=5
1: import { createOpenAI } from "@ai-sdk/openai";
3: export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
4: export const GROQ_MODEL = "openai/gpt-oss-20b";
7: export function groqModel(apiKey: string) {
8: return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);

### src/lib/agents/liza-default.ts
LINES=33 DECLARATIONS/INTEGRATION=7
1: import { convertToModelMessages, streamText } from "ai";
7: export const LIZA_SYSTEM =
10: export const lizaDefaultAgent: AgentDefinition = {
16: const apiKey = env.GROQ_API_KEY;
19: { error: "GROQ_API_KEY is not configured on the server" },
20: { status: 500 },
24: const result = streamText({

### src/lib/agents/orchestrator.ts
LINES=74 DECLARATIONS/INTEGRATION=13
1: import { convertToModelMessages, streamText, type UIMessage } from "ai";
9: export function getAgentEnv(request: Request): AgentEnv {
12: return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };
15: export function isMultiAgentEnabled(env: AgentEnv): boolean {
20: export async function runMultiAgent(input: AgentRunInput): Promise<Response> {
22: const apiKey = env.GROQ_API_KEY!;
30: if (signal.aborted) return new Response(null, { status: 499 });
41: const result = streamText({
51: export async function handleChatRequest(request: Request): Promise<Response> {
53: if (!env.GROQ_API_KEY) {
55: { error: "GROQ_API_KEY is not configured on the server" },
56: { status: 500 },
68: return Response.json({ error: "Invalid request" }, { status: 400 });

### src/routes/api/chat.ts
LINES=11 DECLARATIONS/INTEGRATION=1
5: export const Route = createFileRoute("/api/chat")({

### src/test/chat-api.test.ts
LINES=135 DECLARATIONS/INTEGRATION=20
3: const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];
4: const state = { failSpecialists: false, generateCalls: 0, streamSystems: [] as string[] };
6: const usage = {
11: function systemOf(prompt: { role: string; content: unknown }[]) {
22: createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({
58: import { DEFAULT_AGENT_ID, getAgent, listAgents } from "@/lib/agents/registry";
60: function req(body: unknown, env: Record<string, string> = {}) {
69: const msgs = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];
70: const KEY = { GROQ_API_KEY: "secret-k" };
79: describe("POST /api/chat orchestrator", () => {
80: it("returns 500 when GROQ_API_KEY is missing", async () => {
83: expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
86: it("returns 400 for an invalid body", async () => {
91: it("by default makes one Groq call (no specialists), even for unknown agentId", async () => {
104: it("stays single-agent unless DOOT_MULTI_AGENT is exactly 'true'", async () => {
109: it("when enabled runs both specialists then synthesizes with their notes", async () => {
118: it("falls back to normal Liza when both specialists fail", async () => {
126: it("registry holds Liza plus the two real specialists; default is Liza", () => {
132: expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
133: expect(getAgent("problem-solver").id).toBe(DEFAULT_AGENT_ID);
