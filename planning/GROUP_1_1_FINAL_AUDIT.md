# Group 1.1 — Source Audit

Date: Tue Nov 10 19:25:29 +06 2026

## 1. Git baseline
- Branch: main
- Local HEAD: d2da23c
- Remote HEAD: 3f0b138
- Behind/Ahead: 0	13

## 2. Remote architecture
### src/server.ts
1:import "./lib/error-capture";
3:import { consumeLastCapturedError } from "./lib/error-capture";
4:import { renderErrorPage } from "./lib/error-page";
12:async function getServerEntry(): Promise<ServerEntry> {
23:async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
31:  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
33:    status: 500,
38:function isH3SwallowedErrorBody(body: string): boolean {
47:export default {
48:  async fetch(request: Request, env: unknown, ctx: unknown) {
53:    } catch (error) {
54:      console.error(error);
56:        status: 500,

### src/routes/api/chat.ts
1:import { createFileRoute } from "@tanstack/react-router";
3:import { handleChatRequest } from "@/lib/agents/orchestrator";
5:export const Route = createFileRoute("/api/chat")({
8:      POST: async ({ request }) => handleChatRequest(request),

### src/lib/agents/types.ts
1:import type { ModelMessage, UIMessage } from "ai";
4:export type AgentEnv = {
5:  GROQ_API_KEY?: string | undefined;
10:export type AgentRunInput = {
16:export type SpecialistInput = {
22:/** A mountable agent. Chat agents stream via `run`; specialists return text via `generate`. */
23:export type AgentDefinition = {
27:  role: "chat" | "specialist";
29:  generate?: (input: SpecialistInput) => Promise<string>;

### src/lib/agents/registry.ts
1:import { lizaDefaultAgent } from "./liza-default";
2:import { problemSolverAgent, qualityReviewerAgent } from "./specialists";
3:import type { AgentDefinition } from "./types";
5:export const DEFAULT_AGENT_ID = lizaDefaultAgent.id;
12:/** Returns a chat agent; unknown ids or specialists fall back to the default. */
13:export function getAgent(id: string | undefined | null): AgentDefinition {
15:  return found?.role === "chat" ? found : agents.get(DEFAULT_AGENT_ID)!;
18:export function getSpecialist(id: string): AgentDefinition {
20:  if (!found || found.role !== "specialist") throw new Error(`Unknown specialist ${id}`);
24:export function listAgents(): AgentDefinition[] {

### src/lib/agents/groq.ts
1:import { createOpenAI } from "@ai-sdk/openai";
3:export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
4:export const GROQ_MODEL = "openai/gpt-oss-20b";
6:/** The single Groq model every agent uses (same provider/model as the original chat). */
7:export function groqModel(apiKey: string) {
8:  return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);

### src/lib/agents/liza-default.ts
1:import { convertToModelMessages, streamText } from "ai";
3:import { groqModel } from "./groq";
4:import type { AgentDefinition } from "./types";
7:export const LIZA_SYSTEM =
10:export const lizaDefaultAgent: AgentDefinition = {
15:  run: async ({ messages, env, signal }) => {
16:    const apiKey = env.GROQ_API_KEY;
19:        { error: "GROQ_API_KEY is not configured on the server" },
20:        { status: 500 },
25:      model: groqModel(apiKey),

### src/lib/agents/specialists.ts
1:import { generateText } from "ai";
3:import { groqModel } from "./groq";
4:import type { AgentDefinition, SpecialistInput } from "./types";
6:// Ported from PR #1 (feat/base-multi-agent-orchestration): Problem Solver + Quality Reviewer.
8:  "You are the Problem Solver specialist. Work out a correct, complete, practical answer to the user's latest message. Be concrete and step-by-step where useful. Your notes go to a final writer, not the user.";
11:  "You are the Quality Reviewer specialist. Identify what a good answer to the user's latest message must include, likely mistakes, missing caveats, and safety or accuracy issues. Output concise review notes for a final writer, not the user.";
13:function specialist(id: string, name: string, description: string, system: string): AgentDefinition {
18:    role: "specialist",
19:    generate: async ({ apiKey, messages, signal }: SpecialistInput) => {
20:      const { text } = await generateText({
21:        model: groqModel(apiKey),
31:export const problemSolverAgent = specialist(
32:  "problem-solver",
38:export const qualityReviewerAgent = specialist(

### src/lib/agents/orchestrator.ts
1:import { convertToModelMessages, streamText, type UIMessage } from "ai";
3:import { groqModel } from "./groq";
4:import { LIZA_SYSTEM } from "./liza-default";
5:import { getAgent, getSpecialist } from "./registry";
6:import type { AgentEnv, AgentRunInput } from "./types";
9:export function getAgentEnv(request: Request): AgentEnv {
12:  return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };
15:export function isMultiAgentEnabled(env: AgentEnv): boolean {
20:export async function runMultiAgent(input: AgentRunInput): Promise<Response> {
22:  const apiKey = env.GROQ_API_KEY!;
23:  const modelMessages = await convertToModelMessages(messages);
26:    getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),
27:    getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),
30:  if (signal.aborted) return new Response(null, { status: 499 });
38:  // Both specialists failed: answer exactly like the normal single agent.
42:    model: groqModel(apiKey),
43:    instructions: `${LIZA_SYSTEM}\n\nWrite the final answer to the user using these internal specialist notes. Do not mention the specialists.\n\n${notes.join("\n\n")}`,
44:    messages: modelMessages,
51:export async function handleChatRequest(request: Request): Promise<Response> {
53:  if (!env.GROQ_API_KEY) {
55:      { error: "GROQ_API_KEY is not configured on the server" },
56:      { status: 500 },
68:    return Response.json({ error: "Invalid request" }, { status: 400 });

## 3. API security static inspection
3:import { handleChatRequest } from "@/lib/agents/orchestrator";
8:      POST: async ({ request }) => handleChatRequest(request),

### Security-related patterns across remote source
origin/main:.env.example:3:LOVABLE_API_KEY=
origin/main:src/components/ai-elements/prompt-input.tsx:868:              // If conversion failed, keep the original blob URL
origin/main:src/components/ui/context-menu.tsx:47:      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin)",
origin/main:src/components/ui/context-menu.tsx:63:        "z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-context-menu-content-transform-origin)",
origin/main:src/components/ui/dropdown-menu.tsx:49:      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
origin/main:src/components/ui/dropdown-menu.tsx:67:        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
origin/main:src/components/ui/hover-card.tsx:19:      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-hover-card-content-transform-origin)",
origin/main:src/components/ui/menubar.tsx:85:      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-menubar-content-transform-origin)",
origin/main:src/components/ui/menubar.tsx:104:        "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-menubar-content-transform-origin)",
origin/main:src/components/ui/navigation-menu.tsx:83:        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
origin/main:src/components/ui/popover.tsx:22:        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-popover-content-transform-origin)",
origin/main:src/components/ui/select.tsx:71:        "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-select-content-transform-origin)",
origin/main:src/components/ui/tooltip.tsx:23:        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-tooltip-content-transform-origin)",
origin/main:src/lib/agents/groq.ts:6:/** The single Groq model every agent uses (same provider/model as the original chat). */
origin/main:src/lib/agents/groq.ts:7:export function groqModel(apiKey: string) {
origin/main:src/lib/agents/groq.ts:8:  return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);
origin/main:src/lib/agents/liza-default.ts:6:// Unchanged from the original /api/chat behavior.
origin/main:src/lib/agents/liza-default.ts:16:    const apiKey = env.GROQ_API_KEY;
origin/main:src/lib/agents/liza-default.ts:17:    if (!apiKey) {
origin/main:src/lib/agents/liza-default.ts:19:        { error: "GROQ_API_KEY is not configured on the server" },
origin/main:src/lib/agents/liza-default.ts:25:      model: groqModel(apiKey),
origin/main:src/lib/agents/liza-default.ts:31:    return result.toUIMessageStreamResponse({ originalMessages: messages });
origin/main:src/lib/agents/orchestrator.ts:12:  return { GROQ_API_KEY: env?.GROQ_API_KEY, DOOT_MULTI_AGENT: env?.DOOT_MULTI_AGENT };
origin/main:src/lib/agents/orchestrator.ts:22:  const apiKey = env.GROQ_API_KEY!;
origin/main:src/lib/agents/orchestrator.ts:26:    getSpecialist("problem-solver").generate!({ apiKey, messages: modelMessages, signal }),
origin/main:src/lib/agents/orchestrator.ts:27:    getSpecialist("quality-reviewer").generate!({ apiKey, messages: modelMessages, signal }),
origin/main:src/lib/agents/orchestrator.ts:42:    model: groqModel(apiKey),
origin/main:src/lib/agents/orchestrator.ts:47:  return result.toUIMessageStreamResponse({ originalMessages: messages });
origin/main:src/lib/agents/orchestrator.ts:53:  if (!env.GROQ_API_KEY) {
origin/main:src/lib/agents/orchestrator.ts:55:      { error: "GROQ_API_KEY is not configured on the server" },
origin/main:src/lib/agents/specialists.ts:19:    generate: async ({ apiKey, messages, signal }: SpecialistInput) => {
origin/main:src/lib/agents/specialists.ts:21:        model: groqModel(apiKey),
origin/main:src/lib/agents/types.ts:5:  GROQ_API_KEY?: string | undefined;
origin/main:src/lib/agents/types.ts:17:  apiKey: string;
origin/main:src/lib/ai/responses.ts:12:  config: { baseURL: string; apiKey: string; model: string },
origin/main:src/lib/ai/responses.ts:15:  originalMessages?: import("ai").UIMessage[],
origin/main:src/lib/ai/responses.ts:20:    apiKey: config.apiKey,
origin/main:src/lib/ai/responses.ts:21:    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
origin/main:src/lib/ai/responses.ts:48:      withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ ...(originalMessages ? { originalMessages } : {}), sendReasoning: true }), runIdFetch),
origin/main:src/lib/error-capture.ts:1:// Captures the original Error out-of-band so server.ts can recover the stack
origin/main:src/lib/error-capture.ts:55:const originalConsoleError = console.error.bind(console);
origin/main:src/lib/error-capture.ts:62:  originalConsoleError(...expanded);
origin/main:src/start.ts:1:import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
origin/main:src/start.ts:23:const csrfMiddleware = createCsrfMiddleware({
origin/main:src/start.ts:28:  requestMiddleware: [errorMiddleware, csrfMiddleware],
origin/main:src/test/chat-api.test.ts:3:const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];
origin/main:src/test/chat-api.test.ts:22:    createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({
origin/main:src/test/chat-api.test.ts:70:const KEY = { GROQ_API_KEY: "secret-k" };
origin/main:src/test/chat-api.test.ts:80:  it("returns 500 when GROQ_API_KEY is missing", async () => {
origin/main:src/test/chat-api.test.ts:83:    expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
origin/main:src/test/chat-api.test.ts:98:      apiKey: "secret-k",

## 4. Deployment and environment
### .github/workflows/build.yml
name: Doot Cloud Build

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install --no-audit --no-fund
      - run: npm run build
### wrangler.toml
### wrangler.json
### wrangler.jsonc
### .env.example
# Server-only Lovable AI Gateway key=<REDACTED>
# Never expose this through a VITE_ variable or commit the real .env file.
LOVABLE_API_KEY=<REDACTED>
## 5. Runtime diagnostic
OS: Linux 4.19.157-perf-g1a6087bc0325-dirty aarch64
Node path: /data/data/com.termux/files/usr/bin/node
NPM path: /data/data/com.termux/files/usr/bin/npm
Python path: /data/data/com.termux/files/usr/bin/python
### node file
The program file is not installed. Install it by executing:
 pkg install file
Exit code: 0
v24.22.1
### npm file
The program file is not installed. Install it by executing:
 pkg install file
Exit code: 0
12.2.1

### Node native package candidates

## 6. Test inventory
src/test/app-routing.test.tsx
src/test/chat-api.test.ts

## 7. Existing test evidence
- Previous npm test attempt: Illegal instruction (exit 132).
- Full test suite: NOT VERIFIED.
- Build/lint: NOT VERIFIED.
- Production deployment health: NOT VERIFIED.

## 8. Preserved user files
46a70c851b4ad7343f9da4fb22a463a8ee87b15d8c0ad27e168b4d9921e427be  src/routes/api/chat.ts.bak
9740fe2e69881a3c8f8b76f995c6244c70f8474a9e0071afec629de3598cd893  src/routes/api/chat.ts.before-env-fix

## 9. Worktree
?? planning/
?? src/routes/api/chat.ts.bak
?? src/routes/api/chat.ts.before-env-fix


## Final disposition
- Source inventory and Git identity: completed.
- Runtime verification: blocked; carry forward to QA.
- Build/tests/deployment: not verified.
- User backups and untracked files preserved.
- Group disposition: audit completed with documented blockers.
