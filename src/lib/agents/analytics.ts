export type AnalyticsPlatform = "linkedin" | "instagram" | "facebook" | "youtube" | "x" | "tiktok";
export type AnalyticsMetricName = "impressions" | "reach" | "views" | "reactions" | "likes" | "comments" | "shares" | "clicks" | "followersGained" | "followersLost" | "saves";
export interface AnalyticsSnapshot { id:string; platform:AnalyticsPlatform; accountId:string; entityId:string; entityType:"account"|"post"|"campaign"; metric:AnalyticsMetricName; value:number; unit:"count"; periodStart:string; periodEnd:string; capturedAt:string; source:string; limitations:string[]; dimensions:Record<string,string>; }
export interface AnalyticsIngestionInput { id:string; platform:AnalyticsPlatform; accountId:string; entityId:string; entityType:AnalyticsSnapshot["entityType"]; metricName:string; value:number; periodStart:string; periodEnd:string; capturedAt:string; source:string; limitations?:string[]; dimensions?:Record<string,string>; }
const ALIASES:Readonly<Record<string,AnalyticsMetricName>>={impressions:"impressions",impression_count:"impressions",reach:"reach",unique_reach:"reach",views:"views",video_views:"views",view_count:"views",reactions:"reactions",reaction_count:"reactions",likes:"likes",like_count:"likes",comments:"comments",comment_count:"comments",shares:"shares",share_count:"shares",clicks:"clicks",click_count:"clicks",followers_gained:"followersGained",followersgained:"followersGained",followers_lost:"followersLost",followerslost:"followersLost",saves:"saves",saved:"saves"};
const PLATFORMS=new Set<AnalyticsPlatform>(["linkedin","instagram","facebook","youtube","x","tiktok"]), ENTITIES=new Set(["account","post","campaign"]);
const clean=(v:unknown,max=300):string=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max):"";
const validTimestamp=(v:string)=>Number.isFinite(Date.parse(v))&&/^\d{4}-\d{2}-\d{2}T/.test(v);
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+"T00:00:00.000Z").toISOString().slice(0,10)===v;
export function normalizeAnalyticsRecord(input:AnalyticsIngestionInput):AnalyticsSnapshot{
 const key=clean(input.metricName,80),metric=ALIASES[key]??ALIASES[key.toLowerCase()];
 if(!PLATFORMS.has(input.platform))throw new Error("Unsupported analytics platform.");
 if(!ENTITIES.has(input.entityType))throw new Error("Unsupported analytics entity type.");
 if(!clean(input.id,120)||!clean(input.accountId,160)||!clean(input.entityId,200))throw new Error("Analytics IDs are required.");
 if(!metric)throw new Error("Unsupported analytics metric.");
 if(!Number.isFinite(input.value)||input.value<0||input.value>Number.MAX_SAFE_INTEGER)throw new Error("Analytics value must be a finite non-negative number.");
 if(!validDate(input.periodStart)||!validDate(input.periodEnd)||input.periodStart>input.periodEnd)throw new Error("Analytics period is invalid.");
 if(!validTimestamp(input.capturedAt)||!clean(input.source,300))throw new Error("Capture timestamp and source are required.");
 const dimensions=Object.fromEntries(Object.entries(input.dimensions??{}).slice(0,20).map(([k,v])=>[clean(k,60),clean(v,160)]).filter(([k,v])=>Boolean(k&&v)));
 return {id:clean(input.id,120),platform:input.platform,accountId:clean(input.accountId,160),entityId:clean(input.entityId,200),entityType:input.entityType,metric,value:input.value,unit:"count",periodStart:input.periodStart,periodEnd:input.periodEnd,capturedAt:input.capturedAt,source:clean(input.source,300),limitations:[...new Set((input.limitations??[]).map(v=>clean(v,300)).filter(Boolean))].slice(0,20),dimensions};
}
export interface AnalyticsSnapshotStore{append(snapshot:AnalyticsSnapshot):void;list(filters?:Partial<Pick<AnalyticsSnapshot,"platform"|"accountId"|"entityId"|"metric">>):AnalyticsSnapshot[];}
/** Volatile reference store; durable history requires a provisioned database. */
export class InMemoryAnalyticsStore implements AnalyticsSnapshotStore{
 private readonly records=new Map<string,AnalyticsSnapshot>();
 append(snapshot:AnalyticsSnapshot){const old=this.records.get(snapshot.id);if(old&&JSON.stringify(old)!==JSON.stringify(snapshot))throw new Error("Analytics snapshot ID already exists with different data.");this.records.set(snapshot.id,structuredClone(snapshot));}
 list(filters:Partial<Pick<AnalyticsSnapshot,"platform"|"accountId"|"entityId"|"metric">>={}){return structuredClone([...this.records.values()].filter(row=>Object.entries(filters).every(([k,v])=>v===undefined||row[k as keyof AnalyticsSnapshot]===v)));}
}
export interface KpiDefinition{id:string;label:string;description:string;formula:string;requiredMetrics:AnalyticsMetricName[];}
export const ANALYTICS_KPI_DEFINITIONS:readonly KpiDefinition[]=[
{id:"engagement-rate",label:"Engagement rate",description:"Tracked interactions divided by selected exposure denominator.",formula:"(reactions + likes + comments + shares + clicks + saves) / impressions or reach × 100",requiredMetrics:["impressions","reactions","likes","comments","shares","clicks","saves"]},
{id:"view-rate",label:"View rate",description:"Views divided by impressions when definitions are compatible.",formula:"views / impressions × 100",requiredMetrics:["views","impressions"]},
{id:"net-follower-change",label:"Net follower change",description:"Followers gained minus followers lost.",formula:"followers gained - followers lost",requiredMetrics:["followersGained","followersLost"]}];
export function sumMetrics(rows:readonly AnalyticsSnapshot[],metrics:readonly AnalyticsMetricName[]):number|null{const selected=rows.filter(r=>metrics.includes(r.metric));return selected.length?selected.reduce((s,r)=>s+r.value,0):null;}
export function calculateEngagementRate(rows:readonly AnalyticsSnapshot[],denominator:"impressions"|"reach"="impressions"){const engagements=sumMetrics(rows,["reactions","likes","comments","shares","clicks","saves"]),exposure=sumMetrics(rows,[denominator]);return{rate:engagements===null||exposure===null||exposure<=0?null:engagements/exposure*100,engagements,denominator:exposure,denominatorMetric:denominator};}
export function compareMetricPeriods(current:readonly AnalyticsSnapshot[],previous:readonly AnalyticsSnapshot[],metric:AnalyticsMetricName){const now=sumMetrics(current,[metric]),before=sumMetrics(previous,[metric]);if(now===null||before===null)return{current:now,previous:before,absoluteChange:null,percentageChange:null};return{current:now,previous:before,absoluteChange:now-before,percentageChange:before===0?null:(now-before)/before*100};}
function median(values:number[]){const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]!:(s[m-1]!+s[m]!)/2;}
export function detectMetricAnomalies(history:readonly number[],current:number,thresholdRatio=0.5){if(!Number.isFinite(current)||current<0||!Number.isFinite(thresholdRatio)||thresholdRatio<=0)throw new Error("Anomaly inputs must be finite and non-negative.");const valid=history.filter(v=>Number.isFinite(v)&&v>=0).slice(-30);if(valid.length<3)return{anomalous:false,baseline:null,deviationRatio:null,direction:null as "up"|"down"|null};const baseline=median(valid);if(baseline===0)return{anomalous:current>0,baseline,deviationRatio:current>0?null:0,direction:current>0?"up" as const:null};const delta=(current-baseline)/baseline;return{anomalous:Math.abs(delta)>=thresholdRatio,baseline,deviationRatio:delta,direction:delta>=thresholdRatio?"up" as const:delta<=-thresholdRatio?"down" as const:null};}
export function getAnalyticsFreshness(rows:readonly AnalyticsSnapshot[],now=new Date().toISOString(),staleAfterMs=86400000){if(!validTimestamp(now)||!Number.isFinite(staleAfterMs)||staleAfterMs<0)throw new Error("Invalid freshness evaluation parameters.");if(!rows.length)return{status:"missing" as const,latestCapturedAt:null,ageMs:null};const latest=rows.reduce((v,r)=>Date.parse(r.capturedAt)>Date.parse(v)?r.capturedAt:v,rows[0]!.capturedAt),ageMs=Math.max(0,Date.parse(now)-Date.parse(latest));return{status:ageMs<=staleAfterMs?"fresh" as const:"stale" as const,latestCapturedAt:latest,ageMs};}
export function exportAnalyticsCsv(rows:readonly AnalyticsSnapshot[]){const cols:(keyof AnalyticsSnapshot)[]=["platform","accountId","entityId","entityType","metric","value","unit","periodStart","periodEnd","capturedAt","source"];const quote=(v:unknown)=>{const raw=String(v??""),safe=/^[=+@\-]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};return[cols.join(","),...rows.map(r=>cols.map(k=>quote(r[k])).join(","))].join("\n");}
export function createExecutiveAnalyticsSummary(rows:readonly AnalyticsSnapshot[]){const metrics:AnalyticsMetricName[]=["impressions","reach","views","reactions","likes","comments","shares","clicks","followersGained","followersLost","saves"],totals=Object.fromEntries(metrics.map(m=>[m,sumMetrics(rows,[m])])),platforms=[...new Set(rows.map(r=>r.platform))];return{snapshotCount:rows.length,platforms,totals,engagementByPlatform:platforms.map(platform=>{const subset=rows.filter(r=>r.platform===platform),imp=calculateEngagementRate(subset,"impressions"),reach=calculateEngagementRate(subset,"reach");return{platform,engagementRate:imp.rate??reach.rate,denominator:imp.rate!==null?"impressions":reach.rate!==null?"reach":null};}),limitations:[...new Set(rows.flatMap(r=>r.limitations))],note:"Only supplied, normalized snapshots are included. Missing platform metrics are not inferred."};}


/** Parse the canonical CSV export with strict size, row and column bounds. */
export function parseAnalyticsCsv(csv: string): AnalyticsSnapshot[] {
  if (typeof csv !== "string" || csv.length > 2_000_000) throw new Error("CSV is empty or exceeds the 2 MB limit.");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]!;
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      if (rows.length > 10_001) throw new Error("CSV exceeds the 10,000-record limit.");
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const headers = rows[0]!.map((value, index) => index === 0 ? value.replace(/^\uFEFF/, "") : value);
  const expected = ["platform","accountId","entityId","entityType","metric","value","unit","periodStart","periodEnd","capturedAt","source"];
  if (headers.length !== expected.length || expected.some((name, index) => headers[index] !== name)) {
    throw new Error("CSV header does not match the Liza analytics export format.");
  }
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== expected.length) throw new Error("CSV row " + (index + 2) + " has an invalid column count.");
    const value = Number(cells[5]);
    if (!Number.isFinite(value)) throw new Error("CSV row " + (index + 2) + " has an invalid metric value.");
    return normalizeAnalyticsRecord({
      id: "csv-" + (index + 1) + "-" + cells[1] + "-" + cells[2] + "-" + cells[4],
      platform: cells[0] as AnalyticsPlatform,
      accountId: cells[1]!,
      entityId: cells[2]!,
      entityType: cells[3] as AnalyticsSnapshot["entityType"],
      metricName: cells[4]!,
      value,
      periodStart: cells[7]!,
      periodEnd: cells[8]!,
      capturedAt: cells[9]!,
      source: cells[10]!,
      limitations: ["Imported from CSV; provider authenticity was not independently verified."],
    });
  });
}


export interface AnalyticsRecommendation { id:string; priority:"high"|"medium"|"low"; title:string; rationale:string; evidence:string[]; }

/** Recommendations use only supplied snapshots and never assume external benchmarks. */
export function generateAnalyticsRecommendations(rows:readonly AnalyticsSnapshot[],now=new Date().toISOString()):AnalyticsRecommendation[]{
 if(!rows.length)return[{id:"collect-data",priority:"high",title:"Connect or import analytics data",rationale:"No metric snapshots are available, so performance conclusions cannot be supported.",evidence:[]}];
 const out:AnalyticsRecommendation[]=[],fresh=getAnalyticsFreshness(rows,now);
 if(fresh.status!=="fresh")out.push({id:"refresh-data",priority:fresh.status==="missing"?"high":"medium",title:"Refresh analytics snapshots",rationale:fresh.status==="missing"?"No capture timestamp is available.":"The latest supplied snapshot is stale.",evidence:fresh.latestCapturedAt?[fresh.latestCapturedAt]:[]});
 const platforms=[...new Set(rows.map(r=>r.platform))],rates=platforms.map(platform=>({platform,result:calculateEngagementRate(rows.filter(r=>r.platform===platform))})).filter(x=>x.result.rate!==null);
 if(rates.length>=2){const sorted=[...rates].sort((a,b)=>b.result.rate!-a.result.rate!),best=sorted[0]!,worst=sorted[sorted.length-1]!;if(best.platform!==worst.platform)out.push({id:"compare-platform-engagement",priority:"low",title:"Review the strongest platform's content patterns",rationale:best.platform+" has the highest observed engagement rate in the supplied dataset. This is descriptive, not proof of causation.",evidence:[best.platform+": "+best.result.rate!.toFixed(2)+"%",worst.platform+": "+worst.result.rate!.toFixed(2)+"%"]});}
 const gained=sumMetrics(rows,["followersGained"]),lost=sumMetrics(rows,["followersLost"]);
 if(gained!==null&&lost!==null&&gained-lost<0)out.push({id:"review-follower-retention",priority:"medium",title:"Review follower retention",rationale:"Reported follower losses exceed gains. Check period alignment and audience feedback before changing strategy.",evidence:["Gained: "+gained,"Lost: "+lost,"Net: "+(gained-lost)]});
 const missing=platforms.filter(p=>{const subset=rows.filter(r=>r.platform===p);return sumMetrics(subset,["impressions"])===null&&sumMetrics(subset,["reach"])===null;});
 if(missing.length)out.push({id:"complete-exposure-metrics",priority:"medium",title:"Complete exposure metrics",rationale:"Engagement rate cannot be calculated without impressions or reach.",evidence:missing});
 return out;
}
export function buildAnalyticsTrendReport(rows:readonly AnalyticsSnapshot[],metric:AnalyticsMetricName){
 const grouped=new Map<string,{platform:AnalyticsPlatform;periodStart:string;periodEnd:string;value:number}>();
 for(const row of rows){if(row.metric!==metric)continue;const key=[row.platform,row.periodStart,row.periodEnd].join("|"),current=grouped.get(key);if(current)current.value+=row.value;else grouped.set(key,{platform:row.platform,periodStart:row.periodStart,periodEnd:row.periodEnd,value:row.value});}
 return [...grouped.values()].sort((a,b)=>a.periodStart.localeCompare(b.periodStart)||a.platform.localeCompare(b.platform));
}
export function buildAnalyticsDimensionReport(rows:readonly AnalyticsSnapshot[],dimension:"campaign"|"audience"|"contentPillar",metric:AnalyticsMetricName){
 const grouped=new Map<string,{value:number;recordCount:number}>();
 for(const row of rows){if(row.metric!==metric)continue;const label=clean(row.dimensions[dimension],160)||"Unspecified",current=grouped.get(label)??{value:0,recordCount:0};current.value+=row.value;current.recordCount++;grouped.set(label,current);}
 return [...grouped.entries()].map(([dimension,data])=>({dimension,...data})).sort((a,b)=>b.value-a.value);
}


export type D1AnalyticsDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      all: <T = Record<string, unknown>>() => Promise<{ success?: boolean; results?: T[] }>;
    };
  };
};

export interface DurableAnalyticsSnapshotStore {
  append(snapshot: AnalyticsSnapshot): Promise<void>;
  list(filters?: Partial<Pick<AnalyticsSnapshot, "platform" | "accountId" | "entityId" | "metric">>): Promise<AnalyticsSnapshot[]>;
  listPage(filters: Partial<Pick<AnalyticsSnapshot, "platform" | "accountId" | "entityId" | "metric">>, limit: number, cursor?: string): Promise<{ records: AnalyticsSnapshot[]; nextCursor: string | null; hasMore: boolean }>;
  delete(ids: string[], deletedAt: string): Promise<number>;
}


type AnalyticsPageCursor = { periodStart: string; capturedAt: string; storageId: string };
function encodeAnalyticsCursor(cursor: AnalyticsPageCursor): string {
  return btoa(JSON.stringify(cursor)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeAnalyticsCursor(value: string): AnalyticsPageCursor {
  if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid analytics page cursor.");
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const parsed: unknown = JSON.parse(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const cursor = parsed as Record<string, unknown>;
    if (typeof cursor["periodStart"] !== "string" || !validDate(cursor["periodStart"]) ||
      typeof cursor["capturedAt"] !== "string" || !validTimestamp(cursor["capturedAt"]) ||
      typeof cursor["storageId"] !== "string" || !cursor["storageId"] || cursor["storageId"].length > 512) throw new Error();
    return { periodStart: cursor["periodStart"], capturedAt: cursor["capturedAt"], storageId: cursor["storageId"] };
  } catch { throw new Error("Invalid analytics page cursor."); }
}

/** D1 adapter. It is usable only after the analytics migration and ACTION_DB binding are provisioned. */
export function createD1AnalyticsStore(database: D1AnalyticsDatabase, workspaceId: string): DurableAnalyticsSnapshotStore {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 analytics database is required");
  const workspace = clean(workspaceId, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(workspace)) throw new Error("A valid analytics workspace is required");
  const restore = (json: string): AnalyticsSnapshot => {
    let value: unknown;
    try { value = JSON.parse(json); } catch { throw new Error("Stored analytics snapshot is invalid JSON"); }
    if (!value || typeof value !== "object") throw new Error("Stored analytics snapshot is invalid");
    const item = value as AnalyticsSnapshot;
    return normalizeAnalyticsRecord({
      id:item.id, platform:item.platform, accountId:item.accountId, entityId:item.entityId,
      entityType:item.entityType, metricName:item.metric, value:item.value,
      periodStart:item.periodStart, periodEnd:item.periodEnd, capturedAt:item.capturedAt,
      source:item.source, limitations:item.limitations, dimensions:item.dimensions,
    });
  };
  return {
    append: async (snapshot) => {
      const normalized = restore(JSON.stringify(snapshot));
      const payload = JSON.stringify(normalized);
      // The legacy table uses a globally unique primary key. Namespace the storage key
      // by workspace so identical source snapshot IDs can safely exist in separate workspaces.
      const storageId = JSON.stringify([workspace, normalized.id]);
      const result = await database.prepare(
        "INSERT OR IGNORE INTO analytics_snapshots (id, platform, account_id, entity_id, entity_type, metric, period_start, period_end, captured_at, source, value, payload_json, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(storageId, normalized.platform, normalized.accountId, normalized.entityId,
        normalized.entityType, normalized.metric, normalized.periodStart, normalized.periodEnd,
        normalized.capturedAt, normalized.source, normalized.value, payload, workspace).run();
      if (result.success === false) throw new Error("D1 analytics snapshot write failed");
      if (result.meta?.changes === 1) return;
      if (result.meta?.changes !== 0) throw new Error("D1 did not return an analytics write change count");
      const existing = await database.prepare(
        "SELECT payload_json FROM analytics_snapshots WHERE id = ? AND workspace_id = ?",
      ).bind(storageId, workspace).first<{ payload_json: string }>();
      if (!existing || existing.payload_json !== payload) throw new Error("Analytics snapshot ID already exists with different data.");
    },
    list: async (filters = {}) => {
      const clauses: string[] = ["workspace_id = ?"];
      const values: unknown[] = [workspace];
      if (filters.platform !== undefined) { clauses.push("platform = ?"); values.push(filters.platform); }
      if (filters.accountId !== undefined) { clauses.push("account_id = ?"); values.push(filters.accountId); }
      if (filters.entityId !== undefined) { clauses.push("entity_id = ?"); values.push(filters.entityId); }
      if (filters.metric !== undefined) { clauses.push("metric = ?"); values.push(filters.metric); }
      clauses.push("deleted_at IS NULL");
      const query = "SELECT payload_json FROM analytics_snapshots" +
        (clauses.length ? " WHERE " + clauses.join(" AND ") : "") +
        " ORDER BY period_start ASC, captured_at ASC, id ASC LIMIT 10000";
      const result = await database.prepare(query).bind(...values).all<{ payload_json: string }>();
      if (result.success === false) throw new Error("D1 analytics snapshot query failed");
      return (result.results ?? []).map((row) => restore(row.payload_json));
    },
    listPage: async (filters = {}, limit, cursorValue) => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Analytics page limit must be between 1 and 500.");
      const clauses: string[] = ["workspace_id = ?", "deleted_at IS NULL"];
      const values: unknown[] = [workspace];
      if (filters.platform !== undefined) { clauses.push("platform = ?"); values.push(filters.platform); }
      if (filters.accountId !== undefined) { clauses.push("account_id = ?"); values.push(filters.accountId); }
      if (filters.entityId !== undefined) { clauses.push("entity_id = ?"); values.push(filters.entityId); }
      if (filters.metric !== undefined) { clauses.push("metric = ?"); values.push(filters.metric); }
      if (cursorValue) {
        const cursor = decodeAnalyticsCursor(cursorValue);
        clauses.push("(period_start > ? OR (period_start = ? AND captured_at > ?) OR (period_start = ? AND captured_at = ? AND id > ?))");
        values.push(cursor.periodStart, cursor.periodStart, cursor.capturedAt, cursor.periodStart, cursor.capturedAt, cursor.storageId);
      }
      const query = "SELECT id, period_start, captured_at, payload_json FROM analytics_snapshots WHERE " +
        clauses.join(" AND ") + " ORDER BY period_start ASC, captured_at ASC, id ASC LIMIT ?";
      const result = await database.prepare(query).bind(...values, limit + 1).all<{
        id: string; period_start: string; captured_at: string; payload_json: string;
      }>();
      if (result.success === false) throw new Error("D1 analytics page query failed");
      const rows = result.results ?? [];
      const hasMore = rows.length > limit;
      const pageRows = rows.slice(0, limit);
      const last = pageRows[pageRows.length - 1];
      return {
        records: pageRows.map((row) => restore(row.payload_json)),
        hasMore,
        nextCursor: hasMore && last ? encodeAnalyticsCursor({
          periodStart: last.period_start, capturedAt: last.captured_at, storageId: last.id,
        }) : null,
      };
    },
    delete: async (ids, deletedAt) => {
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 ||
        ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 120) ||
        !validTimestamp(deletedAt)) throw new Error("Invalid analytics deletion request.");
      const storageIds = [...new Set(ids)].map((id) => JSON.stringify([workspace, clean(id, 120)]));
      const placeholders = storageIds.map(() => "?").join(", ");
      const result = await database.prepare(
        "UPDATE analytics_snapshots SET deleted_at = ? WHERE workspace_id = ? AND deleted_at IS NULL AND id IN (" + placeholders + ")"
      ).bind(deletedAt, workspace, ...storageIds).run();
      if (result.success === false) throw new Error("D1 analytics deletion failed.");
      return result.meta?.changes ?? 0;
    },
  };
}
