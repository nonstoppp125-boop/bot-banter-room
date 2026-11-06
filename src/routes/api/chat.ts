import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM =
  "You are Doot, a friendly helpful assistant. Reply in the same language the user writes in (Bangla if they write Bangla). Use markdown when helpful.";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Nitro's cloudflare-module preset attaches the Worker env bindings to the
        // incoming Request as request.runtime.cloudflare.env (documented Nitro API).
        const apiKey = (
          request as Request & {
            runtime?: { cloudflare?: { env?: { GROQ_API_KEY?: string } } };
          }
        ).runtime?.cloudflare?.env?.GROQ_API_KEY;

        if (!apiKey) {
          return Response.json(
            { error: "GROQ_API_KEY is not configured on the server" },
            { status: 500 },
          );
        }

        let messages: UIMessage[];
        try {
          const body = await request.json();
          messages = body?.messages;
          if (!Array.isArray(messages)) throw new Error("Invalid messages");
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const provider = createOpenAI({
          baseURL: "https://api.groq.com/openai/v1",
          apiKey,
        });

        const result = streamText({
          model: provider.responses("openai/gpt-oss-20b"),
          instructions: SYSTEM,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
