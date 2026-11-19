export type ConversationRole = "user" | "assistant" | "tool";
export interface ConversationRecord { id:string; workspaceId:string; userId:string; title:string; createdAt:string; updatedAt:string; }
export interface MessageRecord { id:string; conversationId:string; workspaceId:string; userId:string; role:ConversationRole; content:string; metadata:Record<string,unknown>; createdAt:string; }
export interface ConversationExport { conversation:ConversationRecord; messages:MessageRecord[]; }
export type D1ConversationDatabase = {
  prepare:(query:string)=>{bind:(...values:unknown[])=>{
    run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;
    first:<T=Record<string,unknown>>()=>Promise<T|null>;
    all:<T=Record<string,unknown>>()=>Promise<{success?:boolean;results?:T[]}>;
  }};
};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const validTime=(value:string)=>Number.isFinite(Date.parse(value));
const clean=(value:string,max:number)=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g," ").trim().slice(0,max);
function parseMetadata(value:string):Record<string,unknown>{
 try{const parsed:unknown=JSON.parse(value);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}catch{return{};}
}
export function createD1ConversationStore(database:D1ConversationDatabase){
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 conversation database is required.");
 return{
  create:async(input:ConversationRecord)=>{
   if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!clean(input.title,200)||!validTime(input.createdAt)||!validTime(input.updatedAt))throw new Error("Invalid conversation record.");
   const result=await database.prepare("INSERT INTO conversations (id, workspace_id, user_id, title, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?)").bind(input.id,input.workspaceId,input.userId,clean(input.title,200),input.createdAt,input.updatedAt,input.workspaceId,input.userId).run();
   if(result.success===false||result.meta?.changes!==1)throw new Error("D1 conversation creation failed.");
  },
  list:async(input:{workspaceId:string;userId:string;limit?:number})=>{
   if(!ID.test(input.workspaceId)||!ID.test(input.userId))return[];
   const limit=input.limit??30;if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error("Conversation list limit must be between 1 and 100.");
   const result=await database.prepare("SELECT id, workspace_id, user_id, title, created_at, updated_at FROM conversations WHERE workspace_id = ? AND user_id = ? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversations.workspace_id AND wm.user_id = conversations.user_id) ORDER BY updated_at DESC LIMIT ?").bind(input.workspaceId,input.userId,limit).all<{id:string;workspace_id:string;user_id:string;title:string;created_at:string;updated_at:string}>();
   if(result.success===false)throw new Error("D1 conversation list failed.");
   return(result.results??[]).map(row=>({id:row.id,workspaceId:row.workspace_id,userId:row.user_id,title:row.title,createdAt:row.created_at,updatedAt:row.updated_at}));
  },
  search:async(input:{workspaceId:string;userId:string;query:string;limit?:number})=>{
   const query=clean(input.query,200);if(!ID.test(input.workspaceId)||!ID.test(input.userId)||query.length<2)return[];
   const limit=input.limit??30;if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error("Conversation search limit must be between 1 and 100.");
   const result=await database.prepare("SELECT c.id, c.workspace_id, c.user_id, c.title, c.created_at, c.updated_at FROM conversations c WHERE c.workspace_id = ? AND c.user_id = ? AND c.deleted_at IS NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = c.workspace_id AND wm.user_id = c.user_id) AND (instr(lower(c.title), lower(?)) > 0 OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.workspace_id = c.workspace_id AND instr(lower(m.content), lower(?)) > 0)) ORDER BY c.updated_at DESC LIMIT ?").bind(input.workspaceId,input.userId,query,query,limit).all<{id:string;workspace_id:string;user_id:string;title:string;created_at:string;updated_at:string}>();
   if(result.success===false)throw new Error("D1 conversation search failed.");
   return(result.results??[]).map(row=>({id:row.id,workspaceId:row.workspace_id,userId:row.user_id,title:row.title,createdAt:row.created_at,updatedAt:row.updated_at}));
  },
  appendMessage:async(input:MessageRecord)=>{
   if(!ID.test(input.id)||!ID.test(input.conversationId)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!["user","assistant","tool"].includes(input.role)||!input.content.trim()||input.content.length>200_000||!validTime(input.createdAt))throw new Error("Invalid conversation message.");
   const metadata=JSON.stringify(input.metadata&&typeof input.metadata==="object"?input.metadata:{});if(metadata.length>20_000)throw new Error("Message metadata exceeds the 20 KB limit.");
   const result=await database.prepare("INSERT INTO messages (id, workspace_id, conversation_id, role, content, metadata_json, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM conversations c WHERE c.id = ? AND c.workspace_id = ? AND c.user_id = ? AND c.deleted_at IS NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = c.workspace_id AND wm.user_id = c.user_id))").bind(input.id,input.workspaceId,input.conversationId,input.role,clean(input.content,200_000),metadata,input.createdAt,input.conversationId,input.workspaceId,input.userId).run();
   if(result.success===false||result.meta?.changes!==1)throw new Error("Conversation not found or message write failed.");
   await database.prepare("UPDATE conversations SET updated_at = ? WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL").bind(input.createdAt,input.conversationId,input.workspaceId).run();
  },
  listMessages:async(input:{conversationId:string;workspaceId:string;userId:string;limit?:number})=>{
   if(!ID.test(input.conversationId)||!ID.test(input.workspaceId)||!ID.test(input.userId))return[];const limit=input.limit??500;if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error("Message list limit must be between 1 and 1000.");
   const result=await database.prepare("SELECT m.id, m.conversation_id, m.workspace_id, m.role, m.content, m.metadata_json, m.created_at FROM messages m JOIN conversations c ON c.id = m.conversation_id AND c.workspace_id = m.workspace_id WHERE m.conversation_id = ? AND m.workspace_id = ? AND c.user_id = ? AND c.deleted_at IS NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = c.workspace_id AND wm.user_id = c.user_id) ORDER BY m.created_at ASC LIMIT ?").bind(input.conversationId,input.workspaceId,input.userId,limit).all<{id:string;conversation_id:string;workspace_id:string;role:ConversationRole;content:string;metadata_json:string;created_at:string}>();
   if(result.success===false)throw new Error("D1 message list failed.");
   return(result.results??[]).map(row=>({id:row.id,conversationId:row.conversation_id,workspaceId:row.workspace_id,role:row.role,content:row.content,metadata:parseMetadata(row.metadata_json),createdAt:row.created_at}));
  },
  delete:async(input:{conversationId:string;workspaceId:string;userId:string;deletedAt:string})=>{
   if(!validTime(input.deletedAt))throw new Error("Invalid conversation deletion timestamp.");
   const result=await database.prepare("UPDATE conversations SET deleted_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversations.workspace_id AND wm.user_id = conversations.user_id)").bind(input.deletedAt,input.deletedAt,input.conversationId,input.workspaceId,input.userId).run();
   if(result.success===false)throw new Error("D1 conversation deletion failed.");
   return result.meta?.changes===1;
  },
 };
}
