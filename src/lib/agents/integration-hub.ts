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
 endpoint.searchParams.set("client_id",input.clientId);
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
 const details=Object.fromEntries(Object.entries(event.details).slice(0,20).map(([k,v])=>[k.slice(0,80),v.slice(0,300)]));
 return{...event,details};
}
