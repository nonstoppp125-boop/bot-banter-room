import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, FileUp, RefreshCw, TrendingUp } from "lucide-react";
import { calculateEngagementRate, createExecutiveAnalyticsSummary, getAnalyticsFreshness, parseAnalyticsCsv, type AnalyticsSnapshot } from "@/lib/agents/analytics";

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
  const summary=createExecutiveAnalyticsSummary(records);
  const engagement=calculateEngagementRate(records);
  const freshness=getAnalyticsFreshness(records);
  async function importFile(file?:File) {
    if(!file)return;
    setError(null);
    try {
      const parsed=parseAnalyticsCsv(await file.text());
      setRecords(parsed);
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
      {!records.length ? <section className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <TrendingUp className="mx-auto mb-4 size-9 text-muted-foreground"/>
        <h2 className="text-lg font-medium">No analytics data imported</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">No sample or fabricated metrics are displayed. Import a CSV previously exported in Liza's canonical analytics format. Data stays in this browser session and is not uploaded.</p>
        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
          <FileUp className="size-4"/> Choose CSV
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={e=>void importFile(e.target.files?.[0])}/>
        </label>
      </section> : <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Source file: {fileName} · {records.length} metric records</span>
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
        <section className="mt-6 overflow-hidden rounded-xl border border-border">
          <h2 className="border-b border-border p-4 font-medium">Imported metric records</h2>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Platform","Entity","Metric","Value","Period","Source"].map(label=><th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{records.slice(0,200).map(row=><tr key={row.id} className="border-t border-border"><td className="px-3 py-3">{row.platform}</td><td className="px-3 py-3">{row.entityType}: {row.entityId}</td><td className="px-3 py-3">{row.metric}</td><td className="px-3 py-3 tabular-nums">{row.value.toLocaleString()}</td><td className="px-3 py-3 whitespace-nowrap">{row.periodStart} – {row.periodEnd}</td><td className="px-3 py-3">{row.source}</td></tr>)}</tbody>
          </table></div>
          {records.length>200&&<p className="p-3 text-xs text-muted-foreground">Showing first 200 of {records.length} records.</p>}
        </section>
      </>}
      <p className="mt-6 text-xs text-muted-foreground">Import is local-only and session-scoped. CSV provenance is user-supplied and is not independently authenticated. No platform API is connected.</p>
    </div>
  </main>;
}
