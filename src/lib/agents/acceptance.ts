export type DeliverableAcceptanceCriterion = {
  id: string;
  description: string;
};

export type AcceptanceReviewStatus = "accepted" | "rejected" | "needs-review";

export type DeliverableAcceptanceReview = {
  status: AcceptanceReviewStatus;
  summary: string;
  findings: string[];
  criteria: Array<{
    id: string;
    status: "pass" | "fail" | "unknown";
    evidence: string;
  }>;
  reason?: string;
};

/** Derives explicit, reviewable acceptance criteria from the final execution plan. */
export function buildDeliverableAcceptanceCriteria(
  subtasks: readonly { agentId: string; objective: string }[],
  approvalRequired: boolean,
): DeliverableAcceptanceCriterion[] {
  const criteria = subtasks.map((task) => ({
    id: `task:${task.agentId}`,
    description: `The deliverable for this objective is substantively completed: ${task.objective.slice(0, 400)}`,
  }));
  criteria.push({
    id: "evidence:integrity",
    description: "Claims are supported by supplied evidence; uncertainty, missing information and failures are disclosed.",
  });
  if (approvalRequired) {
    criteria.push({
      id: "safety:approval",
      description: "No consequential external action is executed without explicit human approval.",
    });
  }
  return criteria;
}

/**
 * Fails closed when the independent reviewer omits criteria, invents IDs,
 * duplicates entries, or supplies no evidence for a pass/fail decision.
 */
export function evaluateDeliverableAcceptance(
  raw: string,
  expected: readonly DeliverableAcceptanceCriterion[],
): DeliverableAcceptanceReview {
  const fallback = (reason: string): DeliverableAcceptanceReview => ({
    status: "needs-review",
    summary: "Acceptance could not be verified.",
    findings: [],
    criteria: expected.map((criterion) => ({
      id: criterion.id,
      status: "unknown",
      evidence: "",
    })),
    reason,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback("Reviewer output was not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) return fallback("Invalid review structure.");
  const value = parsed as Record<string, unknown>;
  if (
    typeof value.summary !== "string" ||
    !Array.isArray(value.findings) ||
    value.findings.some((finding) => typeof finding !== "string") ||
    !Array.isArray(value.criteria)
  ) {
    return fallback("Reviewer output did not match the acceptance schema.");
  }

  const expectedIds = new Set(expected.map((criterion) => criterion.id));
  const seen = new Set<string>();
  const reviewed: DeliverableAcceptanceReview["criteria"] = [];
  for (const item of value.criteria) {
    if (typeof item !== "object" || item === null) return fallback("Invalid criterion result.");
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.id !== "string" ||
      !expectedIds.has(entry.id) ||
      seen.has(entry.id) ||
      (entry.status !== "pass" && entry.status !== "fail" && entry.status !== "unknown") ||
      typeof entry.evidence !== "string"
    ) {
      return fallback("Unknown, duplicate or malformed criterion result.");
    }
    seen.add(entry.id);
    reviewed.push({
      id: entry.id,
      status: entry.status,
      evidence: entry.evidence.trim().slice(0, 1_000),
    });
  }

  if (seen.size !== expected.length) return fallback("One or more required criteria were omitted.");
  if (reviewed.some((item) => item.status === "unknown" || item.evidence.length < 8)) {
    return {
      status: "needs-review",
      summary: value.summary.slice(0, 1_000),
      findings: (value.findings as string[]).slice(0, 20).map((finding) => finding.slice(0, 500)),
      criteria: reviewed,
      reason: "At least one criterion is unknown or lacks adequate evidence.",
    };
  }
  const failed = reviewed.some((item) => item.status === "fail");
  return {
    status: failed ? "rejected" : "accepted",
    summary: value.summary.slice(0, 1_000),
    findings: (value.findings as string[]).slice(0, 20).map((finding) => finding.slice(0, 500)),
    criteria: reviewed,
  };
}
