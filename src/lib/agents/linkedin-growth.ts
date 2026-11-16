import { executeVerifiedApprovedAction } from "./action-policy";
import type { ApprovalStore } from "./approval-store";
import { hashApprovalPayload } from "./approval-store";
import type { DurableActionStore } from "./action-policy";

export type LinkedInDraftStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface LinkedInGrowthDraft {
  id: string;
  content: string;
  status: LinkedInDraftStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  publicationId: string | null;
  failureReason: string | null;
  campaign: string | null;
  pillar: string | null;
}

export interface LinkedInAuditEvent {
  id: string;
  draftId: string;
  action: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface LinkedInMetricSnapshot {
  postId: string;
  capturedAt: string;
  periodStart?: string;
  periodEnd?: string;
  impressions?: number | null;
  reach?: number | null;
  reactions?: number | null;
  comments?: number | null;
  shares?: number | null;
  clicks?: number | null;
  followersGained?: number | null;
  campaign?: string | null;
  pillar?: string | null;
  publishedAt?: string | null;
}

export interface LinkedInLeadEvidence {
  sourceId: string;
  sourceUrl: string;
  observedAt: string;
  summary: string;
}

export interface LinkedInProspect {
  id: string;
  name: string;
  organization: string | null;
  relevance: string;
  evidence: LinkedInLeadEvidence[];
  followUpDraft: string | null;
  status: "researched" | "follow_up_pending_approval" | "approved" | "rejected";
}

export interface LinkedInGrowthStore {
  getDraft(id: string): LinkedInGrowthDraft | null;
  saveDraft(draft: LinkedInGrowthDraft): void;
  listDrafts(): LinkedInGrowthDraft[];
  appendAudit(event: LinkedInAuditEvent): void;
  listAudit(draftId?: string): LinkedInAuditEvent[];
}

const clean = (value: string, max = 500): string => value.trim().slice(0, max);
const validId = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(value);
const validDate = (value: string): boolean =>
  Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);

function requireText(value: string, label: string, max = 500): string {
  const result = clean(value, max);
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function audit(
  store: LinkedInGrowthStore,
  draft: LinkedInGrowthDraft,
  action: string,
  actor: string,
  timestamp: string,
  details: Record<string, unknown> = {},
): void {
  store.appendAudit({
    id: `${draft.id}:${draft.version}:${action}:${timestamp}`,
    draftId: draft.id,
    action,
    actor: requireText(actor, "Actor", 100),
    timestamp,
    details,
  });
}

function transition(
  store: LinkedInGrowthStore,
  current: LinkedInGrowthDraft,
  nextStatus: LinkedInDraftStatus,
  actor: string,
  timestamp: string,
  patch: Partial<LinkedInGrowthDraft> = {},
): LinkedInGrowthDraft {
  const next: LinkedInGrowthDraft = {
    ...current,
    ...patch,
    status: nextStatus,
    version: current.version + 1,
    updatedAt: timestamp,
  };
  store.saveDraft(next);
  audit(store, next, `status:${nextStatus}`, actor, timestamp, {
    previousStatus: current.status,
  });
  return next;
}

/** Volatile reference store only; do not use for production publication. */
export class InMemoryLinkedInGrowthStore implements LinkedInGrowthStore {
  private readonly drafts = new Map<string, LinkedInGrowthDraft>();
  private readonly events: LinkedInAuditEvent[] = [];

  getDraft(id: string): LinkedInGrowthDraft | null {
    const value = this.drafts.get(id);
    return value ? structuredClone(value) : null;
  }

  saveDraft(draft: LinkedInGrowthDraft): void {
    this.drafts.set(draft.id, structuredClone(draft));
  }

  listDrafts(): LinkedInGrowthDraft[] {
    return structuredClone([...this.drafts.values()]);
  }

  appendAudit(event: LinkedInAuditEvent): void {
    this.events.push(structuredClone(event));
  }

  listAudit(draftId?: string): LinkedInAuditEvent[] {
    return structuredClone(
      draftId ? this.events.filter((event) => event.draftId === draftId) : this.events,
    );
  }
}

export function createLinkedInGrowthDraft(input: {
  id: string;
  content: string;
  actor: string;
  now?: string;
  campaign?: string;
  pillar?: string;
}): LinkedInGrowthDraft {
  const id = requireText(input.id, "Draft ID", 80);
  if (!validId(id)) throw new Error("Invalid draft ID.");
  const now = input.now ?? new Date().toISOString();
  if (!validDate(now)) throw new Error("Invalid creation timestamp.");

  return {
    id,
    content: requireText(input.content, "Draft content", 10000),
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    scheduledAt: null,
    approvedBy: null,
    publishedAt: null,
    publicationId: null,
    failureReason: null,
    campaign: clean(input.campaign ?? "", 120) || null,
    pillar: clean(input.pillar ?? "", 120) || null,
  };
}

export function saveLinkedInDraft(
  store: LinkedInGrowthStore,
  draft: LinkedInGrowthDraft,
  actor: string,
): LinkedInGrowthDraft {
  if (store.getDraft(draft.id)) throw new Error("Draft ID already exists.");
  store.saveDraft(structuredClone(draft));
  audit(store, draft, "draft:created", actor, draft.createdAt);
  return structuredClone(draft);
}

export function submitLinkedInDraftForApproval(
  store: LinkedInGrowthStore,
  id: string,
  actor: string,
  now = new Date().toISOString(),
): LinkedInGrowthDraft {
  const current = store.getDraft(id);
  if (!current || !["draft", "rejected"].includes(current.status)) {
    throw new Error("Only a draft or rejected draft can be submitted for approval.");
  }
  return transition(store, current, "pending_approval", actor, now);
}

export function approveLinkedInDraft(
  store: LinkedInGrowthStore,
  id: string,
  approver: string,
  now = new Date().toISOString(),
): LinkedInGrowthDraft {
  const current = store.getDraft(id);
  if (!current || current.status !== "pending_approval") {
    throw new Error("Draft is not awaiting approval.");
  }
  return transition(store, current, "approved", approver, now, {
    approvedBy: requireText(approver, "Approver", 100),
    failureReason: null,
  });
}

export function rejectLinkedInDraft(
  store: LinkedInGrowthStore,
  id: string,
  reviewer: string,
  reason: string,
  now = new Date().toISOString(),
): LinkedInGrowthDraft {
  const current = store.getDraft(id);
  if (!current || current.status !== "pending_approval") {
    throw new Error("Only a pending draft can be rejected.");
  }
  return transition(store, current, "rejected", reviewer, now, {
    approvedBy: null,
    failureReason: requireText(reason, "Rejection reason", 500),
  });
}

export function reviseLinkedInDraft(
  store: LinkedInGrowthStore,
  id: string,
  content: string,
  editor: string,
  now = new Date().toISOString(),
): LinkedInGrowthDraft {
  const current = store.getDraft(id);
  if (!current || !["draft", "rejected"].includes(current.status)) {
    throw new Error("Only draft or rejected content can be revised.");
  }
  const next = transition(store, current, "draft", editor, now, {
    content: requireText(content, "Revised content", 10000),
    approvedBy: null,
    scheduledAt: null,
    failureReason: null,
  });
  audit(store, next, "draft:revised", editor, now, { priorVersion: current.version });
  return next;
}

export function scheduleApprovedLinkedInDraft(
  store: LinkedInGrowthStore,
  id: string,
  scheduledAt: string,
  actor: string,
  now = new Date().toISOString(),
): LinkedInGrowthDraft {
  const current = store.getDraft(id);
  if (!current || current.status !== "approved" || !current.approvedBy) {
    throw new Error("Only explicitly approved drafts can be scheduled.");
  }
  if (!validDate(scheduledAt) || Date.parse(scheduledAt) <= Date.parse(now)) {
    throw new Error("Schedule must be a valid future ISO timestamp.");
  }
  return transition(store, current, "scheduled", actor, now, { scheduledAt });
}

export interface LinkedInPublisher {
  publish(input: { content: string; idempotencyKey: string }): Promise<{ publicationId: string }>;
}

export interface LinkedInPublishInput {
  store: LinkedInGrowthStore;
  draftId: string;
  actor: string;
  now?: string;
  apiConfigured: boolean;
  officialApiPermissionGranted: boolean;
  durableActionStore: DurableActionStore | null;
  approvalStore: ApprovalStore | null;
  approvalId: string;
  workspaceId: string;
  approverUserId: string;
  publisher: LinkedInPublisher | null;
}

export async function publishApprovedLinkedInDraft(
  input: LinkedInPublishInput,
): Promise<LinkedInGrowthDraft> {
  const current = input.store.getDraft(input.draftId);
  if (!current || !["approved", "scheduled"].includes(current.status)) {
    throw new Error("Draft must be approved before publication.");
  }
  if (!current.approvedBy || !input.approverUserId || current.approvedBy !== input.approverUserId) throw new Error("Explicit approval by the initiating user is missing.");
  if (!input.apiConfigured || !input.officialApiPermissionGranted || !input.publisher) {
    throw new Error("LinkedIn official API connection or publishing permission is unavailable.");
  }
  if (!input.durableActionStore) {
    throw new Error("Durable idempotency storage is unavailable.");
  }

  const now = input.now ?? new Date().toISOString();
  if (
    current.status === "scheduled" &&
    (!current.scheduledAt ||
      !validDate(current.scheduledAt) ||
      Date.parse(current.scheduledAt) > Date.parse(now))
  ) {
    throw new Error("Scheduled publication time has not arrived.");
  }
  if (!input.approvalStore || !input.approvalId || !input.workspaceId) throw new Error("Persisted approval storage is unavailable.");
  const payloadHash = await hashApprovalPayload({ platform: "linkedin", draftId: current.id, content: current.content });
  const key = "li-pub-" + (await hashApprovalPayload({ draftId: current.id, version: current.version })).slice(0, 32);
  const publishing = transition(input.store, current, "publishing", input.actor, now);

  try {
    const result = await executeVerifiedApprovedAction({
      approvalStore: input.approvalStore,
      approvalId: input.approvalId,
      actorUserId: input.approverUserId,
      workspaceId: input.workspaceId,
      actionType: "social.publish",
      payloadHash,
      now,
      idempotencyKey: key,
      store: input.durableActionStore,
      execute: () =>
        input.publisher!.publish({
          content: publishing.content,
          idempotencyKey: key,
        }),
    });

    const publicationId = requireText(result.result.publicationId, "Publication ID", 200);
    const latest = input.store.getDraft(current.id);
    if (!latest || latest.status !== "publishing") {
      throw new Error("Draft state changed during publication.");
    }
    return transition(input.store, latest, "published", input.actor, now, {
      publicationId,
      publishedAt: now,
      failureReason: null,
    });
  } catch (error) {
    const latest = input.store.getDraft(current.id);
    if (latest?.status === "publishing") {
      transition(input.store, latest, "failed", input.actor, now, {
        failureReason: error instanceof Error ? clean(error.message, 500) : "Unknown failure",
      });
    }
    throw error;
  }
}

export function getLinkedInConnectionDiagnostics(input: {
  clientIdConfigured: boolean;
  accessTokenConfigured: boolean;
  organizationOrMemberPermission: boolean;
  publishingPermission: boolean;
  analyticsPermission: boolean;
  apiVersionConfigured: boolean;
}) {
  const checks = [
    ["client configuration", input.clientIdConfigured],
    ["server-side access token", input.accessTokenConfigured],
    ["member or organization authorization", input.organizationOrMemberPermission],
    ["publishing permission", input.publishingPermission],
    ["analytics permission", input.analyticsPermission],
    ["supported API version", input.apiVersionConfigured],
  ] as const;
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const baseConfigured =
    input.clientIdConfigured &&
    input.accessTokenConfigured &&
    input.organizationOrMemberPermission &&
    input.apiVersionConfigured;

  return {
    status: missing.length === 0 ? ("configured" as const) : ("unavailable" as const),
    canPublish: baseConfigured && input.publishingPermission,
    canReadAnalytics: baseConfigured && input.analyticsPermission,
    missing,
    note: "Configuration flags are not proof of a successful LinkedIn API authorization. Verify through the official API before enabling actions.",
  };
}

export interface NormalizedLinkedInMetrics {
  postId: string;
  capturedAt: string;
  impressions: number | null;
  reach: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  clicks: number | null;
  followersGained: number | null;
  engagementRatePercent: number | null;
  campaign: string | null;
  pillar: string | null;
}

function optionalMetric(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeLinkedInMetrics(input: LinkedInMetricSnapshot): NormalizedLinkedInMetrics {
  const impressions = optionalMetric(input.impressions);
  const reactions = optionalMetric(input.reactions);
  const comments = optionalMetric(input.comments);
  const shares = optionalMetric(input.shares);
  const engagementAvailable = [reactions, comments, shares].every((value) => value !== null);

  const capturedAt = requireText(input.capturedAt, "Capture timestamp", 50);
  if (!validDate(capturedAt)) {
    throw new Error("Capture timestamp must be a valid ISO timestamp.");
  }

  return {
    postId: requireText(input.postId, "Post ID", 200),
    capturedAt,
    impressions,
    reach: optionalMetric(input.reach),
    reactions,
    comments,
    shares,
    clicks: optionalMetric(input.clicks),
    followersGained: optionalMetric(input.followersGained),
    engagementRatePercent:
      impressions !== null && impressions > 0 && engagementAvailable
        ? Number(
            ((((reactions ?? 0) + (comments ?? 0) + (shares ?? 0)) / impressions) * 100).toFixed(2),
          )
        : null,
    campaign: clean(input.campaign ?? "", 120) || null,
    pillar: clean(input.pillar ?? "", 120) || null,
  };
}

export function buildLinkedInPerformanceSummary(
  snapshots: LinkedInMetricSnapshot[],
  period: "weekly" | "monthly",
  reportAt = new Date().toISOString(),
) {
  const reportEnd = Date.parse(reportAt);
  if (!Number.isFinite(reportEnd)) {
    throw new Error("Report timestamp must be a valid ISO timestamp.");
  }

  const periodDays = period === "weekly" ? 7 : 30;
  const reportStart = reportEnd - periodDays * 24 * 60 * 60 * 1000;
  const latestByPost = new Map<string, LinkedInMetricSnapshot>();
  let excludedMissingPublishedAt = 0;
  let excludedOutsidePeriod = 0;

  for (const snapshot of snapshots) {
    const publishedAt = snapshot.publishedAt;
    const publishedTime = typeof publishedAt === "string" ? Date.parse(publishedAt) : Number.NaN;

    if (!Number.isFinite(publishedTime)) {
      excludedMissingPublishedAt += 1;
      continue;
    }
    if (publishedTime < reportStart || publishedTime > reportEnd) {
      excludedOutsidePeriod += 1;
      continue;
    }

    const existing = latestByPost.get(snapshot.postId);
    if (!existing || Date.parse(snapshot.capturedAt) > Date.parse(existing.capturedAt)) {
      latestByPost.set(snapshot.postId, snapshot);
    }
  }

  const normalized = [...latestByPost.values()].map(normalizeLinkedInMetrics);
  const sum = (key: keyof NormalizedLinkedInMetrics): number | null => {
    const values = normalized.map((item) => item[key]);
    if (values.some((value) => typeof value !== "number")) return null;
    return (values as number[]).reduce((total, value) => total + value, 0);
  };
  const impressions = sum("impressions");
  const reactions = sum("reactions");
  const comments = sum("comments");
  const shares = sum("shares");
  const totalEngagement =
    reactions === null || comments === null || shares === null
      ? null
      : reactions + comments + shares;

  const grouped = (key: "pillar" | "campaign") => {
    const groups = new Map<string, NormalizedLinkedInMetrics[]>();
    for (const item of normalized) {
      const name = item[key];
      if (!name) continue;
      const entries = groups.get(name) ?? [];
      entries.push(item);
      groups.set(name, entries);
    }

    return [...groups.entries()].map(([name, entries]) => {
      const aggregate = (metric: keyof NormalizedLinkedInMetrics): number | null => {
        const values = entries.map((item) => item[metric]);
        if (values.some((value) => typeof value !== "number")) return null;
        return (values as number[]).reduce((total, value) => total + value, 0);
      };

      const impressionsCount = aggregate("impressions");
      const reactionsCount = aggregate("reactions");
      const commentsCount = aggregate("comments");
      const sharesCount = aggregate("shares");
      const engagement =
        reactionsCount === null || commentsCount === null || sharesCount === null
          ? null
          : reactionsCount + commentsCount + sharesCount;

      return {
        name,
        postCount: entries.length,
        impressions: impressionsCount,
        reach: aggregate("reach"),
        reactions: reactionsCount,
        comments: commentsCount,
        shares: sharesCount,
        clicks: aggregate("clicks"),
        followersGained: aggregate("followersGained"),
        engagementRatePercent:
          impressionsCount !== null && impressionsCount > 0 && engagement !== null
            ? Number(((engagement / impressionsCount) * 100).toFixed(2))
            : null,
      };
    });
  };

  const postingHourGroups = new Map<
    number,
    { postCount: number; impressions: number; impressionsComplete: boolean }
  >();

  for (const item of normalized) {
    const snapshot = latestByPost.get(item.postId);
    const publishedTime = snapshot?.publishedAt ? Date.parse(snapshot.publishedAt) : Number.NaN;
    if (!Number.isFinite(publishedTime)) continue;

    const hour = new Date(publishedTime).getUTCHours();
    const group = postingHourGroups.get(hour) ?? {
      postCount: 0,
      impressions: 0,
      impressionsComplete: true,
    };

    group.postCount += 1;
    if (item.impressions === null) {
      group.impressionsComplete = false;
    } else {
      group.impressions += item.impressions;
    }
    postingHourGroups.set(hour, group);
  }

  const byPostingHourUtc = [...postingHourGroups.entries()]
    .sort(([hourA], [hourB]) => hourA - hourB)
    .map(([hour, group]) => ({
      hourUtc: `${String(hour).padStart(2, "0")}:00`,
      postCount: group.postCount,
      impressions: group.impressionsComplete ? group.impressions : null,
    }));

  return {
    period,
    reportWindow: {
      start: new Date(reportStart).toISOString(),
      end: new Date(reportEnd).toISOString(),
      basis: "publishedAt" as const,
      durationDays: periodDays,
    },
    postCount: normalized.length,
    excludedRecords: {
      missingOrInvalidPublishedAt: excludedMissingPublishedAt,
      outsideReportWindow: excludedOutsidePeriod,
    },
    metrics: {
      impressions,
      reach: sum("reach"),
      reactions,
      comments,
      shares,
      clicks: sum("clicks"),
      followersGained: sum("followersGained"),
    },
    engagementRatePercent:
      impressions !== null && impressions > 0 && totalEngagement !== null
        ? Number(((totalEngagement / impressions) * 100).toFixed(2))
        : null,
    byContentPillar: grouped("pillar"),
    byCampaign: grouped("campaign"),
    byPostingHourUtc,
    limitations: [
      "Analytics are supplied by the caller and are not fetched or verified by this module.",
      "Missing metrics remain null; they are never silently converted to zero.",
      "Only posts published inside the rolling report window are included.",
      "The latest captured snapshot per post is used to prevent cumulative snapshot double-counting.",
      "Records without a valid publishedAt timestamp are excluded.",
      "Posting-time groups use the UTC hour from publishedAt; they do not represent the audience local timezone.",
    ],
  };
}
export function buildLinkedInHistoricalInsights(snapshots: LinkedInMetricSnapshot[]) {
  const latestByPost = new Map<string, LinkedInMetricSnapshot>();
  let excludedMissingPublishedAt = 0;

  for (const snapshot of snapshots) {
    const publishedAt =
      typeof snapshot.publishedAt === "string" ? Date.parse(snapshot.publishedAt) : Number.NaN;

    if (!Number.isFinite(publishedAt)) {
      excludedMissingPublishedAt += 1;
      continue;
    }

    const existing = latestByPost.get(snapshot.postId);
    if (!existing || Date.parse(snapshot.capturedAt) > Date.parse(existing.capturedAt)) {
      latestByPost.set(snapshot.postId, snapshot);
    }
  }

  const entries = [...latestByPost.values()].map((snapshot) => ({
    snapshot,
    metrics: normalizeLinkedInMetrics(snapshot),
    publishedTime: Date.parse(snapshot.publishedAt as string),
  }));

  const aggregate = (items: typeof entries) => {
    const average = (values: Array<number | null>): number | null => {
      if (values.length === 0 || values.some((value) => value === null)) {
        return null;
      }
      const total = (values as number[]).reduce((sum, value) => sum + value, 0);
      return Number((total / values.length).toFixed(2));
    };

    return {
      postCount: items.length,
      averageImpressions: average(items.map((item) => item.metrics.impressions)),
      averageReach: average(items.map((item) => item.metrics.reach)),
      averageEngagementRatePercent: average(
        items.map((item) => item.metrics.engagementRatePercent),
      ),
    };
  };

  const grouped = (key: "pillar" | "campaign") => {
    const groups = new Map<string, typeof entries>();
    for (const item of entries) {
      const name = item.metrics[key];
      if (!name) continue;
      const group = groups.get(name) ?? [];
      group.push(item);
      groups.set(name, group);
    }

    return [...groups.entries()]
      .map(([name, items]) => ({ name, ...aggregate(items) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const postingHours = new Map<number, typeof entries>();
  for (const item of entries) {
    const hour = new Date(item.publishedTime).getUTCHours();
    const group = postingHours.get(hour) ?? [];
    group.push(item);
    postingHours.set(hour, group);
  }

  const byPostingHourUtc = [...postingHours.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, items]) => ({
      hourUtc: `${String(hour).padStart(2, "0")}:00`,
      ...aggregate(items),
    }));

  const byContentPillar = grouped("pillar");
  const byCampaign = grouped("campaign");

  const leaders = (items: typeof byContentPillar) =>
    items
      .filter((item) => item.averageEngagementRatePercent !== null)
      .slice()
      .sort(
        (a, b) => (b.averageEngagementRatePercent ?? 0) - (a.averageEngagementRatePercent ?? 0),
      );

  const publishedTimes = entries.map((item) => item.publishedTime);

  return {
    postsAnalyzed: entries.length,
    historicalWindow:
      publishedTimes.length > 0
        ? {
            start: new Date(Math.min(...publishedTimes)).toISOString(),
            end: new Date(Math.max(...publishedTimes)).toISOString(),
          }
        : null,
    excludedRecords: {
      missingOrInvalidPublishedAt: excludedMissingPublishedAt,
    },
    byContentPillar,
    byCampaign,
    byPostingHourUtc,
    observedLeaders: {
      contentPillar: leaders(byContentPillar),
      campaign: leaders(byCampaign),
    },
    limitations: [
      "Insights use caller-supplied historical snapshots and are not fetched or independently verified.",
      "The latest captured snapshot per post is used; this does not reconstruct historical metric changes.",
      "Averages are descriptive and do not establish that a pillar, campaign or posting hour caused better performance.",
      "Groups with incomplete metrics have null averages and are excluded from engagement-rate leader rankings.",
      "Posting-hour comparisons use UTC and may not reflect audience local time.",
    ],
  };
}

export function buildLinkedInContentRecommendations(
  snapshots: LinkedInMetricSnapshot[],
  minimumSampleSize = 3,
) {
  const requiredSampleSize = Number.isFinite(minimumSampleSize)
    ? Math.max(2, Math.floor(minimumSampleSize))
    : 3;
  const insights = buildLinkedInHistoricalInsights(snapshots);

  const recommendations: Array<{
    area: "content-pillar" | "campaign" | "posting-hour";
    recommendation: string;
    rationale: string;
    evidence: {
      leadingGroup: string;
      leadingAverageEngagementRatePercent: number;
      leadingPostCount: number;
      comparisonGroup: string;
      comparisonAverageEngagementRatePercent: number;
      comparisonPostCount: number;
    };
    confidence: "descriptive";
  }> = [];

  const compareGroups = (
    area: "content-pillar" | "campaign" | "posting-hour",
    groups: Array<{
      name: string;
      postCount: number;
      averageEngagementRatePercent: number | null;
    }>,
  ) => {
    const eligible = groups
      .filter(
        (group) =>
          group.postCount >= requiredSampleSize && group.averageEngagementRatePercent !== null,
      )
      .slice()
      .sort(
        (a, b) => (b.averageEngagementRatePercent ?? 0) - (a.averageEngagementRatePercent ?? 0),
      );

    if (eligible.length < 2) return;

    const leader = eligible[0];
    const comparison = eligible[eligible.length - 1];

    if (!leader || !comparison) return;

    recommendations.push({
      area,
      recommendation:
        area === "content-pillar"
          ? `Run a controlled test that modestly increases ${leader.name} content.`
          : area === "campaign"
            ? `Review and test the approach used in the ${leader.name} campaign.`
            : `Test publishing around ${leader.name} UTC in a controlled schedule experiment.`,
      rationale:
        `${leader.name} has a higher observed average engagement rate than ` +
        `${comparison.name}; this is descriptive evidence, not proof of causation.`,
      evidence: {
        leadingGroup: leader.name,
        leadingAverageEngagementRatePercent: leader.averageEngagementRatePercent as number,
        leadingPostCount: leader.postCount,
        comparisonGroup: comparison.name,
        comparisonAverageEngagementRatePercent: comparison.averageEngagementRatePercent as number,
        comparisonPostCount: comparison.postCount,
      },
      confidence: "descriptive",
    });
  };

  compareGroups(
    "content-pillar",
    insights.byContentPillar.map((item) => ({
      name: item.name,
      postCount: item.postCount,
      averageEngagementRatePercent: item.averageEngagementRatePercent,
    })),
  );

  compareGroups(
    "campaign",
    insights.byCampaign.map((item) => ({
      name: item.name,
      postCount: item.postCount,
      averageEngagementRatePercent: item.averageEngagementRatePercent,
    })),
  );

  compareGroups(
    "posting-hour",
    insights.byPostingHourUtc.map((item) => ({
      name: item.hourUtc,
      postCount: item.postCount,
      averageEngagementRatePercent: item.averageEngagementRatePercent,
    })),
  );

  return {
    status:
      recommendations.length > 0 ? "actionable-patterns-found" : "insufficient-comparable-history",
    minimumSampleSize: requiredSampleSize,
    recommendations,
    limitations: [
      "Recommendations are generated only from caller-supplied historical snapshots.",
      "At least the configured minimum number of posts is required in each compared group.",
      "Observed differences are descriptive and do not establish causation or guarantee future results.",
      "Posting-hour recommendations use UTC and require audience-local-time validation.",
      "Controlled experiments and human review are required before changing content strategy.",
    ],
  };
}

export function buildLinkedInWeeklyReport(
  snapshots: LinkedInMetricSnapshot[],
  reportAt = new Date().toISOString(),
) {
  return buildLinkedInPerformanceSummary(snapshots, "weekly", reportAt);
}

export function buildLinkedInMonthlyReport(
  snapshots: LinkedInMetricSnapshot[],
  reportAt = new Date().toISOString(),
) {
  return buildLinkedInPerformanceSummary(snapshots, "monthly", reportAt);
}

export function createLinkedInReplyApproval(input: {
  postId: string;
  replyDraft: string;
  actor: string;
}) {
  return {
    postId: requireText(input.postId, "Post ID", 200),
    replyDraft: requireText(input.replyDraft, "Reply draft", 3000),
    createdBy: requireText(input.actor, "Actor", 100),
    status: "pending_approval" as const,
    approvedBy: null as string | null,
    approvedAt: null as string | null,
    note: "This is a draft only. No comment or message is sent.",
  };
}

export function approveLinkedInReply(
  reply: ReturnType<typeof createLinkedInReplyApproval>,
  approver: string,
  now = new Date().toISOString(),
) {
  if (reply.status !== "pending_approval") {
    throw new Error("Reply is not awaiting approval.");
  }
  return {
    ...reply,
    status: "approved" as const,
    approvedBy: requireText(approver, "Approver", 100),
    approvedAt: now,
  };
}

export function createEvidenceLinkedProspect(input: {
  id: string;
  name: string;
  organization?: string;
  relevance: string;
  evidence: LinkedInLeadEvidence[];
  followUpDraft?: string;
}): LinkedInProspect {
  if (!validId(input.id)) throw new Error("Invalid prospect ID.");
  if (!input.evidence.length) throw new Error("At least one evidence item is required.");
  const evidence = input.evidence.map((item) => {
    const sourceUrl = requireText(item.sourceUrl, "Evidence source URL", 1000);
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new Error("Evidence source URL must be valid.");
    }
    if (parsed.protocol !== "https:") throw new Error("Evidence URL must use HTTPS.");
    return {
      sourceId: requireText(item.sourceId, "Evidence source ID", 100),
      sourceUrl,
      observedAt: requireText(item.observedAt, "Evidence timestamp", 50),
      summary: requireText(item.summary, "Evidence summary", 1000),
    };
  });

  return {
    id: input.id,
    name: requireText(input.name, "Prospect name", 160),
    organization: clean(input.organization ?? "", 160) || null,
    relevance: requireText(input.relevance, "Prospect relevance", 1000),
    evidence,
    followUpDraft: clean(input.followUpDraft ?? "", 2000) || null,
    status: input.followUpDraft ? "follow_up_pending_approval" : "researched",
  };
}

export function buildLinkedInGrowthDashboard(input: {
  store: LinkedInGrowthStore;
  connection: ReturnType<typeof getLinkedInConnectionDiagnostics>;
  metrics?: LinkedInMetricSnapshot[];
  reportPeriod?: "weekly" | "monthly";
  reportAt?: string;
}) {
  const drafts = input.store.listDrafts();
  const count = (status: LinkedInDraftStatus) =>
    drafts.filter((draft) => draft.status === status).length;

  return {
    connection: input.connection,
    drafts: {
      total: drafts.length,
      pendingApproval: count("pending_approval"),
      approved: count("approved"),
      scheduled: count("scheduled"),
      published: count("published"),
      failed: count("failed"),
    },
    auditEventCount: input.store.listAudit().length,
    performance: input.metrics?.length
      ? input.reportPeriod === "weekly"
        ? buildLinkedInWeeklyReport(input.metrics, input.reportAt)
        : buildLinkedInMonthlyReport(input.metrics, input.reportAt)
      : null,
    limitations: [
      "Dashboard includes only records supplied to the current store instance.",
      "In-memory store data is lost on process restart and is not production persistence.",
      "No LinkedIn profile, publishing, messaging or analytics endpoint is called.",
    ],
  };
}

export const LINKEDIN_GROWTH_LIMITATIONS = [
  "The included in-memory store is for tests and local workflows only.",
  "The SQL migration defines persistence tables but does not provision or bind a D1 database.",
  "A production D1 repository and deployment migration are still required.",
  "No LinkedIn OAuth flow, official API publisher, or live analytics client is included.",
  "API access depends on LinkedIn product approval, granted scopes, account type and current API availability.",
  "Prospect research accepts only caller-supplied HTTPS evidence; it does not scrape LinkedIn or send outreach.",
  "Reply approval does not send comments or messages.",
] as const;
