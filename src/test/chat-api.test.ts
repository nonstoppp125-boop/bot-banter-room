import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { apiKey?: string; baseURL?: string; model?: string; fetch?: unknown }[] = [];
const state = {
  failSpecialists: false,
  failProblemSolver: false,
  generateCalls: 0,
  generatePrompts: [] as string[],
  streamSystems: [] as string[],
};

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
    createOpenAI: (opts: { apiKey: string; baseURL: string; fetch?: unknown }) => ({
      responses: (model: string) => {
        calls.push({ ...opts, model });
        return new MockLanguageModelV3({
          doGenerate: async ({ prompt }) => {
            state.generateCalls++;
            const serializedPrompt = JSON.stringify(prompt);
            state.generatePrompts.push(serializedPrompt);
            const sys = systemOf(prompt as never);
            if (
              state.failSpecialists ||
              (state.failProblemSolver && sys.includes("Problem Solver"))
            ) {
              throw new Error("boom");
            }
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
import {
  DEFAULT_AGENT_ID,
  getAgent,
  listAgents,
  getSpecialist,
  validateAgentRegistry,
} from "@/lib/agents/registry";

function req(
  body: unknown,
  env: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const r = new Request("http://x/api/chat", {
    method: "POST",
    headers: { "cf-connecting-ip": "203.0.113.20", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as Request & { runtime?: unknown };
  const defaultLimiter = { limit: async () => ({ success: true }) };
  r.runtime = {
    cloudflare: {
      env: { CHAT_RATE_LIMITER: defaultLimiter, ...env },
    },
  };
  return r;
}

const msgs = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];
const KEY = { GROQ_API_KEY: "secret-k" };

beforeEach(() => {
  calls.length = 0;
  state.failSpecialists = false;
  state.failProblemSolver = false;
  state.generateCalls = 0;
  state.generatePrompts = [];
  state.streamSystems = [];
});

describe("POST /api/chat orchestrator", () => {
  it("returns 500 when GROQ_API_KEY is missing", async () => {
    const res = await handleChatRequest(req({ messages: msgs }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "GROQ_API_KEY is not configured on the server" });
  });

  it("returns 429 when the Cloudflare chat rate limit is exceeded", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await handleChatRequest(
      req(
        { messages: msgs },
        { ...KEY, CHAT_RATE_LIMITER: { limit } },
        {
          "cf-connecting-ip": "203.0.113.10",
        },
      ),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again shortly.",
    });
    expect(limit).toHaveBeenCalledWith({ key: "chat:203.0.113.10" });
  });

  it("fails closed with 503 if the configured rate limiter errors", async () => {
    const limit = vi.fn(async () => {
      throw new Error("binding unavailable");
    });
    const res = await handleChatRequest(
      req(
        { messages: msgs },
        { ...KEY, CHAT_RATE_LIMITER: { limit } },
        {
          "cf-connecting-ip": "203.0.113.10",
        },
      ),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Rate limiting is temporarily unavailable",
    });
  });

  it("fails closed with 503 when the rate limiter binding is missing", async () => {
    const res = await handleChatRequest(
      req({ messages: msgs }, { ...KEY, CHAT_RATE_LIMITER: undefined }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Rate limiting is not configured" });
  });

  it("rejects an individual text part larger than 20,000 characters", async () => {
    const res = await handleChatRequest(
      req(
        {
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "x".repeat(20_001) }] },
          ],
        },
        KEY,
      ),
    );
    expect(res.status).toBe(400);
  });

  it("rejects conversation text larger than 100,000 characters", async () => {
    const largeMessages = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      role: "user",
      parts: [{ type: "text", text: "x".repeat(20_000) }],
    }));
    const res = await handleChatRequest(req({ messages: largeMessages }, KEY));
    expect(res.status).toBe(400);
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
    expect(calls[0]).toMatchObject({
      apiKey: "secret-k",
      baseURL: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-20b",
      fetch: expect.any(Function),
    });
  });

  it("stays single-agent unless DOOT_MULTI_AGENT is exactly 'true'", async () => {
    await (
      await handleChatRequest(req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "1" }))
    ).text();
    expect(state.generateCalls).toBe(0);
  });

  it("when enabled runs both specialists then synthesizes with their notes", async () => {
    const res = await handleChatRequest(
      req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }),
    );
    expect(await res.text()).toContain("হ্যালো");
    expect(state.generateCalls).toBe(2);
    expect(state.generatePrompts).toHaveLength(2);
    expect(state.generatePrompts[1]).toContain("SPECIALIST problem-solver — FULFILLED");
    expect(state.generatePrompts[1]).toContain("SOLVER-NOTE");
    expect(state.streamSystems).toHaveLength(1);
    expect(state.streamSystems[0]).toContain("SOLVER-NOTE");
    expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");
  });

  it("runs quality review with explicit failure evidence when a specialist fails", async () => {
    state.failProblemSolver = true;

    const res = await handleChatRequest(
      req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }),
    );

    expect(res.status).toBe(200);
    await res.text();
    expect(state.generateCalls).toBe(3);
    expect(state.generatePrompts[2]).toContain("SPECIALIST problem-solver — REJECTED");
    expect(state.generatePrompts[2]).toContain("boom");
    expect(state.streamSystems[0]).toContain("REVIEWER-NOTE");
  });

  it("uses the configured GROQ_MODEL for default chat and all multi-agent calls", async () => {
    const res = await handleChatRequest(
      req(
        { messages: msgs },
        { ...KEY, GROQ_MODEL: "llama-3.3-70b-versatile", DOOT_MULTI_AGENT: "true" },
      ),
    );
    expect(res.status).toBe(200);
    await res.text();
    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.model)).toEqual([
      "llama-3.3-70b-versatile",
      "llama-3.3-70b-versatile",
      "llama-3.3-70b-versatile",
    ]);
  });

  it("falls back to normal Liza when both specialists fail", async () => {
    state.failSpecialists = true;
    const res = await handleChatRequest(
      req({ messages: msgs }, { ...KEY, DOOT_MULTI_AGENT: "true" }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("হ্যালো");
    expect(state.streamSystems[0]).not.toContain("specialist notes");
  });

  it("registry holds Liza and the registered real specialists; default is Liza", () => {
    expect(listAgents().map((a) => a.id)).toEqual([
      "liza-default",
      "research",
      "web-intelligence",
      "coding",
      "debugging",
      "data-analyst",
      "business-analyst",
      "linkedin",
      "social-media",
      "instagram",
      "facebook",
      "youtube",
      "x-platform",
      "tiktok",
      "content-writer",
      "content-reviewer",
      "seo",
      "problem-solver",
      "quality-reviewer",
      "marketing-strategist",
      "security-reviewer",
      "automation",
      "reporting",
    ]);
    expect(getSpecialist("marketing-strategist").name).toBe("Marketing Strategist");
    expect(getSpecialist("marketing-strategist").generate).toBeTypeOf("function");
    expect(getSpecialist("quality-reviewer").name).toBe("Quality Reviewer");
    expect(getSpecialist("quality-reviewer").description).toContain("accuracy");
    expect(getSpecialist("quality-reviewer").generate).toBeTypeOf("function");
    expect(getSpecialist("security-reviewer").name).toBe("Security Reviewer");
    expect(getSpecialist("security-reviewer").description).toContain("security");
    expect(getSpecialist("security-reviewer").generate).toBeTypeOf("function");
    expect(getSpecialist("automation").name).toBe("Automation Agent");
    expect(getSpecialist("automation").description).toContain("workflows");
    expect(getSpecialist("automation").generate).toBeTypeOf("function");
    expect(getSpecialist("reporting").name).toBe("Reporting Agent");
    expect(getSpecialist("reporting").description).toContain("reports");
    expect(getSpecialist("reporting").generate).toBeTypeOf("function");
    const agents = listAgents();
    const ids = agents.map((agent) => agent.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      agents
        .filter((agent) => agent.role === "specialist")
        .every((agent) => typeof agent.generate === "function"),
    ).toBe(true);
    expect(
      agents.every((agent) => agent.role !== "specialist" || Boolean(agent.description.trim())),
    ).toBe(true);
    expect(getAgent(undefined).id).toBe(DEFAULT_AGENT_ID);
    expect(getAgent("problem-solver").id).toBe(DEFAULT_AGENT_ID);
  });

  it("rejects duplicate IDs and agents without capability metadata", () => {
    const valid = listAgents();
    const first = valid[0];

    if (!first) {
      throw new Error("Expected at least one registered agent");
    }

    expect(() => validateAgentRegistry(valid)).not.toThrow();
    expect(() => validateAgentRegistry([...valid, first])).toThrow(/duplicate agent id/);
    expect(() => validateAgentRegistry([{ ...first, capabilities: [] }])).toThrow(
      /no capabilities/,
    );
  });

  it("rejects malformed registry metadata and missing execution handlers", () => {
    const agents = listAgents();
    const first = agents[0];
    if (!first) throw new Error("Expected at least one registered agent");

    const invalid = (patch: Partial<typeof first>) => ({ ...first, ...patch });

    expect(() => validateAgentRegistry([invalid({ permissions: [] })])).toThrow(/no permissions/);
    expect(() =>
      validateAgentRegistry([
        invalid({ permissions: ["shell:execute"] as unknown as typeof first.permissions }),
      ]),
    ).toThrow(/unsupported permission/);
    expect(() =>
      validateAgentRegistry([
        invalid({
          capabilities: ["unknown-capability"] as unknown as typeof first.capabilities,
        }),
      ]),
    ).toThrow(/unsupported capability/);
    expect(() =>
      validateAgentRegistry([
        invalid({ capabilities: [first.capabilities[0]!, first.capabilities[0]!] }),
      ]),
    ).toThrow(/duplicate capability/);
    expect(() =>
      validateAgentRegistry([invalid({ permissions: ["llm:inference", "llm:inference"] })]),
    ).toThrow(/duplicate permission/);
    expect(() =>
      validateAgentRegistry([invalid({ role: "unknown" as typeof first.role })]),
    ).toThrow(/invalid role/);
    expect(() => validateAgentRegistry([invalid({ id: " padded-id " })])).toThrow(
      /invalid or duplicate agent id/i,
    );

    const specialist = agents.find((agent) => agent.role === "specialist");
    if (!specialist) throw new Error("Expected a registered specialist");
    const { generate: _generate, ...withoutGenerator } = specialist;
    expect(() =>
      validateAgentRegistry([
        ...agents.filter((agent) => agent.id !== specialist.id),
        withoutGenerator,
      ]),
    ).toThrow(/no generator/);

    const chat = agents.find((agent) => agent.role === "chat");
    if (!chat) throw new Error("Expected a registered chat agent");
    const { run: _run, ...withoutRunner } = chat;
    expect(() =>
      validateAgentRegistry([...agents.filter((agent) => agent.id !== chat.id), withoutRunner]),
    ).toThrow(/no runner/);
  });

  it("validates every registered specialist capability", async () => {
    const specialists = listAgents().filter((agent) => agent.role === "specialist");
    expect(specialists.length).toBe(22);
    expect(specialists.every((agent) => agent.capabilities.length > 0)).toBe(true);
    expect(specialists.every((agent) => agent.permissions.includes("llm:inference"))).toBe(true);
    expect(specialists.find((agent) => agent.id === "research")?.permissions).toContain("research:search");
    expect(specialists.find((agent) => agent.id === "web-intelligence")?.permissions).toContain("research:extract");
    expect(specialists.find((agent) => agent.id === "coding")?.permissions).toContain("coding:validate-command");
    expect(specialists.find((agent) => agent.id === "data-analyst")?.permissions).toEqual(["llm:inference"]);

    const results = await Promise.all(
      specialists.map((agent) => {
        if (!agent.generate) throw new Error(`Missing generator: ${agent.id}`);
        return agent.generate({
          apiKey: "test-key",
          messages: [{ role: "user", content: "Run a specialist capability smoke test." }],
          signal: new AbortController().signal,
        });
      }),
    );

    expect(results).toHaveLength(specialists.length);
    expect(results.every((result) => typeof result === "string" && result.length > 0)).toBe(true);
  });

  it("propagates specialist provider failures without fabricating results", async () => {
    state.failSpecialists = true;
    const specialists = listAgents().filter((agent) => agent.role === "specialist");

    const results = await Promise.allSettled(
      specialists.map((agent) => {
        if (!agent.generate) throw new Error(`Missing generator: ${agent.id}`);
        return agent.generate({
          apiKey: "test-key",
          messages: [],
          signal: new AbortController().signal,
        });
      }),
    );

    expect(results).toHaveLength(specialists.length);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
  });

  it("rejects empty messages and malformed message structures", async () => {
    expect((await handleChatRequest(req({ messages: [] }, KEY))).status).toBe(400);
    expect(
      (await handleChatRequest(req({ messages: [{ id: "1", role: "user", parts: "bad" }] }, KEY)))
        .status,
    ).toBe(400);
    expect(
      (await handleChatRequest(req({ messages: [{ id: "1", role: "system", parts: [] }] }, KEY)))
        .status,
    ).toBe(400);
    expect(
      (
        await handleChatRequest(
          req({ messages: [{ id: "1", role: "user", parts: [{ type: "text" }] }] }, KEY),
        )
      ).status,
    ).toBe(400);
  });

  it("rejects oversized message batches", async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      id: String(i),
      role: "user",
      parts: [{ type: "text", text: "hi" }],
    }));
    expect((await handleChatRequest(req({ messages: tooMany }, KEY))).status).toBe(400);
  });

  it("rejects request bodies larger than 1 MiB", async () => {
    const oversized = JSON.stringify({
      messages: msgs,
      padding: "x".repeat(1_048_576),
    });
    const res = await handleChatRequest(req(oversized, KEY));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Request body too large" });
  });

  it("returns a safe error for malformed JSON without exposing internals", async () => {
    const res = await handleChatRequest(req("{", KEY));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });

  it("supplies Tavily research evidence to routed specialists", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Research integration source",
              url: "https://example.com/research-integration",
              content: "A bounded research evidence snippet.",
              raw_content: "Full untrusted research evidence for integration testing.",
              published_date: "2026-11-01",
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const messages = [
        {
          id: "research-integration-1",
          role: "user" as const,
          parts: [
            {
              type: "text" as const,
              text: "Research the latest market trends and cite sources",
            },
          ],
        },
      ];
      const res = await handleChatRequest(
        req({ messages }, { ...KEY, DOOT_MULTI_AGENT: "true", TAVILY_API_KEY: "test-server-key" }),
      );

      expect(res.status).toBe(200);
      await res.text();
      expect(
        state.generatePrompts.some((prompt) => prompt.includes("Research integration source")),
      ).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("discloses Tavily failures without exposing provider error bodies", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("private provider error", { status: 401 })) as typeof fetch;

    try {
      const messages = [
        {
          id: "research-failure-1",
          role: "user" as const,
          parts: [
            {
              type: "text" as const,
              text: "Research the latest market trends and cite sources",
            },
          ],
        },
      ];
      const res = await handleChatRequest(
        req({ messages }, { ...KEY, DOOT_MULTI_AGENT: "true", TAVILY_API_KEY: "test-server-key" }),
      );

      expect(res.status).toBe(200);
      await res.text();
      expect(
        state.generatePrompts.some((prompt) => prompt.includes("LIVE WEB SEARCH FAILED")),
      ).toBe(true);
      expect(
        state.generatePrompts.some((prompt) => prompt.includes("private provider error")),
      ).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
