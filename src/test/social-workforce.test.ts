import { describe, expect, it } from "vitest";
import {
  adaptSocialContent,
  createSocialCalendar,
  createSocialCampaignBrief,
  createSocialDraft,
  createSocialReplyDraft,
  createSocialVideoStoryboard,
  SocialDraftStore,
} from "@/lib/agents/social-workforce";

const draft = () => createSocialDraft({
  id: "social-1",
  platform: "instagram",
  format: "carousel",
  topic: "Beginner SQL",
  audience: "New analysts",
  objective: "Teach one practical SQL concept",
  caption: "A practical SQL lesson",
  createdAt: "2026-11-16T00:00:00.000Z",
});

describe("cross-platform social workforce foundations", () => {
  it("validates platform-specific formats and required fields", () => {
    expect(() => createSocialDraft({
      id: "bad",
      platform: "tiktok",
      format: "thread",
      topic: "topic",
      audience: "audience",
      objective: "goal",
    })).toThrow(/not supported/);
    expect(() => createSocialDraft({
      id: "bad",
      platform: "facebook",
      format: "post",
      topic: "",
      audience: "audience",
      objective: "goal",
    })).toThrow(/required/);
  });

  it("creates a unified weekday calendar across selected platforms", () => {
    const calendar = createSocialCalendar({
      startDate: "2026-11-16",
      days: 7,
      platforms: ["instagram", "youtube", "tiktok"],
      topics: ["SQL basics", "Portfolio projects"],
    });
    expect(calendar.length).toBeGreaterThan(0);
    expect(new Set(calendar.map((item) => item.platform))).toEqual(new Set(["instagram", "youtube", "tiktok"]));
    expect(calendar.every((item) => item.status === "planned")).toBe(true);
  });

  it("adapts a core message into platform-specific format briefs", () => {
    const variants = adaptSocialContent({
      topic: "Data storytelling",
      coreMessage: "Use evidence to explain business outcomes.",
      audience: "Small business owners",
      platforms: ["instagram", "youtube", "x", "tiktok"],
      evidence: ["source-1"],
    });
    expect(variants).toHaveLength(4);
    expect(variants.find((item) => item.platform === "youtube")?.format).toBe("short-video");
    expect(variants.find((item) => item.platform === "x")?.format).toBe("thread");
  });

  it("creates bounded video storyboards and campaign briefs", () => {
    const storyboard = createSocialVideoStoryboard({
      platform: "tiktok",
      title: "SQL in 30 seconds",
      scenes: [
        { visual: "Show a table", narration: "Start with a question", durationSeconds: 10 },
        { visual: "Show a query", narration: "Filter the data", durationSeconds: 15 },
      ],
    });
    expect(storyboard.totalDurationSeconds).toBe(25);
    expect(storyboard.status).toBe("creative-brief-only");
    const campaign = createSocialCampaignBrief({
      name: "SQL basics",
      objective: "Teach beginners",
      audience: "New analysts",
      keyMessage: "Learn one SQL skill at a time",
      platforms: ["instagram", "youtube"],
      callToAction: "Try a query",
      kpis: ["Saves", "Video completion"],
    });
    expect(campaign.status).toBe("planning-only");
  });

  it("requires approval before schedule and preserves version history", () => {
    const store = new SocialDraftStore();
    store.create(draft());
    expect(() => store.schedule("social-1", "2026-11-18T10:00:00.000Z", "owner", "2026-11-16T00:00:00.000Z")).toThrow(/approved/);
    store.submitForApproval("social-1", "owner", "2026-11-16T00:01:00.000Z");
    store.approve("social-1", "owner", "2026-11-16T00:02:00.000Z");
    store.schedule("social-1", "2026-11-18T10:00:00.000Z", "owner", "2026-11-16T00:03:00.000Z");
    expect(store.getHistory("social-1")).toHaveLength(4);
    expect(store.get("social-1")?.status).toBe("scheduled");
  });

  it("creates reply drafts without sending", () => {
    const reply = createSocialReplyDraft({
      platform: "facebook",
      targetId: "post-1",
      reply: "Thanks for sharing.",
      actor: "owner",
    });
    expect(reply.status).toBe("pending_approval");
    expect(reply.note).toContain("No comment");
  });
});


describe("official social API feasibility registry", () => {
  it("documents all five official platform APIs without claiming live connections", async () => {
    const { SOCIAL_INTEGRATION_READINESS, getSocialIntegrationReadiness } = await import("@/lib/agents/social-workforce");
    expect(Object.keys(SOCIAL_INTEGRATION_READINESS).sort()).toEqual(["facebook", "instagram", "tiktok", "x", "youtube"]);
    for (const platform of Object.keys(SOCIAL_INTEGRATION_READINESS) as Array<keyof typeof SOCIAL_INTEGRATION_READINESS>) {
      const readiness = getSocialIntegrationReadiness(platform);
      expect(readiness.apiAvailable).toBe(true);
      expect(readiness.connectionStatus).toBe("not-connected");
      expect(readiness.livePublishingEnabled).toBe(false);
      expect(readiness.sourceUrls.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("records platform-specific approval and account constraints", async () => {
    const { SOCIAL_INTEGRATION_READINESS } = await import("@/lib/agents/social-workforce");
    expect(SOCIAL_INTEGRATION_READINESS.instagram.accountEligibility).toContain("Professional");
    expect(SOCIAL_INTEGRATION_READINESS.facebook.authorization).toContain("pages_manage_posts");
    expect(SOCIAL_INTEGRATION_READINESS.youtube.authorization).toContain("OAuth 2.0");
    expect(SOCIAL_INTEGRATION_READINESS.x.authorization).toContain("OAuth");
    expect(SOCIAL_INTEGRATION_READINESS.tiktok.publishingConstraints).toContain("private visibility");
  });
});


describe("platform captions and evidence-gated repurposing", () => {
  it("formats captions with platform-specific structure and bounded hashtags", async () => {
    const { buildPlatformCaption } = await import("@/lib/agents/social-workforce");
    const instagram = buildPlatformCaption({
      platform: "instagram",
      hook: "Learn SQL faster",
      body: "One query at a time.",
      callToAction: "Save this lesson.",
      hashtags: ["sql", "#analytics", "data", "sql"],
    });
    expect(instagram.structure).toContain("hook");
    expect(instagram.text).toContain("#sql");
    const x = buildPlatformCaption({
      platform: "x",
      body: "A concise data lesson.",
      hashtags: ["sql", "analytics", "business", "data"],
    });
    expect(x.text.match(/#/g)?.length).toBe(2);
    expect(() => buildPlatformCaption({ platform: "youtube", body: "  " })).toThrow(/required/);
  });

  it("requires a minimum evidence sample and labels repurposing as review-only", async () => {
    const { createSocialRepurposeBrief } = await import("@/lib/agents/social-workforce");
    const base = {
      sourcePlatform: "instagram" as const,
      targetPlatforms: ["youtube", "x"],
      topic: "SQL basics",
      coreMessage: "Teach one query pattern.",
      audience: "New analysts",
      engagementRate: 0.08,
      comparisonBaseline: 0.05,
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-31T23:59:59.000Z",
      metricSource: "owner-supplied monthly report",
    };
    expect(createSocialRepurposeBrief({ ...base, observations: 2 }).status).toBe("insufficient-evidence");
    const eligible = createSocialRepurposeBrief({ ...base, observations: 5 });
    expect(eligible.status).toBe("eligible-for-human-review");
    expect(eligible.autoRepurpose).toBe(false);
    expect(eligible.interpretation).toContain("does not establish causation");
  });
});


describe("cross-platform social analytics normalization", () => {
  it("aggregates supplied metrics with weighted rates and provenance", async () => {
    const { createCrossPlatformSocialReport } = await import("@/lib/agents/social-workforce");
    const report = createCrossPlatformSocialReport({
      generatedAt: "2026-11-16T12:00:00.000Z",
      snapshots: [
        {
          platform: "instagram",
          impressions: 1000,
          engagements: 100,
          clicks: 20,
          followers: 500,
          publishedPosts: 4,
          collectedAt: "2026-11-16T10:00:00.000Z",
          periodStart: "2026-11-01T00:00:00.000Z",
          periodEnd: "2026-11-15T23:59:59.000Z",
          source: "owner-export",
          metricDefinition: "engagements / impressions",
        },
        {
          platform: "instagram",
          impressions: 500,
          engagements: 25,
          clicks: 5,
          collectedAt: "2026-11-16T11:00:00.000Z",
          periodStart: "2026-11-01T00:00:00.000Z",
          periodEnd: "2026-11-15T23:59:59.000Z",
          source: "owner-export",
          metricDefinition: "engagements / impressions",
        },
      ],
    });
    expect(report.platforms[0]?.engagementRate).toBeCloseTo(8.3333, 3);
    expect(report.platforms[0]?.clickThroughRate).toBeCloseTo(1.6667, 3);
    expect(report.platforms[0]?.freshness).toBe("fresh");
    expect(report.platforms[0]?.impressions).toBe(1500);
  });

  it("preserves missing metrics as null and marks stale snapshots", async () => {
    const { createCrossPlatformSocialReport } = await import("@/lib/agents/social-workforce");
    const report = createCrossPlatformSocialReport({
      generatedAt: "2026-11-16T12:00:00.000Z",
      staleAfterHours: 24,
      snapshots: [{
        platform: "youtube",
        collectedAt: "2026-11-14T00:00:00.000Z",
        periodStart: "2026-11-01T00:00:00.000Z",
        periodEnd: "2026-11-10T00:00:00.000Z",
        source: "manual-csv",
        metricDefinition: "YouTube Analytics export",
      }],
    });
    expect(report.platforms[0]?.impressions).toBeNull();
    expect(report.platforms[0]?.engagementRate).toBeNull();
    expect(report.platforms[0]?.freshness).toBe("stale");
  });

  it("rejects invalid metric denominators and future collection timestamps", async () => {
    const { createCrossPlatformSocialReport } = await import("@/lib/agents/social-workforce");
    const base = {
      platform: "x" as const,
      periodStart: "2026-11-01T00:00:00.000Z",
      periodEnd: "2026-11-10T00:00:00.000Z",
      source: "manual",
      metricDefinition: "engagements / impressions",
    };
    expect(() => createCrossPlatformSocialReport({
      generatedAt: "2026-11-16T12:00:00.000Z",
      snapshots: [{ ...base, collectedAt: "2026-11-16T11:00:00.000Z", engagements: 10 }],
    })).toThrow(/denominator/);
    expect(() => createCrossPlatformSocialReport({
      generatedAt: "2026-11-16T12:00:00.000Z",
      snapshots: [{ ...base, collectedAt: "2026-11-17T11:00:00.000Z" }],
    })).toThrow(/invalid/);
  });
});
