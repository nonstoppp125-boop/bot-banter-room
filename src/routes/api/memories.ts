import { createFileRoute } from "@tanstack/react-router";
import { handleMemoryRequest, type MemoryApiEnv } from "@/lib/agents/memory-api";

function getMemoryEnv(request: Request): MemoryApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: MemoryApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/memories")({
  server: {
    handlers: {
      GET: async ({ request }) => handleMemoryRequest(request, getMemoryEnv(request)),
      POST: async ({ request }) => handleMemoryRequest(request, getMemoryEnv(request)),
      PATCH: async ({ request }) => handleMemoryRequest(request, getMemoryEnv(request)),
      DELETE: async ({ request }) => handleMemoryRequest(request, getMemoryEnv(request)),
      HEAD: async ({ request }) => {
        const response = await handleMemoryRequest(
          new Request(request.url, { method: "GET", headers: request.headers }),
          getMemoryEnv(request),
        );
        return new Response(null, { status: response.status, headers: response.headers });
      },
    },
  },
});
