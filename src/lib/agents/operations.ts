import { redactSensitiveText } from "./security-boundaries";
export type OperationalLogLevel="debug"|"info"|"warn"|"error";
export interface StructuredLogEvent{timestamp:string;level:OperationalLogLevel;event:string;requestId:string|null;fields:Record<string,string|number|boolean|null>;}
const SECRET_KEY=/(token|secret|password|authorization|cookie|credential|api.?key|private.?key)/i;
export function createStructuredLogEvent(input:{timestamp:string;level:OperationalLogLevel;event:string;requestId?:string|null;fields?:Record<string,unknown>}):StructuredLogEvent{
 if(!Number.isFinite(Date.parse(input.timestamp))||!["debug","info","warn","error"].includes(input.level)||!/^[a-z0-9._:-]{2,100}$/i.test(input.event))throw new Error("Invalid structured log event.");
 const fields:Record<string,string|number|boolean|null>={};
 for(const[key,value]of Object.entries(input.fields??{}).slice(0,30)){
  const name=key.replace(/[^a-zA-Z0-9_.-]/g,"").slice(0,60);if(!name)continue;
  if(SECRET_KEY.test(name)){fields[name]="[REDACTED]";continue;}
  if(value===null||typeof value==="boolean"||(typeof value==="number"&&Number.isFinite(value)))fields[name]=value as string|number|boolean|null;
  else if(typeof value==="string")fields[name]=redactSensitiveText(value).slice(0,500);
  else fields[name]="[OMITTED]";
 }
 const requestId=input.requestId&&/^[A-Za-z0-9._:-]{8,100}$/.test(input.requestId)?input.requestId:null;
 return{timestamp:input.timestamp,level:input.level,event:input.event,requestId,fields};
}
export function createPublicHealthResponse(now=new Date().toISOString()):Response{
 if(!Number.isFinite(Date.parse(now)))throw new Error("Invalid health timestamp.");
 return Response.json({status:"ok",service:"liza",timestamp:now},{status:200,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
export function createReadinessSummary(input:{providerConfigured:boolean;rateLimiterConfigured:boolean;durableStorageConfigured:boolean;identityConfigured:boolean}){
 const checks={providerConfigured:input.providerConfigured,rateLimiterConfigured:input.rateLimiterConfigured,durableStorageConfigured:input.durableStorageConfigured,identityConfigured:input.identityConfigured};
 const missing=Object.entries(checks).filter(([,ready])=>!ready).map(([name])=>name);
 return{status:missing.length===0?"ready" as const:"degraded" as const,checks,missing,note:"Configuration readiness only; this does not prove provider, database or identity runtime health."};
}
