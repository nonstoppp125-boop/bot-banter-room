import { createFileRoute } from "@tanstack/react-router";
import { handleSessionLogout, type PasswordAuthEnv } from "@/lib/agents/password-auth";
function getEnv(request: Request): PasswordAuthEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: PasswordAuthEnv } } }).runtime?.cloudflare?.env ?? {};
}
export const Route = createFileRoute("/api/auth/logout")({
  server: { handlers: { POST: async ({ request }) => handleSessionLogout(request, getEnv(request)) } },
});
