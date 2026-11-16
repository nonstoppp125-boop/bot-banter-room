import { validateReleaseMetadata } from "./quality-gates";
export interface ReleaseApproval{approved:boolean;approvedByUserId:string|null;approvedAt:string|null;commitSha:string;scope:"staging"|"production";reason:string;}
export interface ReleaseCandidateInput{version:string;commitSha:string;branch:string;changeSummary:string;artifactSha256:string;qualityStatus:"passed"|"failed"|"blocked";rollbackPlan:string;backupEvidence:string;approval?:ReleaseApproval|null;now:string;}
export interface ReleaseDecision{status:"blocked"|"ready-for-human-approval"|"approved-for-promotion";deploymentPerformed:false;deploymentAllowed:boolean;blockers:string[];note:string;}
export function evaluateReleaseCandidate(input:ReleaseCandidateInput):ReleaseDecision{
 const blockers:string[]=[];
 const metadata=validateReleaseMetadata({version:input.version,commitSha:input.commitSha,branch:input.branch,changeSummary:input.changeSummary});
 blockers.push(...metadata.errors);
 if(!/^[a-f0-9]{64}$/i.test(input.artifactSha256))blockers.push("Artifact SHA-256 is required.");
 if(input.qualityStatus!=="passed")blockers.push("All required quality gates must pass.");
 if(input.rollbackPlan.trim().length<20)blockers.push("A documented rollback plan is required.");
 if(input.backupEvidence.trim().length<10)blockers.push("Backup/restore evidence is required.");
 if(!Number.isFinite(Date.parse(input.now)))blockers.push("Evaluation timestamp is invalid.");
 if(blockers.length)return{status:"blocked",deploymentPerformed:false,deploymentAllowed:false,blockers,note:"Release candidate is blocked; no deployment action was performed."};
 if(!input.approval?.approved)return{status:"ready-for-human-approval",deploymentPerformed:false,deploymentAllowed:false,blockers:[],note:"Technical gates passed; explicit human approval is still required."};
 const approval=input.approval;
 if(!approval.approvedByUserId||!approval.approvedAt||!Number.isFinite(Date.parse(approval.approvedAt)))blockers.push("Approval identity and timestamp are required.");
 if(approval.commitSha!==input.commitSha)blockers.push("Approval is bound to a different commit.");
 if(!approval.reason.trim()||approval.reason.length>1000)blockers.push("A bounded approval reason is required.");
 if(approval.scope==="production"&&input.branch==="main")blockers.push("Production approval must reference a reviewed release candidate, not an unreviewed main branch.");
 if(blockers.length)return{status:"blocked",deploymentPerformed:false,deploymentAllowed:false,blockers,note:"Approval evidence is invalid; no deployment action was performed."};
 return{status:"approved-for-promotion",deploymentPerformed:false,deploymentAllowed:false,blockers:[],note:"Approval is recorded for a separate promotion workflow; this module does not deploy."};
}
export function buildReleaseManifest(input:{version:string;commitSha:string;artifactSha256:string;builtAt:string;changeSummary:string}){
 const decision=validateReleaseMetadata({version:input.version,commitSha:input.commitSha,branch:"release/candidate",changeSummary:input.changeSummary});
 if(!decision.valid||!/^[a-f0-9]{64}$/i.test(input.artifactSha256)||!Number.isFinite(Date.parse(input.builtAt)))throw new Error("Release manifest metadata is invalid.");
 return{schemaVersion:1,version:input.version,commitSha:input.commitSha,artifactSha256:input.artifactSha256.toLowerCase(),builtAt:input.builtAt,changeSummary:input.changeSummary.trim(),deploymentPerformed:false as const};
}
