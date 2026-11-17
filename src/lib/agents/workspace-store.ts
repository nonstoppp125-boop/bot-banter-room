export type WorkspaceRole="owner"|"admin"|"member";
export interface WorkspaceMembership{workspaceId:string;userId:string;role:WorkspaceRole;}
export type D1WorkspaceDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{first:<T=Record<string,unknown>>()=>Promise<T|null>}}};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const ROLE_WEIGHT:Record<WorkspaceRole,number>={member:1,admin:2,owner:3};
export function authorizeWorkspaceRole(input:{membership:WorkspaceMembership|null;workspaceId:string;userId:string;requiredRole:WorkspaceRole}):{allowed:boolean;reason:string}{
 const m=input.membership;
 if(!m||m.workspaceId!==input.workspaceId||m.userId!==input.userId)return{allowed:false,reason:"Workspace membership not found for this user."};
 if(ROLE_WEIGHT[m.role]<ROLE_WEIGHT[input.requiredRole])return{allowed:false,reason:"Workspace role is insufficient."};
 return{allowed:true,reason:"Workspace membership and role verified."};
}
export function createD1WorkspaceAccessStore(database:D1WorkspaceDatabase){
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 workspace database is required.");
 return{getMembership:async(workspaceId:string,userId:string):Promise<WorkspaceMembership|null>=>{
  if(!ID.test(workspaceId)||!ID.test(userId))return null;
  const row=await database.prepare("SELECT workspace_id, user_id, role FROM workspace_members WHERE workspace_id = ? AND user_id = ? LIMIT 1").bind(workspaceId,userId).first<{workspace_id:string;user_id:string;role:string}>();
  if(!row||!(["owner","admin","member"] as string[]).includes(row.role))return null;
  return{workspaceId:row.workspace_id,userId:row.user_id,role:row.role as WorkspaceRole};
 }};
}
export function validateWorkspaceRecord(input:{id:string;ownerUserId:string;name:string;createdAt:string;updatedAt:string}){
 if(!ID.test(input.id)||!ID.test(input.ownerUserId)||!input.name.trim()||input.name.length>120||!Number.isFinite(Date.parse(input.createdAt))||!Number.isFinite(Date.parse(input.updatedAt)))throw new Error("Invalid workspace record.");
 return{...input,name:input.name.trim()};
}
export function createRetentionPolicy(input:{conversationDays:number;taskDays:number;auditDays:number;memoryDays:number}){
 const values=Object.values(input);
 if(values.some(value=>!Number.isInteger(value)||value<1||value>3650))throw new Error("Retention periods must be whole days between 1 and 3650.");
 return{...input,note:"Policy metadata only; scheduled deletion and legal-hold enforcement are not implemented."};
}
