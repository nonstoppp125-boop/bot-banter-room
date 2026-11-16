import {describe,expect,it} from "vitest";
import {evaluateQualityGates,validateMigrationSequence,validateReleaseMetadata} from "@/lib/agents/quality-gates";
describe("release quality gates",()=>{
it("never permits deployment from evidence evaluation alone",()=>{const checks=[{id:"typecheck" as const,status:"passed" as const,summary:"tsc",checkedAt:"2026-11-16T10:00:00Z"}];expect(evaluateQualityGates(checks,["typecheck"])).toMatchObject({status:"passed",deploymentAllowed:false});});
it("blocks release readiness when required evidence is missing",()=>{expect(evaluateQualityGates([]).status).toBe("blocked");expect(evaluateQualityGates([{id:"typecheck",status:"failed",summary:"compile failed",checkedAt:"2026-11-16T10:00:00Z"}]).status).toBe("failed");});
it("detects duplicate and missing D1 migration versions",()=>{expect(validateMigrationSequence(["migrations/0001_a.sql","migrations/0002_b.sql","migrations/0003_c.sql"]).valid).toBe(true);expect(validateMigrationSequence(["migrations/0001_a.sql","migrations/0001_b.sql"]).duplicates).toEqual([1]);expect(validateMigrationSequence(["migrations/0001_a.sql","migrations/0003_c.sql"]).gaps).toEqual([2]);});
it("validates release candidate metadata",()=>{expect(validateReleaseMetadata({version:"1.2.3-rc.1",commitSha:"abcdef1234567",branch:"release/candidate",changeSummary:"RC"}).valid).toBe(true);expect(validateReleaseMetadata({version:"latest",commitSha:"x",branch:"main",changeSummary:""}).valid).toBe(false);});
});
