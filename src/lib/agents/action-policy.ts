import { verifyApprovalForAction, type ApprovalAction, type ApprovalStore } from "./approval-store";
/**
 * Fail-closed authorization contract for future external-action executors.
 * This module does not execute actions or provide durable idempotency storage.
 */

export type ExternalActionAuthorization = {
  approvedByUser: boolean;
  idempotencyKey: string;
  durableStoreAvailable: boolean;
  alreadyExecuted: boolean;
};

export type ExternalActionDecision = {
  allowed: boolean;
  reason:
    | "approval-required"
    | "durable-idempotency-unavailable"
    | "duplicate-action"
    | "invalid-idempotency-key"
    | "authorized";
};

export function authorizeExternalAction(
  input: ExternalActionAuthorization,
): ExternalActionDecision {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(input.idempotencyKey)) {
    return { allowed: false, reason: "invalid-idempotency-key" };
  }
  if (!input.approvedByUser) {
    return { allowed: false, reason: "approval-required" };
  }
  if (!input.durableStoreAvailable) {
    return { allowed: false, reason: "durable-idempotency-unavailable" };
  }
  if (input.alreadyExecuted) {
    return { allowed: false, reason: "duplicate-action" };
  }
  return { allowed: true, reason: "authorized" };
}

/**
 * Storage adapter contract for atomic, durable action claims.
 * Implementations must make claim() atomic across concurrent requests.
 * An in-memory Map is NOT a production implementation.
 */
export type DurableActionStore = {
  claim: (key: string) => Promise<boolean>;
};

async function executeClaimedAction<T>(input:{
  idempotencyKey:string;
  store:DurableActionStore|null;
  execute:()=>Promise<T>;
}):Promise<{executed:true;result:T}>{
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(input.idempotencyKey))throw new Error("Invalid external action idempotency key");
  if(!input.store||typeof input.store.claim!=="function")throw new Error("Durable idempotency storage is unavailable");
  const claimed=await input.store.claim(input.idempotencyKey);
  if(!claimed)throw new Error("Duplicate external action rejected");
  const result=await input.execute();
  return{executed:true,result};
}

/**
 * Minimal structural subset of Cloudflare D1 used by the action store.
 * INSERT OR IGNORE + a primary key provides an atomic cross-request claim.
 */
export type D1ActionDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{
        success?: boolean;
        meta?: { changes?: number };
      }>;
    };
  };
};

/**
 * Production adapter. Requires the action_claims migration to be applied.
 * Never replace this with an in-memory Map for external side effects.
 */
export function createD1ActionStore(database: D1ActionDatabase): DurableActionStore {
  if (!database || typeof database.prepare !== "function") {
    throw new Error("A valid D1 action database is required");
  }

  return {
    claim: async (key: string): Promise<boolean> => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(key)) {
        throw new Error("Invalid external action idempotency key");
      }

      const result = await database
        .prepare("INSERT OR IGNORE INTO action_claims (idempotency_key) VALUES (?)")
        .bind(key)
        .run();

      if (result.success === false) {
        throw new Error("D1 action claim failed");
      }

      if (result.meta?.changes === 1) return true;
      if (result.meta?.changes === 0) return false;

      throw new Error("D1 did not return an action claim change count");
    },
  };
}



/** Verify the persisted approval against this exact action before claiming its idempotency key. */
export async function executeVerifiedApprovedAction<T>(input:{
  approvalStore:ApprovalStore|null;
  approvalId:string;
  actorUserId:string;
  workspaceId:string;
  actionType:ApprovalAction;
  payloadHash:string;
  now:string;
  idempotencyKey:string;
  store:DurableActionStore|null;
  execute:()=>Promise<T>;
}):Promise<{executed:true;result:T}>{
  if(!input.approvalStore)throw new Error("Persisted approval storage is unavailable.");
  const approval=await input.approvalStore.get({id:input.approvalId,workspaceId:input.workspaceId,actorUserId:input.actorUserId});
  if(!approval||approval.decidedByUserId!==input.actorUserId)throw new Error("External action blocked: persisted approval not found for the approving user.");
  const decision=verifyApprovalForAction({approval,workspaceId:input.workspaceId,actionType:input.actionType,payloadHash:input.payloadHash,now:input.now});
  if(!decision.allowed)throw new Error("External action blocked: "+decision.reason);
  return executeClaimedAction({idempotencyKey:input.idempotencyKey,store:input.store,execute:input.execute});
}
