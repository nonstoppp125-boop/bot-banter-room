export type CodingRisk = "low" | "medium" | "high";
export type RepositoryFileStatus = "tracked" | "modified" | "untracked";
export interface RepositoryFileInput { path:string; sha?:string; size:number; status:RepositoryFileStatus; }
export interface RepositoryInventory { repository:string; branch:string; headSha:string; files:RepositoryFileInput[]; skippedPaths:string[]; totalBytes:number; createdAt:string; }
const MAX_FILES=5000,MAX_FILE_BYTES=1_000_000,MAX_INVENTORY_BYTES=20_000_000,MAX_PROPOSAL_FILES=8,MAX_PATCH_BYTES=500_000;
const SECRET_PATH=/(^|\/)(\.env(?!\.example$)(?:\.[^/]*)?|id_rsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx))$/i;
const PROTECTED_SEGMENTS=new Set([".git","node_modules",".wrangler",".output","dist","coverage"]);
function safePath(path:string):boolean{
 if(!path||path.length>500||path.startsWith("/")||path.includes("\\")||path.split("/").some(p=>!p||p==="."||p===".."||PROTECTED_SEGMENTS.has(p)))return false;
 return !SECRET_PATH.test(path);
}
function cleanText(v:string,max:number){return v.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
export function buildRepositoryInventory(input:{repository:string;branch:string;headSha:string;files:readonly RepositoryFileInput[];now?:string}):RepositoryInventory{
 if(!cleanText(input.repository,200)||!cleanText(input.branch,120)||!/^[a-f0-9]{7,64}$/i.test(input.headSha))throw new Error("Repository identity, branch and head SHA are required.");
 if(input.files.length>MAX_FILES)throw new Error("Repository inventory exceeds the file-count limit.");
 const files:RepositoryFileInput[]=[],skippedPaths:string[]=[];let totalBytes=0;const seen=new Set<string>();
 for(const file of input.files){
  if(!safePath(file.path)||seen.has(file.path)||!Number.isSafeInteger(file.size)||file.size<0||file.size>MAX_FILE_BYTES||!["tracked","modified","untracked"].includes(file.status)){skippedPaths.push(cleanText(file.path,500));continue;}
  seen.add(file.path);totalBytes+=file.size;if(totalBytes>MAX_INVENTORY_BYTES)throw new Error("Repository inventory exceeds the 20 MB metadata budget.");
  files.push({path:file.path,...(file.sha?{sha:file.sha}:{}),size:file.size,status:file.status});
 }
 return{repository:cleanText(input.repository,200),branch:cleanText(input.branch,120),headSha:input.headSha,files,skippedPaths,totalBytes,createdAt:input.now??new Date().toISOString()};
}
export interface CodingPlan { task:string; baseSha:string; targetBranch:string; complexity:"simple"|"moderate"|"complex"; risk:CodingRisk; filesToInspect:string[]; acceptanceCriteria:string[]; validationCommands:string[]; approvalRequired:boolean; limitations:string[]; }
export function buildCodingPlan(task:string,inventory:RepositoryInventory):CodingPlan{
 const objective=cleanText(task,4000);if(!objective)throw new Error("Coding task is required.");
 const risk:CodingRisk=/\b(delete|drop|overwrite|deploy|release|production|secret|credential|permission|authentication)\b/i.test(objective)?"high":/\b(api|database|migration|auth|security|refactor)\b/i.test(objective)?"medium":"low";
 const complexity=objective.length>1200||/\b(end[- ]to[- ]end|architecture|multiple modules|complete system)\b/i.test(objective)?"complex":objective.length>300?"moderate":"simple";
 return{task:objective,baseSha:inventory.headSha,targetBranch:inventory.branch,complexity,risk,filesToInspect:inventory.files.slice(0,20).map(f=>f.path),acceptanceCriteria:["Requirements are mapped to observable behavior.","Existing behavior and unrelated changes are preserved.","Relevant tests cover success, failure and boundary cases.","Typecheck, tests and production build pass where configured.","Diff and security review are recorded."],validationCommands:["npm run typecheck","npm test","npm run build","git diff --check"],approvalRequired:risk==="high"||inventory.branch==="main",limitations:["Planning only: no repository files are changed or commands executed by this module.","Repository inventory contains metadata only; skipped secret/configuration paths are not inspected."]};
}
export interface ProposedFileChange { path:string; beforeSha:string|null; content:string; }
export interface CodeChangeProposal { id:string; repository:string; baseSha:string; targetBranch:string; changes:ProposedFileChange[]; status:"pending-review"; }
export function validateCodeChangeProposal(proposal:CodeChangeProposal,inventory:RepositoryInventory):{valid:boolean;errors:string[];totalBytes:number}{
 const errors:string[]=[];let totalBytes=0;const known=new Map(inventory.files.map(f=>[f.path,f]));
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(proposal.id))errors.push("Invalid proposal ID.");
 if(proposal.repository!==inventory.repository)errors.push("Repository identity mismatch.");
 if(proposal.baseSha!==inventory.headSha)errors.push("Stale base SHA; refresh inventory before proposing changes.");
 if(proposal.targetBranch==="main"||proposal.targetBranch!==inventory.branch)errors.push("Changes must target the inspected non-main work branch.");
 if(!proposal.changes.length||proposal.changes.length>MAX_PROPOSAL_FILES)errors.push("Proposal must contain between 1 and 8 files.");
 const seen=new Set<string>();
 for(const change of proposal.changes){
  if(!safePath(change.path)||seen.has(change.path)){errors.push("Unsafe or duplicate target path: "+cleanText(change.path,200));continue;}
  seen.add(change.path);const current=known.get(change.path);
  if(current&&change.beforeSha!==current.sha)errors.push("File SHA mismatch: "+change.path);
  if(!current&&change.beforeSha!==null)errors.push("New files must use a null beforeSha: "+change.path);
  if(typeof change.content!=="string"||change.content.length>MAX_PATCH_BYTES){errors.push("File content exceeds the 500 KB limit: "+change.path);continue;}
  totalBytes+=new TextEncoder().encode(change.content).byteLength;
 }
 if(totalBytes>2_000_000)errors.push("Proposal exceeds the 2 MB total content limit.");
 return{valid:errors.length===0,errors,totalBytes};
}
const VALIDATION_COMMANDS=new Set(["npm run typecheck","npm test","npm run build","npm run lint","npm audit --omit=dev --audit-level=high","git status --short","git diff --check","git diff --stat"]);
export function authorizeValidationCommand(command:string):{allowed:boolean;reason:string}{
 const normalized=cleanText(command,300);
 if(VALIDATION_COMMANDS.has(normalized))return{allowed:true,reason:"Exact allowlisted validation command."};
 return{allowed:false,reason:"Command is not allowlisted; shell composition, arbitrary execution and destructive commands are denied."};
}

export interface ValidationCommandResult {
  command:string;
  exitCode:number;
  stdout:string;
  stderr:string;
  durationMs:number;
}
export interface ValidationCommandRunner {
  run(input:{command:string;timeoutMs:number;signal?:AbortSignal}):Promise<{exitCode:number;stdout:string;stderr:string;durationMs:number}>;
}
export interface ValidationSuiteResult {
  status:"passed"|"failed"|"blocked"|"cancelled";
  passed:boolean;
  results:ValidationCommandResult[];
  totalDurationMs:number;
  reason?:string;
}
/** Runs only exact allowlisted checks through an injected isolated runner; this module never spawns a shell. */
export async function runValidationSuite(input:{
  commands:readonly string[];
  runner:ValidationCommandRunner;
  signal?:AbortSignal;
  timeoutMs?:number;
  maxOutputChars?:number;
}):Promise<ValidationSuiteResult>{
  const commands=[...input.commands];
  const timeoutMs=input.timeoutMs??120_000;
  const maxOutputChars=input.maxOutputChars??12_000;
  if(commands.length===0||commands.length>8||new Set(commands).size!==commands.length){
    return{status:"blocked",passed:false,results:[],totalDurationMs:0,reason:"Validation suite must contain 1–8 unique commands."};
  }
  const denied=commands.find(command=>!authorizeValidationCommand(command).allowed);
  if(denied)return{status:"blocked",passed:false,results:[],totalDurationMs:0,reason:"Validation command is not allowlisted: "+cleanText(denied,120)};
  if(!Number.isInteger(timeoutMs)||timeoutMs<1_000||timeoutMs>300_000||!Number.isInteger(maxOutputChars)||maxOutputChars<1_000||maxOutputChars>30_000){
    return{status:"blocked",passed:false,results:[],totalDurationMs:0,reason:"Validation execution limits are outside the permitted range."};
  }
  const results:ValidationCommandResult[]=[];
  let totalDurationMs=0;
  for(const command of commands){
    if(input.signal?.aborted)return{status:"cancelled",passed:false,results,totalDurationMs,reason:"Validation suite was cancelled."};
    try{
      const result=await input.runner.run({command,timeoutMs,signal:input.signal});
      if(!Number.isInteger(result.exitCode)||!Number.isFinite(result.durationMs)||result.durationMs<0||typeof result.stdout!=="string"||typeof result.stderr!=="string"){
        return{status:"failed",passed:false,results,totalDurationMs,reason:"Validation runner returned malformed execution evidence."};
      }
      const bounded={command,exitCode:result.exitCode,stdout:result.stdout.replace(/\u0000/g,"").slice(0,maxOutputChars),stderr:result.stderr.replace(/\u0000/g,"").slice(0,maxOutputChars),durationMs:result.durationMs};
      results.push(bounded);totalDurationMs+=result.durationMs;
      if(result.exitCode!==0)return{status:"failed",passed:false,results,totalDurationMs,reason:"Validation command failed: "+command};
    }catch(error){
      if(input.signal?.aborted)return{status:"cancelled",passed:false,results,totalDurationMs,reason:"Validation suite was cancelled."};
      return{status:"failed",passed:false,results,totalDurationMs,reason:error instanceof Error?cleanText(error.message,300):"Validation runner failed."};
    }
  }
  return{status:"passed",passed:true,results,totalDurationMs};
}

export interface DiffReviewInput { files:readonly {path:string;content:string}[]; testsChanged:boolean; }
export function reviewCodeDiff(input:DiffReviewInput){
 const findings:{severity:"critical"|"high"|"medium";code:string;message:string}[]=[];
 for(const file of input.files){
  if(SECRET_PATH.test(file.path))findings.push({severity:"critical",code:"secret-path",message:"Sensitive credential path must not be included: "+file.path});
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"']{12,}/i.test(file.content))findings.push({severity:"critical",code:"possible-secret",message:"Possible hard-coded credential detected in "+file.path});
  if(/\beval\s*\(|new Function\s*\(|child_process|execSync\s*\(|dangerouslySetInnerHTML/.test(file.content))findings.push({severity:"high",code:"unsafe-primitive",message:"Review dynamic execution or unsafe rendering primitive in "+file.path});
 }
 if(input.files.some(f=>/\.(?:ts|tsx|js|jsx)$/.test(f.path))&&!input.testsChanged)findings.push({severity:"medium",code:"tests-not-updated",message:"Source changes were proposed without a corresponding test change."});
 return{passed:findings.every(f=>f.severity!=="critical"&&f.severity!=="high"),findings,reviewScope:"Heuristic source review only; this is not a complete security audit or compiler result."};
}
export interface EngineeringEvent { id:string; taskId:string; type:"planned"|"proposal-created"|"reviewed"|"verified"|"blocked"; timestamp:string; summary:string; evidence:string[]; }
export function createEngineeringEvent(input:EngineeringEvent):EngineeringEvent{
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(input.id)||!cleanText(input.taskId,100)||!Number.isFinite(Date.parse(input.timestamp)))throw new Error("Invalid engineering event metadata.");
 return{...input,summary:cleanText(input.summary,500),evidence:input.evidence.map(v=>cleanText(v,500)).filter(Boolean).slice(0,20)};
}


export interface DependencyManifestReport {
  packageCount: number;
  productionDependencies: Array<{ name:string; version:string; pinned:boolean }>;
  developmentDependencies: Array<{ name:string; version:string; pinned:boolean }>;
  lifecycleScripts: string[];
  lockfilePresent: boolean;
  findings: string[];
  auditCommand: "npm audit --omit=dev --audit-level=high";
}
export function inspectDependencyManifest(packageJson:string,lockfilePresent:boolean):DependencyManifestReport{
 if(typeof packageJson!=="string"||packageJson.length>1_000_000)throw new Error("Package manifest is missing or exceeds the 1 MB limit.");
 let parsed:unknown;try{parsed=JSON.parse(packageJson);}catch{throw new Error("Package manifest is not valid JSON.");}
 if(!parsed||typeof parsed!=="object")throw new Error("Package manifest must be a JSON object.");
 const data=parsed as Record<string,unknown>;
 const collect=(value:unknown)=>Object.entries(value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{})
  .filter((entry):entry is [string,string]=>Boolean(cleanText(entry[0],200))&&typeof entry[1]==="string")
  .map(([name,version])=>({name:cleanText(name,200),version:cleanText(version,100),pinned:/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version)}));
 const production=collect(data["dependencies"]),development=collect(data["devDependencies"]);
 const scripts=data["scripts"]&&typeof data["scripts"]==="object"?data["scripts"] as Record<string,unknown>:{};
 const lifecycle=["preinstall","install","postinstall","prepare"].filter(name=>typeof scripts[name]==="string");
 const findings:string[]=[];
 if(!lockfilePresent)findings.push("No lockfile was reported; reproducible dependency installation is not verified.");
 if(lifecycle.length)findings.push("Lifecycle scripts require review: "+lifecycle.join(", "));
 if([...production,...development].some(item=>!item.pinned))findings.push("One or more dependency versions use ranges or tags rather than exact pins.");
 return{packageCount:production.length+development.length,productionDependencies:production,developmentDependencies:development,lifecycleScripts:lifecycle,lockfilePresent,findings,auditCommand:"npm audit --omit=dev --audit-level=high"};
}
export function createCodeChangeProposal(input:{id:string;inventory:RepositoryInventory;targetBranch:string;changes:ProposedFileChange[]}):CodeChangeProposal{
 const proposal:CodeChangeProposal={id:input.id,repository:input.inventory.repository,baseSha:input.inventory.headSha,targetBranch:input.targetBranch,changes:input.changes,status:"pending-review"};
 const result=validateCodeChangeProposal(proposal,input.inventory);
 if(!result.valid)throw new Error("Code change proposal rejected: "+result.errors.join(" "));
 return proposal;
}
