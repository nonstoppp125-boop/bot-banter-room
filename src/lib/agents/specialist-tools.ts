import { authorizeValidationCommand } from "./coding-workforce";
import { extractTavilyResearchSources, searchTavilyResearch, type ResearchSource } from "./research";
import { getSpecialist } from "./registry";
import type { AgentPermission } from "./types";

export type SpecialistToolId = "research.search" | "research.extract" | "coding.validate-command";

const REQUIRED_PERMISSION: Record<SpecialistToolId, AgentPermission> = {
  "research.search": "research:search",
  "research.extract": "research:extract",
  "coding.validate-command": "coding:validate-command",
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Execute only a statically registered tool explicitly granted to this specialist. */
export async function invokeSpecialistTool(input: {
  agentId: string;
  toolId: SpecialistToolId;
  args: unknown;
  apiKey?: string;
  signal: AbortSignal;
}): Promise<unknown> {
  const agent = getSpecialist(input.agentId);
  const required = REQUIRED_PERMISSION[input.toolId];
  if (!required || !agent.permissions.includes(required)) {
    throw new Error("Specialist tool permission denied.");
  }
  if (!record(input.args)) throw new Error("Specialist tool arguments must be an object.");
  if (input.signal.aborted) throw new Error("Specialist tool call cancelled.");

  if (input.toolId === "research.search") {
    const query = input.args["query"];
    if (typeof query !== "string" || !input.apiKey?.trim()) {
      throw new Error("Research search requires a query and configured server-side provider key.");
    }
    return searchTavilyResearch(query, input.apiKey, input.signal);
  }

  if (input.toolId === "research.extract") {
    const sources = input.args["sources"];
    if (!Array.isArray(sources) || sources.length < 1 || sources.length > 3) {
      throw new Error("Research extraction accepts one to three selected sources.");
    }
    return extractTavilyResearchSources(sources as ResearchSource[], input.apiKey ?? "", input.signal);
  }

  if (input.toolId === "coding.validate-command") {
    const command = input.args["command"];
    if (typeof command !== "string" || command.length > 300) {
      throw new Error("Coding validation tool requires a bounded command string.");
    }
    return authorizeValidationCommand(command);
  }

  throw new Error("Unknown specialist tool.");
}

export function listSpecialistTools(agentId: string): SpecialistToolId[] {
  const agent = getSpecialist(agentId);
  return (Object.entries(REQUIRED_PERMISSION) as [SpecialistToolId, AgentPermission][])
    .filter(([, permission]) => agent.permissions.includes(permission))
    .map(([toolId]) => toolId);
}
