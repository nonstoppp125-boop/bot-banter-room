export type SocialPlatform = "instagram" | "facebook" | "youtube" | "x" | "tiktok";
export type SocialFormat =
  | "post"
  | "carousel"
  | "story"
  | "short-video"
  | "long-video"
  | "thread"
  | "community-post"
  | "event";

export type SocialDraftStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled";

export interface SocialDraftInput {
  id: string;
  platform: SocialPlatform;
  format: SocialFormat;
  topic: string;
  audience: string;
  objective: string;
  caption?: string;
  hook?: string;
  outline?: string[];
  script?: string;
  hashtags?: string[];
  keywords?: string[];
  language?: "bn" | "en" | "banglish";
  evidence?: string[];
  createdAt?: string;
}

export interface SocialDraft extends Omit<SocialDraftInput, "createdAt"> {
  version: number;
  status: SocialDraftStatus;
  createdAt: string;
  updatedAt: string;
  approvedBy: string | null;
  scheduledAt: string | null;
}

export interface SocialCalendarItem {
  id: string;
  date: string;
  platform: SocialPlatform;
  topic: string;
  format: SocialFormat;
  status: "planned";
}

const clean = (value: unknown, max = 1000): string =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";

const unique = (values: unknown[], max = 300): string[] =>
  [...new Set(values.map((value) => clean(value, max)).filter(Boolean))];

const VALID_PLATFORMS = new Set<SocialPlatform>(["instagram", "facebook", "youtube", "x", "tiktok"]);

const ALLOWED_FORMATS: Readonly<Record<SocialPlatform, readonly SocialFormat[]>> = {
  instagram: ["post", "carousel", "story", "short-video"],
  facebook: ["post", "carousel", "story", "short-video", "event"],
  youtube: ["long-video", "short-video", "community-post"],
  x: ["post", "thread"],
  tiktok: ["short-video"],
};

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value);
}

export function createSocialDraft(input: SocialDraftInput): SocialDraft {
  const id = clean(input.id, 100);
  const topic = clean(input.topic, 300);
  const audience = clean(input.audience, 300);
  const objective = clean(input.objective, 300);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(id)) throw new Error("Invalid social draft ID.");
  if (!VALID_PLATFORMS.has(input.platform)) throw new Error("Unsupported social platform.");
  if (!ALLOWED_FORMATS[input.platform].includes(input.format)) {
    throw new Error("Content format is not supported for this platform.");
  }
  if (!topic || !audience || !objective) throw new Error("Topic, audience and objective are required.");
  const now = input.createdAt ?? new Date().toISOString();
  if (!validTimestamp(now)) throw new Error("Invalid social draft timestamp.");

  return {
    id,
    platform: input.platform,
    format: input.format,
    topic,
    audience,
    objective,
    caption: clean(input.caption, 5000),
    hook: clean(input.hook, 500),
    outline: unique(Array.isArray(input.outline) ? input.outline : [], 800),
    script: clean(input.script, 10000),
    hashtags: unique(Array.isArray(input.hashtags) ? input.hashtags : [], 80),
    keywords: unique(Array.isArray(input.keywords) ? input.keywords : [], 100),
    language: input.language === "bn" || input.language === "banglish" ? input.language : "en",
    evidence: unique(Array.isArray(input.evidence) ? input.evidence : [], 500),
    version: 1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    approvedBy: null,
    scheduledAt: null,
  };
}

export function createSocialCalendar(input: {
  startDate: string;
  days: number;
  platforms: SocialPlatform[];
  topics: string[];
  formats?: Partial<Record<SocialPlatform, SocialFormat>>;
}): SocialCalendarItem[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return [];
  const start = new Date(`${input.startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== input.startDate) return [];
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 366) return [];
  const platforms = [...new Set((Array.isArray(input.platforms) ? input.platforms : []).filter((platform) => VALID_PLATFORMS.has(platform)))];
  const topics = unique(Array.isArray(input.topics) ? input.topics : [], 300);
  if (!platforms.length || !topics.length) return [];

  const entries: SocialCalendarItem[] = [];
  let slot = 0;
  for (let day = 0; day < input.days; day++) {
    const date = new Date(start.getTime() + day * 86_400_000);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    const platform = platforms[slot % platforms.length]!;
    const format = input.formats?.[platform] ?? (platform === "youtube" || platform === "tiktok" ? "short-video" : platform === "x" ? "thread" : "post");
    if (!ALLOWED_FORMATS[platform].includes(format)) continue;
    entries.push({
      id: `social-${slot + 1}`,
      date: date.toISOString().slice(0, 10),
      platform,
      topic: topics[slot % topics.length]!,
      format,
      status: "planned",
    });
    slot++;
  }
  return entries;
}

export function adaptSocialContent(input: {
  topic: string;
  coreMessage: string;
  audience: string;
  platforms: SocialPlatform[];
  language?: "bn" | "en" | "banglish";
  evidence?: string[];
}): Array<{
  platform: SocialPlatform;
  format: SocialFormat;
  topic: string;
  coreMessage: string;
  audience: string;
  language: "bn" | "en" | "banglish";
  evidence: string[];
  adaptationNote: string;
}> {
  const topic = clean(input.topic, 300);
  const coreMessage = clean(input.coreMessage, 2000);
  const audience = clean(input.audience, 300);
  if (!topic || !coreMessage || !audience) return [];
  return [...new Set(input.platforms.filter((platform) => VALID_PLATFORMS.has(platform)))].map((platform) => ({
    platform,
    format: platform === "youtube" || platform === "tiktok" ? "short-video" : platform === "x" ? "thread" : "post",
    topic,
    coreMessage,
    audience,
    language: input.language === "bn" || input.language === "banglish" ? input.language : "en",
    evidence: unique(Array.isArray(input.evidence) ? input.evidence : [], 500),
    adaptationNote:
      platform === "youtube" || platform === "tiktok"
        ? "Convert the core message into a visual hook, short script and storyboard."
        : platform === "x"
          ? "Convert the core message into a concise post or thread with one clear point per segment."
          : "Adapt the message to the platform's visual/community context and provide accessible supporting text.",
  }));
}

export function createSocialVideoStoryboard(input: {
  platform: "instagram" | "facebook" | "youtube" | "tiktok";
  title: string;
  scenes: Array<{ visual: string; narration: string; onScreenText?: string; durationSeconds: number }>;
}) {
  if (!["instagram", "facebook", "youtube", "tiktok"].includes(input.platform)) {
    throw new Error("Unsupported video platform.");
  }
  const scenes = Array.isArray(input.scenes)
    ? input.scenes.slice(0, 20).map((scene) => ({
        visual: clean(scene.visual, 500),
        narration: clean(scene.narration, 1000),
        onScreenText: clean(scene.onScreenText, 300),
        durationSeconds: Number.isInteger(scene.durationSeconds) ? scene.durationSeconds : 0,
      }))
    : [];
  if (!clean(input.title, 200) || !scenes.length || scenes.some((scene) =>
    !scene.visual || !scene.narration || scene.durationSeconds < 1 || scene.durationSeconds > 60
  )) {
    throw new Error("Storyboard requires a title and valid, bounded scenes.");
  }
  const totalDurationSeconds = scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
  if (totalDurationSeconds > 180) throw new Error("Storyboard duration exceeds 180 seconds.");
  return {
    platform: input.platform,
    title: clean(input.title, 200),
    scenes,
    totalDurationSeconds,
    status: "creative-brief-only" as const,
  };
}

export function createSocialCampaignBrief(input: {
  name: string;
  objective: string;
  audience: string;
  keyMessage: string;
  platforms: SocialPlatform[];
  callToAction: string;
  kpis: string[];
  evidence?: string[];
}) {
  const platforms = [...new Set((Array.isArray(input.platforms) ? input.platforms : []).filter((platform) => VALID_PLATFORMS.has(platform)))];
  const kpis = unique(Array.isArray(input.kpis) ? input.kpis : [], 150);
  if (!clean(input.name) || !clean(input.objective) || !clean(input.audience) ||
      !clean(input.keyMessage) || !clean(input.callToAction) || !platforms.length || !kpis.length) {
    throw new Error("Campaign brief is missing required information.");
  }
  return {
    name: clean(input.name, 150),
    objective: clean(input.objective, 300),
    audience: clean(input.audience, 300),
    keyMessage: clean(input.keyMessage, 1000),
    platforms,
    callToAction: clean(input.callToAction, 300),
    kpis,
    evidence: unique(Array.isArray(input.evidence) ? input.evidence : [], 500),
    status: "planning-only" as const,
    limitations: ["KPIs are proposed measurement targets; no platform data has been retrieved."],
  };
}

export class SocialDraftStore {
  private readonly history = new Map<string, SocialDraft[]>();

  create(draft: SocialDraft): SocialDraft {
    if (this.history.has(draft.id)) throw new Error("Social draft already exists.");
    this.history.set(draft.id, [structuredClone(draft)]);
    return structuredClone(draft);
  }

  get(id: string): SocialDraft | null {
    const current = this.history.get(clean(id, 100))?.at(-1);
    return current ? structuredClone(current) : null;
  }

  list(): SocialDraft[] {
    return structuredClone([...this.history.values()].map((history) => history.at(-1)!));
  }

  private transition(
    id: string,
    status: SocialDraftStatus,
    actor: string,
    now: string,
    patch: Partial<SocialDraft> = {},
  ): SocialDraft {
    const current = this.get(id);
    if (!current) throw new Error("Social draft not found.");
    if (!validTimestamp(now)) throw new Error("Invalid transition timestamp.");
    const next: SocialDraft = {
      ...current,
      ...patch,
      status,
      version: current.version + 1,
      updatedAt: now,
    };
    if (!clean(actor, 100)) throw new Error("Actor is required.");
    const history = this.history.get(clean(id, 100));
    if (!history) throw new Error("Social draft not found.");
    history.push(structuredClone(next));
    return structuredClone(next);
  }

  submitForApproval(id: string, actor: string, now = new Date().toISOString()): SocialDraft {
    const current = this.get(id);
    if (!current || !["draft", "rejected"].includes(current.status)) {
      throw new Error("Only draft or rejected content can be submitted for approval.");
    }
    return this.transition(id, "pending_approval", actor, now, { approvedBy: null });
  }

  approve(id: string, approver: string, now = new Date().toISOString()): SocialDraft {
    const current = this.get(id);
    if (!current || current.status !== "pending_approval") {
      throw new Error("Social draft is not awaiting approval.");
    }
    return this.transition(id, "approved", approver, now, { approvedBy: clean(approver, 100) });
  }

  reject(id: string, reviewer: string, reason: string, now = new Date().toISOString()): SocialDraft {
    const current = this.get(id);
    if (!current || current.status !== "pending_approval") {
      throw new Error("Only pending content can be rejected.");
    }
    return this.transition(id, "rejected", reviewer, now, {
      approvedBy: null,
      caption: `[REJECTED: ${clean(reason, 300)}] ${current.caption ?? ""}`.slice(0, 5000),
    });
  }

  revise(id: string, changes: Partial<Pick<SocialDraft, "caption" | "hook" | "outline" | "script">>, editor: string, now = new Date().toISOString()): SocialDraft {
    const current = this.get(id);
    if (!current || !["draft", "rejected"].includes(current.status)) {
      throw new Error("Only draft or rejected content can be revised.");
    }
    const safeChanges = {
      ...(changes.caption !== undefined ? { caption: clean(changes.caption, 5000) } : {}),
      ...(changes.hook !== undefined ? { hook: clean(changes.hook, 500) } : {}),
      ...(changes.outline !== undefined ? { outline: unique(changes.outline, 800) } : {}),
      ...(changes.script !== undefined ? { script: clean(changes.script, 10000) } : {}),
    };
    return this.transition(id, "draft", editor, now, { ...safeChanges, approvedBy: null, scheduledAt: null });
  }

  schedule(id: string, scheduledAt: string, actor: string, now = new Date().toISOString()): SocialDraft {
    const current = this.get(id);
    if (!current || current.status !== "approved" || !current.approvedBy) {
      throw new Error("Only explicitly approved social drafts can be scheduled.");
    }
    if (!validTimestamp(scheduledAt) || Date.parse(scheduledAt) <= Date.parse(now)) {
      throw new Error("Schedule must be a valid future ISO timestamp.");
    }
    return this.transition(id, "scheduled", actor, now, { scheduledAt });
  }

  getHistory(id: string): SocialDraft[] {
    return structuredClone(this.history.get(clean(id, 100)) ?? []);
  }
}

export function createSocialReplyDraft(input: { platform: SocialPlatform; targetId: string; reply: string; actor: string }) {
  if (!VALID_PLATFORMS.has(input.platform)) throw new Error("Unsupported social platform.");
  const targetId = clean(input.targetId, 200);
  const reply = clean(input.reply, 3000);
  const createdBy = clean(input.actor, 100);
  if (!targetId || !reply || !createdBy) throw new Error("Reply target, content and actor are required.");
  return {
    platform: input.platform,
    targetId,
    reply,
    createdBy,
    status: "pending_approval" as const,
    note: "Draft only. No comment, reply or message has been sent.",
  };
}

export const SOCIAL_WORKFORCE_LIMITATIONS = [
  "Platform-specific specialists and content adapters are prompt/planning foundations, not account integrations.",
  "Draft and calendar stores are in-memory and are lost on process restart.",
  "Scheduling records do not execute without a configured background worker.",
  "No platform publishing, comments, messaging, uploads or analytics API is connected.",
  "All content and replies require human review; API permissions must be verified per platform.",
] as const;


export type SocialIntegrationReadiness = {
  platform: SocialPlatform;
  apiAvailable: true;
  accountEligibility: string;
  authorization: string;
  publishingConstraints: string;
  quotaAndRateLimit: string;
  connectionStatus: "not-connected";
  livePublishingEnabled: false;
  sourceUrls: readonly string[];
};

/**
 * Verified API feasibility notes, not live connection claims.
 * These records intentionally keep every integration disconnected until OAuth,
 * provider approval, account eligibility and durable secret storage are verified.
 */
export const SOCIAL_INTEGRATION_READINESS: Readonly<Record<SocialPlatform, SocialIntegrationReadiness>> = {
  instagram: {
    platform: "instagram",
    apiAvailable: true,
    accountEligibility: "Instagram Professional account (Business or Creator); consumer/personal accounts are not supported by the professional-account API.",
    authorization: "Instagram Login uses instagram_business_basic and instagram_business_content_publishing; the Facebook Login route uses Instagram professional-account/Page linkage and the corresponding Meta permissions.",
    publishingConstraints: "Publishing is supported for eligible professional accounts; Stories availability differs by login route and account type. Media must meet Meta publishing requirements.",
    quotaAndRateLimit: "Meta applies dynamic app/account rate limits; inspect usage headers and the app dashboard rather than hardcoding a universal quota.",
    connectionStatus: "not-connected",
    livePublishingEnabled: false,
    sourceUrls: [
      "https://developers.facebook.com/docs/instagram/platform/instagram-api/changelog/",
      "https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/",
      "https://developers.facebook.com/docs/graph-api/overview/rate-limiting/",
    ],
  },
  facebook: {
    platform: "facebook",
    apiAvailable: true,
    accountEligibility: "Publishing is for Facebook Pages, not arbitrary personal-profile timelines; the authorizing user must have the Page task required to create content.",
    authorization: "Page access token plus pages_manage_posts, pages_read_engagement and pages_show_list; Page role/task must include CREATE_CONTENT.",
    publishingConstraints: "Page Feed publishing is supported through the official Graph API. Page-owned data and public Page data have distinct permission/feature gates.",
    quotaAndRateLimit: "Graph API and Pages calls are dynamically rate limited; inspect response usage headers and app dashboard.",
    connectionStatus: "not-connected",
    livePublishingEnabled: false,
    sourceUrls: [
      "https://developers.facebook.com/docs/graph-api/reference/page/feed/",
      "https://developers.facebook.com/docs/graph-api/overview/rate-limiting/",
      "https://developers.facebook.com/docs/graph-api/reference/page/",
    ],
  },
  youtube: {
    platform: "youtube",
    apiAvailable: true,
    accountEligibility: "A Google Cloud project with YouTube Data API enabled and a channel/account authorized for the requested operation.",
    authorization: "API key may read public data; OAuth 2.0 is required for private account data and insert/update/delete operations. Upload requires youtube.upload or a broader documented YouTube scope.",
    publishingConstraints: "Video upload is supported by videos.insert. The API's documented default quota includes 100 videos.insert calls/day; quota allocation and method costs must be checked in the active Google Cloud project.",
    quotaAndRateLimit: "Default allocation: 10,000 units/day for most methods, with separate 100/day buckets for search.list and videos.insert; quota may be changed by Google.",
    connectionStatus: "not-connected",
    livePublishingEnabled: false,
    sourceUrls: [
      "https://developers.google.com/youtube/data/guides/authentication",
      "https://developers.google.com/youtube/data/reference/rest/v3/videos/insert",
      "https://developers.google.com/youtube/data/determine_quota_cost",
    ],
  },
  x: {
    platform: "x",
    apiAvailable: true,
    accountEligibility: "An approved X developer account and project/app with access to the required API product/endpoints.",
    authorization: "User-context access token via OAuth 2.0 PKCE or OAuth 1.0a; posting requires user authorization with write capability.",
    publishingConstraints: "POST /2/tweets creates posts. Self-serve reply behavior has additional restrictions; API access tier and commercial terms must be checked in the developer console.",
    quotaAndRateLimit: "Endpoint and access-level rate limits apply; no universal quota or free allowance is assumed. Read current headers and developer-console limits.",
    connectionStatus: "not-connected",
    livePublishingEnabled: false,
    sourceUrls: [
      "https://docs.x.com/x-api/posts/manage-tweets/introduction",
      "https://docs.x.com/x-api/posts/manage-tweets/quickstart",
      "https://help.x.com/en/rules-and-policies/x-api",
    ],
  },
  tiktok: {
    platform: "tiktok",
    apiAvailable: true,
    accountEligibility: "Registered TikTok developer app with Content Posting API product enabled and a target creator account authorizing the app.",
    authorization: "Direct Post requires approved video.publish scope; draft upload requires approved video.upload scope.",
    publishingConstraints: "Direct Post supports authorized posting, but unaudited clients are restricted to private visibility until TikTok audits the client. Upload-to-inbox is a draft flow requiring the user to finish in TikTok.",
    quotaAndRateLimit: "TikTok documents a per-user access-token limit of 6 upload-init requests/minute for the upload endpoint; other endpoint limits must be checked individually.",
    connectionStatus: "not-connected",
    livePublishingEnabled: false,
    sourceUrls: [
      "https://developers.tiktok.com/docs/en/content-posting-api-get-started",
      "https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content",
      "https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video",
    ],
  },
} as const;

export function getSocialIntegrationReadiness(platform: SocialPlatform): SocialIntegrationReadiness {
  return SOCIAL_INTEGRATION_READINESS[platform];
}


export function buildPlatformCaption(input: {
  platform: SocialPlatform;
  hook?: string;
  body: string;
  callToAction?: string;
  hashtags?: string[];
}): { platform: SocialPlatform; text: string; structure: string[] } {
  if (!VALID_PLATFORMS.has(input.platform)) throw new Error("Unsupported social platform.");
  const hook = clean(input.hook, 500);
  const body = clean(input.body, 5000);
  const callToAction = clean(input.callToAction, 500);
  const hashtags = unique(Array.isArray(input.hashtags) ? input.hashtags : [], 80)
    .map((tag) => tag.startsWith("#") ? tag : `#${tag.replace(/[^\p{L}\p{N}_]/gu, "")}`)
    .filter((tag) => tag.length > 1);
  if (!body) throw new Error("Caption body is required.");

  const selectedHashtags = input.platform === "x" ? hashtags.slice(0, 2) : hashtags.slice(0, 8);
  const parts: string[] = [];
  if (input.platform === "instagram") {
    if (hook) parts.push(hook);
    parts.push(body);
    if (callToAction) parts.push(callToAction);
    if (selectedHashtags.length) parts.push(selectedHashtags.join(" "));
  } else if (input.platform === "facebook") {
    parts.push(body);
    if (callToAction) parts.push(callToAction);
    if (selectedHashtags.length) parts.push(selectedHashtags.slice(0, 3).join(" "));
  } else if (input.platform === "youtube") {
    if (hook) parts.push(hook);
    parts.push(body);
    if (callToAction) parts.push(callToAction);
    if (selectedHashtags.length) parts.push(selectedHashtags.join(" "));
  } else if (input.platform === "x") {
    parts.push([hook, body].filter(Boolean).join(" — "));
    if (callToAction) parts.push(callToAction);
    if (selectedHashtags.length) parts.push(selectedHashtags.join(" "));
  } else {
    if (hook) parts.push(hook);
    parts.push(body);
    if (callToAction) parts.push(callToAction);
    if (selectedHashtags.length) parts.push(selectedHashtags.join(" "));
  }

  return {
    platform: input.platform,
    text: parts.join("\n\n"),
    structure:
      input.platform === "instagram" ? ["hook", "caption", "call-to-action", "hashtags"] :
      input.platform === "facebook" ? ["community-copy", "call-to-action", "hashtags"] :
      input.platform === "youtube" ? ["description-hook", "description", "call-to-action", "hashtags"] :
      input.platform === "x" ? ["concise-post", "call-to-action", "limited-hashtags"] :
      ["video-hook", "short-caption", "call-to-action", "hashtags"],
  };
}

export function createSocialRepurposeBrief(input: {
  sourcePlatform: SocialPlatform;
  targetPlatforms: SocialPlatform[];
  topic: string;
  coreMessage: string;
  audience: string;
  observations: number;
  engagementRate: number;
  comparisonBaseline: number;
  periodStart: string;
  periodEnd: string;
  metricSource: string;
}) {
  const topic = clean(input.topic, 300);
  const coreMessage = clean(input.coreMessage, 2000);
  const audience = clean(input.audience, 300);
  const metricSource = clean(input.metricSource, 300);
  if (!topic || !coreMessage || !audience || !metricSource) throw new Error("Repurpose brief is missing required evidence or content.");
  if (!Number.isInteger(input.observations) || input.observations < 0 ||
      !Number.isFinite(input.engagementRate) || input.engagementRate < 0 ||
      !Number.isFinite(input.comparisonBaseline) || input.comparisonBaseline < 0) {
    throw new Error("Repurpose metrics must be finite, non-negative values.");
  }
  if (!validTimestamp(input.periodStart) || !validTimestamp(input.periodEnd) ||
      Date.parse(input.periodStart) > Date.parse(input.periodEnd)) {
    throw new Error("Repurpose evidence period is invalid.");
  }
  const eligible = input.observations >= 3 && input.engagementRate > input.comparisonBaseline;
  const targets = [...new Set((Array.isArray(input.targetPlatforms) ? input.targetPlatforms : [])
    .filter((platform) => VALID_PLATFORMS.has(platform) && platform !== input.sourcePlatform))];
  return {
    sourcePlatform: input.sourcePlatform,
    targetPlatforms: targets,
    topic,
    coreMessage,
    audience,
    status: eligible && targets.length ? "eligible-for-human-review" as const : "insufficient-evidence" as const,
    evidence: {
      observations: input.observations,
      engagementRate: input.engagementRate,
      comparisonBaseline: input.comparisonBaseline,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      metricSource,
    },
    interpretation: "Descriptive comparison only. This does not establish causation or guarantee similar performance on another platform.",
    requiresHumanReview: true as const,
    autoRepurpose: false as const,
  };
}


export interface SocialMetricSnapshot {
  platform: SocialPlatform;
  impressions?: number | null;
  engagements?: number | null;
  clicks?: number | null;
  followers?: number | null;
  publishedPosts?: number | null;
  collectedAt: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  metricDefinition: string;
}

function validNonNegativeMetric(value: number | null | undefined): boolean {
  return value === undefined || value === null || (Number.isFinite(value) && value >= 0);
}

export function createCrossPlatformSocialReport(input: {
  snapshots: SocialMetricSnapshot[];
  generatedAt: string;
  staleAfterHours?: number;
}) {
  if (!validTimestamp(input.generatedAt)) throw new Error("Report generation timestamp is invalid.");
  const staleAfterHours = input.staleAfterHours ?? 48;
  if (!Number.isFinite(staleAfterHours) || staleAfterHours < 1 || staleAfterHours > 24 * 30) {
    throw new Error("Staleness threshold must be between 1 hour and 30 days.");
  }
  const snapshots = Array.isArray(input.snapshots) ? input.snapshots : [];
  for (const snapshot of snapshots) {
    if (!VALID_PLATFORMS.has(snapshot.platform) ||
        !validTimestamp(snapshot.collectedAt) ||
        !validTimestamp(snapshot.periodStart) ||
        !validTimestamp(snapshot.periodEnd) ||
        Date.parse(snapshot.periodStart) > Date.parse(snapshot.periodEnd) ||
        Date.parse(snapshot.collectedAt) > Date.parse(input.generatedAt) ||
        !clean(snapshot.source, 300) || !clean(snapshot.metricDefinition, 500) ||
        ![snapshot.impressions, snapshot.engagements, snapshot.clicks, snapshot.followers, snapshot.publishedPosts].every(validNonNegativeMetric)) {
      throw new Error("Social metric snapshot contains invalid values or provenance.");
    }
    if (snapshot.engagements != null && snapshot.impressions == null) {
      throw new Error("Engagement rate requires an impressions denominator.");
    }
    if (snapshot.clicks != null && snapshot.impressions == null) {
      throw new Error("Click-through rate requires an impressions denominator.");
    }
  }

  const platforms = [...new Set(snapshots.map((snapshot) => snapshot.platform))];
  const summaries = platforms.map((platform) => {
    const rows = snapshots.filter((snapshot) => snapshot.platform === platform);
    const sum = (key: "impressions" | "engagements" | "clicks" | "followers" | "publishedPosts") => {
      const values = rows.map((row) => row[key]).filter((value): value is number => value != null);
      return values.length ? values.reduce((total, value) => total + value, 0) : null;
    };
    const impressions = sum("impressions");
    const engagements = sum("engagements");
    const clicks = sum("clicks");
    const latestCollectedAt = rows.map((row) => row.collectedAt).sort().at(-1)!;
    const ageHours = (Date.parse(input.generatedAt) - Date.parse(latestCollectedAt)) / 3_600_000;
    return {
      platform,
      snapshotCount: rows.length,
      impressions,
      engagements,
      clicks,
      followers: sum("followers"),
      publishedPosts: sum("publishedPosts"),
      engagementRate: impressions && engagements != null ? (engagements / impressions) * 100 : null,
      clickThroughRate: impressions && clicks != null ? (clicks / impressions) * 100 : null,
      latestCollectedAt,
      freshness: ageHours <= staleAfterHours ? "fresh" as const : "stale" as const,
      ageHours: Math.round(ageHours * 100) / 100,
      sources: [...new Set(rows.map((row) => clean(row.source, 300)))],
      metricDefinitions: [...new Set(rows.map((row) => clean(row.metricDefinition, 500)))],
    };
  });
  const uniqueDefinitions = [...new Set(snapshots.map((snapshot) => clean(snapshot.metricDefinition, 500)))];
  return {
    generatedAt: input.generatedAt,
    snapshotCount: snapshots.length,
    platforms: summaries,
    comparisonCaveat: uniqueDefinitions.length > 1
      ? "Metric definitions differ across supplied sources; cross-platform rates are not directly comparable until definitions are reconciled."
      : "Even with matching supplied definitions, platform-native measurement differences may remain; treat comparisons as directional.",
    missingDataPolicy: "Missing values remain null; they are never converted to zero.",
    sourcePolicy: "All metrics are caller-supplied snapshots. This function does not fetch or verify platform analytics.",
  };
}


export function evaluateSocialPublishingGate(input: {
  platform: SocialPlatform;
  draftStatus: SocialDraftStatus;
  approvedBy: string | null;
  serverApprovalVerified: boolean;
  providerConnectionVerified: boolean;
  providerAdapterConfigured: boolean;
  durableIdempotencyAvailable: boolean;
  mediaRequirementsVerified: boolean;
}) {
  const readiness = getSocialIntegrationReadiness(input.platform);
  const blockers: string[] = [];
  if (input.draftStatus !== "approved" && input.draftStatus !== "scheduled") blockers.push("draft-not-approved");
  if (!clean(input.approvedBy, 100)) blockers.push("approver-missing");
  if (!input.serverApprovalVerified) blockers.push("server-side-approval-not-verified");
  if (!input.providerConnectionVerified || readiness.connectionStatus !== "connected") blockers.push("provider-account-not-connected");
  if (!readiness.livePublishingEnabled) blockers.push("live-publishing-disabled");
  if (!input.providerAdapterConfigured) blockers.push("official-provider-adapter-not-configured");
  if (!input.durableIdempotencyAvailable) blockers.push("durable-idempotency-unavailable");
  if (!input.mediaRequirementsVerified) blockers.push("media-requirements-not-verified");
  return {
    allowed: blockers.length === 0,
    platform: input.platform,
    blockers,
    note: "Preflight only. This function does not publish content or authorize an external action.",
  };
}

export function classifySocialProviderFailure(input: {
  operation: "read" | "publish";
  statusCode?: number;
  providerCode?: string;
  message?: string;
  retryAfterSeconds?: number;
  durableIdempotencyConfirmed?: boolean;
}) {
  const status = input.statusCode;
  const classification =
    status === 401 ? "authentication" as const :
    status === 403 ? "permission" as const :
    status === 429 ? "rate-limited" as const :
    status !== undefined && status >= 400 && status < 500 ? "validation" as const :
    status !== undefined && status >= 500 ? "transient" as const :
    "unknown" as const;
  const retryAfterSeconds = input.retryAfterSeconds !== undefined &&
    Number.isFinite(input.retryAfterSeconds) &&
    input.retryAfterSeconds >= 0 &&
    input.retryAfterSeconds <= 86_400
      ? input.retryAfterSeconds
      : null;
  const retryableClass = classification === "rate-limited" || classification === "transient";
  const safeToRetry = retryableClass &&
    (input.operation === "read" || input.durableIdempotencyConfirmed === true);
  return {
    classification,
    statusCode: status ?? null,
    providerCode: clean(input.providerCode, 100) || null,
    message: clean(input.message, 500) || "Provider request failed.",
    retryAfterSeconds,
    safeToRetry,
    manualReconciliationRequired: input.operation === "publish" && retryableClass && !safeToRetry,
  };
}
