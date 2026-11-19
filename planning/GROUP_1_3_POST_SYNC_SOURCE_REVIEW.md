# Post-sync source review

Baseline: local main at synchronized origin/main
Review: read-only

## src/lib/agents/types.ts
Total lines: 30
L1: import type { ModelMessage, UIMessage } from "ai";
L4: export type AgentEnv = {
L5: GROQ_API_KEY?: string | undefined;
L10: export type AgentRunInput = {
L16: export type SpecialistInput = {
L22: /** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */
L23: export type AgentDefinition = {
L28: run?: (input: AgentRunInput) => Promise<Response> | Response;
L29: generate?: (input: SpecialistInput) => Promise<string>;

## src/lib/agents/groq.ts
Total lines: 9
L1: import { createOpenAI } from "@ai-sdk/openai";
L3: export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
L4: export const GROQ_MODEL = "openai/gpt-oss-20b";
L7: export function groqModel(apiKey: string) {
L8: return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);

## src/lib/agents/liza-default.ts
Total lines: 33
L1: import { convertToModelMessages, streamText } from "ai";
L3: import { groqModel } from "./groq";
L4: import type { AgentDefinition } from "./types";
L7: export const LIZA_SYSTEM =
L10: export const lizaDefaultAgent: AgentDefinition = {
L15: run: async ({ messages, env, signal }) => {
L16: const apiKey = env.GROQ_API_KEY;
L18: return Response.json(
L19: { error: "GROQ_API_KEY is not configured on the server" },
L20: { status: 500 },
L24: const result = streamText({
L31: return result.toUIMessageStreamResponse({ originalMessages: messages });

## src/lib/agents/orchestrator.ts
Total lines: 74
L1: import { convertToModelMessages, streamText, type UIMessage } from "ai";
L3: import { groqModel } from "./groq";
L4: import { LIZA_SYSTEM } from "./liza-default";
L5: import { getAgent, getSpecialist } from "./registry";
L6: import type { AgentEnv, AgentRunInput } from "./types";
L9: export function getAgentEnv(request: Request): AgentEnv {
L12: return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };
L15: export function isMultiAgentEnabled(env: AgentEnv): boolean {
L20: export async function runMultiAgent(input: AgentRunInput): Promise<Response> {
L22: const apiKey = env.GROQ_API_KEY!;
L26: getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),
L27: getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),
L30: if (signal.aborted) return new Response(null, { status: 499 });
L33: if (solver.status === "fulfilled" && solver.value.trim())
L35: if (reviewer.status === "fulfilled" && reviewer.value.trim())
L41: const result = streamText({
L47: return result.toUIMessageStreamResponse({ originalMessages: messages });
L51: export async function handleChatRequest(request: Request): Promise<Response> {
L53: if (!env.GROQ_API_KEY) {
L54: return Response.json(
L55: { error: "GROQ_API_KEY is not configured on the server" },
L56: { status: 500 },
L66: if (!Array.isArray(messages)) throw new Error("Invalid messages");
L67: } catch {
L68: return Response.json({ error: "Invalid request" }, { status: 400 });

## src/lib/agents/registry.ts
Total lines: 26
L1: import { lizaDefaultAgent } from "./liza-default";
L2: import { problemSolverAgent, qualityReviewerAgent } from "./specialists";
L3: import type { AgentDefinition } from "./types";
L5: export const DEFAULT_AGENT_ID = lizaDefaultAgent.id;
L13: export function getAgent(id: string | undefined | null): AgentDefinition {
L15: return found?.role === "chat" ? found : agents.get(DEFAULT_AGENT_ID)!;
L18: export function getSpecialist(id: string): AgentDefinition {
L20: if (!found || found.role !== "specialist") throw new Error(`Unknown specialist ${id}`);
L24: export function listAgents(): AgentDefinition[] {

## src/routes/api/chat.ts
Total lines: 11
L1: import { createFileRoute } from "@tanstack/react-router";
L3: import { handleChatRequest } from "@/lib/agents/orchestrator";
L5: export const Route = createFileRoute("/api/chat")({
L8: POST: async ({ request }) => handleChatRequest(request),

## src/test/chat-api.test.ts
Total lines: 135
L1: import { beforeEach, describe, expect, it, vi } from "vitest";
L4: const state = { failSpecialists: false, generateCalls: 0, streamSystems: [] as string[] };
L11: function systemOf(prompt: { role: string; content: unknown }[]) {
L18: vi.mock("@ai-sdk/openai", async () => {
L22: createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({
L23: responses: (model: string) => {
L26: doGenerate: async ({ prompt }) => {
L27: state.generateCalls++;
L28: if (state.failSpecialists) throw new Error("boom");
L38: doStream: async ({ prompt }) => {
L57: import { handleChatRequest } from "@/lib/agents/orchestrator";
L58: import { DEFAULT_AGENT_ID, getAgent, listAgents } from "@/lib/agents/registry";
L60: function req(body: unknown, env: Record<string, string> = {}) {
L70: const KEY = { GROQ_API_KEY: "secret-k" };
L75: state.generateCalls = 0;
L79: describe("POST /api/chat orchestrator", () => {
L80: it("returns 500 when GROQ_API_KEY is missing", async () => {
L82: expect(res.status).toBe(500);
L83: expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
L86: it("returns 400 for an invalid body", async () => {
L87: expect((await handleChatRequest(req("not json", KEY))).status).toBe(400);
L88: expect((await handleChatRequest(req({ messages: "x" }, KEY))).status).toBe(400);
L91: it("by default makes one Groq call (no specialists), even for unknown agentId", async () => {
L93: expect(res.status).toBe(200);
L94: expect(await res.text()).toContain("হ্যালো");
L95: expect(state.generateCalls).toBe(0);
L96: expect(state.streamSystems).toHaveLength(1);
L97: expect(calls[0]).toEqual({
L104: it("stays single-agent unless DOOT_MULTI_AGENT is exactly 'true'", async () => {
L106: expect(state.generateCalls).toBe(0);
L109: it("when enabled runs both specialists then synthesizes with their notes", async () => {
L111: expect(await res.text()).toContain("হ্যালো");
L112: expect(state.generateCalls).toBe(2);
L113: expect(state.streamSystems).toHaveLength(1);
L114: expect(state.streamSystems[0]).toContain("SOLVER-NOTE");
L115: expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");
L118: it("falls back to normal Liza when both specialists fail", async () => {
L121: expect(res.status).toBe(200);
L122: expect(await res.text()).toContain("হ্যালো");
L123: expect(state.streamSystems[0]).not.toContain("specialist notes");
L126: it("registry holds Liza plus the two real specialists; default is Liza", () => {
L127: expect(listAgents().map((a) => a.id)).toEqual([
L132: expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
L133: expect(getAgent("problem-solver").id).toBe(DEFAULT_AGENT_ID);

## package.json
Total lines: 107
Scripts:
- dev: vite dev
- build: vite build
- build:dev: vite build --mode development
- preview: vite preview
- lint: eslint .
- format: prettier --write .
- test: vitest run
- test:watch: vitest
Relevant dependencies:
- @ai-sdk/openai: ^4.0.106
- @ai-sdk/react: ^4.0.158
- @streamdown/mermaid: ^1.0.3
- @tailwindcss/vite: ^4.2.1
- ai: ^7.0.154
- tailwind-merge: ^3.5.0
- tailwindcss: ^4.2.1
- zod: ^3.25.76
- typescript: ^5.8.3
- vite: 8.1.5
- vitest: ^4.1.10
