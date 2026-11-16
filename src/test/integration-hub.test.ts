import {describe,expect,it} from "vitest";
import {authorizeWebhookDelivery,verifyWebhookHmacSha256,calculateProviderRetryDelay,authorizeConnectionAccess,createIntegrationAuditEvent,createOAuthAuthorizationUrl,generateOAuthPkcePair,encryptOAuthVerifier,decryptOAuthVerifier,generateOAuthState,hashOAuthState,createD1OAuthTransactionStore,getIntegrationProvider,validateOAuthCallback} from "@/lib/agents/integration-hub";
describe("integration hub security foundations",()=>{
it("keeps providers disconnected and OAuth scopes least-privilege allowlisted",()=>{expect(getIntegrationProvider("instagram").connectionStatus).toBe("not-connected");expect(getIntegrationProvider("instagram").allowedScopes).toContain("instagram_business_basic");expect(getIntegrationProvider("linkedin").allowedScopes).toHaveLength(0);});
it("builds PKCE-bound authorization URLs only for registered scopes and exact callbacks",()=>{const url=new URL(createOAuthAuthorizationUrl({provider:"instagram",authorizationEndpoint:"https://example.com/oauth",clientId:"client-123",redirectUri:"https://app.example.com/callback",registeredRedirectUri:"https://app.example.com/callback",scopes:["instagram_business_basic"],state:"a".repeat(40),codeChallenge:"b".repeat(43)}));expect(url.searchParams.get("code_challenge_method")).toBe("S256");expect(url.searchParams.get("scope")).toBe("instagram_business_basic");expect(()=>createOAuthAuthorizationUrl({provider:"instagram",authorizationEndpoint:"http://evil.example/oauth",clientId:"id",redirectUri:"https://app.example.com/callback",registeredRedirectUri:"https://app.example.com/callback",scopes:["instagram_business_basic"],state:"a".repeat(40),codeChallenge:"b".repeat(43)})).toThrow("HTTPS");expect(()=>createOAuthAuthorizationUrl({provider:"instagram",authorizationEndpoint:"https://example.com/oauth",clientId:"id",redirectUri:"https://evil.example/callback",registeredRedirectUri:"https://app.example.com/callback",scopes:["instagram_business_basic"],state:"a".repeat(40),codeChallenge:"b".repeat(43)})).toThrow("exactly match");});
it("validates one-time OAuth callback state, provider, redirect and expiry",()=>{const base={provider:"instagram" as const,expectedProvider:"instagram" as const,expectedState:"s".repeat(40),receivedState:"s".repeat(40),registeredRedirectUri:"https://app.example/callback",receivedRedirectUri:"https://app.example/callback",authorizationCode:"code",expiresAt:"2026-11-16T11:00:00Z",now:"2026-11-16T10:00:00Z",alreadyConsumed:false};expect(validateOAuthCallback(base)).toMatchObject({valid:true,reason:"valid"});expect(validateOAuthCallback({...base,receivedState:"wrong"}).reason).toBe("state-mismatch");expect(validateOAuthCallback({...base,alreadyConsumed:true}).reason).toBe("already-consumed");});
it("isolates connections by owner and checks required scopes",()=>{expect(authorizeConnectionAccess({ownerUserId:"u1",actorUserId:"u2",requiredScopes:[],grantedScopes:[]}).allowed).toBe(false);expect(authorizeConnectionAccess({ownerUserId:"u1",actorUserId:"u1",requiredScopes:["read"],grantedScopes:[]}).allowed).toBe(false);});
it("creates bounded integration audit events",()=>{expect(createIntegrationAuditEvent({id:"evt-1",userId:"u1",provider:"github",action:"connect",timestamp:"2026-11-16T10:00:00Z",outcome:"denied",details:{reason:"missing scope"}}).outcome).toBe("denied");expect(()=>createIntegrationAuditEvent({id:"",userId:"",provider:"github",action:"",timestamp:"bad",outcome:"failure",details:{}})).toThrow();});

it("verifies signed webhook bodies and rejects replay or stale delivery",async()=>{const secret="s".repeat(40),body='{"event":"push"}',key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]),digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body))),signature="sha256="+Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");expect(await verifyWebhookHmacSha256({secret,rawBody:body,signature})).toBe(true);let claimed=false;const store={claim:async()=>{if(claimed)return false;claimed=true;return true;}};const input={provider:"github" as const,eventId:"evt-1",rawBody:body,signature,secret,timestamp:"2026-11-16T10:00:00.000Z",now:"2026-11-16T10:00:10.000Z",replayStore:store};expect(await authorizeWebhookDelivery(input)).toMatchObject({allowed:true,reason:"authorized"});expect(await authorizeWebhookDelivery(input)).toMatchObject({allowed:false,reason:"duplicate-event"});expect(await authorizeWebhookDelivery({...input,now:"2026-11-16T10:10:00.000Z"})).toMatchObject({allowed:false,reason:"stale-timestamp"});});
it("bounds provider retry delays",()=>{expect(calculateProviderRetryDelay(1)).toBe(500);expect(calculateProviderRetryDelay(5)).toBe(8000);expect(calculateProviderRetryDelay(2,60)).toBe(30000);expect(()=>calculateProviderRetryDelay(6)).toThrow();});

});


it("generates cryptographically random OAuth state and an S256 PKCE pair",async()=>{
  const state=generateOAuthState();
  const pair=await generateOAuthPkcePair();
  expect(state).toMatch(/^[a-f0-9]{64}$/);
  expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(pair.challenge).not.toBe(pair.verifier);
});


it("hashes OAuth state and stores a one-time encrypted PKCE transaction",async()=>{
  const state=generateOAuthState();
  const stateHash=await hashOAuthState(state);
  expect(stateHash).toMatch(/^[a-f0-9]{64}$/);
  const rows=new Map<string,Record<string,unknown>>();
  const database={
    prepare:(query:string)=>({bind:(...values:unknown[])=>({
      run:async()=>{
        if(query.startsWith("INSERT")){
          const [hash,provider,userId,redirectUri,blob,scopes,expiresAt,createdAt]=values;
          if(rows.has(String(hash)))return{success:true,meta:{changes:0}};
          rows.set(String(hash),{state_hash:hash,provider,user_id:userId,redirect_uri:redirectUri,encrypted_verifier_blob:blob,scopes_json:scopes,expires_at:expiresAt,created_at:createdAt,consumed_at:null});
          return{success:true,meta:{changes:1}};
        }
        return{success:false};
      },
      first:async <T=Record<string,unknown>>() => {
        if(!query.startsWith("UPDATE"))return null;
        const [now,hash,notExpired]=values;
        const row=rows.get(String(hash));
        if(!row||row["consumed_at"]!==null||String(row["expires_at"])<=String(notExpired))return null;
        row["consumed_at"]=now;
        return row as T;
      },
    })}),
  };
  const store=createD1OAuthTransactionStore(database);
  const record={stateHash,provider:"instagram" as const,userId:"user-1",redirectUri:"https://app.example/callback",encryptedVerifierBlob:new Uint8Array(48).fill(7),scopes:["instagram_business_basic"],expiresAt:"2026-11-16T11:00:00.000Z",createdAt:"2026-11-16T10:00:00.000Z"};
  await store.create(record);
  expect(await store.consume(stateHash,"2026-11-16T10:30:00.000Z")).toMatchObject({provider:"instagram",userId:"user-1"});
  expect(await store.consume(stateHash,"2026-11-16T10:31:00.000Z")).toBeNull();
});

it("encrypts OAuth PKCE verifiers with AES-256-GCM and binds them to user/provider",async()=>{const pair=await generateOAuthPkcePair(),key=crypto.getRandomValues(new Uint8Array(32)),blob=await encryptOAuthVerifier({verifier:pair.verifier,key,provider:"instagram",userId:"user-1"});expect(blob.byteLength).toBeGreaterThan(40);expect(await decryptOAuthVerifier({blob,key,provider:"instagram",userId:"user-1"})).toBe(pair.verifier);await expect(decryptOAuthVerifier({blob,key,provider:"facebook",userId:"user-1"})).rejects.toThrow();await expect(decryptOAuthVerifier({blob,key:crypto.getRandomValues(new Uint8Array(32)),provider:"instagram",userId:"user-1"})).rejects.toThrow();});

});
