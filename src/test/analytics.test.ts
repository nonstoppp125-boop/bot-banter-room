import { describe, expect, it } from "vitest";
import {
  createD1AnalyticsStore,
  buildAnalyticsDimensionReport,
  buildAnalyticsTrendReport,
  generateAnalyticsRecommendations,
  calculateEngagementRate,
  compareMetricPeriods,
  createExecutiveAnalyticsSummary,
  detectMetricAnomalies,
  exportAnalyticsCsv,
  getAnalyticsFreshness,
  InMemoryAnalyticsStore,
  normalizeAnalyticsRecord,
  parseAnalyticsCsv,
} from "@/lib/agents/analytics";
import type { AnalyticsIngestionInput } from "@/lib/agents/analytics";
const row = (overrides: Partial<AnalyticsIngestionInput> = {}) => normalizeAnalyticsRecord({
  id:"snapshot-1",platform:"linkedin",accountId:"account-1",entityId:"post-1",entityType:"post",
  metricName:"impressions",value:1000,periodStart:"2026-11-01",periodEnd:"2026-11-07",
  capturedAt:"2026-11-08T10:00:00.000Z",source:"official-api",...overrides,
});
describe("unified analytics",()=>{
  it("normalizes aliases and preserves provenance",()=>{const v=row({metricName:"comment_count",value:12,limitations:["reporting delay"]});expect(v.metric).toBe("comments");expect(v.source).toBe("official-api");expect(v.limitations).toEqual(["reporting delay"]);});
  it("rejects unknown metrics, invalid periods and invalid values",()=>{expect(()=>row({metricName:"viral_score"})).toThrow("Unsupported analytics metric");expect(()=>row({periodStart:"2026-11-09",periodEnd:"2026-11-01"})).toThrow("Analytics period is invalid");expect(()=>row({value:NaN})).toThrow("finite non-negative");});
  it("stores snapshots idempotently and filters",()=>{const s=new InMemoryAnalyticsStore();s.append(row());s.append(row());s.append(row({id:"s2",platform:"youtube"}));expect(s.list()).toHaveLength(2);expect(s.list({platform:"youtube"})).toHaveLength(1);expect(()=>s.append(row({value:5}))).toThrow("already exists");});
  it("calculates engagement with explicit denominator",()=>{const rows=[row({metricName:"reactions",value:10}),row({id:"s2",metricName:"comments",value:5}),row({id:"s3",metricName:"shares",value:5}),row({id:"s4",metricName:"impressions",value:1000})];expect(calculateEngagementRate(rows)).toMatchObject({rate:2,engagements:20,denominator:1000});expect(calculateEngagementRate([row({value:0})]).rate).toBeNull();});
  it("compares periods and handles zero baselines",()=>{expect(compareMetricPeriods([row({value:150})],[row({id:"old",value:100})],"impressions")).toMatchObject({absoluteChange:50,percentageChange:50});expect(compareMetricPeriods([row({value:5})],[row({id:"zero",value:0})],"impressions").percentageChange).toBeNull();});
  it("requires enough observations for anomaly detection",()=>{expect(detectMetricAnomalies([10,11],30).anomalous).toBe(false);expect(detectMetricAnomalies([10,10,11,9],20)).toMatchObject({anomalous:true,direction:"up",baseline:10});});
  it("reports freshness and missing data",()=>{expect(getAnalyticsFreshness([],"2026-11-09T10:00:00.000Z").status).toBe("missing");expect(getAnalyticsFreshness([row()],"2026-11-08T11:00:00.000Z").status).toBe("fresh");expect(getAnalyticsFreshness([row()],"2026-11-10T10:00:00.000Z").status).toBe("stale");});
  it("neutralizes spreadsheet formulas in CSV exports",()=>{const csv=exportAnalyticsCsv([row({source:'=IMPORTDATA("x")'})]);expect(csv).toContain(String.fromCharCode(39)+'=IMPORTDATA(""x"")');});
  it("round-trips canonical CSV exports",()=>{const parsed=parseAnalyticsCsv(exportAnalyticsCsv([row({source:"provider, export"})]));expect(parsed).toHaveLength(1);expect(parsed[0]).toMatchObject({platform:"linkedin",metric:"impressions",value:1000});});
  it("rejects malformed, oversized and non-canonical CSV",()=>{expect(()=>parseAnalyticsCsv("wrong,header\\na,b")).toThrow("header");expect(()=>parseAnalyticsCsv('"unterminated')).toThrow("unterminated");expect(()=>parseAnalyticsCsv("x".repeat(2_000_001))).toThrow("2 MB");});
  it("does not invent absent metrics",()=>{const s=createExecutiveAnalyticsSummary([row()]);expect(s.snapshotCount).toBe(1);expect(s.totals["impressions"]).toBe(1000);expect(s.totals["comments"]).toBeNull();expect(s.note).toContain("not inferred");});
  it("builds dimension and trend reports from supplied metadata",()=>{const rows=[row({dimensions:{campaign:"Launch"},value:100}),row({id:"s2",dimensions:{campaign:"Launch"},value:50}),row({id:"s3",periodStart:"2026-11-08",periodEnd:"2026-11-14",value:25})];expect(buildAnalyticsDimensionReport(rows,"campaign","impressions")[0]).toMatchObject({dimension:"Launch",value:150,recordCount:2});expect(buildAnalyticsTrendReport(rows,"impressions")).toHaveLength(2);});
  it("recommends only evidence-supported actions",()=>{const recs=generateAnalyticsRecommendations([row()],"2026-11-10T10:00:00.000Z");expect(recs.some(x=>x.id==="refresh-data")).toBe(true);expect(recs.some(x=>x.id==="complete-exposure-metrics")).toBe(false);});

  it("uses the D1 adapter contract for durable snapshot writes and reads", async () => {
    const payloads: string[] = [];
    const database = {
      prepare: (query: string) => ({
        bind: (...values: unknown[]) => ({
          run: async () => { if (query.startsWith("INSERT")) payloads.push(String(values[11])); return { success: true, meta: { changes: 1 } }; },
          first: async () => null,
          all: async () => ({ success: true, results: payloads.map(payload_json => ({ payload_json })) }),
        }),
      }),
    };
    const store = createD1AnalyticsStore(database);
    await store.append(row());
    const restored = await store.list({ platform: "linkedin" });
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ metric: "impressions", value: 1000 });
  });

});
