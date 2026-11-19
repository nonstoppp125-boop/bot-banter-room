import { createFileRoute } from "@tanstack/react-router";
import { createPublicHealthResponse } from "@/lib/agents/operations";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => createPublicHealthResponse(),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
