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
