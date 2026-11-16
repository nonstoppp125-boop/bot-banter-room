import { createFileRoute } from "@tanstack/react-router";
import { handleSessionLogoutRequest, type CloudflareAccessAuthEnv } from "@/lib/agents/cloudflare-access-auth";

function getAuthEnv(request: Request): CloudflareAccessAuthEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: CloudflareAccessAuthEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSessionLogoutRequest(request, getAuthEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
