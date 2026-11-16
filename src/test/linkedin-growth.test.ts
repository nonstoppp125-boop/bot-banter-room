import { describe, expect, it, vi } from "vitest";
import {
  InMemoryLinkedInGrowthStore,
  approveLinkedInDraft,
  approveLinkedInReply,
  buildLinkedInGrowthDashboard,
  buildLinkedInHistoricalInsights,
  buildLinkedInContentRecommendations,
  buildLinkedInPerformanceSummary,
  buildLinkedInMonthlyReport,
  buildLinkedInWeeklyReport,
  createEvidenceLinkedProspect,
  createLinkedInGrowthDraft,
  createLinkedInReplyApproval,
  getLinkedInConnectionDiagnostics,
  normalizeLinkedInMetrics,
  publishApprovedLinkedInDraft,
  rejectLinkedInDraft,
  reviseLinkedInDraft,
  saveLinkedInDraft,
  scheduleApprovedLinkedInDraft,
  submitLinkedInDraftForApproval,
} from "../lib/agents/linkedin-growth";
import { hashApprovalPayload } from "../lib/agents/approval-store";

const now = "2026-11-14T10:00:00.000Z";

function readyDraft(store: InMemoryLinkedInGrowthStore, id = "draft-1") {
  const draft = createLinkedInGrowthDraft({
    id,
    content: "A useful LinkedIn post",
    actor: "author",
    now,
  });
  saveLinkedInDraft(store, draft, "author");
  submitLinkedInDraftForApproval(store, id, "author", now);
  return approveLinkedInDraft(store, id, "owner", now);
}


async function approvalContext(store:InMemoryLinkedInGrowthStore,draftId="draft-1"){
 const draft=store.getDraft(draftId)!;
 const payloadHash=await hashApprovalPayload({platform:"linkedin",draftId:draft.id,content:draft.content});
 const approval={id:"approval-"+draftId,workspaceId:"ws1",userId:"author",actionType:"social.publish" as const,payloadHash,status:"approved" as const,decidedByUserId:"owner",decisionReason:"approved",expiresAt:"2026-11-17T10:00:00.000Z",createdAt:"2026-11-14T09:00:00.000Z",decidedAt:"2026-11-14T10:00:00.000Z"};
 return {approvalStore:{get:async(input:{id:string;workspaceId:string;actorUserId:string})=>input.id===approval.id&&input.workspaceId==="ws1"&&input.actorUserId==="owner"?approval:null},approvalId:approval.id,workspaceId:"ws1",approverUserId:"owner"};
}

describe("LinkedIn Growth workflow", () => {
  it("creates a draft and records an audit event", () => {
    const store = new InMemoryLinkedInGrowthStore();
    const draft = createLinkedInGrowthDraft({
      id: "draft-1",
      content: "Post body",
      actor: "author",
      now,
    });
    saveLinkedInDraft(store, draft, "author");
    expect(store.getDraft("draft-1")?.status).toBe("draft");
    expect(store.listAudit("draft-1")).toHaveLength(1);
  });

  it("requires approval submission before approval", () => {
    const store = new InMemoryLinkedInGrowthStore();
    const draft = createLinkedInGrowthDraft({
      id: "draft-2",
      content: "Post body",
      actor: "author",
      now,
    });
    saveLinkedInDraft(store, draft, "author");
    expect(() => approveLinkedInDraft(store, draft.id, "owner", now)).toThrow(/awaiting approval/i);
  });

  it("supports rejection and revision as a new version", () => {
    const store = new InMemoryLinkedInGrowthStore();
    const draft = createLinkedInGrowthDraft({
      id: "draft-3",
      content: "Original",
      actor: "author",
      now,
    });
    saveLinkedInDraft(store, draft, "author");
    submitLinkedInDraftForApproval(store, draft.id, "author", now);
    rejectLinkedInDraft(store, draft.id, "owner", "Add evidence", now);
    const revised = reviseLinkedInDraft(store, draft.id, "Revised with evidence", "author", now);
    expect(revised.version).toBe(4);
    expect(revised.status).toBe("draft");
    expect(revised.approvedBy).toBeNull();
  });

  it("schedules only approved drafts for a future ISO timestamp", async () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    expect(() => scheduleApprovedLinkedInDraft(store, "draft-1", now, "owner", now)).toThrow(
      /future/i,
    );
    const scheduled = scheduleApprovedLinkedInDraft(
      store,
      "draft-1",
      "2026-11-15T10:00:00.000Z",
      "owner",
      now,
    );
    expect(scheduled.status).toBe("scheduled");
    const publish = vi.fn(async () => ({ publicationId: "post-1" }));
    await expect(
      publishApprovedLinkedInDraft({
        ...await approvalContext(store),
        store,
        draftId: "draft-1",
        actor: "owner",
        now,
        apiConfigured: true,
        officialApiPermissionGranted: true,
        durableActionStore: { claim: vi.fn(async () => true) },
        publisher: { publish },
      }),
    ).rejects.toThrow(/scheduled publication time/i);
    expect(publish).not.toHaveBeenCalled();
  });

  it("fails closed when official API permission is missing", async () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    const publish = vi.fn(async () => ({ publicationId: "post-1" }));
    await expect(
      publishApprovedLinkedInDraft({
        ...await approvalContext(store),
        store,
        draftId: "draft-1",
        actor: "owner",
        now,
        apiConfigured: true,
        officialApiPermissionGranted: false,
        durableActionStore: { claim: vi.fn(async () => true) },
        publisher: { publish },
      }),
    ).rejects.toThrow(/permission/i);
    expect(publish).not.toHaveBeenCalled();
  });

  it("fails closed without a durable action store or publisher", async () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    const base = {
      store,
      draftId: "draft-1",
      actor: "owner",
      now,
      apiConfigured: true,
      officialApiPermissionGranted: true,
      publisher: { publish: vi.fn(async () => ({ publicationId: "p1" })) },
    };
    await expect(
      publishApprovedLinkedInDraft({ ...base, durableActionStore: null }),
    ).rejects.toThrow(/durable/i);
    await expect(
      publishApprovedLinkedInDraft({
        ...base,
        durableActionStore: { claim: vi.fn(async () => true) },
        publisher: null,
      }),
    ).rejects.toThrow(/permission/i);
  });

  it("claims durable idempotency before invoking the publisher", async () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    const order: string[] = [];
    const publisher = {
      publish: vi.fn(async () => {
        order.push("publish");
        return { publicationId: "linkedin-post-123" };
      }),
    };
    const result = await publishApprovedLinkedInDraft({
        ...await approvalContext(store),
        store,
      draftId: "draft-1",
      actor: "owner",
      now,
      apiConfigured: true,
      officialApiPermissionGranted: true,
      durableActionStore: {
        claim: vi.fn(async () => {
          order.push("claim");
          return true;
        }),
      },
      publisher,
    });
    expect(order).toEqual(["claim", "publish"]);
    expect(result.status).toBe("published");
    expect(result.publicationId).toBe("linkedin-post-123");
  });

  it("rejects duplicate publication claims before publishing", async () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    const publisher = { publish: vi.fn(async () => ({ publicationId: "p1" })) };
    await expect(
      publishApprovedLinkedInDraft({
        ...await approvalContext(store),
        store,
        draftId: "draft-1",
        actor: "owner",
        now,
        apiConfigured: true,
        officialApiPermissionGranted: true,
        durableActionStore: { claim: vi.fn(async () => false) },
        publisher,
      }),
    ).rejects.toThrow(/duplicate/i);
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(store.getDraft("draft-1")?.status).toBe("failed");
  });

  it("records publisher failures without automatic retry", async () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    await expect(
      publishApprovedLinkedInDraft({
        ...await approvalContext(store),
        store,
        draftId: "draft-1",
        actor: "owner",
        now,
        apiConfigured: true,
        officialApiPermissionGranted: true,
        durableActionStore: { claim: vi.fn(async () => true) },
        publisher: {
          publish: async () => {
            throw new Error("Provider unavailable");
          },
        },
      }),
    ).rejects.toThrow(/provider unavailable/i);
    expect(store.getDraft("draft-1")?.status).toBe("failed");
    expect(store.getDraft("draft-1")?.failureReason).toContain("Provider unavailable");
  });

  it("does not silently treat missing analytics as zero", () => {
    const metrics = normalizeLinkedInMetrics({
      postId: "post-1",
      capturedAt: now,
      impressions: 100,
      reactions: 5,
      shares: 1,
    });
    expect(metrics.impressions).toBe(100);
    expect(metrics.comments).toBeNull();
    expect(metrics.engagementRatePercent).toBeNull();
    expect(() =>
      normalizeLinkedInMetrics({
        postId: "post-2",
        capturedAt: "not-a-date",
      }),
    ).toThrow(/valid ISO timestamp/i);
  });

  it("calculates engagement and groups campaign/pillar metrics", () => {
    const report = buildLinkedInPerformanceSummary(
      [
        {
          postId: "p1",
          capturedAt: now,
          publishedAt: now,
          impressions: 100,
          reactions: 5,
          comments: 3,
          shares: 2,
          campaign: "Launch",
          pillar: "Education",
        },
      ],
      "weekly",
      now,
    );
    expect(report.engagementRatePercent).toBe(10);
    expect(report.postCount).toBe(1);
    expect(report.reportWindow.basis).toBe("publishedAt");
    expect(report.byCampaign).toEqual([
      {
        name: "Launch",
        postCount: 1,
        impressions: 100,
        reach: null,
        reactions: 5,
        comments: 3,
        shares: 2,
        clicks: null,
        followersGained: null,
        engagementRatePercent: 10,
      },
    ]);
    expect(report.byContentPillar[0]).toMatchObject({
      name: "Education",
      postCount: 1,
      impressions: 100,
      engagementRatePercent: 10,
    });
  });

  it("aggregates campaign KPIs without treating missing metrics as zero", () => {
    const report = buildLinkedInPerformanceSummary(
      [
        {
          postId: "campaign-1",
          publishedAt: now,
          capturedAt: now,
          campaign: "Launch",
          impressions: 100,
          reactions: 5,
          comments: 3,
          shares: 2,
          clicks: 4,
          followersGained: 1,
        },
        {
          postId: "campaign-2",
          publishedAt: now,
          capturedAt: now,
          campaign: "Launch",
          impressions: 200,
          reactions: 10,
          comments: 4,
          shares: 6,
          clicks: 8,
          followersGained: 2,
        },
        {
          postId: "campaign-3",
          publishedAt: now,
          capturedAt: now,
          campaign: "Incomplete",
          impressions: 50,
        },
      ],
      "weekly",
      now,
    );

    expect(report.byCampaign).toEqual([
      {
        name: "Launch",
        postCount: 2,
        impressions: 300,
        reach: null,
        reactions: 15,
        comments: 7,
        shares: 8,
        clicks: 12,
        followersGained: 3,
        engagementRatePercent: 10,
      },
      {
        name: "Incomplete",
        postCount: 1,
        impressions: 50,
        reach: null,
        reactions: null,
        comments: null,
        shares: null,
        clicks: null,
        followersGained: null,
        engagementRatePercent: null,
      },
    ]);
  });

  it("filters reports by publication date and uses only the latest snapshot per post", () => {
    const report = buildLinkedInPerformanceSummary(
      [
        {
          postId: "inside",
          publishedAt: now,
          capturedAt: "2026-11-13T10:00:00.000Z",
          impressions: 50,
          reactions: 2,
          comments: 1,
          shares: 1,
        },
        {
          postId: "inside",
          publishedAt: now,
          capturedAt: now,
          impressions: 100,
          reactions: 5,
          comments: 3,
          shares: 2,
        },
        {
          postId: "missing-date",
          capturedAt: now,
          impressions: 999,
        },
        {
          postId: "outside",
          publishedAt: "2020-01-01T00:00:00.000Z",
          capturedAt: now,
          impressions: 999,
        },
      ],
      "weekly",
      now,
    );

    expect(report.postCount).toBe(1);
    expect(report.metrics.impressions).toBe(100);
    expect(report.excludedRecords).toEqual({
      missingOrInvalidPublishedAt: 1,
      outsideReportWindow: 1,
    });
  });

  it("groups posting-time performance by UTC publication hour", () => {
    const report = buildLinkedInPerformanceSummary(
      [
        {
          postId: "morning-1",
          publishedAt: "2026-11-14T09:15:00.000Z",
          capturedAt: "2026-11-14T23:00:00.000Z",
          impressions: 100,
        },
        {
          postId: "morning-2",
          publishedAt: "2026-11-14T09:45:00.000Z",
          capturedAt: "2026-11-14T23:00:00.000Z",
          impressions: 200,
        },
        {
          postId: "evening-1",
          publishedAt: "2026-11-14T17:00:00.000Z",
          capturedAt: "2026-11-14T23:00:00.000Z",
          impressions: 50,
        },
      ],
      "weekly",
      "2026-11-14T23:59:59.000Z",
    );

    expect(report.byPostingHourUtc).toEqual([
      { hourUtc: "09:00", postCount: 2, impressions: 300 },
      { hourUtc: "17:00", postCount: 1, impressions: 50 },
    ]);
  });

  it("does not report posting-hour impressions as zero when data is incomplete", () => {
    const report = buildLinkedInPerformanceSummary(
      [
        {
          postId: "known",
          publishedAt: "2026-11-14T09:15:00.000Z",
          capturedAt: "2026-11-14T23:00:00.000Z",
          impressions: 100,
        },
        {
          postId: "unknown",
          publishedAt: "2026-11-14T09:45:00.000Z",
          capturedAt: "2026-11-14T23:00:00.000Z",
        },
      ],
      "weekly",
      "2026-11-14T23:59:59.000Z",
    );

    expect(report.byPostingHourUtc).toEqual([
      { hourUtc: "09:00", postCount: 2, impressions: null },
    ]);
  });

  it("keeps connection diagnostics unavailable until every permission check passes", () => {
    const result = getLinkedInConnectionDiagnostics({
      clientIdConfigured: true,
      accessTokenConfigured: true,
      organizationOrMemberPermission: true,
      publishingPermission: true,
      analyticsPermission: false,
      apiVersionConfigured: true,
    });
    expect(result.status).toBe("unavailable");
    expect(result.canPublish).toBe(true);
    expect(result.canReadAnalytics).toBe(false);
    expect(result.missing).toContain("analytics permission");
  });

  it("requires evidence and HTTPS sources for prospect research", () => {
    expect(() =>
      createEvidenceLinkedProspect({
        id: "lead-1",
        name: "Example",
        relevance: "Relevant audience",
        evidence: [],
      }),
    ).toThrow(/evidence/i);

    expect(() =>
      createEvidenceLinkedProspect({
        id: "lead-2",
        name: "Example",
        relevance: "Relevant audience",
        evidence: [
          {
            sourceId: "source-1",
            sourceUrl: "http://example.com",
            observedAt: now,
            summary: "Public evidence",
          },
        ],
      }),
    ).toThrow(/https/i);
  });

  it("creates follow-up drafts but never sends outreach", () => {
    const prospect = createEvidenceLinkedProspect({
      id: "lead-3",
      name: "Example",
      organization: "Example Inc",
      relevance: "Relevant to analytics",
      evidence: [
        {
          sourceId: "source-2",
          sourceUrl: "https://example.com/profile",
          observedAt: now,
          summary: "Publicly supplied source summary",
        },
      ],
      followUpDraft: "Hello, I enjoyed your recent work.",
    });
    expect(prospect.status).toBe("follow_up_pending_approval");
    expect(prospect.evidence).toHaveLength(1);
  });

  it("requires explicit approval for engagement replies", () => {
    const reply = createLinkedInReplyApproval({
      postId: "post-1",
      replyDraft: "Thanks for sharing.",
      actor: "assistant",
    });
    expect(reply.status).toBe("pending_approval");
    expect(approveLinkedInReply(reply, "owner", now).status).toBe("approved");
  });

  it("builds a dedicated seven-day weekly report", () => {
    const inside = {
      postId: "weekly-post",
      publishedAt: "2026-11-10T10:00:00.000Z",
      capturedAt: now,
      impressions: 120,
      reactions: 8,
      comments: 2,
      shares: 1,
    };
    const outside = {
      postId: "older-post",
      publishedAt: "2026-11-07T09:59:59.999Z",
      capturedAt: now,
      impressions: 900,
      reactions: 20,
      comments: 5,
      shares: 3,
    };

    const report = buildLinkedInWeeklyReport([inside, outside], now);

    expect(report.period).toBe("weekly");
    expect(report.reportWindow.durationDays).toBe(7);
    expect(report.reportWindow.start).toBe("2026-11-07T10:00:00.000Z");
    expect(report.reportWindow.end).toBe(now);
    expect(report.postCount).toBe(1);
    expect(report.metrics.impressions).toBe(120);
    expect(report.excludedRecords.outsideReportWindow).toBe(1);
  });

  it("builds a dedicated thirty-day monthly report", () => {
    const inside = {
      postId: "monthly-post",
      publishedAt: "2026-10-20T10:00:00.000Z",
      capturedAt: now,
      impressions: 450,
      reactions: 18,
      comments: 6,
      shares: 3,
    };
    const outside = {
      postId: "older-monthly-post",
      publishedAt: "2026-10-15T09:59:59.999Z",
      capturedAt: now,
      impressions: 900,
      reactions: 20,
      comments: 5,
      shares: 3,
    };

    const report = buildLinkedInMonthlyReport([inside, outside], now);

    expect(report.period).toBe("monthly");
    expect(report.reportWindow.durationDays).toBe(30);
    expect(report.reportWindow.start).toBe("2026-10-15T10:00:00.000Z");
    expect(report.reportWindow.end).toBe(now);
    expect(report.postCount).toBe(1);
    expect(report.metrics.impressions).toBe(450);
    expect(report.excludedRecords.outsideReportWindow).toBe(1);
  });

  it("learns descriptive patterns from historical post performance", () => {
    const snapshots = [
      {
        postId: "history-1",
        publishedAt: "2026-10-20T09:00:00.000Z",
        capturedAt: "2026-10-21T10:00:00.000Z",
        impressions: 100,
        reactions: 10,
        comments: 5,
        shares: 5,
        pillar: "Education",
        campaign: "Launch",
      },
      {
        postId: "history-1",
        publishedAt: "2026-10-20T09:00:00.000Z",
        capturedAt: "2026-10-22T10:00:00.000Z",
        impressions: 200,
        reactions: 20,
        comments: 10,
        shares: 10,
        pillar: "Education",
        campaign: "Launch",
      },
      {
        postId: "history-2",
        publishedAt: "2026-10-21T17:00:00.000Z",
        capturedAt: "2026-10-22T10:00:00.000Z",
        impressions: 100,
        reactions: 2,
        comments: 1,
        shares: 1,
        pillar: "Product",
        campaign: "Awareness",
      },
      {
        postId: "history-invalid",
        capturedAt: now,
        impressions: 999,
      },
    ];

    const insights = buildLinkedInHistoricalInsights(snapshots);

    expect(insights.postsAnalyzed).toBe(2);
    expect(insights.excludedRecords.missingOrInvalidPublishedAt).toBe(1);
    expect(insights.byContentPillar).toEqual([
      {
        name: "Education",
        postCount: 1,
        averageImpressions: 200,
        averageReach: null,
        averageEngagementRatePercent: 20,
      },
      {
        name: "Product",
        postCount: 1,
        averageImpressions: 100,
        averageReach: null,
        averageEngagementRatePercent: 4,
      },
    ]);
    expect(insights.byPostingHourUtc).toHaveLength(2);
    expect(insights.observedLeaders.contentPillar[0]?.name).toBe("Education");
    expect(insights.limitations.join(" ")).toMatch(/do not establish/i);
  });

  it("generates evidence-based recommendations only with sufficient history", () => {
    const snapshots = Array.from({ length: 6 }, (_, index) => {
      const isEducation = index < 3;
      const postNumber = index % 3;

      return {
        postId: `recommendation-${index}`,
        publishedAt: isEducation
          ? `2026-10-${20 + postNumber}T09:00:00.000Z`
          : `2026-10-${20 + postNumber}T17:00:00.000Z`,
        capturedAt: `2026-10-${21 + postNumber}T10:00:00.000Z`,
        impressions: 100,
        reactions: isEducation ? 10 : 2,
        comments: isEducation ? 5 : 1,
        shares: isEducation ? 5 : 1,
        pillar: isEducation ? "Education" : "Product",
        campaign: isEducation ? "Launch" : "Awareness",
      };
    });

    const result = buildLinkedInContentRecommendations(snapshots);

    expect(result.status).toBe("actionable-patterns-found");
    expect(result.minimumSampleSize).toBe(3);
    expect(result.recommendations.some((item) => item.area === "content-pillar")).toBe(true);
    expect(result.recommendations[0]?.rationale).toMatch(/descriptive evidence/i);

    const insufficient = buildLinkedInContentRecommendations(snapshots.slice(0, 5));

    expect(insufficient.status).toBe("insufficient-comparable-history");
    expect(insufficient.recommendations).toHaveLength(0);
  });

  it("supports selectable weekly and monthly dashboard reports", () => {
    const store = new InMemoryLinkedInGrowthStore();
    const connection = getLinkedInConnectionDiagnostics({
      clientIdConfigured: false,
      accessTokenConfigured: false,
      organizationOrMemberPermission: false,
      publishingPermission: false,
      analyticsPermission: false,
      apiVersionConfigured: false,
    });
    const metrics = [
      {
        postId: "dashboard-post",
        publishedAt: now,
        capturedAt: now,
        impressions: 250,
        reactions: 10,
        comments: 5,
        shares: 5,
      },
    ];

    const weekly = buildLinkedInGrowthDashboard({
      store,
      connection,
      metrics,
      reportPeriod: "weekly",
      reportAt: now,
    });
    const monthly = buildLinkedInGrowthDashboard({
      store,
      connection,
      metrics,
      reportPeriod: "monthly",
      reportAt: now,
    });

    expect(weekly.performance?.period).toBe("weekly");
    expect(weekly.performance?.postCount).toBe(1);
    expect(monthly.performance?.period).toBe("monthly");
    expect(monthly.performance?.metrics.impressions).toBe(250);
    expect(weekly.connection.status).toBe("unavailable");
  });

  it("builds a dashboard without implying live account access", () => {
    const store = new InMemoryLinkedInGrowthStore();
    readyDraft(store);
    const dashboard = buildLinkedInGrowthDashboard({
      store,
      connection: getLinkedInConnectionDiagnostics({
        clientIdConfigured: false,
        accessTokenConfigured: false,
        organizationOrMemberPermission: false,
        publishingPermission: false,
        analyticsPermission: false,
        apiVersionConfigured: false,
      }),
    });
    expect(dashboard.drafts.approved).toBe(1);
    expect(dashboard.connection.status).toBe("unavailable");
    expect(dashboard.performance).toBeNull();
  });
});
