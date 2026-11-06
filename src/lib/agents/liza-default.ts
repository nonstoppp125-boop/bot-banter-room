import { convertToModelMessages, streamText } from "ai";

import { groqModel } from "./groq";
import type { AgentDefinition } from "./types";

// Unchanged from the original /api/chat behavior.
export const LIZA_SYSTEM =
  "You are Doot, a friendly helpful assistant. Reply in the same language the user writes in (Bangla if they write Bangla). Use markdown when helpful.";

export const lizaDefaultAgent: AgentDefinition = {
  id: "liza-default",
  name: "Liza",
  description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",
  role: "chat",
  run: async ({ messages, env, signal }) => {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured on the server" },
        { status: 500 },
      );
    }

    const result = streamText({
      model: groqModel(apiKey),
      instructions: LIZA_SYSTEM,
      messages: await convertToModelMessages(messages),
      abortSignal: signal,
    });

    return result.toUIMessageStreamResponse({ originalMessages: messages });
  },
};
