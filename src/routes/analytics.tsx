import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Download, FileUp, RefreshCw, TrendingUp } from "lucide-react";
import { buildAnalyticsTrendReport, calculateEngagementRate, createExecutiveAnalyticsSummary, exportAnalyticsCsv, generateAnalyticsRecommendations, getAnalyticsFreshness, parseAnalyticsCsv, type AnalyticsSnapshot } from "@/lib/agents/analytics";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

function MetricCard({label,value,detail}:{label:string;value:string;detail:string}) {
  return <section className="rounded-xl border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
  </section>;
}

function AnalyticsPage() {
  const [records,setRecords]=useState<AnalyticsSnapshot[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [fileName,setFileName]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    void fetch("/api/analytics",{credentials:"same-origin"}).then(async response=>{
      if(!response.ok) throw new Error(response.status===401?"Sign in to load saved workspace analytics.":"Could not load saved analytics.");
      const payload=await response.json() as {records?:AnalyticsSnapshot[]};
      if(active) setRecords(Array.isArray(payload.records)?payload.records:[]);
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:"Could not load saved analytics.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);
  const summary=createExecutiveAnalyticsSummary(records);
  const engagement=calculateEngagementRate(records);
  const freshness=getAnalyticsFreshness(records);
  const recommendations=generateAnalyticsRecommendations(records);
  const trends=buildAnalyticsTrendReport(records, "impressions");
  async function importFile(file?:File) {
    if(!file)return;
    setError(null);
    try {
      if(file.size>2_000_000) throw new Error("CSV exceeds the 2 MB limit.");
      const parsed=parseAnalyticsCsv(await file.text());
      if(parsed.length>100) throw new Error("Import is limited to 100 records per upload.");
      const response=await fetch("/api/analytics",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({records:parsed})});
      const payload=await response.json() as {error?:string};
      if(!response.ok) throw new Error(payload.error??"Could not save analytics to this workspace.");
      const saved=await fetch("/api/analytics",{credentials:"same-origin"});
      if(!saved.ok) throw new Error("Import saved, but analytics refresh failed.");
      const savedPayload=await saved.json() as {records?:AnalyticsSnapshot[]};
      setRecords(Array.isArray(savedPayload.records)?savedPayload.records:[]);
      setFileName(file.name);
    } catch(e) {
      setError(e instanceof Error?e.message:"Could not import analytics CSV.");
    }
  }
  return <main className="min-h-dvh bg-background px-4 py-5 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <a href="/" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> Back to chat</a>
          <h1 className="text-2xl font-semibold">Analytics & Business Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Import a Liza analytics CSV export to inspect normalized performance metrics.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <FileUp className="size-4"/> Import CSV
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={e=>void importFile(e.target.files?.[0])}/>
        </label>
      </header>
      {error&&<p role="alert" className="mb-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <section className="rounded-2xl border border-dashed border-border px-6 py-16 text-center"><p className="text-sm text-muted-foreground">Loading saved workspace analytics…</p></section> : !records.length ? <section className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <TrendingUp className="mx-auto mb-4 size-9 text-muted-foreground"/>
        <h2 className="text-lg font-medium">No analytics data imported</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">No sample or fabricated metrics are displayed. Import a CSV previously exported in Liza's canonical analytics format. Records are saved to your authenticated workspace; imported provenance is marked unverified.</p>
        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
          <FileUp className="size-4"/> Choose CSV
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={e=>void importFile(e.target.files?.[0])}/>
        </label>
      </section> : <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Source file: {fileName} · {records.length} metric records</span>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent" onClick={()=>{const blob=new Blob([exportAnalyticsCsv(records)],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="liza-analytics.csv";link.click();URL.revokeObjectURL(url);}}><Download className="size-3.5"/> Export CSV</button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent" onClick={()=>{setRecords([]);setFileName("");setError(null);}}><RefreshCw className="size-3.5"/> Clear session</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Impressions" value={summary.totals['impressions']?.toLocaleString()??"—"} detail="Imported snapshots"/>
          <MetricCard label="Reach" value={summary.totals['reach']?.toLocaleString()??"—"} detail="Imported snapshots"/>
          <MetricCard label="Engagement rate" value={engagement.rate===null?"—":engagement.rate.toFixed(2)+"%"} detail={engagement.denominatorMetric+" denominator; not cross-platform adjusted"}/>
          <MetricCard label="Data freshness" value={freshness.status} detail={freshness.latestCapturedAt??"No capture timestamp"}/>
        </div>
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Platform coverage</h2>
          <div className="mt-3 flex flex-wrap gap-2">{summary.platforms.map(platform=><span key={platform} className="rounded-full bg-muted px-3 py-1 text-xs">{platform}</span>)}</div>
          <p className="mt-3 text-xs text-muted-foreground">{summary.note}</p>
          {summary.limitations.length>0&&<ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">{summary.limitations.map((item,i)=><li key={i}>{item}</li>)}</ul>}
        </section>
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Evidence-based recommendations</h2>
          {recommendations.length ? <ul className="mt-3 space-y-3">{recommendations.map(item=><li key={item.id} className="border-t border-border pt-3"><p className="text-sm font-medium">{item.title} <span className="ml-2 text-xs text-muted-foreground">{item.priority}</span></p><p className="mt-1 text-sm text-muted-foreground">{item.rationale}</p>{item.evidence.length>0&&<p className="mt-1 text-xs text-muted-foreground">Evidence: {item.evidence.join(" · ")}</p>}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No additional recommendations from the supplied metrics.</p>}
          <h3 className="mt-5 font-medium">Impression trend</h3>
          {trends.length ? <div className="mt-2 space-y-2">{trends.slice(-12).map((item,i)=><div key={item.platform+item.periodStart+i} className="flex justify-between gap-3 text-sm"><span>{item.platform} · {item.periodStart}–{item.periodEnd}</span><span className="tabular-nums">{item.value.toLocaleString()}</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">No impression trend data supplied.</p>}
        </section>
        <section className="mt-6 overflow-hidden rounded-xl border border-border">
          <h2 className="border-b border-border p-4 font-medium">Imported metric records</h2>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Platform","Entity","Metric","Value","Period","Source"].map(label=><th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{records.slice(0,200).map(row=><tr key={row.id} className="border-t border-border"><td className="px-3 py-3">{row.platform}</td><td className="px-3 py-3">{row.entityType}: {row.entityId}</td><td className="px-3 py-3">{row.metric}</td><td className="px-3 py-3 tabular-nums">{row.value.toLocaleString()}</td><td className="px-3 py-3 whitespace-nowrap">{row.periodStart} – {row.periodEnd}</td><td className="px-3 py-3">{row.source}</td></tr>)}</tbody>
          </table></div>
          {records.length>200&&<p className="p-3 text-xs text-muted-foreground">Showing first 200 of {records.length} records.</p>}
        </section>
      </>}
      <p className="mt-6 text-xs text-muted-foreground">Workspace-scoped persistence is enabled. CSV provenance is user-supplied and is not independently authenticated. No platform API is connected.</p>
    </div>
  </main>;
}
