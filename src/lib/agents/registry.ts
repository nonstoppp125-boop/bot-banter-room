import { lizaDefaultAgent } from "./liza-default";
import { problemSolverAgent, qualityReviewerAgent } from "./specialists";
import type { AgentDefinition } from "./types";

export const DEFAULT_AGENT_ID = lizaDefaultAgent.id;

// Only real, working agents belong here.
const agents = new Map<string, AgentDefinition>(
  [lizaDefaultAgent, problemSolverAgent, qualityReviewerAgent].map((a) => [a.id, a]),
);

/** Returns a chat agent; unknown ids or specialists fall back to the default. */
export function getAgent(id: string | undefined | null): AgentDefinition {
  const found = id ? agents.get(id) : undefined;
  return found?.role === "chat" ? found : agents.get(DEFAULT_AGENT_ID)!;
}

export function getSpecialist(id: string): AgentDefinition {
  const found = agents.get(id);
  if (!found || found.role !== "specialist") throw new Error(`Unknown specialist ${id}`);
  return found;
}

export function listAgents(): AgentDefinition[] {
  return [...agents.values()];
}
