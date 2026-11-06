import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];
const state = { failSpecialists: false, generateCalls: 0, streamSystems: [] as string[] };

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function systemOf(prompt: { role: string; content: unknown }[]) {
  return prompt
    .filter((m) => m.role === "system")
    .map((m) => String(m.content))
    .join("\n");
}

vi.mock("@ai-sdk/openai", async () => {
  const { MockLanguageModelV3 } = await import("ai/test");
  const { simulateReadableStream } = await import("ai");
  return {
    createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({
      responses: (model: string) => {
        calls.push({ ...opts, model });
        return new MockLanguageModelV3({
          doGenerate: async ({ prompt }) => {
            state.generateCalls++;
            if (state.failSpecialists) throw new Error("boom");
            const sys = systemOf(prompt as never);
            const text = sys.includes("Problem Solver") ? "SOLVER-NOTE" : "REVIEWER-NOTE";
            return {
              content: [{ type: "text", text }],
              finishReason: { unified: "stop", raw: "stop" },
              usage,
              warnings: [],
            };
          },
          doStream: async ({ prompt }) => {
            state.streamSystems.push(systemOf(prompt as never));
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "text-start", id: "t1" },
                  { type: "text-delta", id: "t1", delta: "হ্যালো" },
                  { type: "text-end", id: "t1" },
                  { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                ],
              }),
            };
          },
        });
      },
    }),
  };
});

import { handleChatRequest } from "@/lib/agents/orchestrator";
import { DEFAULT_AGENT_ID, getAgent, listAgents } from "@/lib/agents/registry";

function req(body: unknown, env: Record<string, string> = {}) {
  const r = new Request("http://x/api/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as Request & { runtime?: unknown };
  r.runtime = { cloudflare: { env } };
  return r;
}

const msgs = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];
const KEY = { GROQ_API_KEY: "secret-k" };

beforeEach(() => {
  calls.length = 0;
  state.failSpecialists = false;
  state.generateCalls = 0;
  state.streamSystems = [];
});

describe("POST /api/chat orchestrator", () => {
  it("returns 500 when GROQ_API_KEY is missing", async () => {
    const res = await handleChatRequest(req({ messages: msgs }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
  });

  it("returns 400 for an invalid body", async () => {
    expect((await handleChatRequest(req("not json", KEY))).status).toBe(400);
    expect((await handleChatRequest(req({ messages: "x" }, KEY))).status).toBe(400);
  });

  it("by default makes one Groq call (no specialists), even for unknown agentId", async () => {
    const res = await handleChatRequest(req({ messages: msgs, agentId: "nope" }, KEY));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("হ্যালো");
    expect(state.generateCalls).toBe(0);
    expect(state.streamSystems).toHaveLength(1);
    expect(calls[0]).toEqual({
      apiKey: "secret-k",
      baseURL: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-20b",
    });
  });

  it("stays single-agent unless DOOT_MULTI_AGENT is exactly 'true'", async () => {
    await (await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "1" }))).text();
    expect(state.generateCalls).toBe(0);
  });

  it("when enabled runs both specialists then synthesizes with their notes", async () => {
    const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));
    expect(await res.text()).toContain("হ্যালো");
    expect(state.generateCalls).toBe(2);
    expect(state.streamSystems).toHaveLength(1);
    expect(state.streamSystems[0]).toContain("SOLVER-NOTE");
    expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");
  });

  it("falls back to normal Liza when both specialists fail", async () => {
    state.failSpecialists = true;
    const res = await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("হ্যালো");
    expect(state.streamSystems[0]).not.toContain("specialist notes");
  });

  it("registry holds Liza plus the two real specialists; default is Liza", () => {
    expect(listAgents().map((a) => a.id)).toEqual([
      "liza-default",
      "problem-solver",
      "quality-reviewer",
    ]);
    expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
    expect(getAgent("problem-solver").id).toBe(DEFAULT_AGENT_ID);
  });
});
