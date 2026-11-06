import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

import type { AgentDefinition } from "./types";

// Unchanged from the original /api/chat behavior.
const SYSTEM =
  "You are Doot, a friendly helpful assistant. Reply in the same language the user writes in (Bangla if they write Bangla). Use markdown when helpful.";

export const lizaDefaultAgent: AgentDefinition = {
  id: "liza-default",
  name: "Liza",
  description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",
  run: async ({ messages, env, signal }) => {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured on the server" },
        { status: 500 },
      );
    }

    const provider = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey,
    });

    const result = streamText({
      model: provider.responses("openai/gpt-oss-20b"),
      instructions: SYSTEM,
      messages: await convertToModelMessages(messages),
      abortSignal: signal,
    });

    return result.toUIMessageStreamResponse({ originalMessages: messages });
  },
};
