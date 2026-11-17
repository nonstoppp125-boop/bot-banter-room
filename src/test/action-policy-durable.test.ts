import { describe, expect, it, vi } from "vitest";
import { createD1ActionStore, executeVerifiedApprovedAction } from "@/lib/agents/action-policy";

describe("durable external action boundary", () => {
  const approval = {
    id:"approval-1",workspaceId:"ws1",userId:"u1",actionType:"social.publish" as const,
    payloadHash:"a".repeat(64),summary:"Publish approved draft",status:"approved" as const,decidedByUserId:"admin1",
    decisionReason:"Reviewed",expiresAt:"2026-11-17T10:00:00.000Z",
    createdAt:"2026-11-16T09:00:00.000Z",decidedAt:"2026-11-16T10:00:00.000Z",
  };
  const approvalStore = { get: vi.fn(async () => approval) };
  const base = {
    approvalStore,approvalId:"approval-1",actorUserId:"admin1",workspaceId:"ws1",
    actionType:"social.publish" as const,payloadHash:"a".repeat(64),
    now:"2026-11-16T11:00:00.000Z",idempotencyKey:"action-1",
    store:{claim:vi.fn(async()=>true)},execute:async()=>"done",
  };

  it("fails closed without persisted approval or durable storage",async()=>{
    await expect(executeVerifiedApprovedAction({...base,approvalStore:null})).rejects.toThrow(/approval storage/i);
    await expect(executeVerifiedApprovedAction({...base,store:null})).rejects.toThrow(/storage/i);
  });

  it("rejects duplicate claims before executing",async()=>{
    const execute=vi.fn(async()=>"done");
    await expect(executeVerifiedApprovedAction({...base,store:{claim:vi.fn(async()=>false)},execute})).rejects.toThrow(/duplicate/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it("claims the key before executing an approved action",async()=>{
    const order:string[]=[];
    const result=await executeVerifiedApprovedAction({...base,store:{claim:vi.fn(async()=>{order.push("claim");return true;})},execute:async()=>{order.push("execute");return"completed";}});
    expect(order).toEqual(["claim","execute"]);
    expect(result).toEqual({executed:true,result:"completed"});
  });

  it("uses an atomic D1 insert and accepts only a newly inserted claim", async () => {
    const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const store = createD1ActionStore({ prepare });

    await expect(store.claim("d1-action-1")).resolves.toBe(true);
    expect(prepare).toHaveBeenCalledWith(
      "INSERT OR IGNORE INTO action_claims (idempotency_key) VALUES (?)",
    );
    expect(bind).toHaveBeenCalledWith("d1-action-1");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate D1 claim when the unique key already exists", async () => {
    const store = createD1ActionStore({
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true, meta: { changes: 0 } }),
        }),
      }),
    });

    await expect(store.claim("d1-action-2")).resolves.toBe(false);
  });

  it("fails closed when D1 cannot confirm the claim result", async () => {
    const store = createD1ActionStore({
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
        }),
      }),
    });

    await expect(store.claim("d1-action-3")).rejects.toThrow(/change count/i);
  });

  it("rejects invalid keys before sending a query to D1", async () => {
    const prepare = vi.fn();
    const store = createD1ActionStore({ prepare });

    await expect(store.claim("invalid key")).rejects.toThrow(/invalid/i);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("propagates D1 write failures instead of authorizing execution", async () => {
    const store = createD1ActionStore({
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: false, meta: { changes: 0 } }),
        }),
      }),
    });

    await expect(store.claim("d1-action-4")).rejects.toThrow(/D1 action claim failed/i);
  });

  it("requires a persisted approval bound to the exact action and payload", async () => {
    const approval = {
      id: "approval-1", workspaceId: "ws1", userId: "u1",
      actionType: "social.publish" as const, payloadHash: "a".repeat(64), summary: "Publish approved draft",
      status: "approved" as const, decidedByUserId: "admin1",
      decisionReason: "Reviewed", expiresAt: "2026-11-17T10:00:00.000Z",
      createdAt: "2026-11-16T09:00:00.000Z", decidedAt: "2026-11-16T10:00:00.000Z",
    };
    const execute = vi.fn(async () => "published");
    const store = { claim: vi.fn(async () => true) };
    const approvalStore = { get: vi.fn(async () => approval) };
    const input = { approvalStore, approvalId: "approval-1", actorUserId: "admin1", workspaceId: "ws1", actionType: "social.publish" as const,
      payloadHash: "a".repeat(64), now: "2026-11-16T11:00:00.000Z",
      idempotencyKey: "publish-1", store, execute };
    await expect(executeVerifiedApprovedAction(input)).resolves.toMatchObject({ executed: true, result: "published" });
    expect(approvalStore.get).toHaveBeenCalledWith({ id: "approval-1", workspaceId: "ws1", actorUserId: "admin1" });
    expect(store.claim).toHaveBeenCalledTimes(1);
    await expect(executeVerifiedApprovedAction({ ...input, payloadHash: "b".repeat(64) })).rejects.toThrow(/approval/i);
    expect(execute).toHaveBeenCalledTimes(1);
    await expect(executeVerifiedApprovedAction({ ...input, actorUserId: "other-user" })).rejects.toThrow(/approving user/i);
    await expect(executeVerifiedApprovedAction({ ...input, approvalStore: null })).rejects.toThrow(/storage/i);
  });


  it("allows only one winner when two workers claim the same D1 idempotency key", async () => {
    const claimed = new Set<string>();
    const store = createD1ActionStore({
      prepare: () => ({
        bind: (key: unknown) => ({
          run: async () => {
            const value = String(key);
            if (claimed.has(value)) return { success: true, meta: { changes: 0 } };
            claimed.add(value);
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    });
    const results = await Promise.all([store.claim("concurrent-action"), store.claim("concurrent-action")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((value) => !value)).toHaveLength(1);
  });

});