import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { createMultiAgentResponsesCall } from "@/lib/ai/orchestrator";

const SYSTEM =
  "You are Doot, a friendly helpful assistant. Reply in the same language the user writes in (Bangla if they write Bangla). Use markdown when helpful.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "AI is not configured. Set the server-side GEMINI_API_KEY secret." },
            { status: 503 },
          );
        }

        let messages: UIMessage[];
        try {
          const body = await request.json();
          messages = body?.messages;
          if (!Array.isArray(messages)) throw new Error("messages must be an array");
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        try {
          const modelMessages = await convertToModelMessages(messages);
          return await (
            await createMultiAgentResponsesCall(
              request,
              {
                baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
                apiKey,
                model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
              },
              modelMessages,
              SYSTEM,
              messages,
            )
          ).response();
        } catch (error) {
          if (request.signal.aborted) {
            return new Response(null, { status: 499 });
          }
          // Keep provider details and secrets out of the client response.
          console.error("Doot Gemini request failed", error);
          return Response.json(
            { error: "The AI service is temporarily unavailable. Check the server logs and Gemini quota." },
            { status: 502 },
          );
        }
      },
    },
  },
});
