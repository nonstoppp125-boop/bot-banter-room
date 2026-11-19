import { createFileRoute } from "@tanstack/react-router";
import { handleApprovalRequest, type ApprovalApiEnv } from "@/lib/agents/approval-api";

function getApprovalEnv(request: Request): ApprovalApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: ApprovalApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/approvals")({
  server: {
    handlers: {
      GET: async ({ request }) => handleApprovalRequest(request, getApprovalEnv(request)),
      POST: async ({ request }) => handleApprovalRequest(request, getApprovalEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
