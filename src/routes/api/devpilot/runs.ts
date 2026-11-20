import { createFileRoute } from "@tanstack/react-router";
import { handleDevPilotRunRequest, type DevPilotApiEnv } from "@/lib/agents/devpilot-api";

function getDevPilotEnv(request: Request): DevPilotApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: DevPilotApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/devpilot/runs")({
  server: {
    handlers: {
      GET: async ({ request }) => handleDevPilotRunRequest(request, getDevPilotEnv(request)),
      POST: async ({ request }) => handleDevPilotRunRequest(request, getDevPilotEnv(request)),
      HEAD: async ({ request }) => handleDevPilotRunRequest(request, getDevPilotEnv(request)),
    },
  },
});
