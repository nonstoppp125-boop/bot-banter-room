import { describe, expect, it } from "vitest";
import {
  buildDeliverableAcceptanceCriteria,
  evaluateDeliverableAcceptance,
} from "@/lib/agents/acceptance";

const plan = [
  { agentId: "research", objective: "Identify reliable API requirements." },
  { agentId: "coding", objective: "Implement the approved integration." },
];

describe("deliverable acceptance", () => {
  it("creates explicit task, evidence and approval criteria", () => {
    const criteria = buildDeliverableAcceptanceCriteria(plan, true);
    expect(criteria.map((item) => item.id)).toEqual([
      "task:research",
      "task:coding",
      "evidence:integrity",
      "safety:approval",
    ]);
  });

  it("accepts only a complete evidence-backed pass for every criterion", () => {
    const criteria = buildDeliverableAcceptanceCriteria(plan, false);
    const review = evaluateDeliverableAcceptance(JSON.stringify({
      summary: "All required outputs are supported.",
      findings: [],
      criteria: criteria.map((item) => ({
        id: item.id,
        status: "pass",
        evidence: "Observed in specialist execution output.",
      })),
    }), criteria);
    expect(review.status).toBe("accepted");
  });

  it("rejects a failed criterion with evidence", () => {
    const criteria = buildDeliverableAcceptanceCriteria(plan, false);
    const review = evaluateDeliverableAcceptance(JSON.stringify({
      summary: "One required task is incomplete.",
      findings: ["Implementation output is missing."],
      criteria: criteria.map((item, index) => ({
        id: item.id,
        status: index === 1 ? "fail" : "pass",
        evidence: "Reviewed execution result and output.",
      })),
    }), criteria);
    expect(review.status).toBe("rejected");
  });

  it("fails closed when criteria are omitted, duplicated, malformed or unknown", () => {
    const criteria = buildDeliverableAcceptanceCriteria(plan, false);
    expect(evaluateDeliverableAcceptance("not json", criteria).status).toBe("needs-review");
    const partial = { summary: "Partial", findings: [], criteria: [] };
    expect(evaluateDeliverableAcceptance(JSON.stringify(partial), criteria).status).toBe("needs-review");
    const duplicate = {
      summary: "Duplicate",
      findings: [],
      criteria: criteria.map((item) => ({ id: item.id, status: "pass", evidence: "Enough evidence." }))
        .concat([{ id: criteria[0]!.id, status: "pass", evidence: "Duplicate evidence." }]),
    };
    expect(evaluateDeliverableAcceptance(JSON.stringify(duplicate), criteria).status).toBe("needs-review");
  });

  it("requires evidence and treats unknown decisions as needs-review", () => {
    const criteria = buildDeliverableAcceptanceCriteria(plan, false);
    const review = evaluateDeliverableAcceptance(JSON.stringify({
      summary: "Insufficient evidence.",
      findings: [],
      criteria: criteria.map((item, index) => ({
        id: item.id,
        status: index === 0 ? "unknown" : "pass",
        evidence: index === 0 ? "" : "Evidence exists in output.",
      })),
    }), criteria);
    expect(review.status).toBe("needs-review");
  });
});
