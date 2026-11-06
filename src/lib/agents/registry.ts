import { lizaDefaultAgent } from "./liza-default";
import type { AgentDefinition } from "./types";

export const DEFAULT_AGENT_ID = lizaDefaultAgent.id;

// Only real, working agents belong here. Mount imported agents by adding entries.
const agents = new Map<string, AgentDefinition>([[lizaDefaultAgent.id, lizaDefaultAgent]]);

export function getAgent(id: string | undefined | null): AgentDefinition {
  return (id && agents.get(id)) || agents.get(DEFAULT_AGENT_ID)!;
}

export function listAgents(): AgentDefinition[] {
  return [...agents.values()];
}
