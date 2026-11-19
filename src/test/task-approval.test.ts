import { describe, expect, it } from "vitest";
import { buildManagerPlan } from "@/lib/agents/manager";
import { listAgents } from "@/lib/agents/registry";
import { createManagerTaskApproval, verifyManagerTaskApproval } from "@/lib/agents/task-approval";

function makeDatabase() {
  let row: Record<string, unknown> | null = null;
  let insertValues: unknown[] = [];
  const database = {
    prepare(query: string) {
      return { bind(...values: unknown[]) {
        return {
          run: async () => {
            if (query.startsWith("INSERT INTO approvals")) {
              insertValues = values;
              row = {
                id: values[0], workspace_id: values[1], user_id: values[2], action_type: values[3],
                payload_hash: values[4], summary: values[5], status: "pending",
                expires_at: values[6], created_at: values[7], decided_by_user_id: null,
                decision_reason: null, decided_at: null,
              };
            }
            return { success: true, meta: { changes: 1 } };
          },
          first: async <T = Record<string, unknown>>() => row as T | null,
          all: async <T = Record<string, unknown>>() => ({ success: true, results: [] as T[] }),
        };
      }};
    },
  };
  return { database: database as Parameters<typeof createManagerTaskApproval>[0], approve: () => {
    if (!row) throw new Error("Approval was not created.");
    row["status"] = "approved";
    row["decided_by_user_id"] = "admin-1";
    row["decision_reason"] = "Reviewed";
    row["decided_at"] = "2026-11-16T12:10:00.000Z";
  }, values: () => insertValues };
}
const now = "2026-11-16T12:00:00.000Z";

describe("approval-bound Manager task execution", () => {
  it("creates an action-specific approval bound to the exact task and plan", async () => {
    const state = makeDatabase();
    const summary = "Publish this LinkedIn post";
    const plan = buildManagerPlan(summary, listAgents());
    const approval = await createManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan, now,
    });
    expect(approval.actionType).toBe("social.publish");
    expect(approval.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(state.values()).toContain(approval.payloadHash);
  });

  it.each([
    ["লিংকডইনে এই পোস্টটি প্রকাশ করো", "social.publish"],
    ["ফেসবুকে পোস্ট করো", "social.publish"],
    ["post to LinkedIn", "social.publish"],
    ["এই পোস্টটা পাবলিশ করে দাও", "social.publish"],
    ["এই ইমেইলটি পাঠিয়ে দাও", "external.message"],
    ["পুরোনো ড্রাফটটি মুছে ফেল", "destructive.delete"],
    ["এটা প্রোডাকশনে ডিপ্লয় করো", "deployment"],
    ["আমার অ্যাকাউন্টের সেটিংস পরিবর্তন করো", "account.change"],
    ["LinkedIn e post ta publish koro", "social.publish"],
    ["ei message ta pathiye dao", "external.message"],
    ["purono draft ta delete koro", "destructive.delete"],
    ["production e deploy koro", "deployment"],
    ["amar account settings change koro", "account.change"],
  ])("stores the correct approval action for Bengali/Banglish intent: %s", async (summary, actionType) => {
    const state = makeDatabase();
    const plan = buildManagerPlan(summary, listAgents());
    expect(plan.approvalRequired).toBe(true);
    const approval = await createManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan, now,
    });
    expect(approval.actionType).toBe(actionType);
  });

  it("keeps pending approvals blocked and unlocks only after an admin decision", async () => {
    const state = makeDatabase();
    const summary = "Publish this LinkedIn post";
    const plan = buildManagerPlan(summary, listAgents());
    const approval = await createManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan, now,
    });
    const savedPlan = { ...plan, approval };
    const pending = await verifyManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan: savedPlan, now,
    });
    expect(pending.allowed).toBe(false);
    state.approve();
    const verified = await verifyManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan: savedPlan, now: "2026-11-16T12:11:00.000Z",
    });
    expect(verified).toMatchObject({ allowed: true });
  });

  it("rejects a changed task summary or plan after approval", async () => {
    const state = makeDatabase();
    const summary = "Publish this LinkedIn post";
    const plan = buildManagerPlan(summary, listAgents());
    const approval = await createManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary, plan, now,
    });
    state.approve();
    const result = await verifyManagerTaskApproval(state.database, {
      taskId: "task-1", workspaceId: "workspace-1", userId: "user-1",
      inputSummary: summary + " changed", plan: { ...plan, approval },
      now: "2026-11-16T12:11:00.000Z",
    });
    expect(result.allowed).toBe(false);
  });
});
