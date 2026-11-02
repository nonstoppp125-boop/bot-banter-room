import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage, type UIMessage } from "ai";

type GeminiConfig = { baseURL: string; apiKey: string; model: string };

/** Gemini's OpenAI-compatible Chat Completions endpoint; API key stays server-side. */
export function createGeminiCall(
  request: Request,
  config: GeminiConfig,
  messages: ModelMessage[],
  instructions?: string,
  originalMessages?: UIMessage[],
) {
  const provider = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
  const result = streamText({
    model: provider.chat(config.model),
    ...(instructions ? { system: instructions } : {}),
    messages,
    abortSignal: request.signal,
  });
  return {
    result,
    response: () =>
      result.toUIMessageStreamResponse({
        ...(originalMessages ? { originalMessages } : {}),
      }),
  };
}
