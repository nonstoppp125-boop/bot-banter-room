import { createFileRoute } from "@tanstack/react-router";
import { handlePasswordLogin, type PasswordAuthEnv } from "@/lib/agents/password-auth";
function getEnv(request: Request): PasswordAuthEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: PasswordAuthEnv } } }).runtime?.cloudflare?.env ?? {};
}
export const Route = createFileRoute("/api/auth/login")({
  server: { handlers: { POST: async ({ request }) => handlePasswordLogin(request, getEnv(request)) } },
});
