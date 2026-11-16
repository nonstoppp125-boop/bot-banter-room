import { createFileRoute } from "@tanstack/react-router";
import { handleAccountDeletionRequest, type AccountDeletionApiEnv } from "@/lib/agents/account-deletion-api";

function getDeletionEnv(request: Request): AccountDeletionApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: AccountDeletionApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/account/deletion")({
  server: {
    handlers: {
      GET: async ({ request }) => handleAccountDeletionRequest(request, getDeletionEnv(request)),
      POST: async ({ request }) => handleAccountDeletionRequest(request, getDeletionEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
