import { describe, expect, it } from "vitest";
import {
  buildLinkedInContentStrategy,
  createLinkedInContentCalendar,
  createMonthlyContentCalendar,
  createWeeklyContentCalendar,
  generateDailyPostIdeas,
  generateLinkedInHooks,
  generateLinkedInPostDraft,
  generateLinkedInStorytellingPost,
  generateLinkedInEducationalPost,
  generateLinkedInOpinionPost,
  generateLinkedInCaseStudy,
  createLinkedInCarouselOutline,
  createLinkedInDocumentOutline,
  generateLinkedInCallToActions,
  recommendLinkedInHashtags,
  recommendLinkedInKeywords,
  adaptLinkedInContentToAudience,
  preserveLinkedInBrandVoice,
  setLinkedInContentLanguage,
  repurposeLinkedInLongForm,
  generateLinkedInCampaignThemes,
  createLinkedInContentVariants,
  reviewLinkedInContent,
  LinkedInDraftVersionStore,
  LinkedInCalendarHistoryStore,
  defineLinkedInContentPillars,
  isLinkedInContentRequest,
  buildLinkedInContentWriterInstruction,
} from "../lib/agents/linkedin-content-studio";

const pillars = [
  {
    name: "Data Analytics",
    purpose: "Teach practical analysis",
    audienceNeed: "Learn data skills",
    topics: ["SQL basics", "Excel reporting"],
  },
  {
    name: "Career Learning",
    purpose: "Share learning progress",
    audienceNeed: "Career direction",
    topics: ["Portfolio projects", "Learning lessons"],
  },
];

const postInput = {
  topic: "SQL for beginners",
  audience: "New data analysts",
  keyPoints: ["Queries", "Filtering", "Grouping"],
  evidence: ["source-1"],
};

describe("LinkedIn AI writing integration brief", () => {
  it("detects LinkedIn content requests", () => {
    expect(isLinkedInContentRequest("Write a LinkedIn post about SQL")).toBe(true);
    expect(isLinkedInContentRequest("লিংকডইনে একটি পোস্ট লিখো")).toBe(true);
    expect(isLinkedInContentRequest("Explain SQL window functions")).toBe(false);
  });

  it("sets Bengali, Banglish and English writing requirements", () => {
    expect(buildLinkedInContentWriterInstruction("বাংলায় LinkedIn post লিখো")).toContain(
      "Bengali script",
    );
    expect(buildLinkedInContentWriterInstruction("Write a LinkedIn post in Banglish")).toContain(
      "Latin-script Banglish",
    );
    expect(buildLinkedInContentWriterInstruction("Write a LinkedIn post in English")).toContain(
      "natural English",
    );
  });

  it("requires complete, evidence-disciplined drafts without publishing", () => {
    const brief = buildLinkedInContentWriterInstruction("Write a LinkedIn post");
    expect(brief).toContain("complete, polished LinkedIn draft");
    expect(brief).toContain("Never invent credentials");
    expect(brief).toContain("Never publish");
  });
});

describe("LinkedIn Content Studio", () => {
  it("defines validated content pillars and a long-term strategy", () => {
    expect(defineLinkedInContentPillars(pillars)).toHaveLength(2);
    const strategy = buildLinkedInContentStrategy({
      audience: "Beginners",
      goal: "Build credibility",
      niche: "Analytics",
      pillars,
      language: "bn",
    });
    expect(strategy.pillars).toHaveLength(2);
    expect(strategy.language).toBe("bn");
  });

  it("creates bounded monthly, weekly and custom calendars", () => {
    expect(createMonthlyContentCalendar(2026, 11, pillars).length).toBeGreaterThan(0);
    expect(createWeeklyContentCalendar("2026-11-16", pillars)).toHaveLength(3);
    expect(
      createLinkedInContentCalendar({
        startDate: "2026-11-16",
        days: 7,
        pillars,
        postsPerWeek: 2,
      }),
    ).toHaveLength(2);
    expect(createWeeklyContentCalendar("invalid", pillars)).toEqual([]);
  });

  it("generates daily ideas and hooks", () => {
    expect(generateDailyPostIdeas(pillars)).toHaveLength(5);
    expect(generateLinkedInHooks("SQL")).toHaveLength(5);
  });

  it("creates professional, storytelling, educational, opinion and case-study drafts", () => {
    expect(generateLinkedInPostDraft(postInput).publicationStatus).toBe("draft-only");
    expect(generateLinkedInStorytellingPost(postInput).format).toBe("storytelling");
    expect(generateLinkedInEducationalPost(postInput).format).toBe("educational");
    expect(generateLinkedInOpinionPost(postInput).format).toBe("opinion");
    expect(generateLinkedInCaseStudy(postInput).format).toBe("case-study");
  });

  it("creates carousel and document outlines", () => {
    expect(createLinkedInCarouselOutline(postInput).length).toBeGreaterThan(2);
    expect(createLinkedInDocumentOutline(postInput).length).toBeGreaterThan(0);
  });

  it("recommends calls to action, hashtags and keywords", () => {
    expect(generateLinkedInCallToActions("learning")).toHaveLength(4);
    expect(recommendLinkedInHashtags(["Data Analytics"])[0]).toBe("#DataAnalytics");
    expect(recommendLinkedInKeywords(["SQL", "Excel"])).toEqual(["SQL", "Excel"]);
  });

  it("adapts audience, voice and language metadata", () => {
    const draft = generateLinkedInPostDraft(postInput);
    expect(adaptLinkedInContentToAudience(draft, "Students", ["Low confidence"]).audience).toBe(
      "Students",
    );
    expect(preserveLinkedInBrandVoice(draft, "Direct and friendly").voice).toBe(
      "Direct and friendly",
    );
    expect(setLinkedInContentLanguage(draft, "banglish").language).toBe("banglish");
  });

  it("repurposes long-form material and creates campaign themes and variants", () => {
    expect(repurposeLinkedInLongForm("Guide", ["Section A", "Section B"])).toHaveLength(3);
    expect(generateLinkedInCampaignThemes("Grow", pillars)).toHaveLength(2);
    expect(createLinkedInContentVariants(postInput)).toHaveLength(4);
  });

  it("reviews evidence, readability, duplication and brand alignment", () => {
    const draft = generateLinkedInPostDraft(postInput);
    const report = reviewLinkedInContent({
      draft,
      factualClaims: ["SQL supports data querying"],
      supportedClaims: [],
      brandThemes: ["Analytics", "SQL"],
      targetThemes: ["SQL"],
      previousDrafts: [],
    });
    expect(report.factualAccuracy.status).toBe("needs-review");
    expect(report.brandConsistency.matchedThemes).toEqual(["SQL"]);
    expect(report.engagementSuitability.status).toBe("basic-check-passed");
  });

  it("stores editable version history and supports preview and regeneration", () => {
    const store = new LinkedInDraftVersionStore();
    const first = store.save(
      "draft-1",
      generateLinkedInPostDraft(postInput),
      "2026-11-14T00:00:00.000Z",
    );
    const second = store.regenerate(
      "draft-1",
      { ...postInput, topic: "Advanced SQL" },
      "2026-11-15T00:00:00.000Z",
    );
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(store.getHistory("draft-1")).toHaveLength(2);
    expect(store.preview("draft-1", 1)?.version).toBe(1);
    expect(store.setStatus("draft-1", 2, "reviewed")?.status).toBe("reviewed");
  });

  it("does not mutate stored drafts through returned objects", () => {
    const store = new LinkedInDraftVersionStore();
    const saved = store.save("safe", generateLinkedInPostDraft(postInput));
    saved.draft.topic = "tampered";
    expect(store.preview("safe")?.draft.topic).toBe("SQL for beginners");
  });

  it("maintains versioned content calendar history", () => {
    const store = new LinkedInCalendarHistoryStore();
    const entries = createWeeklyContentCalendar("2026-11-16", pillars);
    const first = store.save("calendar-1", entries, "2026-11-14T00:00:00.000Z");
    const second = store.save("calendar-1", entries.slice(0, 2), "2026-11-15T00:00:00.000Z");

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(store.getHistory("calendar-1")).toHaveLength(2);
    expect(store.preview("calendar-1", 1)?.entries).toHaveLength(entries.length);
    expect(store.preview("calendar-1")?.version).toBe(2);

    const preview = store.preview("calendar-1");
    if (preview) preview.entries.length = 0;
    expect(store.preview("calendar-1")?.entries).toHaveLength(2);
  });
});
