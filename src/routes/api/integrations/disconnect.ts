import { createFileRoute } from "@tanstack/react-router";
import { handleIntegrationDisconnectRequest, type DisconnectApiEnv } from "@/lib/agents/integration-disconnect-api";

function getDisconnectEnv(request: Request): DisconnectApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: DisconnectApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/integrations/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => handleIntegrationDisconnectRequest(request, getDisconnectEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
