import type { ResearchSource } from "./research";
export type ResearchEvidenceVerdict = "supported" | "contradicted" | "unknown";
export type ResearchEvidenceAssessment = { claim: string; verdict: ResearchEvidenceVerdict; evidence: Array<{ sourceId: string; quote: string }>; rationale: string; };
export type ResearchVerificationReport = { status: "completed" | "unavailable"; claims: ResearchEvidenceAssessment[]; supported: number; contradicted: number; unknown: number; reason?: string; limitation: string; };
const MAX_CLAIMS = 12, MAX_CLAIM_TEXT = 12_000, MAX_SOURCES = 8, MAX_SOURCE_CHARS = 3_000;
const LIMITATION = "Model-based semantic evidence alignment only. A supported label is not proof of truth, and this review may miss errors or contradictions.";
function unavailable(reason: string): ResearchVerificationReport { return { status: "unavailable", claims: [], supported: 0, contradicted: 0, unknown: 0, reason: reason.slice(0, 240), limitation: LIMITATION }; }
function normalizeQuote(value: string): string { return value.toLowerCase().replace(/\s+/g, " ").trim(); }
export function validateResearchClaimVerification(raw: string, sources: readonly ResearchSource[]): ResearchVerificationReport {
  let parsed: unknown; try { parsed = JSON.parse(raw); } catch { return unavailable("Verifier returned malformed JSON."); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return unavailable("Verifier response must be a JSON object.");
  const claimsValue = (parsed as Record<string, unknown>)["claims"];
  if (!Array.isArray(claimsValue) || claimsValue.length > MAX_CLAIMS) return unavailable("Verifier response has an invalid claim list.");
  const sourceById = new Map(sources.map((source) => [source.id, source])), seen = new Set<string>(), claims: ResearchEvidenceAssessment[] = [];
  for (const value of claimsValue) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const item = value as Record<string, unknown>, claim = item["claim"], proposed = item["verdict"];
    if (typeof claim !== "string" || !claim.trim() || claim.length > 500) continue;
    const normalized = normalizeQuote(claim); if (seen.has(normalized)) continue; seen.add(normalized);
    const proposedVerdict: ResearchEvidenceVerdict = proposed === "supported" || proposed === "contradicted" ? proposed : "unknown";
    const entries = Array.isArray(item["evidence"]) ? item["evidence"].slice(0, 3) : [];
    const evidence: Array<{ sourceId: string; quote: string }> = [];
    for (const entry of entries) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
      const proof = entry as Record<string, unknown>, sourceId = proof["sourceId"], quote = proof["quote"];
      if (typeof sourceId !== "string" || typeof quote !== "string" || !quote.trim() || quote.length > 400) continue;
      const source = sourceById.get(sourceId);
      if (!source || !normalizeQuote(source.content).includes(normalizeQuote(quote))) continue;
      evidence.push({ sourceId, quote: quote.trim() });
    }
    claims.push({ claim: claim.trim(), verdict: proposedVerdict !== "unknown" && evidence.length === 0 ? "unknown" : proposedVerdict,
      evidence, rationale: typeof item["rationale"] === "string" ? item["rationale"].trim().slice(0, 400) : "No verifier rationale supplied." });
  }
  if (!claims.length) return unavailable("Verifier returned no usable claims.");
  return { status: "completed", claims, supported: claims.filter((claim) => claim.verdict === "supported").length,
    contradicted: claims.filter((claim) => claim.verdict === "contradicted").length,
    unknown: claims.filter((claim) => claim.verdict === "unknown").length, limitation: LIMITATION };
}
export async function verifyResearchClaims(input: {
  claimsText: string; sources: readonly ResearchSource[]; signal: AbortSignal;
  verify: (request: { claimsText: string; sources: readonly ResearchSource[]; signal: AbortSignal }) => Promise<string>;
}): Promise<ResearchVerificationReport> {
  if (input.signal.aborted) throw new Error("Research claim verification cancelled.");
  if (typeof input.claimsText !== "string" || !input.claimsText.trim()) return unavailable("No research claims were supplied.");
  if (!Array.isArray(input.sources) || input.sources.length === 0) return unavailable("No source evidence was available.");
  const claimsText = input.claimsText.slice(0, MAX_CLAIM_TEXT);
  const sources = input.sources.slice(0, MAX_SOURCES).map((source) => ({ ...source, content: source.content.slice(0, MAX_SOURCE_CHARS) }));
  try {
    const raw = await input.verify({ claimsText, sources, signal: input.signal });
    if (input.signal.aborted) throw new Error("Research claim verification cancelled.");
    return validateResearchClaimVerification(raw, sources);
  } catch (error) {
    if (input.signal.aborted) throw error;
    return unavailable(error instanceof Error ? error.message : "Independent evidence review failed.");
  }
}
