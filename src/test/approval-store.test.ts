import {describe,expect,it} from "vitest";
import {createD1ApprovalStore,hashApprovalPayload,verifyApprovalForAction} from "@/lib/agents/approval-store";
describe("workspace approval persistence",()=>{
 it("hashes action payloads without storing their contents",async()=>{const hash=await hashApprovalPayload({action:"social.publish",draftId:"d1"});expect(hash).toMatch(/^[a-f0-9]{64}$/);});
 it("creates requests only for workspace members and records payload hashes",async()=>{
  let query="";let values:unknown[]=[];
  const database={prepare:(sql:string)=>({bind:(...args:unknown[])=>({run:async()=>{query=sql;values=args;return{success:true,meta:{changes:1}};},first:async<T=Record<string,unknown>>()=>null as T|null,all:async<T=Record<string,unknown>>()=>({success:true,results:[] as T[]})})})};
  const store=createD1ApprovalStore(database);
  await store.create({id:"approval-1",workspaceId:"ws1",userId:"u1",actionType:"social.publish",payloadHash:"a".repeat(64),summary:"Publish the approved LinkedIn draft.",expiresAt:"2026-11-17T10:00:00.000Z",createdAt:"2026-11-16T10:00:00.000Z"});
  expect(query).toContain("workspace_members");
  expect(values[4]).toBe("a".repeat(64));
  expect(query).toContain("summary");
  expect(values[5]).toBe("Publish the approved LinkedIn draft.");
 });
 it("allows only owner/admin decisions and only pending unexpired approvals",async()=>{
  let query="";let values:unknown[]=[];
  const database={prepare:(sql:string)=>({bind:(...args:unknown[])=>({run:async()=>{query=sql;values=args;return{success:true,meta:{changes:1}};},first:async<T=Record<string,unknown>>()=>null as T|null,all:async<T=Record<string,unknown>>()=>({success:true,results:[] as T[]})})})};
  const store=createD1ApprovalStore(database);
  expect(await store.decide({id:"approval-1",workspaceId:"ws1",actorUserId:"u1",decision:"approved",reason:"Reviewed and accepted",now:"2026-11-16T10:00:00.000Z"})).toBe(true);
  expect(query).toContain("status = 'pending'");
  expect(query).toContain("role IN ('owner','admin')");
  expect(values[0]).toBe("approved");
 });
});

it("authorizes only an exact, unexpired approved action payload",async()=>{
 const approval={id:"a1",workspaceId:"ws1",userId:"u1",actionType:"social.publish" as const,payloadHash:"a".repeat(64),summary:"Publish approved draft",status:"approved" as const,decidedByUserId:"admin1",decisionReason:"approved",expiresAt:"2026-11-17T10:00:00.000Z",createdAt:"2026-11-16T09:00:00.000Z",decidedAt:"2026-11-16T10:00:00.000Z"};
 const base={approval,workspaceId:"ws1",actionType:"social.publish" as const,payloadHash:"a".repeat(64),now:"2026-11-16T11:00:00.000Z"};
 expect(verifyApprovalForAction(base).allowed).toBe(true);
 expect(verifyApprovalForAction({...base,payloadHash:"b".repeat(64)}).allowed).toBe(false);
 expect(verifyApprovalForAction({...base,workspaceId:"other"}).allowed).toBe(false);
 expect(verifyApprovalForAction({...base,now:"2026-11-18T00:00:00.000Z"}).allowed).toBe(false);
});
