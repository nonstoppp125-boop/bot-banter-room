import {describe,expect,it} from "vitest";
import {
  clearSessionCookie,
  createD1SessionStore,
  createSessionCookie,
  generateSessionToken,
  hashSessionToken,
  readSessionCookie,
} from "@/lib/agents/session-auth";

describe("session authentication foundations",()=>{
  it("generates high-entropy opaque tokens and stores only their SHA-256 hashes",async()=>{
    const token=generateSessionToken();
    const hash=await hashSessionToken(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });
  it("uses secure HttpOnly host cookies and validates cookie input",()=>{
    const token=generateSessionToken();
    const cookie=createSessionCookie(token,3600);
    expect(cookie).toContain("__Host-liza_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(readSessionCookie("other=x; "+cookie)).toBe(token);
    expect(readSessionCookie("__Host-liza_session=bad")).toBeNull();
    expect(clearSessionCookie()).toContain("Max-Age=0");
    expect(()=>createSessionCookie(token,3_000_000)).toThrow();
  });
  it("creates, validates and revokes D1 sessions by token hash",async()=>{
    const rows=new Map<string,Record<string,unknown>>();
    const database={
      prepare:(query:string)=>({bind:(...values:unknown[])=>({
        run:async()=>{
          if(query.startsWith("INSERT")){
            const [id,userId,workspaceId,tokenHash,expiresAt,createdAt]=values;
            rows.set(String(tokenHash),{id,user_id:userId,workspace_id:workspaceId,token_hash:tokenHash,expires_at:expiresAt,created_at:createdAt,revoked_at:null});
            return{success:true,meta:{changes:1}};
          }
          if(query.startsWith("UPDATE")){
            const [revokedAt,tokenHash]=values;
            const row=rows.get(String(tokenHash));
            if(!row||row.revoked_at!==null)return{success:true,meta:{changes:0}};
            row.revoked_at=revokedAt;
            return{success:true,meta:{changes:1}};
          }
          return{success:false};
        },
        first:async <T=Record<string,unknown>>() => {
          const [tokenHash,now]=values;
          const row=rows.get(String(tokenHash));
          if(!query.startsWith("SELECT")||!row||row.revoked_at!==null||String(row.expires_at)<=String(now))return null;
          return row as T;
        },
      })}),
    };
    const store=createD1SessionStore(database);
    const token=generateSessionToken();
    const tokenHash=await hashSessionToken(token);
    await store.create({id:"session-1",userId:"user-1",workspaceId:"workspace-1",tokenHash,createdAt:"2026-11-16T10:00:00.000Z",expiresAt:"2026-11-17T10:00:00.000Z"});
    expect(await store.getActive(token,"2026-11-16T11:00:00.000Z")).toMatchObject({userId:"user-1"});
    expect(await store.revoke(token,"2026-11-16T12:00:00.000Z")).toBe(true);
    expect(await store.getActive(token,"2026-11-16T13:00:00.000Z")).toBeNull();
    expect(await store.revoke(token,"2026-11-16T14:00:00.000Z")).toBe(false);
  });
});
