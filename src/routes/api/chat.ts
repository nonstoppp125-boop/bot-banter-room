import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { createMultiAgentResponsesCall } from "@/lib/ai/orchestrator";

const SYSTEM =
  "You are Doot, a friendly helpful assistant. Reply in the same language the user writes in (Bangla if they write Bangla). Use markdown when helpful.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return Response.json({ error: "AI is not configured" }, { status: 500 });
        let messages: UIMessage[];
        try {
          const body = await request.json();
          messages = body?.messages;
          if (!Array.isArray(messages)) throw new Error();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const modelMessages = await convertToModelMessages(messages);
        return createMultiAgentResponsesCall(
          request,
          { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
          modelMessages,
          SYSTEM,
          messages,
        ).response();
      },
    },
  },
});
