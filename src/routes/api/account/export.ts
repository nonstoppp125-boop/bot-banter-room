import { createFileRoute } from "@tanstack/react-router";
import { handleDataExportRequest, type DataExportApiEnv } from "@/lib/agents/data-export-api";

function getExportEnv(request: Request): DataExportApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: DataExportApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/account/export")({
  server: {
    handlers: {
      GET: async ({ request }) => handleDataExportRequest(request, getExportEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
