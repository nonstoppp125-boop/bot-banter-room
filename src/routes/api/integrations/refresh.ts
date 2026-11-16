import { createFileRoute } from "@tanstack/react-router";
import { handleConnectionRefreshRequest, type ConnectionRefreshEnv } from "@/lib/agents/connection-refresh-api";

function getRefreshEnv(request: Request): ConnectionRefreshEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: ConnectionRefreshEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/integrations/refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => handleConnectionRefreshRequest(request, getRefreshEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
