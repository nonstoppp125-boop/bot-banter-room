import { authorizeValidationCommand } from "./coding-workforce";
import { extractTavilyResearchSources, searchTavilyResearch, type ResearchSource } from "./research";
import { getSpecialist } from "./registry";
import type { AgentPermission } from "./types";

export type SpecialistToolId =
  | "research.search" | "research.extract" | "coding.validate-command"
  | "data.profile" | "business.requirements" | "content.validate" | "seo.audit"
  | "campaign.validate" | "quality.check" | "security.scan" | "workflow.validate"
  | "report.aggregate" | "social.validate";

const REQUIRED_PERMISSION: Record<SpecialistToolId, AgentPermission> = {
  "research.search": "research:search", "research.extract": "research:extract",
  "coding.validate-command": "coding:validate-command", "data.profile": "data:profile",
  "business.requirements": "business:requirements", "content.validate": "content:validate",
  "seo.audit": "seo:audit", "campaign.validate": "campaign:validate",
  "quality.check": "quality:check", "security.scan": "security:scan",
  "workflow.validate": "workflow:validate", "report.aggregate": "report:aggregate",
  "social.validate": "social:validate",
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function textArg(args: Record<string, unknown>, key: string, max = 20_000): string {
  const value = args[key];
  if (typeof value !== "string" || value.length > max) throw new Error("Specialist tool text input is invalid.");
  return value;
}
function stringList(value: unknown, maxItems: number, maxLength = 500): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string" || item.length > maxLength)) {
    throw new Error("Specialist tool list input is invalid.");
  }
  return value as string[];
}
function contentStats(text: string) {
  return { characters: text.length, words: text.trim() ? text.trim().split(/\s+/).length : 0,
    hashtags: (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length, urls: (text.match(/https?:\/\/\S+/gi) ?? []).length };
}
function profileRows(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 500 || value.some((row) => !record(row))) {
    throw new Error("Data profiling accepts one to 500 object rows.");
  }
  const rows = value as Record<string, unknown>[];
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (fields.length > 50) throw new Error("Data profiling accepts at most 50 fields.");
  return { rowCount: rows.length, fieldCount: fields.length, fields: fields.map((field) => {
    const values = rows.map((row) => row[field]);
    const present = values.filter((item) => item !== null && item !== undefined && item !== "");
    const numeric = present.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    return { field, missing: rows.length - present.length, unique: new Set(present.map(String)).size,
      observedTypes: [...new Set(present.map((item) => Array.isArray(item) ? "array" : typeof item))],
      numeric: numeric.length ? { count: numeric.length, min: Math.min(...numeric), max: Math.max(...numeric),
        mean: numeric.reduce((sum, item) => sum + item, 0) / numeric.length } : null };
  }), limitation: "Descriptive profiling only; no causal or inferential conclusions." };
}
function validateRequirements(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("Requirements validation accepts one to 50 requirements.");
  const issues: string[] = [], ids = new Set<string>();
  value.forEach((item, index) => {
    if (!record(item)) { issues.push("Requirement " + (index + 1) + " is not an object."); return; }
    const id = item["id"], statement = item["statement"], criteria = item["acceptanceCriteria"];
    if (typeof id !== "string" || !id.trim() || ids.has(id)) issues.push("Requirement " + (index + 1) + " has a missing or duplicate ID.");
    else ids.add(id);
    if (typeof statement !== "string" || !statement.trim()) issues.push("Requirement " + (index + 1) + " has no statement.");
    if (!Array.isArray(criteria) || !criteria.length || criteria.some((entry) => typeof entry !== "string" || !entry.trim())) {
      issues.push("Requirement " + (index + 1) + " has no usable acceptance criteria.");
    }
  });
  return { requirementCount: value.length, issueCount: issues.length, issues };
}
function validateWorkflow(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30 || value.some((item) => !record(item))) {
    throw new Error("Workflow validation accepts one to 30 step objects.");
  }
  const steps = value as Record<string, unknown>[], ids = steps.map((step) => step["id"]);
  if (ids.some((id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Workflow step IDs must be unique bounded identifiers.");
  }
  const known = new Set(ids as string[]), dependencies = new Map<string, string[]>(), issues: string[] = [];
  for (const step of steps) {
    const id = step["id"] as string, deps = step["dependsOn"] === undefined ? [] : stringList(step["dependsOn"], 30, 64);
    dependencies.set(id, deps);
    for (const dependency of deps) if (!known.has(dependency)) issues.push("Step " + id + " references missing dependency " + dependency + ".");
  }
  const visiting = new Set<string>(), visited = new Set<string>(), order: string[] = [];
  let hasCycle = false;
  const visit = (id: string) => {
    if (visiting.has(id)) { hasCycle = true; return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) if (known.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id); order.push(id);
  };
  for (const id of known) visit(id);
  return { stepCount: steps.length, valid: issues.length === 0 && !hasCycle, hasCycle, issues, topologicalOrder: hasCycle ? [] : order };
}

export async function invokeSpecialistTool(input: {
  agentId: string; toolId: SpecialistToolId; args: unknown; apiKey?: string; signal: AbortSignal;
}): Promise<unknown> {
  const agent = getSpecialist(input.agentId), required = REQUIRED_PERMISSION[input.toolId];
  if (!required || !agent.permissions.includes(required)) throw new Error("Specialist tool permission denied.");
  if (!record(input.args)) throw new Error("Specialist tool arguments must be an object.");
  if (input.signal.aborted) throw new Error("Specialist tool call cancelled.");
  const args = input.args;
  if (input.toolId === "research.search") {
    const query = args["query"];
    if (typeof query !== "string" || !input.apiKey?.trim()) throw new Error("Research search requires a query and configured server-side provider key.");
    return searchTavilyResearch(query, input.apiKey, input.signal);
  }
  if (input.toolId === "research.extract") {
    const sources = args["sources"];
    if (!Array.isArray(sources) || sources.length < 1 || sources.length > 3) throw new Error("Research extraction accepts one to three selected sources.");
    const validated: ResearchSource[] = sources.map((source) => {
      if (!record(source) || typeof source["id"] !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(source["id"]) ||
        typeof source["title"] !== "string" || source["title"].length > 500 || typeof source["url"] !== "string" ||
        source["url"].length > 2_048 || typeof source["retrievedAt"] !== "string" || typeof source["content"] !== "string" ||
        source["content"].length > 20_000 || (source["publisher"] !== undefined && typeof source["publisher"] !== "string") ||
        (source["publishedAt"] !== undefined && typeof source["publishedAt"] !== "string")) throw new Error("Research extraction source metadata is invalid.");
      return source as unknown as ResearchSource;
    });
    if (new Set(validated.map((source) => source.id)).size !== validated.length) throw new Error("Research extraction source IDs must be unique.");
    if (!input.apiKey?.trim()) throw new Error("Research extraction requires a configured server-side provider key.");
    return extractTavilyResearchSources(validated, input.apiKey, input.signal);
  }
  if (input.toolId === "coding.validate-command") return authorizeValidationCommand(textArg(args, "command", 300));
  if (input.toolId === "data.profile") return profileRows(args["rows"]);
  if (input.toolId === "business.requirements") return validateRequirements(args["requirements"]);
  if (input.toolId === "content.validate") {
    const text = textArg(args, "text"), stats = contentStats(text), max = args["maxChars"] === undefined ? null : args["maxChars"];
    if (max !== null && (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > 100_000)) throw new Error("Content maxChars must be an integer from 1 to 100000.");
    const warnings: string[] = [];
    if (!text.trim()) warnings.push("Content is empty.");
    if (typeof max === "number" && text.length > max) warnings.push("Content exceeds the requested character limit.");
    if (/\s{3,}/.test(text)) warnings.push("Content contains repeated whitespace.");
    return { ...stats, warnings, limitation: "Structural checks only; this does not verify facts, originality or legal compliance." };
  }
  if (input.toolId === "seo.audit") {
    const title = textArg(args, "title", 200), description = textArg(args, "metaDescription", 500);
    const headings = stringList(args["headings"] ?? [], 30, 200);
    const keyword = args["primaryKeyword"] === undefined ? "" : textArg(args, "primaryKeyword", 100).toLowerCase();
    const warnings: string[] = [];
    if (title.length < 30 || title.length > 60) warnings.push("Title length is outside the common 30–60 character heuristic.");
    if (description.length < 120 || description.length > 160) warnings.push("Meta description length is outside the common 120–160 character heuristic.");
    if (!headings.length) warnings.push("No headings were supplied for review.");
    const occurrences = keyword ? (title + " " + description + " " + headings.join(" ")).toLowerCase().split(keyword).length - 1 : null;
    return { titleCharacters: title.length, descriptionCharacters: description.length, headingCount: headings.length, keywordOccurrences: occurrences, warnings, limitation: "Heuristic metadata review only; no live crawl, ranking or search-volume data." };
  }
  if (input.toolId === "campaign.validate") {
    const missing = ["objective", "audience", "channels", "kpis"].filter((key) => {
      const value = args[key];
      return key === "channels" || key === "kpis" ? !Array.isArray(value) || !value.length : typeof value !== "string" || !value.trim();
    });
    return { valid: missing.length === 0, missingFields: missing, limitation: "Completeness check only; no market validation or performance forecast." };
  }
  if (input.toolId === "quality.check") {
    const text = textArg(args, "text"), requirements = stringList(args["requirements"], 20, 300);
    return { checkCount: requirements.length, checks: requirements.map((requirement) => ({
      requirement, lexicalMatch: text.toLowerCase().includes(requirement.toLowerCase()),
    })), limitation: "Literal phrase matching only; not semantic or factual verification." };
  }
  if (input.toolId === "security.scan") {
    const text = textArg(args, "text");
    const patterns: Array<[string, RegExp]> = [
      ["private-key-header", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
      ["bearer-token", /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/gi],
      ["github-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
      ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/g],
      ["credential-assignment", /\b(?:api[_-]?key|password|secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/gi],
    ];
    const findings = patterns.flatMap(([type, pattern]) => {
      const matches = text.match(pattern) ?? [];
      return matches.length ? [{ type, count: matches.length, valuesRedacted: true }] : [];
    });
    return { findingCount: findings.reduce((sum, finding) => sum + finding.count, 0), findings, limitation: "Pattern-based screening only; false positives and missed formats are possible." };
  }
  if (input.toolId === "workflow.validate") return validateWorkflow(args["steps"]);
  if (input.toolId === "report.aggregate") {
    const values = args["values"];
    if (!Array.isArray(values) || values.length < 1 || values.length > 1_000 || values.some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new Error("Report aggregation accepts one to 1000 finite numeric values.");
    const sorted = [...values as number[]].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
    return { count: sorted.length, min: sorted[0], max: sorted[sorted.length - 1], mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length, median, limitation: "Descriptive aggregation only; no causal or inferential conclusions." };
  }
  if (input.toolId === "social.validate") {
    const platform = args["platform"];
    if (!["linkedin", "social-media", "instagram", "facebook", "youtube", "x-platform", "tiktok"].includes(String(platform))) throw new Error("Social validation platform is unsupported.");
    const text = textArg(args, "text"), stats = contentStats(text), max = args["maxChars"] === undefined ? null : args["maxChars"];
    if (max !== null && (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > 100_000)) throw new Error("Social maxChars must be an integer from 1 to 100000.");
    return { platform, ...stats, exceedsRequestedLimit: typeof max === "number" ? text.length > max : null, limitation: "Text metrics only; platform limits and policies must be checked against current official guidance." };
  }
  throw new Error("Unknown specialist tool.");
}

export function listSpecialistTools(agentId: string): SpecialistToolId[] {
  const agent = getSpecialist(agentId);
  return (Object.entries(REQUIRED_PERMISSION) as [SpecialistToolId, AgentPermission][])
    .filter(([, permission]) => agent.permissions.includes(permission)).map(([toolId]) => toolId);
}

/** Deterministic post-generation checks; these are structural, not factual verification. */
export async function auditSpecialistOutput(agentId: string, output: string, signal: AbortSignal): Promise<unknown | null> {
  if (["content-writer", "content-reviewer"].includes(agentId)) {
    return invokeSpecialistTool({ agentId, toolId: "content.validate", args: { text: output }, signal });
  }
  if (["linkedin", "social-media", "instagram", "facebook", "youtube", "x-platform", "tiktok"].includes(agentId)) {
    return invokeSpecialistTool({ agentId, toolId: "social.validate", args: { platform: agentId, text: output }, signal });
  }
  if (agentId === "security-reviewer") return invokeSpecialistTool({ agentId, toolId: "security.scan", args: { text: output }, signal });
  return null;
}

/** Run a specialist's domain tool when the latest user message is a bounded JSON payload. */
export async function prepareSpecialistToolContext(agentId: string, messages: readonly unknown[], signal: AbortSignal): Promise<unknown | null> {
  const latest = [...messages].reverse().find((message) => record(message) && message["role"] === "user");
  if (!record(latest)) return null;
  const content = latest["content"];
  let raw = "";
  if (typeof content === "string") raw = content;
  else if (Array.isArray(content)) {
    raw = content.filter((part) => record(part) && part["type"] === "text" && typeof part["text"] === "string")
      .map((part) => (part as Record<string, unknown>)["text"] as string).join("\n");
  }
  raw = raw.trim();
  if (!raw.startsWith("{")) return null;
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return null; }
  if (!record(payload)) return null;
  let toolId: SpecialistToolId | null = null;
  let args: Record<string, unknown> = payload;
  if (agentId === "data-analyst" && Array.isArray(payload["rows"])) toolId = "data.profile";
  else if (agentId === "business-analyst" && Array.isArray(payload["requirements"])) toolId = "business.requirements";
  else if (["content-writer", "content-reviewer"].includes(agentId) && typeof payload["text"] === "string") toolId = "content.validate";
  else if (agentId === "seo" && typeof payload["title"] === "string" && typeof payload["metaDescription"] === "string") toolId = "seo.audit";
  else if (agentId === "marketing-strategist" && typeof payload["objective"] === "string" && typeof payload["audience"] === "string") toolId = "campaign.validate";
  else if (agentId === "quality-reviewer" && typeof payload["text"] === "string" && Array.isArray(payload["requirements"])) toolId = "quality.check";
  else if (agentId === "security-reviewer" && typeof payload["text"] === "string") toolId = "security.scan";
  else if (agentId === "automation" && Array.isArray(payload["steps"])) toolId = "workflow.validate";
  else if (agentId === "reporting" && Array.isArray(payload["values"])) toolId = "report.aggregate";
  else if (["linkedin", "social-media", "instagram", "facebook", "youtube", "x-platform", "tiktok"].includes(agentId) && typeof payload["text"] === "string") {
    toolId = "social.validate";
    args = { ...payload, platform: agentId };
  }
  if (!toolId) return null;
  try { return await invokeSpecialistTool({ agentId, toolId, args, signal }); }
  catch (error) {
    if (signal.aborted) throw error;
    return { toolError: error instanceof Error ? error.message.slice(0, 240) : "Structured specialist tool validation failed." };
  }
}
