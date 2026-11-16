import {describe,expect,it} from "vitest";
import {calculateEngagementRate,compareMetricPeriods,createExecutiveAnalyticsSummary,detectMetricAnomalies,exportAnalyticsCsv,getAnalyticsFreshness,InMemoryAnalyticsStore,normalizeAnalyticsRecord} from "@/lib/agents/analytics";
import type {AnalyticsIngestionInput} from "@/lib/agents/analytics";
const row=(overrides:Partial<AnalyticsIngestionInput>={})=>normalizeAnalyticsRecord({id:"snapshot-1",platform:"linkedin",accountId:"account-1",entityId:"post-1",entityType:"post",metricName:"impressions",value:1000,periodStart:"2026-11-01",periodEnd:"2026-11-07",capturedAt:"2026-11-08T10:00:00.000Z",source:"official-api",...overrides});
describe("unified analytics",()=>{
it("normalizes aliases and preserves provenance",()=>{const v=row({metricName:"comment_count",value:12,limitations:["reporting delay"]});expect(v.metric).toBe("comments");expect(v.source).toBe("official-api");expect(v.limitations).toEqual(["reporting delay"]);});
it("rejects unknown metrics, invalid periods and invalid values",()=>{expect(()=>row({metricName:"viral_score"})).toThrow("Unsupported analytics metric");expect(()=>row({periodStart:"2026-11-09",periodEnd:"2026-11-01"})).toThrow("Analytics period is invalid");expect(()=>row({value:NaN})).toThrow("finite non-negative");});
it("stores snapshots idempotently and filters",()=>{const s=new InMemoryAnalyticsStore();s.append(row());s.append(row());s.append(row({id:"s2",platform:"youtube"}));expect(s.list()).toHaveLength(2);expect(s.list({platform:"youtube"})).toHaveLength(1);expect(()=>s.append(row({value:5}))).toThrow("already exists");});
it("calculates engagement with explicit denominator",()=>{const rows=[row({metricName:"reactions",value:10}),row({id:"s2",metricName:"comments",value:5}),row({id:"s3",metricName:"shares",value:5}),row({id:"s4",metricName:"impressions",value:1000})];expect(calculateEngagementRate(rows)).toMatchObject({rate:2,engagements:20,denominator:1000});expect(calculateEngagementRate([row({value:0})]).rate).toBeNull();});
it("compares periods and handles zero baselines",()=>{expect(compareMetricPeriods([row({value:150})],[row({id:"old",value:100})],"impressions")).toMatchObject({absoluteChange:50,percentageChange:50});expect(compareMetricPeriods([row({value:5})],[row({id:"zero",value:0})],"impressions").percentageChange).toBeNull();});
it("requires enough observations for anomaly detection",()=>{expect(detectMetricAnomalies([10,11],30).anomalous).toBe(false);expect(detectMetricAnomalies([10,10,11,9],20)).toMatchObject({anomalous:true,direction:"up",baseline:10});});
it("reports freshness and missing data",()=>{expect(getAnalyticsFreshness([],"2026-11-09T10:00:00.000Z").status).toBe("missing");expect(getAnalyticsFreshness([row()],"2026-11-08T11:00:00.000Z").status).toBe("fresh");expect(getAnalyticsFreshness([row()],"2026-11-10T10:00:00.000Z").status).toBe("stale");});
it("exports CSV safely against spreadsheet formulas",()=>{expect(exportAnalyticsCsv([row({source:'=IMPORTDATA("x")'})])).toContain("'=IMPORTDATA(""x"")");});
it("does not invent absent metrics",()=>{const s=createExecutiveAnalyticsSummary([row()]);expect(s.snapshotCount).toBe(1);expect(s.totals.impressions).toBe(1000);expect(s.totals.comments).toBeNull();expect(s.note).toContain("not inferred");});
});


describe("analytics dashboard and dimension reports",()=>{
  it("builds platform performance cards with freshness and limitations",()=>{
    const input=[row(),row({id:"eng-1",metricName:"likes",value:30,limitations:["sample export"]})];
    const dashboard=createPerformanceDashboard(input,"2026-11-09T10:00:00.000Z");
    expect(dashboard.platformCards[0]?.totals.impressions).toBe(1000);
    expect(dashboard.platformCards[0]?.engagement.rate).toBe(3);
    expect(dashboard.freshness.status).toBe("fresh");
  });
  it("groups campaign and content reports by platform-scoped entities",()=>{
    const campaign=normalizeAnalyticsRecord({id:"c1",platform:"linkedin",accountId:"a",entityId:"campaign-1",entityType:"campaign",metricName:"impressions",value:500,periodStart:"2026-11-01",periodEnd:"2026-11-07",capturedAt:"2026-11-08T10:00:00.000Z",source:"manual"});
    const post=normalizeAnalyticsRecord({id:"p1",platform:"linkedin",accountId:"a",entityId:"post-1",entityType:"post",metricName:"impressions",value:200,periodStart:"2026-11-01",periodEnd:"2026-11-07",capturedAt:"2026-11-08T10:00:00.000Z",source:"manual"});
    expect(createCampaignAnalyticsReport([campaign])[0]?.campaignId).toBe("campaign-1");
    expect(createContentAnalyticsReport([post])[0]?.contentId).toBe("post-1");
  });
  it("builds audience and trend reports from supplied dimensions and periods",()=>{
    const a=row({dimensions:{audienceSegment:"founders"},value:100});
    const b=row({id:"s2",metricName:"impressions",value:150,periodStart:"2026-11-08",periodEnd:"2026-11-14",dimensions:{audienceSegment:"founders"}});
    expect(createAudienceAnalyticsReport([a,b])[0]?.segment).toBe("founders");
    const trend=createAnalyticsTrendReport([a,b],"impressions");
    expect(trend.points).toHaveLength(2);
    expect(trend.changes[0]?.absoluteChange).toBe(50);
  });
});
