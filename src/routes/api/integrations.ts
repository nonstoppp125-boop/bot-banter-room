import { createFileRoute } from "@tanstack/react-router";
import { handleIntegrationListRequest, type IntegrationListEnv } from "@/lib/agents/integration-list-api";

function getIntegrationListEnv(request: Request): IntegrationListEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: IntegrationListEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/integrations")({
  server: {
    handlers: {
      GET: async ({ request }) => handleIntegrationListRequest(request, getIntegrationListEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
