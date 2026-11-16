export interface TelegramMessageInput {
  updateId:number; telegramUserId:string; chatId:string; messageId:number; text:string; languageCode:string|null; receivedAt:string;
}
export interface TelegramIdentity { botId:string; telegramUserId:string; userId:string; workspaceId:string; }
export type D1TelegramDatabase={
 prepare:(query:string)=>{bind:(...values:unknown[])=>{
  run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;
  first:<T=Record<string,unknown>>()=>Promise<T|null>;
 }};
};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
function clean(value:string,max:number){return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g," ").trim().slice(0,max);}
export function verifyTelegramWebhookSecret(received:string|null,expected:string|undefined):boolean{
 if(!received||!expected||!/^[A-Za-z0-9_-]{32,256}$/.test(expected))return false;
 const a=new TextEncoder().encode(received),b=new TextEncoder().encode(expected);
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]!^b[i]!;
 return diff===0;
}
export function normalizeTelegramPrivateMessage(value:unknown,receivedAt:string):TelegramMessageInput|null{
 if(!value||typeof value!=="object"||Array.isArray(value)||!Number.isFinite(Date.parse(receivedAt)))return null;
 const update=value as Record<string,unknown>;
 if(!Number.isSafeInteger(update["update_id"])||(update["update_id"] as number)<0)return null;
 const message=update["message"];
 if(!message||typeof message!=="object"||Array.isArray(message))return null;
 const m=message as Record<string,unknown>,from=m["from"],chat=m["chat"];
 if(!from||typeof from!=="object"||Array.isArray(from)||!chat||typeof chat!=="object"||Array.isArray(chat))return null;
 const sender=from as Record<string,unknown>,room=chat as Record<string,unknown>;
 const userId=sender["id"],chatId=room["id"],text=m["text"];
 if(!Number.isSafeInteger(userId)||(userId as number)<=0||sender["is_bot"]===true||
    room["type"]!=="private"||chatId!==userId||typeof text!=="string"||!text.trim()||Array.from(text).length>4096||
    !Number.isSafeInteger(m["message_id"])||!Number.isSafeInteger(m["date"]))return null;
 const language=sender["language_code"];
 return{
  updateId:update["update_id"] as number,
  telegramUserId:String(userId),
  chatId:String(chatId),
  messageId:m["message_id"] as number,
  text:clean(text,8192),
  languageCode:typeof language==="string"?clean(language,16):null,
  receivedAt,
 };
}
export function splitTelegramText(text:string,maxCodePoints=4096):string[]{
 if(!Number.isInteger(maxCodePoints)||maxCodePoints<1||maxCodePoints>4096)throw new Error("Telegram message chunk size must be between 1 and 4096.");
 const chars=Array.from(text);if(!chars.length)return[];
 const chunks:string[]=[];
 for(let i=0;i<chars.length;i+=maxCodePoints)chunks.push(chars.slice(i,i+maxCodePoints).join(""));
 return chunks;
}
export interface TelegramBridgeStore {
 getIdentity(botId:string,telegramUserId:string):Promise<TelegramIdentity|null>;
 claimUpdate(botId:string,updateId:number,receivedAt:string,expiresAt:string):Promise<boolean>;
}
export function createD1TelegramBridgeStore(database:D1TelegramDatabase):TelegramBridgeStore{
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 Telegram database is required.");
 return{
  getIdentity:async(botId,telegramUserId)=>{
   if(!ID.test(botId)||!/^[1-9][0-9]{0,19}$/.test(telegramUserId))return null;
   const row=await database.prepare("SELECT l.bot_id, l.telegram_user_id, l.user_id, l.workspace_id FROM telegram_user_links l JOIN workspace_members wm ON wm.workspace_id = l.workspace_id AND wm.user_id = l.user_id WHERE l.bot_id = ? AND l.telegram_user_id = ? AND l.status = 'active' AND l.revoked_at IS NULL LIMIT 1").bind(botId,telegramUserId).first<{bot_id:string;telegram_user_id:string;user_id:string;workspace_id:string}>();
   return row?{botId:row.bot_id,telegramUserId:row.telegram_user_id,userId:row.user_id,workspaceId:row.workspace_id}:null;
  },
  claimUpdate:async(botId,updateId,receivedAt,expiresAt)=>{
   if(!ID.test(botId)||!Number.isSafeInteger(updateId)||updateId<0||!Number.isFinite(Date.parse(receivedAt))||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.parse(receivedAt))return false;
   await database.prepare("DELETE FROM telegram_update_claims WHERE expires_at <= ?").bind(receivedAt).run();
   const result=await database.prepare("INSERT OR IGNORE INTO telegram_update_claims (bot_id, update_id, received_at, expires_at) VALUES (?, ?, ?, ?)").bind(botId,updateId,receivedAt,expiresAt).run();
   if(result.success===false)throw new Error("D1 Telegram update claim failed.");
   if(result.meta?.changes===1)return true;
   if(result.meta?.changes===0)return false;
   throw new Error("D1 did not return Telegram update claim change count.");
  },
 };
}
