import { describe, expect, it } from "vitest";
import { handleAnalyticsRequest } from "@/lib/agents/analytics-api";

const token = "A".repeat(43);
const cookie = "__Host-liza_session=" + token;
const url = "https://liza.example/api/analytics";
function makeDatabase(role: "owner" | "admin" | "member" = "owner") {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const payloads: string[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return { bind(...values: unknown[]) {
        bindings.push(values);
        return {
          first: async <T = Record<string, unknown>>() => {
            if (query.includes("FROM sessions")) return { id:"session-1",user_id:"user-1",workspace_id:"workspace-1",expires_at:"2026-11-17T00:00:00.000Z",created_at:"2026-11-16T00:00:00.000Z" } as T;
            if (query.includes("FROM workspace_members")) return { workspace_id:"workspace-1",user_id:"user-1",role } as T;
            if (query.includes("SELECT payload_json")) return null;
            return null;
          },
          run: async () => { if(query.startsWith("INSERT INTO") || query.startsWith("INSERT OR IGNORE")) payloads.push(String(values[11])); return {success:true,meta:{changes:1}}; },
          all: async <T = Record<string, unknown>>() => ({success:true,results:payloads.map(payload_json=>({payload_json})) as unknown as T[]}),
        };
      }};
    },
  };
  return {database,queries,bindings,payloads};
}
const record = {id:"snap-1",platform:"linkedin",accountId:"account-1",entityId:"post-1",entityType:"post",metricName:"impressions",value:100,periodStart:"2026-11-01",periodEnd:"2026-11-07",capturedAt:"2026-11-08T10:00:00.000Z",source:"claimed-official-api"};
function post(body:unknown, origin="https://liza.example") {
  return new Request(url,{method:"POST",headers:{origin,"content-type":"application/json",cookie},body:JSON.stringify(body)});
}
describe("workspace analytics API",()=>{
  it("rejects cross-origin writes before touching D1",async()=>{
    const {database,queries}=makeDatabase();
    expect((await handleAnalyticsRequest(post({records:[record]},"https://evil.example"),{ACTION_DB:database})).status).toBe(403);
    expect(queries).toEqual([]);
  });
  it("requires a session and configured D1 binding",async()=>{
    expect((await handleAnalyticsRequest(new Request(url),{})).status).toBe(503);
    const {database}=makeDatabase();
    expect((await handleAnalyticsRequest(new Request(url,{headers:{cookie}}),{ACTION_DB:database})).status).toBe(200);
  });
  it("persists normalized imports with unverified provenance and workspace scope",async()=>{
    const {database,queries,payloads,bindings}=makeDatabase();
    const response=await handleAnalyticsRequest(post({records:[record]}),{ACTION_DB:database});
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({imported:1,provenance:"user-import-unverified"});
    expect(JSON.parse(payloads[0]!).source).toBe("user-import");
    expect(queries.some(query=>query.includes("workspace_id"))).toBe(true);
    expect(bindings.some(values=>values.includes("workspace-1"))).toBe(true);
  });
  it("requires an administrator role to import and bounds batches",async()=>{
    const {database}=makeDatabase("member");
    expect((await handleAnalyticsRequest(post({records:[record]}),{ACTION_DB:database})).status).toBe(403);
    const owner=makeDatabase();
    expect((await handleAnalyticsRequest(post({records:Array(101).fill(record)}),{ACTION_DB:owner.database})).status).toBe(400);
  });
  it("rejects unsupported analytics filters",async()=>{
    const {database}=makeDatabase();
    const response=await handleAnalyticsRequest(new Request(url+"?platform=unknown",{headers:{cookie}}),{ACTION_DB:database});
    expect(response.status).toBe(400);
  });
});
