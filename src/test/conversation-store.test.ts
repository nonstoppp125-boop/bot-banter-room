import {describe,expect,it} from "vitest";
import {createD1ConversationStore} from "@/lib/agents/conversation-store";

describe("workspace-scoped conversation store",()=>{
 it("scopes lists and search to both workspace and user",async()=>{
  const queries:string[]=[];const values:unknown[][]=[];
  const database={prepare:(query:string)=>({bind:(...args:unknown[])=>({run:async()=>({success:true,meta:{changes:1}}),first:async<T=Record<string,unknown>>()=>null as T|null,all:async<T=Record<string,unknown>>()=>{queries.push(query);values.push(args);return{success:true,results:[] as T[]};}})})};
  const store=createD1ConversationStore(database);
  await store.list({workspaceId:"w1",userId:"u1"});
  await store.search({workspaceId:"w1",userId:"u1",query:"budget"});
  expect(queries.every(q=>q.includes("workspace_id = ?")&&q.includes("user_id = ?"))).toBe(true);
  expect(values[0]?.slice(0,2)).toEqual(["w1","u1"]);
  expect(values[1]?.slice(0,2)).toEqual(["w1","u1"]);
 });
 it("writes messages only through an active user-owned conversation",async()=>{
  let insertQuery="";let insertValues:unknown[]=[];
  const database={prepare:(query:string)=>({bind:(...args:unknown[])=>({run:async()=>{if(query.startsWith("INSERT INTO messages")){insertQuery=query;insertValues=args;}return{success:true,meta:{changes:1}};},first:async<T=Record<string,unknown>>()=>null as T|null,all:async<T=Record<string,unknown>>()=>({success:true,results:[] as T[]})})})};
  const store=createD1ConversationStore(database);
  await store.appendMessage({id:"m1",conversationId:"c1",workspaceId:"w1",userId:"u1",role:"user",content:"Hello",metadata:{},createdAt:"2026-11-16T10:00:00.000Z"});
  expect(insertQuery).toContain("c.user_id");
  expect(insertQuery).toContain("deleted_at IS NULL");
  expect(insertValues.slice(-3)).toEqual(["c1","w1","u1"]);
 });
 it("soft-deletes only the matching workspace and owner",async()=>{
  let values:unknown[]=[];
  const database={prepare:(query:string)=>({bind:(...args:unknown[])=>({run:async()=>{values=args;return{success:true,meta:{changes:1}};},first:async<T=Record<string,unknown>>()=>null as T|null,all:async<T=Record<string,unknown>>()=>({success:true,results:[] as T[]})})})};
  const store=createD1ConversationStore(database);
  expect(await store.delete({conversationId:"c1",workspaceId:"w1",userId:"u1",deletedAt:"2026-11-16T10:00:00.000Z"})).toBe(true);
  expect(values.slice(2)).toEqual(["c1","w1","u1"]);
 });
});
