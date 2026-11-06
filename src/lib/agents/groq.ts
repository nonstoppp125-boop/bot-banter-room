import { createOpenAI } from "@ai-sdk/openai";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MODEL = "openai/gpt-oss-20b";

/** The single Groq model every agent uses (same provider/model as the original chat). */
export function groqModel(apiKey: string) {
  return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);
}
