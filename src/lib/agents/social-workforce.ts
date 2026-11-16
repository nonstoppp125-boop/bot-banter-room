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
