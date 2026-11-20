import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentEnv } from "@/lib/agents/types";

vi.mock("@/lib/agents/task-queue-worker", () => ({
  processD1TaskQueue: vi.fn(),
}));
vi.mock("@/lib/agents/devpilot-engine", () => ({
  processDevPilotQueue: vi.fn(),
}));

import { processD1TaskQueue } from "@/lib/agents/task-queue-worker";
import { processDevPilotQueue } from "@/lib/agents/devpilot-engine";
import worker from "@/server";

const event = { scheduledTime: Date.parse("2026-11-19T16:00:00.000Z"), cron: "* * * * *" };
function fakeDatabase() {
  return { prepare() { return { bind() { return { async run() { return { success: true, meta: { changes: 0 } }; } }; } }; } };
}
const context = { waitUntil: vi.fn() };

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Cloudflare scheduled Group 06 task queue handler", () => {
  it("invokes the D1 queue processor when ACTION_DB is configured", async () => {
    vi.mocked(processD1TaskQueue).mockResolvedValueOnce({ recovered: 0, claimed: false });
    const env = { ACTION_DB: fakeDatabase() as never, GROQ_API_KEY: "test-key" } as AgentEnv;
    await worker.scheduled(event, env, context);
    expect(processD1TaskQueue).toHaveBeenCalledOnce();
    expect(processD1TaskQueue).toHaveBeenCalledWith(env);
  });

  it("fails closed for DevPilot execution when the required rate limiter is missing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(processD1TaskQueue).mockResolvedValueOnce({ recovered: 0, claimed: false });
    const env = {
      ACTION_DB: fakeDatabase() as never,
      DEVPILOT_ENABLED: "true",
      GITHUB_TOKEN: "test-token",
      GROQ_API_KEY: "test-key",
      GITHUB_REPOSITORY_ALLOWLIST: "nonstoppp125-boop/bot-banter-room",
    } as AgentEnv;
    await worker.scheduled(event, env, context);
    expect(processD1TaskQueue).toHaveBeenCalledOnce();
    expect(processDevPilotQueue).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("rate limiter is missing"));
  });

  it("consumes a scheduled rate-limit token before processing the DevPilot queue", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    vi.mocked(processD1TaskQueue).mockResolvedValueOnce({ recovered: 0, claimed: false });
    vi.mocked(processDevPilotQueue).mockResolvedValueOnce(null);
    const env = {
      ACTION_DB: fakeDatabase() as never,
      DEVPILOT_ENABLED: "true",
      GITHUB_TOKEN: "test-token",
      GROQ_API_KEY: "test-key",
      GITHUB_REPOSITORY_ALLOWLIST: "nonstoppp125-boop/bot-banter-room",
      CHAT_RATE_LIMITER: limiter,
    } as AgentEnv;
    await worker.scheduled(event, env, context);
    expect(limiter.limit).toHaveBeenCalledWith({
      key: "devpilot:scheduled:nonstoppp125-boop/bot-banter-room",
    });
    expect(processDevPilotQueue).toHaveBeenCalledOnce();
  });

  it("fails closed when the scheduled rate limiter rejects the DevPilot tick", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(processD1TaskQueue).mockResolvedValueOnce({ recovered: 0, claimed: false });
    const env = {
      ACTION_DB: fakeDatabase() as never,
      DEVPILOT_ENABLED: "true",
      GITHUB_TOKEN: "test-token",
      GROQ_API_KEY: "test-key",
      GITHUB_REPOSITORY_ALLOWLIST: "nonstoppp125-boop/bot-banter-room",
      CHAT_RATE_LIMITER: limiter,
    } as AgentEnv;
    await worker.scheduled(event, env, context);
    expect(limiter.limit).toHaveBeenCalledOnce();
    expect(processDevPilotQueue).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("rate limit reached"));
  });

  it("fails closed and skips queue processing when ACTION_DB is missing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await worker.scheduled(event, {} as AgentEnv, context);
    expect(processD1TaskQueue).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("D1 task queue skipped: ACTION_DB is not configured.");
  });

  it("contains queue invocation failures so one cron tick does not leak an unhandled rejection", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(processD1TaskQueue).mockRejectedValueOnce(new Error("database unavailable"));
    const env = { ACTION_DB: fakeDatabase() as never, GROQ_API_KEY: "test-key" } as AgentEnv;
    await expect(worker.scheduled(event, env, context)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("D1 task queue invocation failed.", expect.any(Error));
  });
});
