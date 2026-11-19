import { createFileRoute } from "@tanstack/react-router";
import { handleTelegramWebhookRequest, type TelegramApiEnv } from "@/lib/agents/telegram-api";

function getTelegramEnv(request: Request): TelegramApiEnv {
  return (request as Request & { runtime?: { cloudflare?: { env?: TelegramApiEnv } } })
    .runtime?.cloudflare?.env ?? {};
}

export const Route = createFileRoute("/api/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleTelegramWebhookRequest(request, getTelegramEnv(request)),
      HEAD: async () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
