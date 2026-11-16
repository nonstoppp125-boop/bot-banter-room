import { createFileRoute } from "@tanstack/react-router";
import { handleTaskRequest, type TaskApiEnv } from "@/lib/agents/task-api";

function getTaskEnv(request: Request): TaskApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: TaskApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => handleTaskRequest(request, getTaskEnv(request)),
      POST: async ({ request }) => handleTaskRequest(request, getTaskEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
