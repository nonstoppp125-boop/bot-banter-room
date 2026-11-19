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
  if (/\b(publish|post)\b|(?:পোস্ট(?:টি|টা)?\s*(?:প্রকাশ|পাবলিশ|শেয়ার|শেয়ার)\s*(?:কর|দাও)|প্রকাশ\s*কর|পাবলিশ\s*কর)|(?:post\s*(?:ta|ti)?\s*(?:publish|share)\s*koro|post\s*koro)/i.test(taskText)) return "social.publish";
  if (/\b(reply|comment)\b|(?:কমেন্ট\s*কর|জবাব\s*দাও|উত্তর\s*দাও)|(?:comment\s*koro|reply\s*koro)/i.test(taskText)) return "social.reply";
  if (/\b(send|message|email|dm)\b|(?:মেসেজ|ইমেইল|ডিএম)\s*(?:টি|টা)?\s*(?:পাঠাও|পাঠিয়ে\s*দাও|পাঠিয়ে\s*দাও)|(?:message|email|dm)\s*(?:ta|ti)?\s*(?:pathao|pathiye\s+dao)/i.test(taskText)) return "external.message";
  if (/\b(delete|remove|destroy|overwrite)\b|(?:মুছে\s*(?:ফেল|দাও)|ডিলিট\s*(?:কর|করে\s*দাও)|ধ্বংস\s*কর)|(?:muche\s*(?:felo|dao)|delete\s*(?:koro|kore\s+dao))/i.test(taskText)) return "destructive.delete";
  if (/\b(deploy|release|production)\b|(?:প্রোডাকশনে\s*(?:ডিপ্লয়|ডেপ্লয়|রিলিজ)|ডিপ্লয়\s*কর|ডেপ্লয়\s*কর|রিলিজ\s*কর)|(?:production\s*e\s*(?:deploy|release)\s*koro|deploy\s*koro|release\s*koro)/i.test(taskText)) return "deployment";
  if (/\b(purchase|buy|pay|transfer|withdraw)\b|(?:কিনে\s*দাও|পেমেন্ট\s*কর|টাকা\s*পাঠাও|ট্রান্সফার\s*কর|উত্তোলন\s*কর)|(?:kine\s*dao|payment\s*koro|taka\s*pathao|transfer\s*koro|withdraw\s*koro)/i.test(taskText)) return "financial.action";
  if (/\b(change|update|modify)\s+(?:my\s+)?(?:profile|account|permissions|settings)\b|\b(?:profile|account|settings|permissions)\s+(?:change|update|modify)\s+(?:koro|kore\s+dao)\b|(?:আমার\s*)?(?:অ্যাকাউন্ট|প্রোফাইল|সেটিংস|অনুমতি)\s*(?:টি|টা)?\s*(?:বদলাও|পরিবর্তন\s*কর|আপডেট\s*কর)|(?:account|profile|settings|permission)\s*(?:ta|gulo)?\s*(?:change|update)\s*koro/i.test(taskText)) return "account.change";
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
