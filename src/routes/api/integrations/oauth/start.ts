import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthStartRequest, type OAuthApiEnv } from "@/lib/agents/oauth-api";

function getOAuthEnv(request: Request): OAuthApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: OAuthApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/integrations/oauth/start")({
  server: {
    handlers: {
      POST: async ({ request }) => handleOAuthStartRequest(request, getOAuthEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
