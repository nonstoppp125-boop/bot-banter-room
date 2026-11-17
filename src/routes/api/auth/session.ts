import { createFileRoute } from "@tanstack/react-router";
import { handleSessionStatus, type PasswordAuthEnv } from "@/lib/agents/password-auth";
function getEnv(request: Request): PasswordAuthEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: PasswordAuthEnv } } }).runtime?.cloudflare?.env ?? {};
}
export const Route = createFileRoute("/api/auth/session")({
  server: { handlers: { GET: async ({ request }) => handleSessionStatus(request, getEnv(request)) } },
});
