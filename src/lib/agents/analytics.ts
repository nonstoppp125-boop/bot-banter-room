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


function aggregateForAnalyticsRows(rows: readonly AnalyticsSnapshot[]) {
  const metricNames: AnalyticsMetricName[] = ["impressions","reach","views","reactions","likes","comments","shares","clicks","followersGained","followersLost","saves"];
  return Object.fromEntries(metricNames.map((metric) => [metric, sumMetrics(rows, [metric])])) as Record<AnalyticsMetricName, number | null>;
}
function groupRowsBy(rows: readonly AnalyticsSnapshot[], selector: (row: AnalyticsSnapshot) => string | null) {
  const groups = new Map<string, AnalyticsSnapshot[]>();
  for (const row of rows) { const key = selector(row); if (!key) continue; const group=groups.get(key)??[]; group.push(row); groups.set(key,group); }
  return groups;
}
export function createPerformanceDashboard(rows: readonly AnalyticsSnapshot[], generatedAt: string) {
  if (!validTimestamp(generatedAt)) throw new Error("Dashboard generation timestamp is invalid.");
  const platforms=[...new Set(rows.map(row=>row.platform))];
  return {
    generatedAt,
    executive:createExecutiveAnalyticsSummary(rows),
    freshness:getAnalyticsFreshness(rows,generatedAt),
    platformCards:platforms.map(platform=>{
      const subset=rows.filter(row=>row.platform===platform);
      return {platform,snapshotCount:subset.length,totals:aggregateForAnalyticsRows(subset),engagement:calculateEngagementRate(subset,"impressions"),sourceCount:new Set(subset.map(row=>row.source)).size,limitations:[...new Set(subset.flatMap(row=>row.limitations))]};
    }),
    dataPolicy:"Dashboard values are derived only from supplied snapshots; missing metrics remain null.",
  };
}
export function createCampaignAnalyticsReport(rows: readonly AnalyticsSnapshot[]) {
  const groups=groupRowsBy(rows.filter(row=>row.entityType==="campaign"),row=>row.dimensions.campaignId??row.entityId);
  return [...groups.entries()].map(([campaignId,group])=>({campaignId,platforms:[...new Set(group.map(row=>row.platform))],totals:aggregateForAnalyticsRows(group),engagement:calculateEngagementRate(group,"impressions"),snapshotCount:group.length,sources:[...new Set(group.map(row=>row.source))],limitations:[...new Set(group.flatMap(row=>row.limitations))]}));
}
export function createAudienceAnalyticsReport(rows: readonly AnalyticsSnapshot[],dimension="audienceSegment") {
  const safeDimension=clean(dimension,60); if(!safeDimension)throw new Error("Audience dimension is required.");
  const groups=groupRowsBy(rows,row=>row.dimensions[safeDimension]??null);
  return [...groups.entries()].map(([segment,group])=>({segment,platforms:[...new Set(group.map(row=>row.platform))],totals:aggregateForAnalyticsRows(group),snapshotCount:group.length,sourceCount:new Set(group.map(row=>row.source)).size,limitations:[...new Set(group.flatMap(row=>row.limitations))]}));
}
export function createContentAnalyticsReport(rows: readonly AnalyticsSnapshot[]) {
  const groups=groupRowsBy(rows.filter(row=>row.entityType==="post"),row=>row.platform+":"+row.entityId);
  return [...groups.entries()].map(([contentKey,group])=>({contentKey,platform:group[0]!.platform,contentId:group[0]!.entityId,totals:aggregateForAnalyticsRows(group),engagement:calculateEngagementRate(group,"impressions"),snapshotCount:group.length,sources:[...new Set(group.map(row=>row.source))],limitations:[...new Set(group.flatMap(row=>row.limitations))]}));
}
export function createAnalyticsTrendReport(rows: readonly AnalyticsSnapshot[],metric:AnalyticsMetricName) {
  const selected=rows.filter(row=>row.metric===metric);
  const groups=groupRowsBy(selected,row=>row.platform+":"+row.periodStart+":"+row.periodEnd);
  const points=[...groups.entries()].map(([key,group])=>({key,platform:group[0]!.platform,periodStart:group[0]!.periodStart,periodEnd:group[0]!.periodEnd,metric,value:sumMetrics(group,[metric]),sourceCount:new Set(group.map(row=>row.source)).size})).sort((a,b)=>a.periodStart.localeCompare(b.periodStart));
  const byPlatform=new Map<string,typeof points>();
  for(const point of points){const list=byPlatform.get(point.platform)??[];list.push(point);byPlatform.set(point.platform,list);}
  const changes=[...byPlatform.entries()].flatMap(([platform,series])=>{const ordered=[...series].sort((a,b)=>a.periodStart.localeCompare(b.periodStart));return ordered.slice(1).map((current,index)=>{const previous=ordered[index]!;return{platform,currentPeriodStart:current.periodStart,previousPeriodStart:previous.periodStart,absoluteChange:current.value===null||previous.value===null?null:current.value-previous.value,percentageChange:current.value===null||previous.value===null||previous.value===0?null:((current.value-previous.value)/previous.value)*100};});});
  return {metric,points,changes,limitations:["Periods are grouped from supplied snapshots; overlapping periods are not deduplicated.","A zero previous-period value has no percentage-change result."]};
}
