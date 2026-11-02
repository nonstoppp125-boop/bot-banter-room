import type { ModelMessage, UIMessage } from "ai";
import { createResponsesCall } from "./responses";

type GatewayConfig = {
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
 * Base multi-agent pipeline:
 * 1. Two independent agents analyze the same conversation in parallel.
 * 2. A final Doot response synthesizes their findings.
 * The final answer remains streamed to the existing chat UI.
 */
export async function createMultiAgentResponsesCall(
  request: Request,
  config: GatewayConfig,
  messages: ModelMessage[],
  instructions: string,
  originalMessages: UIMessage[],
) {
  // Keep the free-tier-friendly path to one model request by default.
  // Enable the higher-cost parallel agent workflow only when explicitly configured.
  if (process.env.DOOT_MULTI_AGENT !== "true") {
    return createResponsesCall(
      request,
      config,
      messages,
      instructions,
      originalMessages,
    );
  }

  const reports = await Promise.allSettled(
    AGENTS.map(async (agent) => {
      const call = createResponsesCall(
        request,
        config,
        messages,
        agent.instructions,
      );
      return { name: agent.name, report: await call.result.text };
    }),
  );

  if (request.signal.aborted) {
    throw new DOMException("The request was aborted.", "AbortError");
  }

  const successfulReports = reports.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  // Fail open: a temporary agent failure must not make Doot unavailable.
  if (successfulReports.length === 0) {
    return createResponsesCall(
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

  return createResponsesCall(
    request,
    config,
    [...messages, synthesisMessage],
    instructions +
      "\nYou are the final synthesizer. Prioritize correctness, relevance, and clear actionable answers. If agent notes conflict, resolve the conflict rather than repeating it.",
    originalMessages,
  );
}
