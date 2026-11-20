import { hashApprovalPayload } from "./approval-store";
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
export type DevPilotResultStatus = "awaiting_approval"|"completed"|"blocked"|"failed"|"cancelled";
export interface DevPilotResult {
  status:DevPilotResultStatus;
  progress:0|10|25|50|75|90|100;
  plan?:ReturnType<typeof buildCodingPlan>;
  proposal?:CodeChangeProposal;
  approvalPayloadHash?:string;
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
  signal?:AbortSignal;
  now?:()=>Date;
}):Promise<DevPilotResult>{
  const events:EngineeringEvent[]=[];
  const now=input.now??(()=>new Date());
  let currentProgress:DevPilotResult["progress"]=0;
  const blocked=(reason:string,progress:DevPilotResult["progress"]=currentProgress):DevPilotResult=>{
    if(TASK_ID.test(input.taskId))addEvent(events,input.taskId,"blocked",reason,[],now);
    return{status:"blocked",progress,events,reason};
  };
  const failed=(reason:string,progress:DevPilotResult["progress"]=currentProgress,extra:Partial<DevPilotResult>={}):DevPilotResult=>{
    return{status:input.signal?.aborted?"cancelled":"failed",progress,events,reason,...extra};
  };
  if(!TASK_ID.test(input.taskId)||!REPOSITORY.test(input.repository)||!input.task.trim()||input.task.length>4_000||!input.baseBranch.trim()||input.baseBranch.length>120){
    return blocked("Invalid DevPilot task or repository identity.");
  }
  if(input.signal?.aborted)return{status:"cancelled",progress:0,events,reason:"DevPilot task was cancelled before inspection."};
  try{
    const snapshot=await input.adapter.inspectRepository({repository:input.repository,branch:input.baseBranch,...(input.signal?{signal:input.signal}:{})});
    if(snapshot.repository!==input.repository||snapshot.branch!==input.baseBranch||!SHA.test(snapshot.headSha)){
      return blocked("Repository identity, base branch or HEAD verification failed.");
    }
    if(!snapshot.workingTreeClean)return blocked("Repository working tree is not clean; isolate and preserve existing changes before coding.");
    const targetBranch="devpilot/"+input.taskId;
    const inventory=buildRepositoryInventory({repository:snapshot.repository,branch:targetBranch,headSha:snapshot.headSha,files:snapshot.files,now:now().toISOString()});
    currentProgress=10;
    addEvent(events,input.taskId,"planned","Repository identity and clean baseline verified.",[snapshot.repository,snapshot.branch,snapshot.headSha],now);
    const plan=buildCodingPlan(input.task,inventory);
    currentProgress=25;
    addEvent(events,input.taskId,"planned","Bounded coding plan created.",[...plan.acceptanceCriteria],now);
    const files=await input.adapter.readFiles({repository:input.repository,branch:input.baseBranch,paths:plan.filesToInspect,...(input.signal?{signal:input.signal}:{})});
    const allowedPaths=new Set(plan.filesToInspect);
    if(files.length!==plan.filesToInspect.length||files.length>20||files.some(file=>!allowedPaths.has(file.path)||file.content.length>1_000_000||!SHA.test(file.sha))){
      return blocked("Repository adapter returned an out-of-scope or oversized file.");
    }
    for(const file of files){
      const expected=inventory.files.find(item=>item.path===file.path)?.sha;
      if(expected&&expected!==file.sha)return blocked("Repository file changed during inspection: "+file.path);
    }
    const changes=await input.proposeChanges({task:input.task,repository:input.repository,baseBranch:input.baseBranch,targetBranch,baseSha:snapshot.headSha,plan,files,...(input.signal?{signal:input.signal}:{})});
    const proposal=createCodeChangeProposal({id:input.taskId,inventory,targetBranch,changes});
    const testsChanged=changes.some(change=>/(?:^|\/)(?:[^/]*\.)?(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(__tests__|tests)\//i.test(change.path));
    const sourceChanged=changes.some(change=>/\.(?:ts|tsx|js|jsx|py|go|rs|java|kt|swift)$/i.test(change.path));
    const initialReview=reviewCodeDiff({files:changes,testsChanged});
    if(!initialReview.passed)return blocked("Proposed diff contains critical or high-severity security findings.",25);
    if(sourceChanged&&!testsChanged)return blocked("Source changes require corresponding test changes before execution.",25);
    const approvalRequired=plan.approvalRequired||changes.some(change=>/^(?:\.github\/workflows\/|migrations\/|wrangler(?:\.[^/]*)?$|package(?:-lock)?\.json$|bun\.lock$|src\/lib\/agents\/(?:session-auth|password-auth|approval-store|task-approval|action-policy|security-boundaries)\.ts$)/i.test(change.path));
    const effectivePlan=approvalRequired&&!plan.approvalRequired?{...plan,risk:"high" as const,approvalRequired:true,limitations:[...plan.limitations,"Sensitive deployment, migration, dependency, authentication and authorization paths require explicit approval."]}:plan;
    const approvalPayloadHash=await hashApprovalPayload({kind:"devpilot-code-change",taskId:input.taskId,repository:input.repository,baseBranch:input.baseBranch,baseSha:snapshot.headSha,targetBranch,plan:effectivePlan,proposal,review:initialReview});
    addEvent(events,input.taskId,"proposal-created","Validated code proposal and pre-apply security review completed.",[...changes.map(change=>change.path),approvalPayloadHash],now);
    if(input.approval&&input.approval.payloadHash!==approvalPayloadHash){
      return blocked("Approval payload does not match the current task, repository baseline and exact code proposal.",25);
    }
    if(effectivePlan.approvalRequired){
      if(!input.approval?.approvalId||!input.verifyApproval){
        return{status:"awaiting_approval",progress:25,plan:effectivePlan,proposal,approvalPayloadHash,events,reason:"A persisted approval record and trusted approval verifier are required before repository writes."};
      }
      const approved=await input.verifyApproval({approvalId:input.approval.approvalId,taskId:input.taskId,repository:input.repository,payloadHash:approvalPayloadHash});
      if(!approved)return blocked("Persisted approval is missing, expired, rejected or does not match this exact proposal.",25);
    }
    if(input.signal?.aborted)return{status:"cancelled",progress:25,plan:effectivePlan,proposal,approvalPayloadHash,events,reason:"DevPilot task was cancelled before repository writes."};
    await input.adapter.createBranch({repository:input.repository,branch:targetBranch,baseSha:snapshot.headSha,...(input.signal?{signal:input.signal}:{})});
    addEvent(events,input.taskId,"planned","Isolated non-main work branch created.",[targetBranch,snapshot.headSha],now);
    const applied=await input.adapter.applyChanges({repository:input.repository,branch:targetBranch,baseSha:snapshot.headSha,changes,...(input.signal?{signal:input.signal}:{})});
    if(!SHA.test(applied.headSha))return failed("Repository adapter returned an invalid post-apply HEAD.",50,{plan:effectivePlan,proposal,approvalPayloadHash});
    currentProgress=50;
    addEvent(events,input.taskId,"verified","Proposed files applied with a conditional base-commit check.",[applied.headSha,...changes.map(change=>change.path)],now);
    const validation=await runValidationSuite({commands:plan.validationCommands,runner:input.adapter,...(input.signal?{signal:input.signal}:{})});
    if(validation.status!=="passed")return failed(validation.reason??"Validation did not pass.",50,{plan:effectivePlan,proposal,approvalPayloadHash,validation});
    currentProgress=75;
    addEvent(events,input.taskId,"verified","All allowlisted validation commands passed.",validation.results.map(result=>result.command+" (exit "+result.exitCode+")"),now);
    const diff=await input.adapter.inspectDiff({repository:input.repository,branch:targetBranch,baseSha:snapshot.headSha,...(input.signal?{signal:input.signal}:{})});
    const proposedByPath=new Map(changes.map(change=>[change.path,change.content]));
    const actualByPath=new Map(diff.files.map(file=>[file.path,file.content]));
    const diffMatchesProposal=proposedByPath.size===actualByPath.size&&[...proposedByPath].every(([path,content])=>actualByPath.get(path)===content);
    if(!diffMatchesProposal)return blocked("Post-validation diff does not exactly match the approved proposal.",90);
    const finalTestsChanged=diff.files.some(file=>/(^|\/)([^/]+\.)?(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|tests)\//i.test(file.path));
    const finalReview=reviewCodeDiff({files:diff.files,testsChanged:finalTestsChanged});
    if(!finalReview.passed||!finalTestsChanged)return blocked("Post-validation diff review failed or test changes are missing.",90);
    currentProgress=90;
    addEvent(events,input.taskId,"reviewed","Post-validation diff passed the bounded security review.",diff.files.map(file=>file.path),now);
    const committed=await input.adapter.commit({repository:input.repository,branch:targetBranch,expectedHeadSha:applied.headSha,message:"devpilot: "+plan.task.slice(0,72),...(input.signal?{signal:input.signal}:{})});
    if(!SHA.test(committed.commitSha))return failed("Repository adapter returned an invalid commit SHA.",90,{plan:effectivePlan,proposal,approvalPayloadHash,validation});
    addEvent(events,input.taskId,"verified","Reviewed changes committed on the isolated branch.",[committed.commitSha],now);
    const pullRequest=await input.adapter.createPullRequest({repository:input.repository,headBranch:targetBranch,baseBranch:input.baseBranch,title:"DevPilot: "+plan.task.slice(0,100),body:"Automated coding task.\n\n- Base: "+snapshot.headSha+"\n- Commit: "+committed.commitSha+"\n- Validation: all allowlisted checks passed.\n- Security: bounded diff review passed.\n\nNo production deployment or merge was performed.",commitSha:committed.commitSha,...(input.signal?{signal:input.signal}:{})});
    if(!Number.isInteger(pullRequest.number)||pullRequest.number<1||!/^https:\/\//.test(pullRequest.url))return failed("Repository adapter returned invalid pull-request metadata.",90,{plan:effectivePlan,proposal,approvalPayloadHash,validation,commitSha:committed.commitSha});
    currentProgress=100;
    addEvent(events,input.taskId,"verified","Pull request created; no merge or deployment performed.",[pullRequest.url],now);
    return{status:"completed",progress:100,plan:effectivePlan,proposal,approvalPayloadHash,validation,commitSha:committed.commitSha,pullRequest,events};
  }catch(error){
    return failed(error instanceof Error?error.message.slice(0,500):"DevPilot workflow failed.");
  }
}
