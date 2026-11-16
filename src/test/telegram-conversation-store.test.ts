import {describe,expect,it} from "vitest";
import {createD1TelegramConversationStore} from "@/lib/agents/telegram-conversation-store";
describe("Telegram conversation continuity store",()=>{
 it("creates a link only through active identity, membership and owned conversation predicates",async()=>{
  let query="";let values:unknown[]=[];
  const database={prepare:(sql:string)=>({bind:(...args:unknown[])=>({run:async()=>{query=sql;values=args;return{success:true,meta:{changes:1}};},first:async<T=Record<string,unknown>>()=>null as T|null})})};
  const store=createD1TelegramConversationStore(database);
  await store.create({botId:"bot-1",chatId:"123",telegramUserId:"123",userId:"user-1",workspaceId:"ws-1",conversationId:"conv-1",now:"2026-11-16T10:00:00.000Z"});
  expect(query).toContain("telegram_user_links");
  expect(query).toContain("workspace_members");
  expect(query).toContain("c.deleted_at IS NULL");
  expect(values.slice(8,12)).toEqual(["bot-1","123","user-1","ws-1"]);
 });
 it("reads only a live mapping for the linked owner",async()=>{
  const database={prepare:(sql:string)=>({bind:(...args:unknown[])=>({run:async()=>({success:true,meta:{changes:1}}),first:async<T=Record<string,unknown>>()=>args[3]==="user-1"?({bot_id:"bot-1",telegram_chat_id:"123",telegram_user_id:"123",user_id:"user-1",workspace_id:"ws-1",conversation_id:"conv-1",updated_at:"2026-11-16T10:00:00.000Z"} as T):null})})};
  const store=createD1TelegramConversationStore(database);
  expect(await store.get({botId:"bot-1",chatId:"123",telegramUserId:"123",userId:"user-1"})).toMatchObject({conversationId:"conv-1",workspaceId:"ws-1"});
  expect(await store.get({botId:"bot-1",chatId:"123",telegramUserId:"123",userId:"user-2"})).toBeNull();
 });
});
