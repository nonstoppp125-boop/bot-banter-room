import { lizaDefaultAgent } from "./liza-default";
import {
  researchAgent,
  webIntelligenceAgent,
  codingAgent,
  debuggingAgent,
  dataAnalystAgent,
  businessAnalystAgent,
  linkedinAgent,
  socialMediaAgent,
  instagramAgent,
  facebookAgent,
  youtubeAgent,
  xPlatformAgent,
  tiktokAgent,
  contentWriterAgent,
  contentReviewerAgent,
  seoAgent,
  marketingStrategistAgent,
  problemSolverAgent,
  qualityReviewerAgent,
  securityReviewerAgent,
  automationAgent,
  reportingAgent,
} from "./specialists";
import type { AgentCapability, AgentDefinition, AgentPermission } from "./types";

export const DEFAULT_AGENT_ID = lizaDefaultAgent.id;

// Only real, working agents belong here.
const agentDefinitions: AgentDefinition[] = [
  lizaDefaultAgent,
  researchAgent,
  webIntelligenceAgent,
  codingAgent,
  debuggingAgent,
  dataAnalystAgent,
  businessAnalystAgent,
  linkedinAgent,
  socialMediaAgent,
  instagramAgent,
  facebookAgent,
  youtubeAgent,
  xPlatformAgent,
  tiktokAgent,
  contentWriterAgent,
  contentReviewerAgent,
  seoAgent,
  problemSolverAgent,
  qualityReviewerAgent,
  marketingStrategistAgent,
  securityReviewerAgent,
  automationAgent,
  reportingAgent,
];

const supportedPermissions = new Set<AgentPermission>([
  "llm:inference", "research:search", "research:extract", "coding:validate-command",
  "data:profile", "business:requirements", "content:validate", "seo:audit",
  "campaign:validate", "quality:check", "security:scan", "workflow:validate",
  "report:aggregate", "social:validate",
]);

const supportedCapabilities = new Set<AgentCapability>([
  "chat",
  "research",
  "evidence-analysis",
  "web-content-analysis",
  "code-generation",
  "code-review",
  "debugging",
  "root-cause-analysis",
  "data-analysis",
  "sql-analysis",
  "statistics",
  "requirements-analysis",
  "business-process-analysis",
  "linkedin-strategy",
  "social-strategy",
  "instagram-strategy",
  "facebook-strategy",
  "youtube-strategy",
  "x-strategy",
  "tiktok-strategy",
  "content-planning",
  "content-generation",
  "copywriting",
  "content-review",
  "fact-checking",
  "seo-analysis",
  "content-optimization",
  "problem-solving",
  "marketing-strategy",
  "campaign-planning",
  "quality-review",
  "security-review",
  "risk-analysis",
  "workflow-design",
  "automation-planning",
  "reporting",
  "metrics-analysis",
]);

export function validateAgentRegistry(
  definitions: readonly AgentDefinition[] = agentDefinitions,
): void {
  const ids = new Set<string>();

  for (const agent of definitions) {
    if (!agent.id.trim() || agent.id !== agent.id.trim() || ids.has(agent.id))
      throw new Error(`Invalid or duplicate agent id: ${agent.id}`);
    ids.add(agent.id);

    if (!agent.name.trim() || !agent.description.trim())
      throw new Error(`Agent ${agent.id} has incomplete identity metadata`);

    if (!Array.isArray(agent.capabilities) || agent.capabilities.length === 0)
      throw new Error(`Agent ${agent.id} has no capabilities`);

    const capabilities = new Set<string>();
    for (const capability of agent.capabilities) {
      if (!supportedCapabilities.has(capability))
        throw new Error(`Agent ${agent.id} has unsupported capability: ${capability}`);
      if (capabilities.has(capability))
        throw new Error(`Agent ${agent.id} has duplicate capability: ${capability}`);
      capabilities.add(capability);
    }

    if (!Array.isArray(agent.permissions) || agent.permissions.length === 0)
      throw new Error(`Agent ${agent.id} has no permissions`);

    const permissions = new Set<string>();
    for (const permission of agent.permissions) {
      if (!supportedPermissions.has(permission))
        throw new Error(`Agent ${agent.id} has an unsupported permission`);
      if (permissions.has(permission))
        throw new Error(`Agent ${agent.id} has duplicate permission: ${permission}`);
      permissions.add(permission);
    }

    if (agent.role !== "chat" && agent.role !== "specialist")
      throw new Error(`Agent ${agent.id} has an invalid role`);

    if (agent.role === "specialist" && typeof agent.generate !== "function")
      throw new Error(`Specialist ${agent.id} has no generator`);

    if (agent.role === "chat" && typeof agent.run !== "function")
      throw new Error(`Chat agent ${agent.id} has no runner`);
  }
}

validateAgentRegistry();

const agents = new Map<string, AgentDefinition>(agentDefinitions.map((agent) => [agent.id, agent]));

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
