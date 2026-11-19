import { createFileRoute } from "@tanstack/react-router";
import { handleAnalyticsRequest, type AnalyticsApiEnv } from "@/lib/agents/analytics-api";

function getAnalyticsEnv(request: Request): AnalyticsApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: AnalyticsApiEnv } } }).runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/analytics")({
  server: { handlers: {
    GET: async ({ request }) => handleAnalyticsRequest(request, getAnalyticsEnv(request)),
    POST: async ({ request }) => handleAnalyticsRequest(request, getAnalyticsEnv(request)),
    DELETE: async ({ request }) => handleAnalyticsRequest(request, getAnalyticsEnv(request)),
    HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
  } },
});
