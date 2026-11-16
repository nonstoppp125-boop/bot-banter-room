export interface OutboundUrlDecision{allowed:boolean;reason:string;normalizedUrl:string|null;requiresDnsEgressValidation:true;}
function isPrivateIpv4(host:string):boolean{
 const parts=host.split(".").map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const a=parts[0]!,b=parts[1]!;
 const c=parts[2]!;
 return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&c<=2)))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113);
}
function isPrivateHost(host:string):boolean{
 const value=host.toLowerCase().replace(/^\[|\]$/g,"").replace(/\.$/,"");
 if(value==="localhost"||value.endsWith(".localhost")||value.endsWith(".local")||value.endsWith(".internal")||value.endsWith(".test"))return true;
 if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)&&isPrivateIpv4(value))return true;
 if(value==="::"||value==="::1"||value.startsWith("fc")||value.startsWith("fd")||value.startsWith("fe80:")||value.startsWith("::ffff:"))return true;
 return false;
}
export function validateOutboundUrl(raw:string,allowedHosts:readonly string[]=[]):OutboundUrlDecision{
 const denied=(reason:string):OutboundUrlDecision=>({allowed:false,reason,normalizedUrl:null,requiresDnsEgressValidation:true});
 let url:URL;try{url=new URL(raw);}catch{return denied("Malformed URL.");}
 if(url.protocol!=="https:")return denied("Only HTTPS outbound URLs are permitted.");
 if(url.username||url.password||url.hash)return denied("Credentials and URL fragments are not permitted.");
 if(url.port&&url.port!=="443")return denied("Non-standard outbound ports are blocked.");
 const host=url.hostname.toLowerCase().replace(/\.$/,"");
 if(!host||isPrivateHost(host))return denied("Local, private or reserved destinations are blocked.");
 if(allowedHosts.length&&!allowedHosts.some(item=>host===item.toLowerCase()||host.endsWith("."+item.toLowerCase())))return denied("Destination host is not allowlisted.");
 url.hash="";
 return{allowed:true,reason:"URL passed static checks; DNS resolution and redirect targets must still be validated by the egress layer.",normalizedUrl:url.toString(),requiresDnsEgressValidation:true};
}
export function validateCorsOrigin(origin:string|null,allowedOrigins:readonly string[]):boolean{
 if(!origin||origin==="null")return false;
 try{const parsed=new URL(origin);if(parsed.origin!==origin||!["https:","http:"].includes(parsed.protocol))return false;return allowedOrigins.includes(parsed.origin);}catch{return false;}
}
export function redactSensitiveText(value:string):string{
 return value
  .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,"[REDACTED PRIVATE KEY]")
  .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,"Bearer [REDACTED]")
  .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[^\s,"']+["']?/gi,"$1=[REDACTED]");
}
const MIME_EXTENSIONS:Readonly<Record<string,readonly string[]>>={"text/plain":[".txt",".md"],"text/csv":[".csv"],"application/pdf":[".pdf"],"image/jpeg":[".jpg",".jpeg"],"image/png":[".png"],"image/webp":[".webp"]};
export function validateUploadMetadata(input:{fileName:string;mimeType:string;size:number;maxBytes?:number}):{allowed:boolean;reason:string;safeFileName:string|null}{
 const fileName=input.fileName.replace(/[\u0000-\u001f\u007f]/g,"").trim();
 if(!fileName||fileName.length>180||fileName.includes("/")||fileName.includes("\\" )||fileName==="."||fileName==="..")return{allowed:false,reason:"Unsafe filename.",safeFileName:null};
 const max=input.maxBytes??10_000_000;
 if(!Number.isSafeInteger(input.size)||input.size<=0||input.size>max)return{allowed:false,reason:"File size is outside the allowed range.",safeFileName:null};
 const allowedExtensions=MIME_EXTENSIONS[input.mimeType];
 if(!allowedExtensions||!allowedExtensions.some(ext=>fileName.toLowerCase().endsWith(ext)))return{allowed:false,reason:"File type and extension are not allowlisted.",safeFileName:null};
 return{allowed:true,reason:"Metadata passed validation; file content still requires safe parsing and malware/content inspection.",safeFileName:fileName};
}
