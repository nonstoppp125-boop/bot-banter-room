export interface ExportDataset{users:Record<string,unknown>[];workspaces:Record<string,unknown>[];projects:Record<string,unknown>[];conversations:Record<string,unknown>[];messages:Record<string,unknown>[];memories:Record<string,unknown>[];agentTasks:Record<string,unknown>[];approvals:Record<string,unknown>[];appConnections:Record<string,unknown>[];socialAccounts:Record<string,unknown>[];contentDrafts:Record<string,unknown>[];publications:Record<string,unknown>[];analyticsSnapshots:Record<string,unknown>[];auditEvents:Record<string,unknown>[];}
const SENSITIVE_KEYS=/(token|secret|password|credential|authorization|cookie|private.?key|verifier|session)/i;
function safeRecord(record:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(record).filter(([key])=>!SENSITIVE_KEYS.test(key)).map(([key,value])=>[key,value]));}
function belongs(record:Record<string,unknown>,userId:string,workspaceIds:Set<string>):boolean{
 return record["userId"]===userId||record["user_id"]===userId||(typeof record["workspaceId"]==="string"&&workspaceIds.has(record["workspaceId"]))||(typeof record["workspace_id"]==="string"&&workspaceIds.has(record["workspace_id"]));
}
export function buildUserDataExport(input:{userId:string;exportedAt:string;datasets:ExportDataset}){
 if(!/^[A-Za-z0-9._:-]{1,120}$/.test(input.userId)||!Number.isFinite(Date.parse(input.exportedAt)))throw new Error("Invalid data export identity or timestamp.");
 const ownedWorkspaces=input.datasets.workspaces.filter(row=>row["ownerUserId"]===input.userId||row["owner_user_id"]===input.userId);
 const workspaceIds=new Set(ownedWorkspaces.map(row=>String(row["id"])));
 const filter=(rows:Record<string,unknown>[])=>rows.filter(row=>belongs(row,input.userId,workspaceIds)).map(safeRecord);
 const exported={
  users:input.datasets.users.filter(row=>row["id"]===input.userId).map(safeRecord),workspaces:ownedWorkspaces.map(safeRecord),projects:filter(input.datasets.projects),
  conversations:filter(input.datasets.conversations),messages:filter(input.datasets.messages),memories:filter(input.datasets.memories),
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
  {sql:"DELETE FROM projects WHERE created_by_user_id = ?",parameters:[userId]},
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
