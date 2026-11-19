# Group 1.3.4 — API Validation, Error Exposure & Test Coverage

Baseline: origin/main
Method: read-only static inspection

## src/routes/api/chat.ts
Total lines: 11
L3: import { handleChatRequest } from "@/lib/agents/orchestrator";
L8: POST: async ({ request }) => handleChatRequest(request),

## src/test/chat-api.test.ts
Total lines: 135
L3: const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];
L11: function systemOf(prompt: { role: string; content: unknown }[]) {
L14: .map((m) => String(m.content))
L18: vi.mock("@ai-sdk/openai", async () => {
L19: const { MockLanguageModelV3 } = await import("ai/test");
L23: responses: (model: string) => {
L24: calls.push({ ...opts, model });
L25: return new MockLanguageModelV3({
L28: if (state.failSpecialists) throw new Error("boom");
L32: content: [{ type: "text", text }],
L57: import { handleChatRequest } from "@/lib/agents/orchestrator";
L60: function req(body: unknown, env: Record<string, string> = {}) {
L61: const r = new Request("http://x/api/chat", {
L63: body: typeof body === "string" ? body : JSON.stringify(body),
L64: }) as Request & { runtime?: unknown };
L70: const KEY = { GROQ_API_KEY: "secret-k" };
L79: describe("POST /api/chat orchestrator", () => {
L80: it("returns 500 when GROQ_API_KEY is missing", async () => {
L81: const res = await handleChatRequest(req({ messages: msgs }));
L82: expect(res.status).toBe(500);
L83: expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
L86: it("returns 400 for an invalid body", async () => {
L87: expect((await handleChatRequest(req("not json", KEY))).status).toBe(400);
L88: expect((await handleChatRequest(req({ messages: "x" }, KEY))).status).toBe(400);
L91: it("by default makes one Groq call (no specialists), even for unknown agentId", async () => {
L92: const res = await handleChatRequest(req({ messages: msgs, agentId: "nope" }, KEY));
L93: expect(res.status).toBe(200);
L94: expect(await res.text()).toContain("হ্যালো");
L95: expect(state.generateCalls).toBe(0);
L96: expect(state.streamSystems).toHaveLength(1);
L97: expect(calls[0]).toEqual({
L98: apiKey: "secret-k",
L99: baseURL: "https://api.groq.com/openai/v1",
L100: model: "openai/gpt-oss-20b",
L104: it("stays single-agent unless DOOT_MULTI_AGENT is exactly 'true'", async () => {
L105: await (await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "1" }))).text();
L106: expect(state.generateCalls).toBe(0);
L109: it("when enabled runs both specialists then synthesizes with their notes", async () => {
L110: const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));
L111: expect(await res.text()).toContain("হ্যালো");
L112: expect(state.generateCalls).toBe(2);
L113: expect(state.streamSystems).toHaveLength(1);
L114: expect(state.streamSystems[0]).toContain("SOLVER-NOTE");
L115: expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");
L118: it("falls back to normal Liza when both specialists fail", async () => {
L120: const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));
L121: expect(res.status).toBe(200);
L122: expect(await res.text()).toContain("হ্যালো");
L123: expect(state.streamSystems[0]).not.toContain("specialist notes");
L126: it("registry holds Liza plus the two real specialists; default is Liza", () => {
L127: expect(listAgents().map((a) => a.id)).toEqual([
L132: expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
L133: expect(getAgent("problem-solver").id).toBe(DEFAULT_AGENT_ID);

## src/lib/agents/groq.ts
Total lines: 9
L3: export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
L4: export const GROQ_MODEL = "openai/gpt-oss-20b";
L6: /** The single Groq model every agent uses (same provider/model as the original chat). */
L7: export function groqModel(apiKey: string) {
L8: return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);

## src/lib/agents/types.ts
Total lines: 30
L1: import type { ModelMessage, UIMessage } from "ai";
L5: GROQ_API_KEY?: string | undefined;
L11: messages: UIMessage[];
L18: messages: ModelMessage[];
L28: run?: (input: AgentRunInput) => Promise<Response> | Response;

## Review checklist
- [ ] Request body validation and malformed JSON behavior
- [ ] Required fields and input size limits
- [ ] Safe client-facing error messages
- [ ] No provider secret leakage
- [ ] HTTP status consistency
- [ ] Missing-key test coverage
- [ ] Invalid input and malformed JSON tests
- [ ] Provider failure and rate-limit tests
- [ ] Cancellation/timeout tests
- [ ] Streaming response and interruption tests

Static evidence only; checklist items are not assumed to pass.
