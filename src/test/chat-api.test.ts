import { describe, expect, it, vi } from "vitest";

const calls: { apiKey?: string; baseURL?: string; model?: string }[] = [];

vi.mock("@ai-sdk/openai", async () => {
  const { MockLanguageModelV3 } = await import("ai/test");
  const { simulateReadableStream } = await import("ai");
  return {
    createOpenAI: (opts: { apiKey: string; baseURL: string }) => ({
      responses: (model: string) => {
        calls.push({ ...opts, model });
        return new MockLanguageModelV3({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start", id: "t1" },
                { type: "text-delta", id: "t1", delta: "হ্যালো" },
                { type: "text-end", id: "t1" },
                {
                  type: "finish",
                  finishReason: { unified: "stop", raw: "stop" },
                  usage: {
                    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                  },
                },
              ],
            }),
          }),
        });
      },
    }),
  };
});

import { handleChatRequest } from "@/lib/agents/orchestrator";
import { DEFAULT_AGENT_ID, getAgent, listAgents } from "@/lib/agents/registry";

function req(body: unknown, key?: string) {
  const r = new Request("http://x/api/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as Request & { runtime?: unknown };
  r.runtime = { cloudflare: { env: key ? { GROQ_API_KEY: key } : {} } };
  return r;
}

const msgs = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];

describe("POST /api/chat orchestrator", () => {
  it("returns 500 when GROQ_API_KEY is missing", async () => {
    const res = await handleChatRequest(req({ messages: msgs }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
  });

  it("returns 400 for an invalid body", async () => {
    expect((await handleChatRequest(req("not json", "k"))).status).toBe(400);
    expect((await handleChatRequest(req({ messages: "x" }, "k"))).status).toBe(400);
  });

  it("streams from the default Groq agent, also for unknown agentId", async () => {
    calls.length = 0;
    const res = await handleChatRequest(req({ messages: msgs, agentId: "nope" }, "secret-k"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("হ্যালো");
    expect(calls[0]).toEqual({
      apiKey: "secret-k",
      baseURL: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-20b",
    });
  });

  it("registry holds only the real Liza agent", () => {
    expect(listAgents().map((a) => a.id)).toEqual(["liza-default"]);
    expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
  });
});
