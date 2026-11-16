export type ApprovalStatus="pending"|"approved"|"rejected"|"expired";
export type ApprovalAction="social.publish"|"social.reply"|"external.message"|"account.change"|"destructive.delete"|"deployment"|"financial.action";
export interface ApprovalRecord{id:string;workspaceId:string;userId:string;actionType:ApprovalAction;payloadHash:string;status:ApprovalStatus;decidedByUserId:string|null;decisionReason:string|null;expiresAt:string;createdAt:string;decidedAt:string|null;}
type D1ApprovalDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;first:<T=Record<string,unknown>>()=>Promise<T|null>;all:<T=Record<string,unknown>>()=>Promise<{success?:boolean;results?:T[]}>}}};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const ACTIONS=new Set<ApprovalAction>(["social.publish","social.reply","external.message","account.change","destructive.delete","deployment","financial.action"]);
const iso=(value:string)=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export async function hashApprovalPayload(payload:unknown):Promise<string>{
 const json=JSON.stringify(payload);if(!json||json.length>100_000)throw new Error("Approval payload is missing or too large.");
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(json)));
 return Array.from(digest,byte=>byte.toString(16).padStart(2,"0")).join("");
}
export interface ApprovalStore { get(input:{id:string;workspaceId:string;actorUserId:string}):Promise<ApprovalRecord|null>; }
export function createD1ApprovalStore(database:D1ApprovalDatabase){
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 approval database is required.");
 const map=(row:{id:string;workspace_id:string;user_id:string;action_type:ApprovalAction;payload_hash:string;status:ApprovalStatus;decided_by_user_id:string|null;decision_reason:string|null;expires_at:string;created_at:string;decided_at:string|null}):ApprovalRecord=>({id:row.id,workspaceId:row.workspace_id,userId:row.user_id,actionType:row.action_type,payloadHash:row.payload_hash,status:row.status,decidedByUserId:row.decided_by_user_id,decisionReason:row.decision_reason,expiresAt:row.expires_at,createdAt:row.created_at,decidedAt:row.decided_at});
 return{
  create:async(input:{id:string;workspaceId:string;userId:string;actionType:ApprovalAction;payloadHash:string;expiresAt:string;createdAt:string})=>{
   if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!ACTIONS.has(input.actionType)||!/^[a-f0-9]{64}$/.test(input.payloadHash)||!iso(input.createdAt)||!iso(input.expiresAt)||Date.parse(input.expiresAt)<=Date.parse(input.createdAt))throw new Error("Invalid approval request.");
   const result=await database.prepare("INSERT INTO approvals (id, workspace_id, user_id, action_type, payload_hash, status, expires_at, created_at) SELECT ?, ?, ?, ?, ?, 'pending', ?, ? WHERE EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?)").bind(input.id,input.workspaceId,input.userId,input.actionType,input.payloadHash,input.expiresAt,input.createdAt,input.workspaceId,input.userId).run();
   if(result.success===false||result.meta?.changes!==1)throw new Error("Approval request rejected or duplicate.");
  },
  get:async(input:{id:string;workspaceId:string;actorUserId:string})=>{
   const row=await database.prepare("SELECT a.* FROM approvals a JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ? WHERE a.id = ? AND a.workspace_id = ? LIMIT 1").bind(input.actorUserId,input.id,input.workspaceId).first<Parameters<typeof map>[0]>();
   return row?map(row):null;
  },
  listPending:async(input:{workspaceId:string;actorUserId:string;now:string;limit?:number})=>{
   if(!iso(input.now))throw new Error("Approval list timestamp is invalid.");
   const limit=input.limit??50;if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error("Approval list limit must be between 1 and 100.");
   const result=await database.prepare("SELECT a.* FROM approvals a JOIN workspace_members wm ON wm.workspace_id = a.workspace_id AND wm.user_id = ? WHERE a.workspace_id = ? AND a.status = 'pending' AND a.expires_at > ? AND wm.role IN ('owner','admin') ORDER BY a.created_at ASC LIMIT ?").bind(input.actorUserId,input.workspaceId,input.now,limit).all<Parameters<typeof map>[0]>();
   if(result.success===false)throw new Error("D1 approval list failed.");
   return(result.results??[]).map(map);
  },
  decide:async(input:{id:string;workspaceId:string;actorUserId:string;decision:"approved"|"rejected";reason:string;now:string})=>{
   const reason=input.reason.trim().slice(0,1000);
   if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.actorUserId)||!reason||!iso(input.now))throw new Error("Invalid approval decision.");
   const result=await database.prepare("UPDATE approvals SET status = ?, decided_by_user_id = ?, decision_reason = ?, decided_at = ? WHERE id = ? AND workspace_id = ? AND status = 'pending' AND expires_at > ? AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = approvals.workspace_id AND wm.user_id = ? AND wm.role IN ('owner','admin'))").bind(input.decision,input.actorUserId,reason,input.now,input.id,input.workspaceId,input.now,input.actorUserId).run();
   if(result.success===false)throw new Error("D1 approval decision failed.");
   return result.meta?.changes===1;
  },
 };
}

export function verifyApprovalForAction(input:{approval:ApprovalRecord|null;workspaceId:string;actionType:ApprovalAction;payloadHash:string;now:string}):{allowed:boolean;reason:string}{
 const approval=input.approval;
 if(!approval)return{allowed:false,reason:"Approval record not found."};
 if(!iso(input.now))return{allowed:false,reason:"Action verification timestamp is invalid."};
 if(approval.status!=="approved"||!approval.decidedByUserId||!approval.decidedAt)return{allowed:false,reason:"Approval is not finally approved."};
 if(approval.workspaceId!==input.workspaceId)return{allowed:false,reason:"Approval belongs to a different workspace."};
 if(approval.actionType!==input.actionType)return{allowed:false,reason:"Approval action type does not match."};
 if(approval.payloadHash!==input.payloadHash||!/^[a-f0-9]{64}$/.test(input.payloadHash))return{allowed:false,reason:"Approved payload hash does not match the requested action."};
 if(Date.parse(approval.expiresAt)<=Date.parse(input.now))return{allowed:false,reason:"Approval has expired."};
 if(Date.parse(approval.decidedAt)>Date.parse(input.now))return{allowed:false,reason:"Approval decision timestamp is in the future."};
 return{allowed:true,reason:"Persisted approval matches workspace, action, payload and expiry."};
}
