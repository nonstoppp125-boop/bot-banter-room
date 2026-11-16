import { createFileRoute } from "@tanstack/react-router";
import { handleCloudflareAccessSessionRequest, type CloudflareAccessAuthEnv } from "@/lib/agents/cloudflare-access-auth";

function getAuthEnv(request: Request): CloudflareAccessAuthEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: CloudflareAccessAuthEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => handleCloudflareAccessSessionRequest(request, getAuthEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
