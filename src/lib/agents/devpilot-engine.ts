import { hashApprovalPayload } from "./approval-store";
import { createDevPilotApprovalStore } from "./devpilot-approval-store";
import { createDevPilotCheckpointWriter, createDevPilotEventWriter, createDevPilotRunStore } from "./devpilot-run-store";
import {
  buildCodingPlan,
  buildRepositoryInventory,
  createEngineeringEvent,
  createCodeChangeProposal,
  reviewCodeDiff,
  runValidationSuite,
  type CodeChangeProposal,
  type DiffReviewInput,
  type EngineeringEvent,
  type RepositoryFileInput,
  type ValidationCommandRunner,
  type ValidationSuiteResult,
} from "./coding-workforce";

export interface DevPilotRepositorySnapshot {
  repository: string;
  branch: string;
  headSha: string;
  workingTreeClean: boolean;
  files: readonly RepositoryFileInput[];
}
export interface DevPilotFileContent { path: string; sha: string; content: string; }
export interface DevPilotPullRequest { number: number; url: string; }
export interface DevPilotRepositoryAdapter extends ValidationCommandRunner {
  inspectRepository(input:{repository:string;branch:string;signal?:AbortSignal}):Promise<DevPilotRepositorySnapshot>;
  readFiles(input:{repository:string;branch:string;paths:readonly string[];signal?:AbortSignal}):Promise<DevPilotFileContent[]>;
  createBranch(input:{repository:string;branch:string;baseSha:string;signal?:AbortSignal}):Promise<void>;
  /** Must apply all file changes atomically and only when the branch HEAD still equals baseSha. */
  applyChanges(input:{repository:string;branch:string;baseSha:string;changes:CodeChangeProposal["changes"];signal?:AbortSignal}):Promise<{headSha:string}>;
  inspectDiff(input:{repository:string;branch:string;baseSha:string;signal?:AbortSignal}):Promise<DiffReviewInput>;
  commit(input:{repository:string;branch:string;expectedHeadSha:string;message:string;signal?:AbortSignal}):Promise<{commitSha:string}>;
  createPullRequest(input:{repository:string;headBranch:string;baseBranch:string;title:string;body:string;commitSha:string;signal?:AbortSignal}):Promise<DevPilotPullRequest>;
}
export interface DevPilotCheckpointInput {
  progress: 0 | 10 | 25 | 50 | 75 | 90 | 100;
  stage: string;
  data: unknown;
  status?: "running" | "awaiting_approval";
}
export type DevPilotResultStatus = "awaiting_approval"|"completed"|"blocked"|"failed"|"cancelled";
export interface DevPilotResult {
  status:DevPilotResultStatus;
  progress:0|10|25|50|75|90|100;
  plan?:ReturnType<typeof buildCodingPlan>;
  proposal?:CodeChangeProposal;
  approvalPayloadHash?:string;
  approvalId?:string;
  validation?:ValidationSuiteResult;
  commitSha?:string;
  pullRequest?:DevPilotPullRequest;
  events:EngineeringEvent[];
  reason?:string;
}
export type DevPilotProposalGenerator = (input:{
  task:string;
  repository:string;
  baseBranch:string;
  targetBranch:string;
  baseSha:string;
  plan:ReturnType<typeof buildCodingPlan>;
  files:readonly DevPilotFileContent[];
  signal?:AbortSignal;
})=>Promise<CodeChangeProposal["changes"]>;

const SHA=/^[a-f0-9]{7,64}$/i;
const REPOSITORY=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const TASK_ID=/^(?!.*\.\.)(?!.*\.$)(?!.*\.lock$)[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/i;

function addEvent(events:EngineeringEvent[],taskId:string,type:EngineeringEvent["type"],summary:string,evidence:string[],now:()=>Date):void{
  const sequence=String(events.length+1).padStart(2,"0");
  events.push(createEngineeringEvent({id:"devpilot-"+taskId+"-"+sequence,taskId,type,timestamp:now().toISOString(),summary,evidence}));
}

/**
 * Runs the bounded DevPilot lifecycle against an injected repository/sandbox adapter.
 * This engine never shells out or accesses GitHub directly; the adapter must enforce
 * authenticated repository scope, isolated workspaces and conditional writes.
 */
export async function runDevPilotTask(input:{
  taskId:string;
  task:string;
  repository:string;
  baseBranch:string;
  adapter:DevPilotRepositoryAdapter;
  proposeChanges:DevPilotProposalGenerator;
  approval?:{approvalId:string;payloadHash:string};
  verifyApproval?:(input:{approvalId:string;taskId:string;repository:string;payloadHash:string})=>Promise<boolean>;
  onCheckpoint?:(checkpoint:DevPilotCheckpointInput)=>Promise<void>;
  onEvent?:(event:EngineeringEvent)=>Promise<void>;
  signal?:AbortSignal;
  now?:()=>Date;
}):Promise<DevPilotResult>{
  const events:EngineeringEvent[]=[];
  const now=input.now??(()=>new Date());
  let currentProgress:DevPilotResult["progress"]=0;
  const recordEvent=async(type:EngineeringEvent["type"],summary:string,evidence:string[])=>{
    addEvent(events,input.taskId,type,summary,evidence,now);
    const event=events[events.length-1];
    if(event)await input.onEvent?.(event);
  };
  const blocked=async(reason:string,progress:DevPilotResult["progress"]=currentProgress):Promise<DevPilotResult>=>{
    if(TASK_ID.test(input.taskId))await recordEvent("blocked",reason,[]);
    return{status:"blocked",progress,events,reason};
  };
  const failed=(reason:string,progress:DevPilotResult["progress"]=currentProgress,extra:Partial<DevPilotResult>={}):DevPilotResult=>{
    return{status:input.signal?.aborted?"cancelled":"failed",progress,events,reason,...extra};
  };
  if(!TASK_ID.test(input.taskId)||!REPOSITORY.test(input.repository)||!input.task.trim()||input.task.length>4_000||!input.baseBranch.trim()||input.baseBranch.length>120){
    return await blocked("Invalid DevPilot task or repository identity.");
  }
  if(input.signal?.aborted)return{status:"cancelled",progress:0,events,reason:"DevPilot task was cancelled before inspection."};
  try{
    const snapshot=await input.adapter.inspectRepository({repository:input.repository,branch:input.baseBranch,...(input.signal?{signal:input.signal}:{})});
    if(snapshot.repository!==input.repository||snapshot.branch!==input.baseBranch||!SHA.test(snapshot.headSha)){
      return await blocked("Repository identity, base branch or HEAD verification failed.");
    }
    if(!snapshot.workingTreeClean)return await blocked("Repository working tree is not clean; isolate and preserve existing changes before coding.");
    const targetBranch="devpilot/"+input.taskId;
    const inventory=buildRepositoryInventory({repository:snapshot.repository,branch:targetBranch,headSha:snapshot.headSha,files:snapshot.files,now:now().toISOString()});
    currentProgress=10;
    await recordEvent("planned","Repository identity and clean baseline verified.",[snapshot.repository,snapshot.branch,snapshot.headSha]);
    await input.onCheckpoint?.({progress:10,stage:"repository-verified",data:{repository:snapshot.repository,branch:snapshot.branch,headSha:snapshot.headSha}});
    const plan=buildCodingPlan(input.task,inventory);
    currentProgress=25;
    await recordEvent("planned","Bounded coding plan created.",[...plan.acceptanceCriteria]);
    await input.onCheckpoint?.({progress:25,stage:"plan-created",data:{plan}});
    const files=await input.adapter.readFiles({repository:input.repository,branch:input.baseBranch,paths:plan.filesToInspect,...(input.signal?{signal:input.signal}:{})});
    const allowedPaths=new Set(plan.filesToInspect);
    const returnedPaths=new Set(files.map(file=>file.path));
    if(files.length!==plan.filesToInspect.length||files.length>20||returnedPaths.size!==files.length||
      plan.filesToInspect.some(path=>!returnedPaths.has(path))||
      files.some(file=>!allowedPaths.has(file.path)||file.content.length>1_000_000||!SHA.test(file.sha))){
      return await blocked("Repository adapter returned an out-of-scope or oversized file.");
    }
    for(const file of files){
      const expected=inventory.files.find(item=>item.path===file.path)?.sha;
      if(expected&&expected!==file.sha)return await blocked("Repository file changed during inspection: "+file.path);
    }
    const changes=await input.proposeChanges({task:input.task,repository:input.repository,baseBranch:input.baseBranch,targetBranch,baseSha:snapshot.headSha,plan,files,...(input.signal?{signal:input.signal}:{})});
    const proposal=createCodeChangeProposal({id:input.taskId,inventory,targetBranch,changes});
    const testsChanged=changes.some(change=>/(?:^|\/)(?:[^/]*\.)?(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(__tests__|tests)\//i.test(change.path));
    const sourceChanged=changes.some(change=>/\.(?:ts|tsx|js|jsx|py|go|rs|java|kt|swift)$/i.test(change.path));
    const initialReview=reviewCodeDiff({files:changes,testsChanged});
    if(!initialReview.passed)return await blocked("Proposed diff contains critical or high-severity security findings.",25);
    if(sourceChanged&&!testsChanged)return await blocked("Source changes require corresponding test changes before execution.",25);
    const approvalRequired=plan.approvalRequired||changes.some(change=>/^(?:\.github\/workflows\/|migrations\/|wrangler(?:\.[^/]*)?$|package(?:-lock)?\.json$|bun\.lock$|src\/lib\/agents\/(?:session-auth|password-auth|approval-store|task-approval|action-policy|security-boundaries)\.ts$)/i.test(change.path));
    const effectivePlan=approvalRequired&&!plan.approvalRequired?{...plan,risk:"high" as const,approvalRequired:true,limitations:[...plan.limitations,"Sensitive deployment, migration, dependency, authentication and authorization paths require explicit approval."]}:plan;
    const approvalPayloadHash=await hashApprovalPayload({kind:"devpilot-code-change",taskId:input.taskId,repository:input.repository,baseBranch:input.baseBranch,baseSha:snapshot.headSha,targetBranch,plan:effectivePlan,proposal,review:initialReview});
    const approvalProposalFiles=effectivePlan.approvalRequired?changes.map(change=>({path:change.path,beforeSha:change.beforeSha,beforeContent:files.find(file=>file.path===change.path)?.content??null,content:change.content})):undefined;
    if(approvalProposalFiles&&new TextEncoder().encode(JSON.stringify(approvalProposalFiles)).byteLength>70_000){
      return await blocked("Approval proposal exceeds the safe inline review limit; split the change into smaller reviewable tasks.",25);
    }
    await recordEvent("proposal-created","Validated code proposal and pre-apply security review completed.",[...changes.map(change=>change.path),approvalPayloadHash]);
    await input.onCheckpoint?.({progress:25,stage:"proposal-created",data:{plan:effectivePlan,proposal:{id:proposal.id,repository:proposal.repository,baseSha:proposal.baseSha,targetBranch:proposal.targetBranch,paths:proposal.changes.map(change=>change.path)},...(approvalProposalFiles?{proposalFiles:approvalProposalFiles}:{}),approvalPayloadHash,review:initialReview}});
    if(input.approval&&input.approval.payloadHash!==approvalPayloadHash){
      return await blocked("Approval payload does not match the current task, repository baseline and exact code proposal.",25);
    }
    if(effectivePlan.approvalRequired){
      if(!input.approval?.approvalId||!input.verifyApproval){
        await input.onCheckpoint?.({progress:25,stage:"awaiting-approval",status:"awaiting_approval",data:{plan:effectivePlan,proposal:{id:proposal.id,repository:proposal.repository,baseSha:proposal.baseSha,targetBranch:proposal.targetBranch,paths:proposal.changes.map(change=>change.path)},...(approvalProposalFiles?{proposalFiles:approvalProposalFiles}:{}),approvalPayloadHash}});
        return{status:"awaiting_approval",progress:25,plan:effectivePlan,proposal,approvalPayloadHash,events,reason:"A persisted approval record and trusted approval verifier are required before repository writes."};
      }
      const approved=await input.verifyApproval({approvalId:input.approval.approvalId,taskId:input.taskId,repository:input.repository,payloadHash:approvalPayloadHash});
      if(!approved)return await blocked("Persisted approval is missing, expired, rejected or does not match this exact proposal.",25);
      await input.onCheckpoint?.({progress:25,stage:"approval-verified",data:{plan:effectivePlan,proposal:{id:proposal.id,repository:proposal.repository,baseSha:proposal.baseSha,targetBranch:proposal.targetBranch,paths:proposal.changes.map(change=>change.path)},approvalPayloadHash,approvalId:input.approval.approvalId}});
    }
    if(input.signal?.aborted)return{status:"cancelled",progress:25,plan:effectivePlan,proposal,approvalPayloadHash,events,reason:"DevPilot task was cancelled before repository writes."};
    await input.adapter.createBranch({repository:input.repository,branch:targetBranch,baseSha:snapshot.headSha,...(input.signal?{signal:input.signal}:{})});
    await recordEvent("planned","Isolated non-main work branch created.",[targetBranch,snapshot.headSha]);
    await input.onCheckpoint?.({progress:25,stage:"branch-created",data:{targetBranch,baseSha:snapshot.headSha,plan:effectivePlan,proposalPaths:changes.map(change=>change.path),approvalPayloadHash}});
    const applied=await input.adapter.applyChanges({repository:input.repository,branch:targetBranch,baseSha:snapshot.headSha,changes,...(input.signal?{signal:input.signal}:{})});
    if(!SHA.test(applied.headSha))return failed("Repository adapter returned an invalid post-apply HEAD.",50,{plan:effectivePlan,proposal,approvalPayloadHash});
    currentProgress=50;
    await recordEvent("verified","Proposed files applied with a conditional base-commit check.",[applied.headSha,...changes.map(change=>change.path)]);
    await input.onCheckpoint?.({progress:50,stage:"changes-applied",data:{headSha:applied.headSha,plan:effectivePlan,proposalPaths:changes.map(change=>change.path),approvalPayloadHash}});
    const validation=await runValidationSuite({commands:plan.validationCommands,runner:input.adapter,...(input.signal?{signal:input.signal}:{})});
    if(validation.status!=="passed")return failed(validation.reason??"Validation did not pass.",50,{plan:effectivePlan,proposal,approvalPayloadHash,validation});
    currentProgress=75;
    await recordEvent("verified","All allowlisted validation commands passed.",validation.results.map(result=>result.command+" (exit "+result.exitCode+")"));
    await input.onCheckpoint?.({progress:75,stage:"validation-passed",data:{headSha:applied.headSha,plan:effectivePlan,proposalPaths:changes.map(change=>change.path),approvalPayloadHash,validation:{status:validation.status,passed:validation.passed,totalDurationMs:validation.totalDurationMs,results:validation.results.map(result=>({command:result.command,exitCode:result.exitCode,durationMs:result.durationMs}))}}});
    const diff=await input.adapter.inspectDiff({repository:input.repository,branch:targetBranch,baseSha:snapshot.headSha,...(input.signal?{signal:input.signal}:{})});
    const proposedByPath=new Map(changes.map(change=>[change.path,change.content]));
    const actualByPath=new Map(diff.files.map(file=>[file.path,file.content]));
    const actualDiffIsWellFormed=Array.isArray(diff.files)&&diff.files.length===changes.length&&actualByPath.size===diff.files.length&&diff.files.every(file=>typeof file.path==="string"&&typeof file.content==="string");
    const diffMatchesProposal=actualDiffIsWellFormed&&proposedByPath.size===actualByPath.size&&[...proposedByPath].every(([path,content])=>actualByPath.get(path)===content);
    if(!diffMatchesProposal)return await blocked("Post-validation diff is malformed or does not exactly match the approved proposal.",90);
    const finalTestsChanged=diff.files.some(file=>/(^|\/)([^/]+\.)?(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|tests)\//i.test(file.path));
    const finalReview=reviewCodeDiff({files:diff.files,testsChanged:finalTestsChanged});
    if(!finalReview.passed||!finalTestsChanged)return await blocked("Post-validation diff review failed or test changes are missing.",90);
    currentProgress=90;
    await recordEvent("reviewed","Post-validation diff passed the bounded security review.",diff.files.map(file=>file.path));
    await input.onCheckpoint?.({progress:90,stage:"diff-reviewed",data:{headSha:applied.headSha,plan:effectivePlan,proposalPaths:changes.map(change=>change.path),approvalPayloadHash,validation:{status:validation.status,passed:validation.passed,totalDurationMs:validation.totalDurationMs,results:validation.results.map(result=>({command:result.command,exitCode:result.exitCode,durationMs:result.durationMs}))},diffPaths:diff.files.map(file=>file.path)}});
    const committed=await input.adapter.commit({repository:input.repository,branch:targetBranch,expectedHeadSha:applied.headSha,message:"devpilot: "+plan.task.slice(0,72),...(input.signal?{signal:input.signal}:{})});
    if(!SHA.test(committed.commitSha))return failed("Repository adapter returned an invalid commit SHA.",90,{plan:effectivePlan,proposal,approvalPayloadHash,validation});
    await recordEvent("verified","Reviewed changes committed on the isolated branch.",[committed.commitSha]);
    const pullRequest=await input.adapter.createPullRequest({repository:input.repository,headBranch:targetBranch,baseBranch:input.baseBranch,title:"DevPilot: "+plan.task.slice(0,100),body:"Automated coding task.\n\n- Base: "+snapshot.headSha+"\n- Commit: "+committed.commitSha+"\n- Validation: all allowlisted checks passed.\n- Security: bounded diff review passed.\n\nNo production deployment or merge was performed.",commitSha:committed.commitSha,...(input.signal?{signal:input.signal}:{})});
    if(!Number.isInteger(pullRequest.number)||pullRequest.number<1||!/^https:\/\//.test(pullRequest.url))return failed("Repository adapter returned invalid pull-request metadata.",90,{plan:effectivePlan,proposal,approvalPayloadHash,validation,commitSha:committed.commitSha});
    currentProgress=100;
    await recordEvent("verified","Pull request created; no merge or deployment performed.",[pullRequest.url]);
    await input.onCheckpoint?.({progress:100,stage:"pull-request-created",data:{plan:effectivePlan,proposalPaths:changes.map(change=>change.path),approvalPayloadHash,validation:{status:validation.status,passed:validation.passed,totalDurationMs:validation.totalDurationMs},commitSha:committed.commitSha,pullRequest},status:"running"});
    return{status:"completed",progress:100,plan:effectivePlan,proposal,approvalPayloadHash,validation,commitSha:committed.commitSha,pullRequest,events};
  }catch(error){
    return failed(error instanceof Error?error.message.slice(0,500):"DevPilot workflow failed.");
  }
}


/** Executes a claimed D1 run with owner-bound durable checkpoints and append-only evidence. */
export async function runClaimedDevPilotTask(input: {
  database: Parameters<typeof createDevPilotRunStore>[0];
  run: {
    id: string; workspaceId: string; userId: string; repository: string; baseBranch: string;
    task: string; checkpointVersion: number; progress: number;
  };
  owner: string;
  adapter: DevPilotRepositoryAdapter;
  proposeChanges: DevPilotProposalGenerator;
  approval?: { approvalId: string; payloadHash: string };
  verifyApproval?: (input: { approvalId: string; taskId: string; repository: string; payloadHash: string }) => Promise<boolean>;
  signal?: AbortSignal;
  now?: () => Date;
}): Promise<DevPilotResult> {
  const now = input.now ?? (() => new Date());
  const onCheckpoint = createDevPilotCheckpointWriter(input.database, {
    id: input.run.id, workspaceId: input.run.workspaceId, userId: input.run.userId,
    owner: input.owner, initialVersion: input.run.checkpointVersion,
    initialProgress: input.run.progress, now,
  });
  const onEvent = createDevPilotEventWriter(input.database, {
    runId: input.run.id, workspaceId: input.run.workspaceId, userId: input.run.userId,
  });
  const result = await runDevPilotTask({
    taskId: input.run.id, task: input.run.task, repository: input.run.repository,
    baseBranch: input.run.baseBranch, adapter: input.adapter, proposeChanges: input.proposeChanges,
    ...(input.approval ? { approval: input.approval } : {}),
    ...(input.verifyApproval ? { verifyApproval: input.verifyApproval } : {}),
    onCheckpoint, onEvent,
    ...(input.signal ? { signal: input.signal } : {}),
    now,
  });
  if (result.status === "awaiting_approval") {
    try {
      if (!result.approvalPayloadHash) throw new Error("Approval payload hash is missing.");
      const createdAt = now().toISOString();
      const approvalId = crypto.randomUUID().replace(/-/g, "");
      await createDevPilotApprovalStore(input.database).create({
        id: approvalId, workspaceId: input.run.workspaceId, userId: input.run.userId,
        taskId: input.run.id, repository: input.run.repository,
        payloadHash: result.approvalPayloadHash, summary: input.run.task.slice(0, 500),
        createdAt, expiresAt: new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString(),
      });
      await onEvent({
        id: "approval-" + approvalId, type: "approval", timestamp: createdAt,
        summary: "Exact code proposal submitted for workspace approval.",
        evidence: [approvalId, result.approvalPayloadHash],
      });
      return { ...result, approvalId };
    } catch {
      await createDevPilotRunStore(input.database).blockAwaitingApproval({
        id: input.run.id, workspaceId: input.run.workspaceId, userId: input.run.userId,
        now: now().toISOString(),
      }).catch(() => false);
      return {
        ...result, status: "blocked",
        reason: "Approval record could not be persisted; the proposal was not applied.",
      };
    }
  }
  const status = result.status === "completed" ? "completed"
    : result.status === "blocked" ? "blocked"
      : result.status === "cancelled" ? "cancelled" : "failed";
  const finished = await createDevPilotRunStore(input.database).finish({
    id: input.run.id, workspaceId: input.run.workspaceId, userId: input.run.userId,
    owner: input.owner, status, progress: result.progress,
    checkpoint: {
      status: result.status, progress: result.progress, reason: result.reason,
      commitSha: result.commitSha, pullRequest: result.pullRequest,
      validation: result.validation ? {
        status: result.validation.status, passed: result.validation.passed,
        totalDurationMs: result.validation.totalDurationMs,
        results: result.validation.results.map(item => ({
          command: item.command, exitCode: item.exitCode, durationMs: item.durationMs,
        })),
      } : undefined,
    },
    now: now().toISOString(),
  });
  if (!finished) throw new Error("DevPilot run completion rejected: lease lost or run state changed.");
  return result;
}
