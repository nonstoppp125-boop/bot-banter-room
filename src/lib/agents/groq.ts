import { createOpenAI } from "@ai-sdk/openai";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

/** The single Groq provider; model selection may be overridden by trusted Worker config. */
export function groqModel(apiKey: string, model = DEFAULT_GROQ_MODEL) {
  return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(model);
}
