import { createFileRoute } from "@tanstack/react-router";
import { handleOAuthCallbackRequest, type OAuthCallbackEnv } from "@/lib/agents/oauth-callback-api";

function getOAuthCallbackEnv(request: Request): OAuthCallbackEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: OAuthCallbackEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/integrations/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOAuthCallbackRequest(request, getOAuthCallbackEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
