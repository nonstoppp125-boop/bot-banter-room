import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { processD1TaskQueue } from "./lib/agents/task-queue-worker";
import { createDevPilotApprovalStore } from "./lib/agents/devpilot-approval-store";
import { createDevPilotRunStore } from "./lib/agents/devpilot-run-store";
import { processDevPilotQueue } from "./lib/agents/devpilot-engine";
import { createGitHubDevPilotAdapter } from "./lib/agents/github-devpilot-adapter";
import { createGroqDevPilotProposalGenerator } from "./lib/agents/groq-devpilot-proposer";
import type { AgentEnv } from "./lib/agents/types";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async scheduled(_event: { scheduledTime: number; cron: string }, env: AgentEnv, _ctx: { waitUntil(promise: Promise<unknown>): void }) {
    if (!env.ACTION_DB) {
      console.error("D1 task queue skipped: ACTION_DB is not configured.");
      return;
    }
    const now = new Date().toISOString();
    await createDevPilotRunStore(env.ACTION_DB).recoverExpired({ now }).catch((error) => {
      console.error("DevPilot expired-run recovery failed.", error);
    });
    await createDevPilotApprovalStore(env.ACTION_DB).expirePending({ now }).catch((error) => {
      console.error("DevPilot approval expiry cleanup failed.", error);
    });
    await processD1TaskQueue(env).catch((error) => {
      console.error("D1 task queue invocation failed.", error);
    });
    if (env.DEVPILOT_ENABLED === "true") {
      const allowedRepositories = new Set((env.GITHUB_REPOSITORY_ALLOWLIST ?? "")
        .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
      if (!env.GITHUB_TOKEN || !env.GROQ_API_KEY || !env.CHAT_RATE_LIMITER ||
        !allowedRepositories.has("nonstoppp125-boop/bot-banter-room")) {
        console.error("DevPilot queue is enabled but its repository allowlist, GitHub token, Groq key or rate limiter is missing; execution skipped.");
      } else {
        const scheduledRate = await env.CHAT_RATE_LIMITER.limit({
          key: "devpilot:scheduled:nonstoppp125-boop/bot-banter-room",
        }).catch((error) => {
          console.error("DevPilot scheduled rate-limit check failed; execution skipped.", error);
          return { success: false };
        });
        if (!scheduledRate.success) {
          console.warn("DevPilot scheduled rate limit reached or unavailable; queue remains untouched.");
        } else {
          await processDevPilotQueue({
            database: env.ACTION_DB,
            repository: "nonstoppp125-boop/bot-banter-room",
            owner: "devpilot-worker-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12),
            createAdapter: ({ repository, targetBranch }) =>
              createGitHubDevPilotAdapter(env, repository, targetBranch),
            proposeChanges: createGroqDevPilotProposalGenerator(env),
            now: () => new Date(),
          }).then((result) => {
            if (result) console.info("DevPilot queue task finished.", { status: result.status, progress: result.progress });
          }).catch((error) => {
            console.error("DevPilot queue invocation failed.", error);
          });
        }
      }
    }
  },
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
