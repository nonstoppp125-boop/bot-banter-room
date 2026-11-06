import { createFileRoute } from "@tanstack/react-router";

import { handleChatRequest } from "@/lib/agents/orchestrator";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => handleChatRequest(request),
    },
  },
});
