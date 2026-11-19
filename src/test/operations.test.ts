import {describe,expect,it} from "vitest";
import {createPublicHealthResponse,createReadinessSummary,createStructuredLogEvent} from "@/lib/agents/operations";
describe("production operations helpers",()=>{
it("returns a non-cacheable minimal public health response",async()=>{const response=createPublicHealthResponse("2026-11-16T10:00:00Z");expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.json()).toMatchObject({status:"ok",service:"liza"});});
it("summarizes readiness without claiming runtime health",()=>{expect(createReadinessSummary({providerConfigured:true,rateLimiterConfigured:false,durableStorageConfigured:false,identityConfigured:false})).toMatchObject({status:"degraded",missing:["rateLimiterConfigured","durableStorageConfigured","identityConfigured"]});});
it("redacts secrets and bounds structured log fields",()=>{const event=createStructuredLogEvent({timestamp:"2026-11-16T10:00:00Z",level:"error",event:"provider.failure",requestId:"request-123456",fields:{apiKey:"secret",message:'Bearer abcdefghijklmnop',count:3,nested:{secret:"x"}}});expect(event.fields["apiKey"]).toBe("[REDACTED]");expect(event.fields["message"]).not.toContain("abcdefghijklmnop");expect(event.fields["nested"]).toBe("[OMITTED]");});
});
