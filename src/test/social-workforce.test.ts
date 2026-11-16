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
      targetPlatforms: ["youtube", "x"] as const,
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
