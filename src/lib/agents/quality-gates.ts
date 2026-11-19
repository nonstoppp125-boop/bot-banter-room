export type QualityStatus="passed"|"failed"|"blocked"|"not-run";
export type QualityGateId="typecheck"|"unit-tests"|"integration-tests"|"production-build"|"wrangler-validation"|"migration-sequence"|"security-review"|"accessibility"|"mobile-smoke"|"api-smoke"|"d1-migration-apply"|"backup-restore"|"privacy-review";
export interface QualityEvidence{id:QualityGateId;status:QualityStatus;summary:string;evidenceRef?:string;checkedAt:string;}
export interface QualityGateSummary{status:"passed"|"failed"|"blocked";passed:QualityGateId[];failed:QualityGateId[];blocked:QualityGateId[];notRun:QualityGateId[];deploymentAllowed:false;reason:string;}
export const REQUIRED_RELEASE_GATES:readonly QualityGateId[]=["typecheck","unit-tests","integration-tests","production-build","wrangler-validation","migration-sequence","security-review","accessibility","mobile-smoke","api-smoke","d1-migration-apply","backup-restore","privacy-review"];
export function evaluateQualityGates(evidence:readonly QualityEvidence[],required:readonly QualityGateId[]=REQUIRED_RELEASE_GATES):QualityGateSummary{
 const byId=new Map<QualityGateId,QualityEvidence>();
 for(const item of evidence){if(!Number.isFinite(Date.parse(item.checkedAt))||!item.summary.trim())throw new Error("Quality evidence requires a timestamp and summary.");byId.set(item.id,item);}
 const passed:QualityGateId[]=[],failed:QualityGateId[]=[],blocked:QualityGateId[]=[],notRun:QualityGateId[]=[];
 for(const id of required){const item=byId.get(id);if(!item||item.status==="not-run")notRun.push(id);else if(item.status==="passed")passed.push(id);else if(item.status==="failed")failed.push(id);else blocked.push(id);}
 const status=failed.length?"failed":blocked.length||notRun.length?"blocked":"passed";
 return{status,passed,failed,blocked,notRun,deploymentAllowed:false,reason:status==="passed"?"All listed gates have evidence; deployment still requires separate explicit authorization.":status==="failed"?"One or more required quality gates failed.":"Required evidence is missing or blocked; release readiness cannot be claimed."};
}
export function validateMigrationSequence(paths:readonly string[]):{valid:boolean;versions:number[];duplicates:number[];gaps:number[]}{
 const versions=paths.map(path=>{const match=path.match(/(?:^|\/)(\d{4})_[^/]+\.sql$/);return match?Number(match[1]):null;}).filter((value):value is number=>value!==null).sort((a,b)=>a-b);
 const duplicates=versions.filter((value,index)=>versions.indexOf(value)!==index);
 const unique=[...new Set(versions)],gaps:number[]=[];
 for(let i=1;i<=unique.length;i++)if(!unique.includes(i))gaps.push(i);
 return{valid:duplicates.length===0&&gaps.length===0&&versions.length===paths.length,versions,duplicates:[...new Set(duplicates)],gaps};
}
export function validateReleaseMetadata(input:{version:string;commitSha:string;branch:string;changeSummary:string}):{valid:boolean;errors:string[]}{
 const errors:string[]=[];
 if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.version))errors.push("Release version must use semantic versioning.");
 if(!/^[a-f0-9]{7,64}$/i.test(input.commitSha))errors.push("Release commit SHA is invalid.");
 if(!input.branch.trim()||input.branch==="main")errors.push("A release candidate must be recorded from a non-main branch before promotion.");
 if(!input.changeSummary.trim()||input.changeSummary.length>2000)errors.push("A bounded change summary is required.");
 return{valid:errors.length===0,errors};
}
