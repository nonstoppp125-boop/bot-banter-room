export interface TelegramConversationLinkInput {
  botId:string; chatId:string; telegramUserId:string; userId:string;
  workspaceId:string; conversationId:string; now:string;
}
export interface TelegramConversationLink {
  botId:string; chatId:string; telegramUserId:string; userId:string;
  workspaceId:string; conversationId:string; updatedAt:string;
}
export type D1TelegramConversationDatabase={
 prepare:(query:string)=>{bind:(...values:unknown[])=>{
  run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;
  first:<T=Record<string,unknown>>()=>Promise<T|null>;
 }};
};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const TELEGRAM_ID=/^[1-9][0-9]{0,19}$/;
export function createD1TelegramConversationStore(database:D1TelegramConversationDatabase){
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 Telegram conversation database is required.");
 return{
  create:async(input:TelegramConversationLinkInput)=>{
   if(!ID.test(input.botId)||!TELEGRAM_ID.test(input.chatId)||!TELEGRAM_ID.test(input.telegramUserId)||input.chatId!==input.telegramUserId||!ID.test(input.userId)||!ID.test(input.workspaceId)||!ID.test(input.conversationId)||!Number.isFinite(Date.parse(input.now)))throw new Error("Invalid Telegram conversation link.");
   const result=await database.prepare("INSERT INTO telegram_chat_conversations (bot_id, telegram_chat_id, telegram_user_id, user_id, workspace_id, conversation_id, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM telegram_user_links l JOIN workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = l.user_id WHERE l.bot_id = ? AND l.telegram_user_id = ? AND l.user_id = ? AND l.workspace_id = ? AND l.status = 'active' AND l.revoked_at IS NULL) AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = ? AND c.workspace_id = ? AND c.user_id = ? AND c.deleted_at IS NULL)").bind(input.botId,input.chatId,input.telegramUserId,input.userId,input.workspaceId,input.conversationId,input.now,input.now,input.botId,input.telegramUserId,input.userId,input.workspaceId,input.conversationId,input.workspaceId,input.userId).run();
   if(result.success===false||result.meta?.changes!==1)throw new Error("Telegram conversation link rejected or already exists.");
  },
  get:async(input:{botId:string;chatId:string;telegramUserId:string;userId:string})=>{
   if(!ID.test(input.botId)||!TELEGRAM_ID.test(input.chatId)||!TELEGRAM_ID.test(input.telegramUserId)||input.chatId!==input.telegramUserId||!ID.test(input.userId))return null;
   const row=await database.prepare("SELECT tc.bot_id, tc.telegram_chat_id, tc.telegram_user_id, tc.user_id, tc.workspace_id, tc.conversation_id, tc.updated_at FROM telegram_chat_conversations tc JOIN telegram_user_links l ON l.bot_id = tc.bot_id AND l.telegram_user_id = tc.telegram_user_id AND l.user_id = tc.user_id AND l.workspace_id = tc.workspace_id JOIN workspace_members wm ON wm.workspace_id = tc.workspace_id AND wm.user_id = tc.user_id JOIN conversations c ON c.id = tc.conversation_id AND c.workspace_id = tc.workspace_id AND c.user_id = tc.user_id WHERE tc.bot_id = ? AND tc.telegram_chat_id = ? AND tc.telegram_user_id = ? AND tc.user_id = ? AND l.status = 'active' AND l.revoked_at IS NULL AND c.deleted_at IS NULL LIMIT 1").bind(input.botId,input.chatId,input.telegramUserId,input.userId).first<{bot_id:string;telegram_chat_id:string;telegram_user_id:string;user_id:string;workspace_id:string;conversation_id:string;updated_at:string}>();
   return row?{botId:row.bot_id,chatId:row.telegram_chat_id,telegramUserId:row.telegram_user_id,userId:row.user_id,workspaceId:row.workspace_id,conversationId:row.conversation_id,updatedAt:row.updated_at}:null;
  },
 };
}
