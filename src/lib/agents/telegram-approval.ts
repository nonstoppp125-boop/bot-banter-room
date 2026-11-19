const ID=/^[A-Za-z0-9_-]{1,32}$/;
const WORKSPACE=/^[A-Za-z0-9._:-]{1,120}$/;
function encodeBase64Url(bytes:Uint8Array){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function constantTimeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function signature(secret:string,payload:string){
 if(secret.length<32)throw new Error("Telegram callback signing secret is not configured.");
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload)));
 return encodeBase64Url(digest.slice(0,12));
}
export async function createTelegramApprovalCallbackData(input:{approvalId:string;telegramUserId:string;workspaceId:string;decision:"approved"|"rejected";secret:string}):Promise<string>{
 if(!ID.test(input.approvalId)||!/^[1-9][0-9]{0,19}$/.test(input.telegramUserId)||!WORKSPACE.test(input.workspaceId))throw new Error("Invalid Telegram approval callback identity.");
 const prefix=input.decision==="approved"?"a1":"r1";
 const sig=await signature(input.secret,prefix+":"+input.approvalId+":"+input.telegramUserId+":"+input.workspaceId);
 const data=prefix+"."+input.approvalId+"."+sig;
 if(new TextEncoder().encode(data).byteLength>64)throw new Error("Telegram callback data exceeds 64 bytes.");
 return data;
}
export async function verifyTelegramApprovalCallbackData(input:{data:string;telegramUserId:string;workspaceId:string;secret:string}):Promise<{valid:boolean;approvalId:string|null;decision:"approved"|"rejected"|null}>{
 if(new TextEncoder().encode(input.data).byteLength>64||!/^[1-9][0-9]{0,19}$/.test(input.telegramUserId)||!WORKSPACE.test(input.workspaceId))return{valid:false,approvalId:null,decision:null};
 const parts=input.data.split(".");
 if(parts.length!==3||(parts[0]!=="a1"&&parts[0]!=="r1")||!ID.test(parts[1]!)||! /^[A-Za-z0-9_-]{16}$/.test(parts[2]!))return{valid:false,approvalId:null,decision:null};
 const decision=parts[0]==="a1"?"approved":"rejected";
 let expected:string;try{expected=await signature(input.secret,parts[0]+":"+parts[1]+":"+input.telegramUserId+":"+input.workspaceId);}catch{return{valid:false,approvalId:null,decision:null};}
 return constantTimeEqual(parts[2]!,expected)?{valid:true,approvalId:parts[1]!,decision}:{valid:false,approvalId:null,decision:null};
}
