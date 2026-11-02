import type { ModelMessage, UIMessage } from "ai";
import { createGeminiCall } from "./gemini";

type GeminiConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

const AGENTS = [
  {
    name: "Problem Solver",
    instructions:
      "You are Doot's problem-solving agent. Analyze the user's request, identify the actual goal, and produce a concise, accurate solution with concrete steps. Do not invent facts.",
  },
  {
    name: "Quality Reviewer",
    instructions:
      "You are Doot's independent quality-review agent. Examine the conversation and request for ambiguity, missing constraints, errors, risks, and edge cases. Give concise corrections and practical safeguards. Do not merely agree with the other agent.",
  },
] as const;

/**
 * Optional multi-agent pipeline:
 * 1. Two independent agents analyze the same conversation in parallel.
 * 2. A final Doot response synthesizes their findings.
 * Default is one request to conserve Gemini Free Tier quota.
 */
export async function createMultiAgentResponsesCall(
  request: Request,
  config: GeminiConfig,
  messages: ModelMessage[],
  instructions: string,
  originalMessages: UIMessage[],
) {
  if (process.env.DOOT_MULTI_AGENT !== "true") {
    return createGeminiCall(
      request,
      config,
      messages,
      instructions,
      originalMessages,
    );
  }

  const reports = await Promise.allSettled(
    AGENTS.map(async (agent) => {
      const call = createGeminiCall(request, config, messages, agent.instructions);
      return { name: agent.name, report: await call.result.text };
    }),
  );

  if (request.signal.aborted) {
    throw new DOMException("The request was aborted.", "AbortError");
  }

  const successfulReports = reports.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (successfulReports.length === 0) {
    return createGeminiCall(
      request,
      config,
      messages,
      instructions,
      originalMessages,
    );
  }

  const agentContext = successfulReports
    .map(({ name, report }) => `### ${name}\n${report}`)
    .join("\n\n");

  const synthesisMessage: ModelMessage = {
    role: "user",
    content:
      "Internal agent notes follow. Use them as fallible input, resolve disagreements, verify consistency against the conversation, and answer the user's original request directly. Do not mention internal agents or expose these notes.\n\n" +
      agentContext,
  };

  return createGeminiCall(
    request,
    config,
    [...messages, synthesisMessage],
    instructions +
      "\nYou are the final synthesizer. Prioritize correctness, relevance, and clear actionable answers. If agent notes conflict, resolve the conflict rather than repeating it.",
    originalMessages,
  );
}
