import { createFileRoute } from "@tanstack/react-router";
import { getAgentEnv } from "@/lib/agents/orchestrator";
import { handleTaskExecutionRequest, type TaskExecutionEnv } from "@/lib/agents/task-execution-api";

function getExecutionEnv(request: Request): TaskExecutionEnv {
  const runtimeEnv = (request as Request & { runtime?: { cloudflare?: { env?: TaskExecutionEnv } } })
    .runtime?.cloudflare?.env;
  return { ...getAgentEnv(request), ...(runtimeEnv?.ACTION_DB ? { ACTION_DB: runtimeEnv.ACTION_DB } : {}) };
}

export const Route = createFileRoute("/api/tasks/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => handleTaskExecutionRequest(request, getExecutionEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
