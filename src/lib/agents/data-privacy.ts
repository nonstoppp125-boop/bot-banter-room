export interface ExportDataset{users:Record<string,unknown>[];workspaces:Record<string,unknown>[];projects:Record<string,unknown>[];conversations:Record<string,unknown>[];messages:Record<string,unknown>[];memories:Record<string,unknown>[];agentTasks:Record<string,unknown>[];approvals:Record<string,unknown>[];appConnections:Record<string,unknown>[];socialAccounts:Record<string,unknown>[];contentDrafts:Record<string,unknown>[];publications:Record<string,unknown>[];analyticsSnapshots:Record<string,unknown>[];auditEvents:Record<string,unknown>[];}
const SENSITIVE_KEYS=/(token|secret|password|credential|authorization|cookie|private.?key|verifier|session|api.?key|oauth.?state|pkce)/i;
function safeRecord(record:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(record).filter(([key])=>!SENSITIVE_KEYS.test(key)).map(([key,value])=>[key,value]));}
function belongs(record:Record<string,unknown>,userId:string,workspaceIds:Set<string>):boolean{
 return record["userId"]===userId||record["user_id"]===userId||record["createdByUserId"]===userId||record["created_by_user_id"]===userId||(typeof record["workspaceId"]==="string"&&workspaceIds.has(record["workspaceId"]))||(typeof record["workspace_id"]==="string"&&workspaceIds.has(record["workspace_id"]));
}
export function buildUserDataExport(input:{userId:string;exportedAt:string;datasets:ExportDataset}){
 if(!/^[A-Za-z0-9._:-]{1,120}$/.test(input.userId)||!Number.isFinite(Date.parse(input.exportedAt)))throw new Error("Invalid data export identity or timestamp.");
 const ownedWorkspaces=input.datasets.workspaces.filter(row=>row["ownerUserId"]===input.userId||row["owner_user_id"]===input.userId);
 const workspaceIds=new Set(ownedWorkspaces.map(row=>String(row["id"])));
 const ownedConversations=input.datasets.conversations.filter(row=>belongs(row,input.userId,workspaceIds));
 const conversationIds=new Set(ownedConversations.map(row=>String(row["id"])));
 const filter=(rows:Record<string,unknown>[])=>rows.filter(row=>belongs(row,input.userId,workspaceIds)).map(safeRecord);
 const filterMessages=(rows:Record<string,unknown>[])=>rows.filter(row=>belongs(row,input.userId,workspaceIds)||(typeof row["conversation_id"]==="string"&&conversationIds.has(row["conversation_id"]))).map(safeRecord);
 const exported={
  users:input.datasets.users.filter(row=>row["id"]===input.userId).map(safeRecord),workspaces:ownedWorkspaces.map(safeRecord),projects:filter(input.datasets.projects),
  conversations:ownedConversations.map(safeRecord),messages:filterMessages(input.datasets.messages),memories:filter(input.datasets.memories),
  agentTasks:filter(input.datasets.agentTasks),approvals:filter(input.datasets.approvals),appConnections:filter(input.datasets.appConnections),
  socialAccounts:filter(input.datasets.socialAccounts),contentDrafts:filter(input.datasets.contentDrafts),publications:filter(input.datasets.publications),
  analyticsSnapshots:filter(input.datasets.analyticsSnapshots),auditEvents:filter(input.datasets.auditEvents),
 };
 return{schemaVersion:1,userId:input.userId,exportedAt:input.exportedAt,redactions:["session tokens","access/refresh tokens","OAuth verifier material","encrypted credential blobs","passwords and secrets"],recordCounts:Object.fromEntries(Object.entries(exported).map(([key,rows])=>[key,rows.length])),data:exported};
}
export interface AccountDeletionRequest{id:string;userId:string;confirmedByUserId:string;confirmedAt:string;requestedAt:string;scheduledFor:string;status:"pending"|"cancelled"|"completed";}
export function createAccountDeletionRequest(input:{id:string;actorUserId:string;targetUserId:string;confirmationPhrase:string;now:string;graceDays?:number}):AccountDeletionRequest{
 const days=input.graceDays??30;
 if(!/^[A-Za-z0-9._:-]{1,120}$/.test(input.id)||!input.actorUserId||input.actorUserId!==input.targetUserId||input.confirmationPhrase!=="DELETE MY ACCOUNT"||!Number.isFinite(Date.parse(input.now))||!Number.isInteger(days)||days<7||days>90)throw new Error("Account deletion confirmation or policy is invalid.");
 return{id:input.id,userId:input.targetUserId,confirmedByUserId:input.actorUserId,confirmedAt:input.now,requestedAt:input.now,scheduledFor:new Date(Date.parse(input.now)+days*86_400_000).toISOString(),status:"pending"};
}
export function isAccountDeletionDue(request:AccountDeletionRequest,now:string):boolean{
 return request.status==="pending"&&Number.isFinite(Date.parse(now))&&Date.parse(request.scheduledFor)<=Date.parse(now);
}
export function buildAccountDeletionPlan(userId:string,workspaceDisposition?:{kind:"delete"}|{kind:"transfer";replacementOwnerUserId:string}):{userId:string;statements:Array<{sql:string;parameters:string[]}>;blockers:string[];preserveAuditTrail:true;executionAllowed:false}{
 if(!/^[A-Za-z0-9._:-]{1,120}$/.test(userId))throw new Error("Invalid account deletion user ID.");
 const blockers:string[]=[];
 const statements:Array<{sql:string;parameters:string[]}>= [
  {sql:"UPDATE sessions SET revoked_at = ? WHERE user_id = ?",parameters:["<now>",userId]},
  {sql:"UPDATE app_connections SET status = 'revoked', encrypted_token_blob = NULL, revoked_at = ?, updated_at = ? WHERE user_id = ?",parameters:["<now>","<now>",userId]},
  {sql:"UPDATE audit_events SET user_id = NULL, actor_type = 'deleted_user' WHERE user_id = ?",parameters:[userId]},
  
 ];
 if(!workspaceDisposition)blockers.push("Owned workspaces must be explicitly deleted or transferred before account deletion.");
 else if(workspaceDisposition.kind==="delete")statements.push({sql:"DELETE FROM workspaces WHERE owner_user_id = ?",parameters:[userId]});
 else if(!/^[A-Za-z0-9._:-]{1,120}$/.test(workspaceDisposition.replacementOwnerUserId)||workspaceDisposition.replacementOwnerUserId===userId)blockers.push("A different valid replacement workspace owner is required.");
 else{
  statements.push({sql:"INSERT OR REPLACE INTO workspace_members (workspace_id,user_id,role,created_at) SELECT id, ?, 'owner', ? FROM workspaces WHERE owner_user_id = ?",parameters:[workspaceDisposition.replacementOwnerUserId,"<now>",userId]});
  statements.push({sql:"UPDATE workspaces SET owner_user_id = ?, updated_at = ? WHERE owner_user_id = ?",parameters:[workspaceDisposition.replacementOwnerUserId,"<now>",userId]});
 }
 statements.push({sql:"DELETE FROM users WHERE id = ?",parameters:[userId]});
 return{userId,statements,blockers,preserveAuditTrail:true,executionAllowed:false};
}


export interface AccountDeletionStore{
 create(request:AccountDeletionRequest):Promise<void>;
 cancel(input:{id:string;userId:string;now:string}):Promise<boolean>;
 listDue(now:string,limit?:number):Promise<AccountDeletionRequest[]>;
 markCompleted(input:{id:string;now:string}):Promise<boolean>;
}
export type D1DeletionDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;all:<T=Record<string,unknown>>()=>Promise<{success?:boolean;results?:T[]}>}}};
export function createD1AccountDeletionStore(database:D1DeletionDatabase):AccountDeletionStore{
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 deletion database is required.");
 const map=(row:{id:string;user_id:string;confirmed_by_user_id:string;confirmed_at:string;requested_at:string;scheduled_for:string;status:"pending"|"cancelled"|"completed"}):AccountDeletionRequest=>({id:row.id,userId:row.user_id,confirmedByUserId:row.confirmed_by_user_id,confirmedAt:row.confirmed_at,requestedAt:row.requested_at,scheduledFor:row.scheduled_for,status:row.status});
 return{
  create:async(request)=>{if(!/^[A-Za-z0-9._:-]{1,120}$/.test(request.id)||!/^[A-Za-z0-9._:-]{1,120}$/.test(request.userId)||request.status!=="pending"||request.userId!==request.confirmedByUserId||!Number.isFinite(Date.parse(request.confirmedAt))||!Number.isFinite(Date.parse(request.scheduledFor))||Date.parse(request.scheduledFor)<=Date.parse(request.requestedAt))throw new Error("Invalid account deletion request.");const result=await database.prepare("INSERT INTO account_deletion_requests (id,user_id,confirmed_by_user_id,confirmed_at,requested_at,scheduled_for,status) VALUES (?,?,?,?,?,?, 'pending')").bind(request.id,request.userId,request.confirmedByUserId,request.confirmedAt,request.requestedAt,request.scheduledFor).run();if(result.success===false||result.meta?.changes!==1)throw new Error("D1 deletion request creation failed.");},
  cancel:async(input)=>{if(!input.id||!input.userId||!Number.isFinite(Date.parse(input.now)))throw new Error("Invalid deletion cancellation.");const result=await database.prepare("UPDATE account_deletion_requests SET status='cancelled' WHERE id=? AND user_id=? AND status='pending' AND scheduled_for>?").bind(input.id,input.userId,input.now).run();if(result.success===false)throw new Error("D1 deletion cancellation failed.");return result.meta?.changes===1;},
  listDue:async(now,limit=50)=>{if(!Number.isFinite(Date.parse(now))||!Number.isInteger(limit)||limit<1||limit>100)throw new Error("Invalid due-deletion query.");const result=await database.prepare("SELECT id,user_id,confirmed_by_user_id,confirmed_at,requested_at,scheduled_for,status FROM account_deletion_requests WHERE status='pending' AND scheduled_for<=? ORDER BY scheduled_for ASC LIMIT ?").bind(now,limit).all<Parameters<typeof map>[0]>();if(result.success===false)throw new Error("D1 due-deletion query failed.");return(result.results??[]).map(map);},
  markCompleted:async(input)=>{if(!input.id||!Number.isFinite(Date.parse(input.now)))throw new Error("Invalid deletion completion.");const result=await database.prepare("UPDATE account_deletion_requests SET status='completed',completed_at=? WHERE id=? AND status='pending' AND scheduled_for<=?").bind(input.now,input.id,input.now).run();if(result.success===false)throw new Error("D1 deletion completion failed.");return result.meta?.changes===1;},
 };
}
