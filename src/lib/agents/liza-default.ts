import { convertToModelMessages, streamText } from "ai";

import { groqModel } from "./groq";
import { buildLizaSystem } from "./liza-prompt";
import type { AgentDefinition } from "./types";

export const lizaDefaultAgent: AgentDefinition = {
  id: "liza-default",
  name: "Liza",
  description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",
  role: "chat",
  run: async ({ messages, env, signal, systemInstruction }) => {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured on the server" },
        { status: 500 },
      );
    }

    const result = streamText({
      model: groqModel(apiKey),
      instructions: systemInstruction ?? buildLizaSystem(messages),
      messages: await convertToModelMessages(messages),
      abortSignal: signal,
    });

    return result.toUIMessageStreamResponse({ originalMessages: messages });
  },
};
