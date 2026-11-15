import { convertToModelMessages, streamText } from "ai";

import { groqModel } from "./groq";
import { PROVIDER_REQUEST_OPTIONS } from "./request-policy";
import { buildLizaSystem } from "./liza-prompt";
export { LIZA_SYSTEM } from "./liza-prompt";
import type { AgentDefinition } from "./types";

export const lizaDefaultAgent: AgentDefinition = {
  id: "liza-default",
  name: "Liza",
  description: "Current Liza chat assistant (Groq, openai/gpt-oss-20b).",
  role: "chat",
  capabilities: ["chat"],
  permissions: ["llm:inference"],
  run: async ({ messages, env, signal }) => {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured on the server" },
        { status: 500 },
      );
    }

    const result = streamText({
      ...PROVIDER_REQUEST_OPTIONS,
      model: groqModel(apiKey, env.GROQ_MODEL?.trim() || undefined),
      instructions: buildLizaSystem(messages),
      messages: await convertToModelMessages(messages),
      abortSignal: signal,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: () => "Unable to process chat request",
    });
  },
};
