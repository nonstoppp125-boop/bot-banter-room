export type IntegrationProviderId="linkedin"|"instagram"|"facebook"|"youtube"|"x"|"tiktok"|"github"|"google-drive"|"gmail"|"google-calendar"|"slack"|"discord"|"notion"|"telegram";
export type IntegrationAuthMethod="oauth2"|"oauth1a"|"bot-token";
export interface IntegrationProviderDefinition{id:IntegrationProviderId;name:string;auth:IntegrationAuthMethod;connectionStatus:"not-connected";liveActionsEnabled:false;allowedScopes:readonly string[];sourceUrls:readonly string[];notes:string;}
const docs={
linkedin:["https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow"],
instagram:["https://developers.facebook.com/docs/instagram-platform/instagram-api/"],
facebook:["https://developers.facebook.com/docs/graph-api/"],
youtube:["https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps"],
x:["https://docs.x.com/fundamentals/authentication/oauth-2-0/overview"],
tiktok:["https://developers.tiktok.com/doc/login-kit-web/"],
github:["https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps"],
"google-drive":["https://developers.google.com/drive/api/guides/about-auth"],
gmail:["https://developers.google.com/gmail/api/auth/scopes"],
"google-calendar":["https://developers.google.com/calendar/api/auth"],
slack:["https://api.slack.com/authentication/oauth-v2"],
discord:["https://discord.com/developers/docs/topics/oauth2"],
notion:["https://developers.notion.com/docs/authorization"],
telegram:["https://core.telegram.org/bots/api"],
} as const;
const define=(id:IntegrationProviderId,name:string,auth:IntegrationAuthMethod,scopes:readonly string[]=[],notes="No account authorization or live API connection is configured."):IntegrationProviderDefinition=>({id,name,auth,connectionStatus:"not-connected",liveActionsEnabled:false,allowedScopes:scopes,sourceUrls:docs[id],notes});
export const INTEGRATION_PROVIDERS:Readonly<Record<IntegrationProviderId,IntegrationProviderDefinition>>={
linkedin:define("linkedin","LinkedIn","oauth2",[],"OAuth scope approval and developer application are not verified; do not initiate until configured."),
instagram:define("instagram","Instagram","oauth2",["instagram_business_basic","instagram_business_content_publishing"]),
facebook:define("facebook","Facebook Pages","oauth2",["pages_manage_posts","pages_read_engagement","pages_show_list"]),
youtube:define("youtube","YouTube","oauth2",["https://www.googleapis.com/auth/youtube.upload"]),
x:define("x","X","oauth2",["tweet.read","tweet.write","users.read","offline.access"]),
tiktok:define("tiktok","TikTok","oauth2",[],"Developer product approval and account-specific scopes must be confirmed."),
github:define("github","GitHub","oauth2",[],"Use least-privilege scopes configured for the specific repository workflow."),
"google-drive":define("google-drive","Google Drive","oauth2",[],"Use the narrowest file scopes required by the selected workflow."),
gmail:define("gmail","Gmail","oauth2",[],"Gmail scopes may be restricted/sensitive; require verification and consent review."),
"google-calendar":define("google-calendar","Google Calendar","oauth2",[],"Use read-only calendar scopes unless the user explicitly authorizes event changes."),
slack:define("slack","Slack","oauth2",[],"Request only bot/user scopes required by the selected workspace action."),
discord:define("discord","Discord","oauth2",[],"Use only the required guild and bot scopes."),
notion:define("notion","Notion","oauth2",[],"Integration access is workspace-granted and must be verified."),
telegram:define("telegram","Telegram Bot API","bot-token",[],"Bot token must remain server-side; no OAuth flow is used."),
};
export function getIntegrationProvider(id:IntegrationProviderId){return INTEGRATION_PROVIDERS[id];}
export interface OAuthStartInput{provider:IntegrationProviderId;authorizationEndpoint:string;clientId:string;redirectUri:string;registeredRedirectUri:string;scopes:readonly string[];state:string;codeChallenge:string;}
export function createOAuthAuthorizationUrl(input:OAuthStartInput):string{
 const provider=INTEGRATION_PROVIDERS[input.provider];
 if(!provider||provider.auth!=="oauth2")throw new Error("Provider does not support OAuth 2.0.");
 let endpoint:URL,redirect:URL,registered:URL;
 try{endpoint=new URL(input.authorizationEndpoint);redirect=new URL(input.redirectUri);registered=new URL(input.registeredRedirectUri);}catch{throw new Error("OAuth endpoint or redirect URI is invalid.");}
 if(endpoint.protocol!=="https:"||endpoint.username||endpoint.password||endpoint.hash)throw new Error("Authorization endpoint must be a clean HTTPS URL.");
 const localHttp=redirect.protocol==="http:"&&["localhost","127.0.0.1","::1"].includes(redirect.hostname);
 if(redirect.protocol!=="https:"&&!localHttp)throw new Error("Redirect URI must use HTTPS except for localhost development.");
 if(redirect.href!==registered.href)throw new Error("Redirect URI does not exactly match the registered callback.");
 if(!input.clientId.trim()||input.clientId.length>300)throw new Error("OAuth client ID is required.");
 if(!/^[A-Za-z0-9_-]{32,200}$/.test(input.state))throw new Error("OAuth state must be a high-entropy URL-safe value.");
 if(!/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge))throw new Error("A valid PKCE S256 challenge is required.");
 const scopes=[...new Set(input.scopes)];
 if(scopes.length===0||scopes.some(scope=>!provider.allowedScopes.includes(scope)))throw new Error("Requested OAuth scopes are not in the provider allowlist.");
 endpoint.searchParams.set("response_type","code");
 endpoint.searchParams.set("client_id",input.clientId.trim());
 endpoint.searchParams.set("redirect_uri",redirect.href);
 endpoint.searchParams.set("scope",scopes.join(" "));
 endpoint.searchParams.set("state",input.state);
 endpoint.searchParams.set("code_challenge",input.codeChallenge);
 endpoint.searchParams.set("code_challenge_method","S256");
 return endpoint.toString();
}
export function validateOAuthCallback(input:{provider:IntegrationProviderId;expectedProvider:IntegrationProviderId;expectedState:string;receivedState:string;registeredRedirectUri:string;receivedRedirectUri:string;authorizationCode:string;expiresAt:string;now:string;alreadyConsumed:boolean}):{valid:boolean;reason:"valid"|"provider-mismatch"|"state-mismatch"|"redirect-mismatch"|"missing-code"|"expired"|"already-consumed"}{
 if(input.provider!==input.expectedProvider)return{valid:false,reason:"provider-mismatch"};
 if(!input.expectedState||input.expectedState.length<32||input.expectedState!==input.receivedState)return{valid:false,reason:"state-mismatch"};
 if(input.registeredRedirectUri!==input.receivedRedirectUri)return{valid:false,reason:"redirect-mismatch"};
 if(!input.authorizationCode||input.authorizationCode.length>2000)return{valid:false,reason:"missing-code"};
 if(!Number.isFinite(Date.parse(input.expiresAt))||!Number.isFinite(Date.parse(input.now))||Date.parse(input.expiresAt)<=Date.parse(input.now))return{valid:false,reason:"expired"};
 if(input.alreadyConsumed)return{valid:false,reason:"already-consumed"};
 return{valid:true,reason:"valid"};
}
export function authorizeConnectionAccess(input:{ownerUserId:string;actorUserId:string;requiredScopes:readonly string[];grantedScopes:readonly string[]}):{allowed:boolean;reason:string}{
 if(!input.ownerUserId||!input.actorUserId||input.ownerUserId!==input.actorUserId)return{allowed:false,reason:"Connection belongs to a different user."};
 const granted=new Set(input.grantedScopes);
 const missing=input.requiredScopes.filter(scope=>!granted.has(scope));
 return missing.length?{allowed:false,reason:"Missing required scopes: "+missing.join(", ")}:{allowed:true,reason:"Owner and required scopes verified."};
}
export interface IntegrationAuditEvent{id:string;userId:string;provider:IntegrationProviderId;action:string;timestamp:string;outcome:"success"|"denied"|"failure";details:Record<string,string>;}
export function createIntegrationAuditEvent(event:IntegrationAuditEvent):IntegrationAuditEvent{
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(event.id)||!event.userId.trim()||!event.action.trim()||!Number.isFinite(Date.parse(event.timestamp)))throw new Error("Invalid integration audit event.");
 const details=Object.fromEntries(Object.entries(event.details).filter(([key])=>!/(token|secret|password|authorization|verifier|credential|cookie|code)/i.test(key)).slice(0,20).map(([k,v])=>[k.slice(0,80),v.slice(0,300)]));
 return{...event,details};
}


export interface WebhookReplayStore { claim(provider:IntegrationProviderId,eventId:string,expiresAt:string):Promise<boolean>; }
export async function verifyWebhookHmacSha256(input:{secret:string;rawBody:string;signature:string}):Promise<boolean>{
 if(input.secret.length<32||input.rawBody.length>1_000_000)return false;
 const supplied=input.signature.replace(/^sha256=/i,"").toLowerCase();
 if(!/^[a-f0-9]{64}$/.test(supplied))return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(input.secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(input.rawBody)));
 const expected=Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
 let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^supplied.charCodeAt(i);
 return mismatch===0;
}
export async function authorizeWebhookDelivery(input:{
 provider:IntegrationProviderId;eventId:string;rawBody:string;signature:string;secret:string;
 timestamp:string;now:string;replayStore:WebhookReplayStore|null;
}):Promise<{allowed:boolean;reason:"authorized"|"invalid-event"|"stale-timestamp"|"invalid-signature"|"replay-store-unavailable"|"duplicate-event"}>{
 if(!/^[A-Za-z0-9._:-]{1,200}$/.test(input.eventId)||input.rawBody.length>1_000_000)return{allowed:false,reason:"invalid-event"};
 const timestamp=Date.parse(input.timestamp),now=Date.parse(input.now);
 if(!Number.isFinite(timestamp)||!Number.isFinite(now)||Math.abs(now-timestamp)>300_000)return{allowed:false,reason:"stale-timestamp"};
 if(!await verifyWebhookHmacSha256({secret:input.secret,rawBody:input.rawBody,signature:input.signature}))return{allowed:false,reason:"invalid-signature"};
 if(!input.replayStore)return{allowed:false,reason:"replay-store-unavailable"};
 const expiresAt=new Date(Math.max(now,timestamp)+86_400_000).toISOString();
 const claimed=await input.replayStore.claim(input.provider,input.eventId,expiresAt);
 return claimed?{allowed:true,reason:"authorized"}:{allowed:false,reason:"duplicate-event"};
}
export type D1WebhookReplayDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>}}};
export function createD1WebhookReplayStore(database:D1WebhookReplayDatabase):WebhookReplayStore{
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 webhook database is required.");
 return{claim:async(provider,eventId,expiresAt)=>{
  if(!/^[A-Za-z0-9._:-]{1,200}$/.test(eventId)||!Number.isFinite(Date.parse(expiresAt)))throw new Error("Invalid webhook replay claim.");
  const result=await database.prepare("INSERT OR IGNORE INTO webhook_event_claims (provider, event_id, expires_at) VALUES (?, ?, ?)").bind(provider,eventId,expiresAt).run();
  if(result.success===false)throw new Error("D1 webhook replay claim failed.");
  if(result.meta?.changes===1)return true;
  if(result.meta?.changes===0)return false;
  throw new Error("D1 did not return webhook claim change count.");
 }};
}
export function calculateProviderRetryDelay(attempt:number,retryAfterSeconds?:number|null):number{
 if(!Number.isInteger(attempt)||attempt<1||attempt>5)throw new Error("Retry attempt must be between 1 and 5.");
 const fallback=Math.min(30_000,500*2**(attempt-1));
 if(retryAfterSeconds===undefined||retryAfterSeconds===null)return fallback;
 if(!Number.isFinite(retryAfterSeconds)||retryAfterSeconds<0)return fallback;
 return Math.min(30_000,Math.max(fallback,retryAfterSeconds*1000));
}


function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Generate an RFC 7636 S256 verifier/challenge pair. Keep verifier server-side. */
export async function generateOAuthPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: encodeBase64Url(new Uint8Array(digest)) };
}


export async function hashOAuthState(state: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(state)) throw new Error("OAuth state is invalid.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

export interface OAuthTransactionRecord {
  stateHash: string;
  provider: IntegrationProviderId;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  encryptedVerifierBlob: Uint8Array;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
}
export interface OAuthTransactionStore {
  create(record: OAuthTransactionRecord): Promise<void>;
  consume(stateHash: string, now: string): Promise<OAuthTransactionRecord | null>;
}
export type D1OAuthTransactionDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
    };
  };
};

/** Stores only a state hash and an encrypted PKCE verifier; raw state/verifier never enter this adapter. */
export function createD1OAuthTransactionStore(database: D1OAuthTransactionDatabase): OAuthTransactionStore {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 OAuth database is required.");
  return {
    create: async (record) => {
      if (!/^[a-f0-9]{64}$/.test(record.stateHash) ||
          !/^[A-Za-z0-9._:-]{1,120}$/.test(record.userId) ||
          !/^[A-Za-z0-9._:-]{1,120}$/.test(record.workspaceId) ||
          !INTEGRATION_PROVIDERS[record.provider] ||
          !record.redirectUri.startsWith("https://") ||
          !(record.encryptedVerifierBlob instanceof Uint8Array) ||
          record.encryptedVerifierBlob.byteLength < 32 ||
          !Array.isArray(record.scopes) || !record.scopes.length ||
          new Date(record.createdAt).toISOString() !== record.createdAt ||
          new Date(record.expiresAt).toISOString() !== record.expiresAt ||
          Date.parse(record.expiresAt) <= Date.parse(record.createdAt)) {
        throw new Error("Invalid OAuth transaction record.");
      }
      const result = await database.prepare(
        "INSERT OR IGNORE INTO oauth_transactions (state_hash, provider, user_id, workspace_id, redirect_uri, encrypted_verifier_blob, scopes_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(record.stateHash, record.provider, record.userId, record.workspaceId, record.redirectUri,
        record.encryptedVerifierBlob, JSON.stringify([...new Set(record.scopes)]), record.expiresAt, record.createdAt).run();
      if (result.success === false) throw new Error("D1 OAuth transaction write failed.");
      if (result.meta?.changes !== 1) throw new Error("OAuth state hash already exists or D1 did not confirm the insert.");
    },
    consume: async (stateHash, now) => {
      if (!/^[a-f0-9]{64}$/.test(stateHash) || new Date(now).toISOString() !== now) return null;
      const row = await database.prepare(
        "UPDATE oauth_transactions SET consumed_at = ? WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ? RETURNING state_hash, provider, user_id, workspace_id, redirect_uri, encrypted_verifier_blob, scopes_json, expires_at, created_at",
      ).bind(now, stateHash, now).first<{
        state_hash: string; provider: IntegrationProviderId; user_id: string; workspace_id: string | null; redirect_uri: string;
        encrypted_verifier_blob: Uint8Array; scopes_json: string; expires_at: string; created_at: string;
      }>();
      if (!row || !row.workspace_id) return null;
      let scopes: unknown;
      try { scopes = JSON.parse(row.scopes_json); } catch { throw new Error("Stored OAuth scopes are invalid JSON."); }
      if (!Array.isArray(scopes) || !scopes.every(scope => typeof scope === "string")) throw new Error("Stored OAuth scopes are invalid.");
      return {
        stateHash: row.state_hash, provider: row.provider, userId: row.user_id, workspaceId: row.workspace_id,
        redirectUri: row.redirect_uri, encryptedVerifierBlob: row.encrypted_verifier_blob,
        scopes, expiresAt: row.expires_at, createdAt: row.created_at,
      };
    },
  };
}


function validateOAuthEncryptionKey(key:Uint8Array):void{
 if(!(key instanceof Uint8Array)||key.byteLength!==32)throw new Error("OAuth verifier encryption key must be exactly 32 bytes.");
}
function oauthAad(provider:IntegrationProviderId,userId:string,workspaceId:string):Uint8Array{
 if(!/^[A-Za-z0-9._:-]{1,120}$/.test(userId)||!/^[A-Za-z0-9._:-]{1,120}$/.test(workspaceId))throw new Error("OAuth user/workspace identity is invalid.");
 return new TextEncoder().encode("liza-oauth-verifier:v1:"+provider+":"+workspaceId+":"+userId);
}
function asArrayBuffer(bytes:Uint8Array):ArrayBuffer{
 const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);return copy.buffer;
}
/** AES-256-GCM encryption for the PKCE verifier before D1 persistence. */
export async function encryptOAuthVerifier(input:{verifier:string;key:Uint8Array;provider:IntegrationProviderId;userId:string;workspaceId:string}):Promise<Uint8Array>{
 validateOAuthEncryptionKey(input.key);
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(input.verifier))throw new Error("PKCE verifier is invalid.");
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cryptoKey=await crypto.subtle.importKey("raw",asArrayBuffer(input.key),{name:"AES-GCM"},false,["encrypt"]);
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:asArrayBuffer(iv),additionalData:asArrayBuffer(oauthAad(input.provider,input.userId,input.workspaceId)),tagLength:128},cryptoKey,asArrayBuffer(new TextEncoder().encode(input.verifier))));
 const result=new Uint8Array(iv.length+encrypted.length);result.set(iv);result.set(encrypted,iv.length);return result;
}
export async function decryptOAuthVerifier(input:{blob:Uint8Array;key:Uint8Array;provider:IntegrationProviderId;userId:string;workspaceId:string}):Promise<string>{
 validateOAuthEncryptionKey(input.key);
 if(!(input.blob instanceof Uint8Array)||input.blob.byteLength<29)throw new Error("Encrypted OAuth verifier blob is invalid.");
 const iv=asArrayBuffer(input.blob.slice(0,12)),ciphertext=asArrayBuffer(input.blob.slice(12));
 const cryptoKey=await crypto.subtle.importKey("raw",asArrayBuffer(input.key),{name:"AES-GCM"},false,["decrypt"]);
 const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:asArrayBuffer(oauthAad(input.provider,input.userId,input.workspaceId)),tagLength:128},cryptoKey,ciphertext);
 const verifier=new TextDecoder().decode(plaintext);
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))throw new Error("Decrypted PKCE verifier is invalid.");
 return verifier;
}


export interface OAuthConnectionCredentialPayload {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  createdAt: string;
}

/** Encrypt provider credentials with AES-256-GCM and workspace/user/provider-bound AAD. */
export async function encryptConnectionCredentials(input:{
  credentials:OAuthConnectionCredentialPayload;
  key:Uint8Array;
  provider:IntegrationProviderId;
  userId:string;
  workspaceId:string;
}):Promise<Uint8Array>{
 validateOAuthEncryptionKey(input.key);
 if(!/^[A-Za-z0-9._:-]{1,120}$/.test(input.userId)||!/^[A-Za-z0-9._:-]{1,120}$/.test(input.workspaceId)||
    typeof input.credentials.accessToken!=="string"||!input.credentials.accessToken||input.credentials.accessToken.length>10000||
    (input.credentials.refreshToken!==null&&(typeof input.credentials.refreshToken!=="string"||input.credentials.refreshToken.length>10000))||
    typeof input.credentials.tokenType!=="string"||!input.credentials.tokenType||input.credentials.tokenType.length>40||
    !Number.isFinite(Date.parse(input.credentials.createdAt)))throw new Error("OAuth credential payload is invalid.");
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const aad=new TextEncoder().encode("liza-connection:v1:"+input.provider+":"+input.workspaceId+":"+input.userId);
 const cryptoKey=await crypto.subtle.importKey("raw",asArrayBuffer(input.key),{name:"AES-GCM"},false,["encrypt"]);
 const plaintext=new TextEncoder().encode(JSON.stringify(input.credentials));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:asArrayBuffer(iv),additionalData:asArrayBuffer(aad),tagLength:128},cryptoKey,asArrayBuffer(plaintext)));
 const result=new Uint8Array(iv.length+encrypted.length);result.set(iv);result.set(encrypted,iv.length);return result;
}

/** Decrypts a workspace-bound connection credential blob for server-side refresh only. */
export async function decryptConnectionCredentials(input:{
 blob:Uint8Array;key:Uint8Array;provider:IntegrationProviderId;userId:string;workspaceId:string;
}):Promise<OAuthConnectionCredentialPayload>{
 validateOAuthEncryptionKey(input.key);
 if(!(input.blob instanceof Uint8Array)||input.blob.byteLength<29)throw new Error("Encrypted connection credential blob is invalid.");
 const iv=asArrayBuffer(input.blob.slice(0,12)),ciphertext=asArrayBuffer(input.blob.slice(12));
 const aad=new TextEncoder().encode("liza-connection:v1:"+input.provider+":"+input.workspaceId+":"+input.userId);
 const cryptoKey=await crypto.subtle.importKey("raw",asArrayBuffer(input.key),{name:"AES-GCM"},false,["decrypt"]);
 const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:asArrayBuffer(aad),tagLength:128},cryptoKey,ciphertext);
 const value:unknown=JSON.parse(new TextDecoder().decode(plaintext));
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Decrypted connection credentials are invalid.");
 const record=value as Record<string,unknown>;
 if(typeof record["accessToken"]!=="string"||!record["accessToken"]||record["accessToken"].length>10000||
    !(record["refreshToken"]===null||(typeof record["refreshToken"]==="string"&&record["refreshToken"].length<=10000))||
    typeof record["tokenType"]!=="string"||!record["tokenType"]||record["tokenType"].length>40||
    typeof record["createdAt"]!=="string"||!Number.isFinite(Date.parse(record["createdAt"])))throw new Error("Decrypted connection credential fields are invalid.");
 return{accessToken:record["accessToken"],refreshToken:record["refreshToken"] as string|null,tokenType:record["tokenType"],createdAt:record["createdAt"]};
}

export interface D1ConnectionRecord {
 id:string;workspaceId:string;userId:string;provider:IntegrationProviderId;scopes:string[];
 encryptedTokenBlob:Uint8Array;tokenExpiresAt:string|null;createdAt:string;updatedAt:string;
}
export type D1ConnectionDatabase={prepare:(query:string)=>{bind:(...values:unknown[])=>{run:()=>Promise<{success?:boolean;meta?:{changes?:number}}>;first:<T=Record<string,unknown>>()=>Promise<T|null>;all?:<T=Record<string,unknown>>()=>Promise<{success?:boolean;results?:T[]}>}}};
export function createD1ConnectionStore(database:D1ConnectionDatabase){
 if(!database||typeof database.prepare!=="function")throw new Error("A valid D1 connection database is required.");
 return{
  create:async(record:D1ConnectionRecord)=>{
   if(!/^[A-Za-z0-9._:-]{1,120}$/.test(record.id)||!/^[A-Za-z0-9._:-]{1,120}$/.test(record.workspaceId)||
      !/^[A-Za-z0-9._:-]{1,120}$/.test(record.userId)||!INTEGRATION_PROVIDERS[record.provider]||
      !record.scopes.length||record.scopes.some(scope=>!INTEGRATION_PROVIDERS[record.provider].allowedScopes.includes(scope))||
      !(record.encryptedTokenBlob instanceof Uint8Array)||record.encryptedTokenBlob.byteLength<29||
      !Number.isFinite(Date.parse(record.createdAt))||!Number.isFinite(Date.parse(record.updatedAt))||
      (record.tokenExpiresAt!==null&&!Number.isFinite(Date.parse(record.tokenExpiresAt))))throw new Error("Invalid encrypted connection record.");
   const result=await database.prepare("INSERT INTO app_connections (id,workspace_id,user_id,provider,provider_account_id,scopes_json,encrypted_token_blob,token_expires_at,status,created_at,updated_at) VALUES (?,?,?,?,NULL,?,?,?,'connected',?,?)")
    .bind(record.id,record.workspaceId,record.userId,record.provider,JSON.stringify([...new Set(record.scopes)]),record.encryptedTokenBlob,record.tokenExpiresAt,record.createdAt,record.updatedAt).run();
   if(result.success===false||result.meta?.changes!==1)throw new Error("D1 connection persistence failed.");
  },
  listOwned:async(input:{workspaceId:string;userId:string;limit?:number})=>{
   const limit=input.limit??50;
   if(!/^[A-Za-z0-9._:-]{1,120}$/.test(input.workspaceId)||!/^[A-Za-z0-9._:-]{1,120}$/.test(input.userId)||!Number.isInteger(limit)||limit<1||limit>100)throw new Error("Invalid connection list scope.");
   const statement=database.prepare("SELECT id,provider,scopes_json,token_expires_at,created_at,updated_at FROM app_connections WHERE workspace_id=? AND user_id=? AND status='connected' ORDER BY updated_at DESC LIMIT ?").bind(input.workspaceId,input.userId,limit);
   if(typeof statement.all!=="function")throw new Error("D1 connection list operation is unavailable.");
   const result=await statement.all<{id:string;provider:IntegrationProviderId;scopes_json:string;token_expires_at:string|null;created_at:string;updated_at:string}>();
   if(result.success===false)throw new Error("D1 connection list failed.");
   return(result.results??[]).map(row=>{
    let scopes:unknown;try{scopes=JSON.parse(row.scopes_json);}catch{throw new Error("Stored connection scopes are invalid JSON.");}
    if(!Array.isArray(scopes)||!scopes.every(scope=>typeof scope==="string")||!INTEGRATION_PROVIDERS[row.provider]||
       scopes.some(scope=>!INTEGRATION_PROVIDERS[row.provider].allowedScopes.includes(scope)))throw new Error("Stored connection metadata is invalid.");
    return{id:row.id,provider:row.provider,scopes:scopes as string[],tokenExpiresAt:row.token_expires_at,createdAt:row.created_at,updatedAt:row.updated_at};
   });
  },
  getOwned:async(input:{id:string;workspaceId:string;userId:string})=>{
   const row=await database.prepare("SELECT id,provider,scopes_json,encrypted_token_blob,token_expires_at FROM app_connections WHERE id=? AND workspace_id=? AND user_id=? AND status='connected'")
    .bind(input.id,input.workspaceId,input.userId).first<{id:string;provider:IntegrationProviderId;scopes_json:string;encrypted_token_blob:Uint8Array|null;token_expires_at:string|null}>();
   if(!row||!(row.encrypted_token_blob instanceof Uint8Array))return null;
   let scopes:unknown;try{scopes=JSON.parse(row.scopes_json);}catch{throw new Error("Stored connection scopes are invalid JSON.");}
   if(!Array.isArray(scopes)||!scopes.every(scope=>typeof scope==="string")||!INTEGRATION_PROVIDERS[row.provider]||
      scopes.some(scope=>!INTEGRATION_PROVIDERS[row.provider].allowedScopes.includes(scope)))throw new Error("Stored connection metadata is invalid.");
   return{id:row.id,provider:row.provider,scopes:scopes as string[],encryptedTokenBlob:row.encrypted_token_blob,tokenExpiresAt:row.token_expires_at};
  },
  updateCredentials:async(input:{id:string;workspaceId:string;userId:string;scopes:string[];encryptedTokenBlob:Uint8Array;tokenExpiresAt:string|null;now:string})=>{
   if(!(input.encryptedTokenBlob instanceof Uint8Array)||input.encryptedTokenBlob.byteLength<29||
      !input.scopes.length||!Number.isFinite(Date.parse(input.now))||
      (input.tokenExpiresAt!==null&&!Number.isFinite(Date.parse(input.tokenExpiresAt))))throw new Error("Invalid refreshed connection credentials.");
   const result=await database.prepare("UPDATE app_connections SET scopes_json=?,encrypted_token_blob=?,token_expires_at=?,updated_at=? WHERE id=? AND workspace_id=? AND user_id=? AND status='connected'")
    .bind(JSON.stringify([...new Set(input.scopes)]),input.encryptedTokenBlob,input.tokenExpiresAt,input.now,input.id,input.workspaceId,input.userId).run();
   if(result.success===false)throw new Error("D1 connection refresh update failed.");
   return result.meta?.changes===1;
  },
  revokeOwned:async(input:{id:string;workspaceId:string;userId:string;now:string})=>{
   if(!/^[A-Za-z0-9._:-]{1,120}$/.test(input.id)||!/^[A-Za-z0-9._:-]{1,120}$/.test(input.workspaceId)||
      !/^[A-Za-z0-9._:-]{1,120}$/.test(input.userId)||!Number.isFinite(Date.parse(input.now)))throw new Error("Invalid connection revocation request.");
   const result=await database.prepare("UPDATE app_connections SET status='revoked',encrypted_token_blob=NULL,revoked_at=?,updated_at=? WHERE id=? AND workspace_id=? AND user_id=? AND status='connected'")
    .bind(input.now,input.now,input.id,input.workspaceId,input.userId).run();
   if(result.success===false)throw new Error("D1 connection revocation failed.");
   return result.meta?.changes===1;
  },
 };
}
