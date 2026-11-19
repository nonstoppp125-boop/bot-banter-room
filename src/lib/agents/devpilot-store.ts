import type { D1TaskDatabase } from "./task-store";

export type DevPilotCheckpointStatus="planned"|"awaiting_approval"|"running"|"paused"|"blocked"|"failed"|"completed"|"cancelled";
export type DevPilotCheckpointStage="inspection"|"planning"|"approval"|"execution"|"validation"|"review"|"delivery"|"complete";
export type DevPilotEventType="planned"|"proposal-created"|"approval-requested"|"approval-granted"|"execution-started"|"command-started"|"command-completed"|"reviewed"|"verified"|"paused"|"resumed"|"blocked"|"failed"|"cancelled"|"completed";
export interface DevPilotCheckpoint {
  taskId:string;workspaceId:string;userId:string;version:number;status:DevPilotCheckpointStatus;stage:DevPilotCheckpointStage;progress:0|10|25|50|75|90|100;retryCount:number;repository:string;baseBranch:string;baseSha:string;targetBranch:string|null;state:unknown;createdAt:string;updatedAt:string;
}
export interface DevPilotTaskEvent {
  id:string;taskId:string;workspaceId:string;userId:string;type:DevPilotEventType;progress:0|10|25|50|75|90|100|null;summary:string;evidence:string[];createdAt:string;
}
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const SHA=/^[a-f0-9]{7,64}$/i;
const REPOSITORY=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const STATUSES=new Set<DevPilotCheckpointStatus>(["planned","awaiting_approval","running","paused","blocked","failed","completed","cancelled"]);
const STAGES=new Set<DevPilotCheckpointStage>(["inspection","planning","approval","execution","validation","review","delivery","complete"]);
const EVENTS=new Set<DevPilotEventType>(["planned","proposal-created","approval-requested","approval-granted","execution-started","command-started","command-completed","reviewed","verified","paused","resumed","blocked","failed","cancelled","completed"]);
const PROGRESS=new Set([0,10,25,50,75,90,100]);
const STAGE_ORDER:Readonly<Record<DevPilotCheckpointStage,number>>={inspection:0,planning:1,approval:2,execution:3,validation:4,review:5,delivery:6,complete:7};
const TRANSITIONS:Readonly<Record<DevPilotCheckpointStatus,readonly DevPilotCheckpointStatus[]>>={
 planned:["awaiting_approval","running","blocked","failed","cancelled"],
 awaiting_approval:["running","blocked","cancelled"],
 running:["running","paused","blocked","failed","completed","cancelled"],
 paused:["running","cancelled"],
 blocked:["running","cancelled"],
 failed:["running","cancelled"],
 completed:[],
 cancelled:[],
};
const iso=(value:string)=>Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function json(value:unknown,max:number){const result=JSON.stringify(value??null);if(result.length>max)throw new Error("DevPilot JSON payload exceeds its size limit.");return result;}
function parseJson(value:string){try{return JSON.parse(value) as unknown;}catch{throw new Error("Stored DevPilot JSON is invalid.");}}
function mapCheckpoint(row:Record<string,unknown>):DevPilotCheckpoint{
  const status=String(row["status"]) as DevPilotCheckpointStatus;
  const stage=String(row["stage"]) as DevPilotCheckpointStage;
  const progress=Number(row["progress"]);
  if(!STATUSES.has(status)||!STAGES.has(stage)||!PROGRESS.has(progress))throw new Error("Stored DevPilot checkpoint state is invalid.");
  return{taskId:String(row["task_id"]),workspaceId:String(row["workspace_id"]),userId:String(row["user_id"]),version:Number(row["version"]),status,stage,progress:progress as DevPilotCheckpoint["progress"],retryCount:Number(row["retry_count"]),repository:String(row["repository"]),baseBranch:String(row["base_branch"]),baseSha:String(row["base_sha"]),targetBranch:row["target_branch"]===null?null:String(row["target_branch"]),state:parseJson(String(row["state_json"])),createdAt:String(row["created_at"]),updatedAt:String(row["updated_at"])};
}
function mapEvent(row:Record<string,unknown>):DevPilotTaskEvent{
  const type=String(row["event_type"]) as DevPilotEventType;
  const progress=row["progress"]===null?null:Number(row["progress"]);
  if(!EVENTS.has(type)||(progress!==null&&!PROGRESS.has(progress)))throw new Error("Stored DevPilot event is invalid.");
  const evidence=parseJson(String(row["evidence_json"]));
  if(!Array.isArray(evidence)||!evidence.every(value=>typeof value==="string"))throw new Error("Stored DevPilot evidence is invalid.");
  return{id:String(row["id"]),taskId:String(row["task_id"]),workspaceId:String(row["workspace_id"]),userId:String(row["user_id"]),type,progress:progress as DevPilotTaskEvent["progress"],summary:String(row["summary"]),evidence:evidence as string[],createdAt:String(row["created_at"])};
}
export function canTransitionDevPilotStatus(from:DevPilotCheckpointStatus,to:DevPilotCheckpointStatus):boolean{return from===to||TRANSITIONS[from]?.includes(to)===true;}
export function createD1DevPilotStore(database:D1TaskDatabase){
  if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 database is required.");
  return{
    create:async(input:{taskId:string;workspaceId:string;userId:string;status:DevPilotCheckpointStatus;stage:DevPilotCheckpointStage;progress:DevPilotCheckpoint["progress"];repository:string;baseBranch:string;baseSha:string;targetBranch?:string|null;state:unknown;createdAt:string;updatedAt:string}):Promise<DevPilotCheckpoint>=>{
      if(!ID.test(input.taskId)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!STATUSES.has(input.status)||!STAGES.has(input.stage)||!PROGRESS.has(input.progress)||!REPOSITORY.test(input.repository)||!input.baseBranch.trim()||input.baseBranch.length>120||!SHA.test(input.baseSha)||!iso(input.createdAt)||!iso(input.updatedAt)||Date.parse(input.updatedAt)<Date.parse(input.createdAt)||(input.targetBranch!==undefined&&input.targetBranch!==null&&(!input.targetBranch.trim()||input.targetBranch.length>120)))throw new Error("Invalid DevPilot checkpoint.");
      const stateJson=json(input.state,100_000);
      const result=await database.prepare("INSERT INTO devpilot_checkpoints (task_id, workspace_id, user_id, version, status, stage, progress, retry_count, repository, base_branch, base_sha, target_branch, state_json, created_at, updated_at) SELECT ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM agent_tasks WHERE id = ? AND workspace_id = ? AND user_id = ?)").bind(input.taskId,input.workspaceId,input.userId,input.status,input.stage,input.progress,input.repository,input.baseBranch,input.baseSha,input.targetBranch??null,stateJson,input.createdAt,input.updatedAt,input.taskId,input.workspaceId,input.userId).run();
      if(result.success===false||result.meta?.changes!==1)throw new Error("DevPilot checkpoint rejected or task ownership mismatch.");
      return{taskId:input.taskId,workspaceId:input.workspaceId,userId:input.userId,version:1,status:input.status,stage:input.stage,progress:input.progress,retryCount:0,repository:input.repository,baseBranch:input.baseBranch,baseSha:input.baseSha,targetBranch:input.targetBranch??null,state:input.state,createdAt:input.createdAt,updatedAt:input.updatedAt};
    },
    get:async(input:{taskId:string;workspaceId:string;userId:string}):Promise<DevPilotCheckpoint|null>=>{
      if(!ID.test(input.taskId)||!ID.test(input.workspaceId)||!ID.test(input.userId))return null;
      const row=await database.prepare("SELECT * FROM devpilot_checkpoints WHERE task_id = ? AND workspace_id = ? AND user_id = ? LIMIT 1").bind(input.taskId,input.workspaceId,input.userId).first<Record<string,unknown>>();
      return row?mapCheckpoint(row):null;
    },
    update:async(input:{taskId:string;workspaceId:string;userId:string;expectedVersion:number;expectedStatus:DevPilotCheckpointStatus;status:DevPilotCheckpointStatus;stage:DevPilotCheckpointStage;progress:DevPilotCheckpoint["progress"];baseSha:string;targetBranch?:string|null;state:unknown;updatedAt:string}):Promise<boolean>=>{
      if(!ID.test(input.taskId)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1||!STATUSES.has(input.expectedStatus)||!STATUSES.has(input.status)||!canTransitionDevPilotStatus(input.expectedStatus,input.status)||!STAGES.has(input.stage)||!PROGRESS.has(input.progress)||!SHA.test(input.baseSha)||!iso(input.updatedAt)||(input.targetBranch!==undefined&&input.targetBranch!==null&&(!input.targetBranch.trim()||input.targetBranch.length>120)))throw new Error("Invalid DevPilot checkpoint update.");
      const stateJson=json(input.state,100_000);
      const result=await database.prepare("UPDATE devpilot_checkpoints SET version = version + 1, status = ?, stage = ?, progress = ?, base_sha = ?, target_branch = ?, state_json = ?, updated_at = ? WHERE task_id = ? AND workspace_id = ? AND user_id = ? AND version = ? AND status = ? AND progress <= ? AND CASE stage WHEN 'inspection' THEN 0 WHEN 'planning' THEN 1 WHEN 'approval' THEN 2 WHEN 'execution' THEN 3 WHEN 'validation' THEN 4 WHEN 'review' THEN 5 WHEN 'delivery' THEN 6 WHEN 'complete' THEN 7 ELSE 99 END <= ?").bind(input.status,input.stage,input.progress,input.baseSha,input.targetBranch??null,stateJson,input.updatedAt,input.taskId,input.workspaceId,input.userId,input.expectedVersion,input.expectedStatus,input.progress,STAGE_ORDER[input.stage]).run();
      return result.success!==false&&result.meta?.changes===1;
    },
    appendEvent:async(input:DevPilotTaskEvent):Promise<boolean>=>{
      if(!ID.test(input.id)||!ID.test(input.taskId)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!EVENTS.has(input.type)||(input.progress!==null&&!PROGRESS.has(input.progress))||!input.summary.trim()||input.summary.length>500||!input.evidence.every(value=>typeof value==="string"&&value.length<=500)||input.evidence.length>20||!iso(input.createdAt))throw new Error("Invalid DevPilot event.");
      const evidenceJson=json(input.evidence,12_000);
      const result=await database.prepare("INSERT INTO devpilot_task_events (id, task_id, workspace_id, user_id, event_type, progress, summary, evidence_json, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM devpilot_checkpoints WHERE task_id = ? AND workspace_id = ? AND user_id = ?)").bind(input.id,input.taskId,input.workspaceId,input.userId,input.type,input.progress,input.summary.trim().slice(0,500),evidenceJson,input.createdAt,input.taskId,input.workspaceId,input.userId).run();
      return result.success!==false&&result.meta?.changes===1;
    },
    listEvents:async(input:{taskId:string;workspaceId:string;userId:string;limit?:number}):Promise<DevPilotTaskEvent[]>=>{
      if(!ID.test(input.taskId)||!ID.test(input.workspaceId)||!ID.test(input.userId))return[];
      const limit=input.limit??100;if(!Number.isInteger(limit)||limit<1||limit>200)throw new Error("DevPilot event limit must be between 1 and 200.");
      const result=await database.prepare("SELECT * FROM devpilot_task_events WHERE task_id = ? AND workspace_id = ? AND user_id = ? ORDER BY created_at ASC, id ASC LIMIT ?").bind(input.taskId,input.workspaceId,input.userId,limit).all<Record<string,unknown>>();
      return(result.results??[]).map(mapEvent);
    },
    resume:async(input:{taskId:string;workspaceId:string;userId:string;expectedVersion:number;expectedBaseSha:string;updatedAt:string}):Promise<boolean>=>{
      if(!ID.test(input.taskId)||!ID.test(input.workspaceId)||!ID.test(input.userId)||!Number.isInteger(input.expectedVersion)||input.expectedVersion<1||!SHA.test(input.expectedBaseSha)||!iso(input.updatedAt))throw new Error("Invalid DevPilot resume request.");
      const result=await database.prepare("UPDATE devpilot_checkpoints SET version = version + 1, status = 'running', progress = CASE WHEN progress < 50 THEN 50 ELSE progress END, retry_count = retry_count + 1, updated_at = ? WHERE task_id = ? AND workspace_id = ? AND user_id = ? AND version = ? AND status IN ('paused', 'blocked', 'failed') AND retry_count < 2 AND base_sha = ?").bind(input.updatedAt,input.taskId,input.workspaceId,input.userId,input.expectedVersion,input.expectedBaseSha).run();
      return result.success!==false&&result.meta?.changes===1;
    },
  };
}
