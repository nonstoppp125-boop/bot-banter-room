import {
  createD1ApprovalStore,
  hashApprovalPayload,
  verifyApprovalForAction,
  type ApprovalAction,
} from "./approval-store";
import { restoreManagerPlan, type ManagerPlan } from "./manager";
import { listAgents } from "./registry";

const ACTIONS = new Set<ApprovalAction>([
  "social.publish", "social.reply", "external.message", "account.change",
  "destructive.delete", "deployment", "financial.action",
]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

export type ManagerTaskApprovalMetadata = {
  approvalId: string;
  actionType: ApprovalAction;
  payloadHash: string;
};

function classifyAction(taskText: string): ApprovalAction {
  if (/\b(delete|remove|destroy|overwrite)\b|(?:মুছে\s*(?:ফেল|ফেলো|দাও)|ডিলিট\s*(?:কর|করো|করে\s*দাও))|\b(delete|remove|destroy|overwrite)\s*koro\b|\bmuche\s*(?:felo|dao)\b/i.test(taskText)) return "destructive.delete";
  if (/\b(deploy|release|production)\b|(?:ডিপ্লয়|ডেপ্লয়|প্রোডাকশন|রিলিজ)|\b(deploy|release)\s*koro\b|\bproduction\s*e\b/i.test(taskText)) return "deployment";
  if (/\b(purchase|buy|pay|transfer|withdraw)\b|(?:কিনে\s*(?:দাও|ফেলো)|কেনাকাটা\s*কর|পেমেন্ট\s*কর|টাকা\s*(?:পাঠাও|দাও)|ট্রান্সফার\s*কর|উত্তোলন\s*কর)|\b(purchase|buy|pay|transfer|withdraw)\s*koro\b/i.test(taskText)) return "financial.action";
  if (/\b(change|update|modify)\s+(?:my\s+)?(?:profile|account|permissions|settings)\b|(?:অ্যাকাউন্ট|একাউন্ট|প্রোফাইল|পারমিশন|অনুমতি|সেটিংস).{0,20}(?:বদল|পরিবর্তন|আপডেট|চেঞ্জ)|\b(account|profile|permission|settings)\s*(?:change|update)\s*koro\b/i.test(taskText)) return "account.change";
  if (/\b(publish|post)\b|(?:পোস্ট|পাবলিশ|প্রকাশ|শেয়ার|শেয়ার)\s*(?:কর|করো|দাও|করে\s*দাও)|\b(publish|post|share)\s*koro\b/i.test(taskText)) return "social.publish";
  if (/\b(reply|comment)\b|(?:রিপ্লাই|কমেন্ট|মন্তব্য|জবাব)\s*(?:কর|করো|দাও)|\b(reply|comment)\s*koro\b/i.test(taskText)) return "social.reply";
  if (/\b(send|message|email|dm)\b|(?:মেসেজ|বার্তা|ইমেইল)\s*(?:পাঠাও|কর|করো)|\b(send|message|email|dm)\s*koro\b/i.test(taskText)) return "external.message";
  return "external.message";
}

function approvalPayload(input: {
  taskId: string; workspaceId: string; userId: string; inputSummary: string; plan: ManagerPlan;
}) {
  return {
    kind: "manager-task-execution",
    taskId: input.taskId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    inputSummary: input.inputSummary,
    plan: input.plan,
  };
}

export async function createManagerTaskApproval(
  database: Parameters<typeof createD1ApprovalStore>[0],
  input: { taskId: string; workspaceId: string; userId: string; inputSummary: string; plan: ManagerPlan; now: string },
): Promise<ManagerTaskApprovalMetadata> {
  if (!input.plan.approvalRequired || !ID.test(input.taskId) || !ID.test(input.workspaceId) ||
    !ID.test(input.userId) || !Number.isFinite(Date.parse(input.now))) {
    throw new Error("A valid high-risk Manager task is required for approval.");
  }
  const actionType = classifyAction(input.inputSummary);
  if (!ACTIONS.has(actionType)) throw new Error("Manager task approval action is unsupported.");
  const payloadHash = await hashApprovalPayload(approvalPayload(input));
  const approvalId = crypto.randomUUID().replace(/-/g, "");
  await createD1ApprovalStore(database).create({
    id: approvalId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    actionType,
    payloadHash,
    summary: input.inputSummary.slice(0, 500),
    expiresAt: new Date(Date.parse(input.now) + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: input.now,
  });
  return { approvalId, actionType, payloadHash };
}

export async function verifyManagerTaskApproval(
  database: Parameters<typeof createD1ApprovalStore>[0],
  input: { taskId: string; workspaceId: string; userId: string; inputSummary: string; plan: unknown; now: string },
): Promise<{ allowed: boolean; reason: string }> {
  const plan = restoreManagerPlan(input.inputSummary, input.plan, listAgents());
  if (!plan?.approvalRequired) return { allowed: false, reason: "The task is not a valid approval-gated Manager plan." };
  if (!input.plan || typeof input.plan !== "object" || Array.isArray(input.plan)) {
    return { allowed: false, reason: "The saved approval metadata is missing." };
  }
  const metadata = (input.plan as Record<string, unknown>)["approval"];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { allowed: false, reason: "The saved approval metadata is missing." };
  }
  const value = metadata as Record<string, unknown>;
  const approvalId = value["approvalId"];
  const actionType = value["actionType"];
  const payloadHash = value["payloadHash"];
  if (typeof approvalId !== "string" || !ID.test(approvalId) ||
    typeof actionType !== "string" || !ACTIONS.has(actionType as ApprovalAction) ||
    typeof payloadHash !== "string" || !/^[a-f0-9]{64}$/.test(payloadHash)) {
    return { allowed: false, reason: "The saved approval metadata is invalid." };
  }
  const expectedHash = await hashApprovalPayload({
    kind: "manager-task-execution", taskId: input.taskId, workspaceId: input.workspaceId,
    userId: input.userId, inputSummary: input.inputSummary, plan,
  });
  if (expectedHash !== payloadHash) return { allowed: false, reason: "The task or plan changed after approval was requested." };
  const approval = await createD1ApprovalStore(database).getForAction({
    id: approvalId, workspaceId: input.workspaceId, actorUserId: input.userId,
  });
  return verifyApprovalForAction({
    approval, workspaceId: input.workspaceId, actionType: actionType as ApprovalAction,
    payloadHash: expectedHash, now: input.now,
  });
}
