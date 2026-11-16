export type DurableTaskStatus="queued"|"running"|"completed"|"failed"|"cancelled"|"needs_approval";
export interface DurableAgentTask{id:string;workspaceId:string;userId:string;status:DurableTaskStatus;inputSummary:string;plan:unknown;result:unknown|null;createdAt:string;updatedAt:string;}
export type D1TaskDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;first:<T=Record<string,unknown>>()=>Promise<T|null>;all:<T=Record<string,unknown>>()=>Promise<{success?:boolean;results?:T[]}>}}};
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const STATUSES=new Set<DurableTaskStatus>(["queued","running","completed","failed","cancelled","needs_approval"]);
const ALLOWED_TRANSITIONS: Readonly<Record<DurableTaskStatus, readonly DurableTaskStatus[]>> = {
 queued: ["running", "cancelled"],
 running: ["completed", "failed", "cancelled"],
 needs_approval: ["queued", "cancelled"],
 completed: [],
 failed: ["queued"],
 cancelled: [],
};
export function canTransitionTaskStatus(from: DurableTaskStatus, to: DurableTaskStatus): boolean {
 return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
function serialize(value:unknown,max:number){const text=JSON.stringify(value??null);if(text.length>max)throw new Error("Task JSON payload exceeds its size limit.");return text;}
function restore(row:{id:string;workspace_id:string;user_id:string;status:string;input_summary:string;plan_json:string;result_json:string|null;created_at:string;updated_at:string}):DurableAgentTask{
 if(!STATUSES.has(row.status as DurableTaskStatus))throw new Error("Stored task status is invalid.");
 let plan:unknown,result:unknown|null;try{plan=JSON.parse(row.plan_json);result=row.result_json===null?null:JSON.parse(row.result_json);}catch{throw new Error("Stored task JSON is invalid.");}
 return{id:row.id,workspaceId:row.workspace_id,userId:row.user_id,status:row.status as DurableTaskStatus,inputSummary:row.input_summary,plan,result,createdAt:row.created_at,updatedAt:row.updated_at};
}
export function createD1TaskStore(database:D1TaskDatabase){
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 task database is required.");
 const select="SELECT id,workspace_id,user_id,status,input_summary,plan_json,result_json,created_at,updated_at FROM agent_tasks";
 return{
  create:async(task:DurableAgentTask)=>{if(!ID.test(task.id)||!ID.test(task.workspaceId)||!ID.test(task.userId)||!STATUSES.has(task.status)||!task.inputSummary.trim()||task.inputSummary.length>20_000||!Number.isFinite(Date.parse(task.createdAt))||!Number.isFinite(Date.parse(task.updatedAt)))throw new Error("Invalid durable task record.");const result=await database.prepare("INSERT INTO agent_tasks (id,workspace_id,user_id,status,input_summary,plan_json,result_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(task.id,task.workspaceId,task.userId,task.status,task.inputSummary,serialize(task.plan,100_000),task.result===null?null:serialize(task.result,200_000),task.createdAt,task.updatedAt).run();if(result.success===false||result.meta?.changes!==1)throw new Error("D1 task creation failed.");},
  get:async(input:{id:string;workspaceId:string;userId:string})=>{if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.userId))return null;const row=await database.prepare(select+" WHERE id=? AND workspace_id=? AND user_id=? LIMIT 1").bind(input.id,input.workspaceId,input.userId).first<{id:string;workspace_id:string;user_id:string;status:string;input_summary:string;plan_json:string;result_json:string|null;created_at:string;updated_at:string}>();return row?restore(row):null;},
  claim:async(input:{id:string;workspaceId:string;userId:string;updatedAt:string})=>{if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!Number.isFinite(Date.parse(input.updatedAt)))throw new Error("Invalid task claim.");const result=await database.prepare("UPDATE agent_tasks SET status=?, updated_at=? WHERE id=? AND workspace_id=? AND user_id=? AND status=?").bind("running",input.updatedAt,input.id,input.workspaceId,input.userId,"queued").run();if(result.success===false)throw new Error("D1 task claim failed.");return result.meta?.changes===1;},
  retry:async(input:{id:string;workspaceId:string;userId:string;updatedAt:string})=>{
   if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!Number.isFinite(Date.parse(input.updatedAt)))throw new Error("Invalid task retry.");
   const result=await database.prepare("UPDATE agent_tasks SET status = 'queued', attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND workspace_id = ? AND user_id = ? AND status = 'failed' AND attempt_count < 2").bind(input.updatedAt,input.id,input.workspaceId,input.userId).run();
   if(result.success===false)throw new Error("D1 task retry failed.");
   return result.meta?.changes===1;
  },
  update:async(input:{id:string;workspaceId:string;userId:string;expectedStatus:DurableTaskStatus;status:DurableTaskStatus;plan?:unknown;result?:unknown|null;updatedAt:string})=>{if(!ID.test(input.id)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!STATUSES.has(input.expectedStatus)||!STATUSES.has(input.status)||!Number.isFinite(Date.parse(input.updatedAt)))throw new Error("Invalid task update.");if(!canTransitionTaskStatus(input.expectedStatus,input.status))throw new Error("Invalid task status transition.");const resultJson=input.result===undefined?null:input.result===null?null:serialize(input.result,200_000),planJson=input.plan===undefined?null:serialize(input.plan,100_000);const result=await database.prepare("UPDATE agent_tasks SET status=?, plan_json=COALESCE(?,plan_json), result_json=COALESCE(?,result_json), updated_at=? WHERE id=? AND workspace_id=? AND user_id=? AND status=?").bind(input.status,planJson,resultJson,input.updatedAt,input.id,input.workspaceId,input.userId,input.expectedStatus).run();if(result.success===false)throw new Error("D1 task update failed.");return result.meta?.changes===1;},
  list:async(input:{workspaceId:string;userId:string;limit?:number})=>{if(!ID.test(input.workspaceId)||!ID.test(input.userId))return[];const requested=input.limit??50;const limit=Number.isFinite(requested)?Math.min(100,Math.max(1,Math.floor(requested))):50;const result=await database.prepare(select+" WHERE workspace_id=? AND user_id=? ORDER BY created_at DESC LIMIT ?").bind(input.workspaceId,input.userId,limit).all<{id:string;workspace_id:string;user_id:string;status:string;input_summary:string;plan_json:string;result_json:string|null;created_at:string;updated_at:string}>();if(result.success===false)throw new Error("D1 task list failed.");return(result.results??[]).map(restore);},
 };
}
