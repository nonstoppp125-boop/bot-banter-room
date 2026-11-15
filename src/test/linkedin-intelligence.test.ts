import { describe, expect, it } from "vitest";
import {
  analyzeLinkedInProfile,
  draftLinkedInProfileImprovements,
  reviewLinkedInAbout,
  reviewLinkedInExperience,
  reviewLinkedInHeadline,
  reviewLinkedInSkills,
} from "../lib/agents/linkedin-intelligence";

describe("LinkedIn profile intelligence", () => {
  it("scores only supplied profile sections", () => {
    const result = analyzeLinkedInProfile({
      headline: "Junior Data Analyst | SQL and Excel",
      about: "A".repeat(150),
      skills: ["SQL", "Excel"],
      location: "Chattogram",
    });

    expect(result.completedSections).toBe(4);
    expect(result.totalSections).toBe(6);
    expect(result.completenessScore).toBe(67);
  });

  it("does not invent missing profile information", () => {
    const result = analyzeLinkedInProfile({});
    expect(result.completenessScore).toBe(0);
    expect(result.findings.some((item) => item.severity === "critical")).toBe(true);
  });

  it("reviews headline length without claiming account access", () => {
    expect(reviewLinkedInHeadline("")).toHaveLength(1);
    expect(reviewLinkedInHeadline("Analyst")).toHaveLength(1);
    expect(
      reviewLinkedInHeadline(
        "Experienced professional focused on data analysis and business insights",
      ),
    ).toHaveLength(1);
  });

  it("flags short About sections", () => {
    expect(reviewLinkedInAbout("Short summary")[0]?.severity).toBe("warning");
    expect(reviewLinkedInAbout("A".repeat(200))[0]?.severity).toBe("info");
  });

  it("reviews missing experience fields", () => {
    const results = reviewLinkedInExperience([
      { title: "Analyst" },
      { title: "Intern", company: "Example", description: "Prepared reports." },
    ]);
    expect(results[0]?.severity).toBe("warning");
    expect(results[1]?.severity).toBe("info");
  });

  it("deduplicates skills for analysis", () => {
    const result = reviewLinkedInSkills(["SQL", "sql", "Excel"]);
    expect(result[0]?.message).toContain("2 unique skills");
    expect(result[0]?.message).toContain("1 duplicates");
  });

  it("creates improvement guidance from supplied facts only", () => {
    const drafts = draftLinkedInProfileImprovements({
      headline: "Junior Analyst",
      experience: [{ title: "Intern", company: "Example" }],
      skills: ["Excel", "SQL"],
    });
    expect(drafts).toHaveLength(4);
    expect(drafts[0]?.currentText).toBe("Junior Analyst");
    expect(drafts[1]?.currentText).toBe("");
    expect(drafts[2]?.currentText).toContain("Intern");
    expect(drafts[3]?.currentText).toBe("Excel, SQL");
    expect(drafts.every((draft) => !draft.draftText)).toBe(true);
  });

  it("builds positioning from supplied evidence only", async () => {
    const { buildLinkedInPositioningBrief } = await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInPositioningBrief({
      currentRole: "Student",
      targetRole: "Junior Data Analyst",
      industry: "Data Analytics",
      strengths: ["SQL", "Excel", "SQL"],
      targetAudience: "Small business owners",
      evidence: ["Completed a sales analysis project"],
    });

    expect(result.positioningStatement).toContain("Junior Data Analyst");
    expect(result.professionalNiche).toContain("Data Analytics");
    expect(result.verifiedStrengths).toEqual(["SQL", "Excel"]);
    expect(result.missingInformation).toEqual([]);
  });

  it("does not invent a professional niche from incomplete data", async () => {
    const { buildLinkedInPositioningBrief } = await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInPositioningBrief({});

    expect(result.positioningStatement).toBeNull();
    expect(result.professionalNiche).toBeNull();
    expect(result.missingInformation.length).toBeGreaterThan(0);
  });

  it("creates audience personas only from supplied goals and challenges", async () => {
    const { createLinkedInAudiencePersona } = await import("../lib/agents/linkedin-intelligence");
    const result = createLinkedInAudiencePersona({
      audienceName: "Small business owners",
      professionalContext: "Owners managing sales data",
      goals: ["Understand monthly sales"],
      challenges: ["Limited reporting skills"],
      evidence: ["User interview notes"],
    });

    expect(result.goals).toContain("Understand monthly sales");
    expect(result.challenges).toContain("Limited reporting skills");
    expect(result.researchRequired).toEqual([]);
  });

  it("flags unsupported audience assumptions", async () => {
    const { createLinkedInAudiencePersona } = await import("../lib/agents/linkedin-intelligence");
    const result = createLinkedInAudiencePersona({
      audienceName: "Potential clients",
      professionalContext: "Unknown",
      goals: [],
      challenges: [],
    });

    expect(result.researchRequired).toHaveLength(3);
  });

  it("builds competitor research only from supplied source evidence", async () => {
    const { buildLinkedInMarketResearchBrief } =
      await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInMarketResearchBrief({
      evidence: [
        {
          id: "src-1",
          title: "Public competitor content review",
          publisher: "Example Publisher",
          url: "https://example.com/research",
          content: "A supplied evidence excerpt",
        },
      ],
      competitorObservations: [
        {
          competitorName: "Example Company",
          observation: "Publishes weekly educational posts",
          sourceIds: ["src-1"],
        },
      ],
      industryTrends: [],
      contentOpportunities: [],
    });

    expect(result.competitorFindings).toHaveLength(1);
    expect(result.competitorFindings[0]!.verifiedSourceIds).toEqual(["src-1"]);
  });

  it("rejects competitor findings without valid source evidence", async () => {
    const { buildLinkedInMarketResearchBrief } =
      await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInMarketResearchBrief({
      evidence: [],
      competitorObservations: [
        {
          competitorName: "Unknown Company",
          observation: "Unverified claim",
          sourceIds: ["missing-source"],
        },
      ],
      industryTrends: [],
      contentOpportunities: [],
    });

    expect(result.competitorFindings).toHaveLength(0);
    expect(result.excludedItems).toBe(1);
  });

  it("keeps industry trends traceable to supplied sources", async () => {
    const { buildLinkedInMarketResearchBrief } =
      await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInMarketResearchBrief({
      evidence: [
        {
          id: "trend-1",
          title: "Industry report",
          content: "Supplied report excerpt",
        },
      ],
      competitorObservations: [],
      industryTrends: [
        { trend: "Growing demand for data storytelling", sourceIds: ["trend-1"] },
        { trend: "Unsupported trend", sourceIds: ["unknown"] },
      ],
      contentOpportunities: [],
    });

    expect(result.industryTrends).toHaveLength(1);
    expect(result.industryTrends[0]!.verifiedSourceIds).toEqual(["trend-1"]);
  });

  it("excludes content opportunities without traceable evidence", async () => {
    const { buildLinkedInMarketResearchBrief } =
      await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInMarketResearchBrief({
      evidence: [
        {
          id: "aud-1",
          title: "Audience research",
          content: "Supplied audience research excerpt",
        },
      ],
      competitorObservations: [],
      industryTrends: [],
      contentOpportunities: [
        {
          opportunity: "Create beginner SQL explainers",
          audienceNeed: "Learn practical SQL",
          sourceIds: ["aud-1"],
        },
        {
          opportunity: "Invented opportunity",
          audienceNeed: "Unknown need",
          sourceIds: ["missing"],
        },
      ],
    });

    expect(result.contentOpportunities).toHaveLength(1);
    expect(result.excludedItems).toBe(1);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("compares profile and content themes without semantic assumptions", async () => {
    const { reviewLinkedInBrandConsistency } = await import("../lib/agents/linkedin-intelligence");
    const result = reviewLinkedInBrandConsistency({
      profileThemes: ["Data Analytics", "SQL"],
      contentThemes: ["SQL", "Excel"],
    });

    expect(result.matchedThemes).toEqual(["SQL"]);
    expect(result.profileOnlyThemes).toEqual(["Data Analytics"]);
    expect(result.contentOnlyThemes).toEqual(["Excel"]);
    expect(result.consistencyScore).toBe(33);
  });

  it("calculates performance only from supplied metrics", async () => {
    const { buildLinkedInPerformanceReport } = await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInPerformanceReport({
      impressions: 1000,
      reactions: 80,
      comments: 10,
      shares: 10,
      clicks: 50,
      followersGained: 5,
      postCount: 4,
    });

    expect(result.metrics.impressions).toBe(1000);
    expect(result.engagementRatePercent).toBe(10);
  });

  it("does not calculate engagement rate without impressions", async () => {
    const { buildLinkedInPerformanceReport } = await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInPerformanceReport({
      reactions: 20,
      comments: 3,
    });

    expect(result.engagementRatePercent).toBeNull();
    expect(result.metrics.impressions).toBe(0);
  });

  it("builds a dashboard with explicit unavailable sections", async () => {
    const { buildLinkedInIntelligenceDashboard } =
      await import("../lib/agents/linkedin-intelligence");
    const result = buildLinkedInIntelligenceDashboard({});

    expect(result.sections).toHaveLength(4);
    expect(result.sections.every((section) => section.status === "unavailable")).toBe(true);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
