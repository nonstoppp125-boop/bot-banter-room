export interface LinkedInExperience {
  title?: string;
  company?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface LinkedInProfileInput {
  headline?: string;
  about?: string;
  experience?: LinkedInExperience[];
  skills?: string[];
  location?: string;
  industry?: string;
}

export interface ProfileFinding {
  section: "headline" | "about" | "experience" | "skills" | "profile";
  severity: "info" | "warning" | "critical";
  message: string;
  recommendation: string;
}

export interface ProfileAnalysis {
  completenessScore: number;
  completedSections: number;
  totalSections: number;
  findings: ProfileFinding[];
}

const clean = (value: unknown, max = 2000): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function analyzeLinkedInProfile(input: LinkedInProfileInput): ProfileAnalysis {
  const headline = clean(input.headline, 300);
  const about = clean(input.about, 5000);
  const experience = Array.isArray(input.experience)
    ? input.experience.filter((item) => clean(item?.title, 200) || clean(item?.company, 200))
    : [];
  const skills = Array.isArray(input.skills)
    ? [...new Set(input.skills.map((skill) => clean(skill, 100).toLowerCase()).filter(Boolean))]
    : [];

  const sections = [
    Boolean(headline),
    Boolean(about),
    experience.length > 0,
    skills.length > 0,
    Boolean(clean(input.location, 200)),
    Boolean(clean(input.industry, 200)),
  ];
  const completedSections = sections.filter(Boolean).length;
  const findings: ProfileFinding[] = [];

  if (!headline) {
    findings.push({
      section: "headline",
      severity: "critical",
      message: "No headline was supplied.",
      recommendation:
        "Add a concise professional headline based on your real role, skills and direction.",
    });
  } else if (headline.length < 35) {
    findings.push({
      section: "headline",
      severity: "warning",
      message: "The headline may not communicate enough professional context.",
      recommendation:
        "Consider adding a relevant specialization or target audience using only accurate details.",
    });
  } else {
    findings.push({
      section: "headline",
      severity: "info",
      message: "A headline is present.",
      recommendation:
        "Check that it clearly communicates your current professional identity and direction.",
    });
  }

  if (!about) {
    findings.push({
      section: "about",
      severity: "warning",
      message: "No About section was supplied.",
      recommendation:
        "Add a short summary covering your actual background, strengths and professional goals.",
    });
  } else if (about.length < 120) {
    findings.push({
      section: "about",
      severity: "warning",
      message: "The About section is relatively brief.",
      recommendation:
        "Expand it with verified experience, concrete skills and a clear professional focus.",
    });
  } else {
    findings.push({
      section: "about",
      severity: "info",
      message: "An About section is present.",
      recommendation: "Review it for specific evidence, readability and a clear value proposition.",
    });
  }

  if (experience.length === 0) {
    findings.push({
      section: "experience",
      severity: "warning",
      message: "No experience entries were supplied.",
      recommendation:
        "Add genuine employment, projects, internships or volunteer work where applicable.",
    });
  } else {
    const incomplete = experience.filter(
      (item) => !clean(item.title) || !clean(item.company),
    ).length;
    findings.push({
      section: "experience",
      severity: incomplete ? "warning" : "info",
      message: `${experience.length} experience entries supplied; ${incomplete} need a title or organization.`,
      recommendation: "Use accurate titles, organizations, dates and outcome-focused descriptions.",
    });
  }

  if (skills.length === 0) {
    findings.push({
      section: "skills",
      severity: "warning",
      message: "No skills were supplied.",
      recommendation: "List relevant skills you can genuinely demonstrate.",
    });
  } else {
    findings.push({
      section: "skills",
      severity: skills.length < 5 ? "warning" : "info",
      message: `${skills.length} unique skills supplied.`,
      recommendation: "Prioritize skills that support your stated professional direction.",
    });
  }

  for (const [field, label] of [
    ["location", "Location"],
    ["industry", "Industry"],
  ] as const) {
    if (!clean(input[field])) {
      findings.push({
        section: "profile",
        severity: "info",
        message: `${label} was not supplied.`,
        recommendation: `Add ${label.toLowerCase()} only if you want it visible and relevant.`,
      });
    }
  }

  return {
    completenessScore: Math.round((completedSections / sections.length) * 100),
    completedSections,
    totalSections: sections.length,
    findings,
  };
}

export function reviewLinkedInHeadline(headline: string): ProfileFinding[] {
  const value = clean(headline, 300);
  if (!value) {
    return [
      {
        section: "headline",
        severity: "critical",
        message: "Headline is empty.",
        recommendation: "Provide a truthful role or professional direction.",
      },
    ];
  }

  const findings: ProfileFinding[] = [];
  if (value.length < 35) {
    findings.push({
      section: "headline",
      severity: "warning",
      message: "Headline may be too brief to explain your positioning.",
      recommendation:
        "Consider role + specialization + audience, without adding unsupported claims.",
    });
  }
  if (value.length > 220) {
    findings.push({
      section: "headline",
      severity: "warning",
      message: "Headline is lengthy.",
      recommendation: "Remove repetition and keep the most relevant professional information.",
    });
  }
  if (!findings.length) {
    findings.push({
      section: "headline",
      severity: "info",
      message: "Headline length is within a practical review range.",
      recommendation: "Manually verify clarity, accuracy and relevance.",
    });
  }
  return findings;
}

export function reviewLinkedInAbout(about: string): ProfileFinding[] {
  const value = clean(about, 5000);
  if (!value) {
    return [
      {
        section: "about",
        severity: "warning",
        message: "About section is empty.",
        recommendation: "Write a factual summary of your background, strengths and goals.",
      },
    ];
  }

  const findings: ProfileFinding[] = [];
  if (value.length < 120) {
    findings.push({
      section: "about",
      severity: "warning",
      message: "About section has limited detail.",
      recommendation: "Add verified examples, relevant skills and a clear professional focus.",
    });
  }
  if (value.length > 2600) {
    findings.push({
      section: "about",
      severity: "warning",
      message: "About section may be difficult to scan.",
      recommendation: "Use short paragraphs and remove repeated information.",
    });
  }
  if (!findings.length) {
    findings.push({
      section: "about",
      severity: "info",
      message: "About section has a workable length.",
      recommendation: "Review factual accuracy, structure and readability.",
    });
  }
  return findings;
}

export function reviewLinkedInExperience(entries: LinkedInExperience[] = []): ProfileFinding[] {
  if (!entries.length) {
    return [
      {
        section: "experience",
        severity: "warning",
        message: "No experience entries supplied.",
        recommendation: "Add only genuine professional, project or volunteer experience.",
      },
    ];
  }

  return entries.map((entry, index) => {
    const missing: string[] = [];
    if (!clean(entry.title)) missing.push("title");
    if (!clean(entry.company)) missing.push("organization");
    if (!clean(entry.description)) missing.push("description");

    return {
      section: "experience",
      severity: missing.length ? "warning" : "info",
      message: `Entry ${index + 1}: ${missing.length ? `missing ${missing.join(", ")}` : "core fields supplied"}.`,
      recommendation: missing.length
        ? `Complete the missing ${missing.join(", ")} using accurate information.`
        : "Make responsibilities and outcomes specific; do not invent metrics.",
    };
  });
}

export function reviewLinkedInSkills(skills: string[] = []): ProfileFinding[] {
  const normalized = skills.map((skill) => clean(skill, 100).toLowerCase()).filter(Boolean);
  const unique = [...new Set(normalized)];

  if (!unique.length) {
    return [
      {
        section: "skills",
        severity: "warning",
        message: "No skills supplied.",
        recommendation: "Add relevant skills you can demonstrate with examples.",
      },
    ];
  }

  return [
    {
      section: "skills",
      severity: unique.length < 5 ? "warning" : "info",
      message: `${unique.length} unique skills found; ${normalized.length - unique.length} duplicates removed from analysis.`,
      recommendation: "Prioritize relevant, demonstrable skills and remove outdated entries.",
    },
  ];
}

export interface ProfileImprovementDraft {
  section: "headline" | "about" | "experience" | "skills";
  currentText: string;
  suggestedAction: string;
  draftText?: string;
}

export function draftLinkedInProfileImprovements(
  input: LinkedInProfileInput,
): ProfileImprovementDraft[] {
  const drafts: ProfileImprovementDraft[] = [];
  const headline = clean(input.headline, 300);
  const about = clean(input.about, 5000);

  if (headline) {
    drafts.push({
      section: "headline",
      currentText: headline,
      suggestedAction:
        "Rewrite using a truthful role, relevant specialization and intended audience. Confirm every claim before use.",
    });
  } else {
    drafts.push({
      section: "headline",
      currentText: "",
      suggestedAction: "Supply your real current role or professional direction before drafting.",
    });
  }

  if (about) {
    drafts.push({
      section: "about",
      currentText: about,
      suggestedAction:
        "Restructure the supplied facts into: professional introduction, verified strengths, relevant evidence and current goals. No new credentials or results should be added.",
    });
  } else {
    drafts.push({
      section: "about",
      currentText: "",
      suggestedAction:
        "Provide your real background, skills and goals before drafting an About section.",
    });
  }

  const experience = Array.isArray(input.experience) ? input.experience : [];
  drafts.push({
    section: "experience",
    currentText: experience
      .map((item) => [clean(item.title), clean(item.company)].filter(Boolean).join(" — "))
      .filter(Boolean)
      .join("; "),
    suggestedAction:
      "For each genuine entry, add accurate dates, responsibilities and measurable outcomes only when evidence exists.",
  });

  const skills = Array.isArray(input.skills)
    ? [...new Set(input.skills.map((skill) => clean(skill, 100)).filter(Boolean))]
    : [];
  drafts.push({
    section: "skills",
    currentText: skills.join(", "),
    suggestedAction:
      "Keep skills that match your real ability and can be supported by projects or experience.",
  });

  return drafts;
}

export interface LinkedInPositioningInput {
  currentRole?: string;
  targetRole?: string;
  industry?: string;
  strengths?: string[];
  targetAudience?: string;
  evidence?: string[];
}

export interface LinkedInPositioningBrief {
  positioningStatement: string | null;
  professionalNiche: string | null;
  targetAudience: string | null;
  verifiedStrengths: string[];
  supportingEvidence: string[];
  missingInformation: string[];
}

export function buildLinkedInPositioningBrief(
  input: LinkedInPositioningInput,
): LinkedInPositioningBrief {
  const currentRole = clean(input.currentRole, 150);
  const targetRole = clean(input.targetRole, 150);
  const industry = clean(input.industry, 150);
  const targetAudience = clean(input.targetAudience, 200);

  const strengths = Array.isArray(input.strengths)
    ? [...new Set(input.strengths.map((item) => clean(item, 100)).filter(Boolean))]
    : [];

  const evidence = Array.isArray(input.evidence)
    ? [...new Set(input.evidence.map((item) => clean(item, 500)).filter(Boolean))]
    : [];

  const missingInformation: string[] = [];
  if (!currentRole && !targetRole) missingInformation.push("current or target professional role");
  if (!industry) missingInformation.push("industry");
  if (!strengths.length) missingInformation.push("verified professional strengths");
  if (!targetAudience) missingInformation.push("target audience");
  if (!evidence.length) missingInformation.push("supporting evidence or examples");

  const role = targetRole || currentRole;
  const positioningStatement =
    role && strengths.length && industry
      ? `${role} focused on ${strengths.slice(0, 3).join(", ")} in ${industry}.`
      : null;

  const professionalNiche =
    role && industry && strengths.length
      ? `${industry} — ${role} — ${strengths.slice(0, 2).join(" / ")}`
      : null;

  return {
    positioningStatement,
    professionalNiche,
    targetAudience: targetAudience || null,
    verifiedStrengths: strengths,
    supportingEvidence: evidence,
    missingInformation,
  };
}

export interface LinkedInAudiencePersonaInput {
  audienceName: string;
  professionalContext: string;
  goals: string[];
  challenges: string[];
  evidence?: string[];
}

export interface LinkedInAudiencePersona {
  audienceName: string;
  professionalContext: string;
  goals: string[];
  challenges: string[];
  supportingEvidence: string[];
  researchRequired: string[];
}

export function createLinkedInAudiencePersona(
  input: LinkedInAudiencePersonaInput,
): LinkedInAudiencePersona {
  const goals = Array.isArray(input.goals)
    ? [...new Set(input.goals.map((item) => clean(item, 200)).filter(Boolean))]
    : [];

  const challenges = Array.isArray(input.challenges)
    ? [...new Set(input.challenges.map((item) => clean(item, 200)).filter(Boolean))]
    : [];

  const evidence = Array.isArray(input.evidence)
    ? [...new Set(input.evidence.map((item) => clean(item, 500)).filter(Boolean))]
    : [];

  const researchRequired: string[] = [];
  if (!goals.length) researchRequired.push("Audience goals need research or user input.");
  if (!challenges.length) researchRequired.push("Audience challenges need research or user input.");
  if (!evidence.length) researchRequired.push("Persona assumptions have no supporting evidence.");

  return {
    audienceName: clean(input.audienceName, 150),
    professionalContext: clean(input.professionalContext, 300),
    goals,
    challenges,
    supportingEvidence: evidence,
    researchRequired,
  };
}

export interface LinkedInMarketEvidence {
  id: string;
  title: string;
  publisher?: string;
  url?: string;
  publishedAt?: string;
  content: string;
}

export interface LinkedInCompetitorObservation {
  competitorName: string;
  observation: string;
  sourceIds: string[];
}

export interface LinkedInContentOpportunity {
  opportunity: string;
  audienceNeed: string;
  sourceIds: string[];
}

export interface LinkedInMarketResearchInput {
  evidence: LinkedInMarketEvidence[];
  competitorObservations: LinkedInCompetitorObservation[];
  industryTrends: Array<{
    trend: string;
    sourceIds: string[];
  }>;
  contentOpportunities: LinkedInContentOpportunity[];
}

export interface LinkedInMarketResearchBrief {
  evidence: LinkedInMarketEvidence[];
  competitorFindings: Array<{
    competitorName: string;
    observation: string;
    verifiedSourceIds: string[];
  }>;
  industryTrends: Array<{
    trend: string;
    verifiedSourceIds: string[];
  }>;
  contentOpportunities: Array<{
    opportunity: string;
    audienceNeed: string;
    verifiedSourceIds: string[];
  }>;
  excludedItems: number;
  limitations: string[];
}

export function buildLinkedInMarketResearchBrief(
  input: LinkedInMarketResearchInput,
): LinkedInMarketResearchBrief {
  const evidence = Array.isArray(input.evidence)
    ? input.evidence
        .map((item) => ({
          id: clean(item.id, 100),
          title: clean(item.title, 300),
          ...(clean(item.publisher, 150) ? { publisher: clean(item.publisher, 150) } : {}),
          ...(clean(item.url, 1000) ? { url: clean(item.url, 1000) } : {}),
          ...(clean(item.publishedAt, 80) ? { publishedAt: clean(item.publishedAt, 80) } : {}),
          content: clean(item.content, 12000),
        }))
        .filter((item) => {
          if (!item.id || !item.title || !item.content) return false;
          if (item.url && !/^https?:\/\/\S+$/i.test(item.url)) return false;
          return true;
        })
    : [];

  const uniqueEvidence = [...new Map(evidence.map((item) => [item.id, item])).values()];
  const sourceIds = new Set(uniqueEvidence.map((item) => item.id));
  let excludedItems = evidence.length - uniqueEvidence.length;

  const verifyIds = (ids: string[]): string[] => {
    const valid = Array.isArray(ids)
      ? [...new Set(ids.map((id) => clean(id, 100)).filter((id) => sourceIds.has(id)))]
      : [];
    return valid;
  };

  const competitorFindings = (
    Array.isArray(input.competitorObservations) ? input.competitorObservations : []
  )
    .map((item) => ({
      competitorName: clean(item.competitorName, 150),
      observation: clean(item.observation, 1000),
      verifiedSourceIds: verifyIds(item.sourceIds),
    }))
    .filter((item) => {
      const valid = Boolean(
        item.competitorName && item.observation && item.verifiedSourceIds.length,
      );
      if (!valid) excludedItems += 1;
      return valid;
    });

  const industryTrends = (Array.isArray(input.industryTrends) ? input.industryTrends : [])
    .map((item) => ({
      trend: clean(item.trend, 500),
      verifiedSourceIds: verifyIds(item.sourceIds),
    }))
    .filter((item) => {
      const valid = Boolean(item.trend && item.verifiedSourceIds.length);
      if (!valid) excludedItems += 1;
      return valid;
    });

  const contentOpportunities = (
    Array.isArray(input.contentOpportunities) ? input.contentOpportunities : []
  )
    .map((item) => ({
      opportunity: clean(item.opportunity, 500),
      audienceNeed: clean(item.audienceNeed, 500),
      verifiedSourceIds: verifyIds(item.sourceIds),
    }))
    .filter((item) => {
      const valid = Boolean(item.opportunity && item.audienceNeed && item.verifiedSourceIds.length);
      if (!valid) excludedItems += 1;
      return valid;
    });

  const limitations: string[] = [
    "Findings are based only on supplied evidence; no LinkedIn account access or scraping occurred.",
    "Source citations establish traceability, not that an observation is objectively true.",
    "Competitor coverage and industry trend completeness have not been independently verified.",
  ];

  if (!uniqueEvidence.length) {
    limitations.push("No valid research evidence was supplied.");
  }

  return {
    evidence: uniqueEvidence,
    competitorFindings,
    industryTrends,
    contentOpportunities,
    excludedItems,
    limitations,
  };
}

export interface LinkedInConsistencyInput {
  profileThemes: string[];
  contentThemes: string[];
}

export interface LinkedInConsistencyReport {
  matchedThemes: string[];
  profileOnlyThemes: string[];
  contentOnlyThemes: string[];
  consistencyScore: number | null;
  limitations: string[];
}

export function reviewLinkedInBrandConsistency(
  input: LinkedInConsistencyInput,
): LinkedInConsistencyReport {
  const normalize = (value: string) =>
    clean(value, 200)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const profileThemes = Array.isArray(input.profileThemes)
    ? [...new Set(input.profileThemes.map((item) => clean(item, 200)).filter(Boolean))]
    : [];

  const contentThemes = Array.isArray(input.contentThemes)
    ? [...new Set(input.contentThemes.map((item) => clean(item, 200)).filter(Boolean))]
    : [];

  const profileMap = new Map(profileThemes.map((item) => [normalize(item), item]));
  const contentMap = new Map(contentThemes.map((item) => [normalize(item), item]));

  const matchedThemes = [...profileMap.keys()]
    .filter((key) => contentMap.has(key))
    .map((key) => profileMap.get(key)!);

  const profileOnlyThemes = [...profileMap.keys()]
    .filter((key) => !contentMap.has(key))
    .map((key) => profileMap.get(key)!);

  const contentOnlyThemes = [...contentMap.keys()]
    .filter((key) => !profileMap.has(key))
    .map((key) => contentMap.get(key)!);

  const total = new Set([...profileMap.keys(), ...contentMap.keys()]).size;

  return {
    matchedThemes,
    profileOnlyThemes,
    contentOnlyThemes,
    consistencyScore: total ? Math.round((matchedThemes.length / total) * 100) : null,
    limitations: [
      "This is an exact normalized theme comparison, not semantic brand analysis.",
      "Only user-supplied profile and content themes were compared.",
    ],
  };
}

export interface LinkedInPerformanceInput {
  periodStart?: string;
  periodEnd?: string;
  impressions?: number;
  reactions?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  followersGained?: number;
  postCount?: number;
}

export interface LinkedInPerformanceReport {
  periodStart: string | null;
  periodEnd: string | null;
  metrics: {
    impressions: number;
    reactions: number;
    comments: number;
    shares: number;
    clicks: number;
    followersGained: number;
    postCount: number;
  };
  engagementRatePercent: number | null;
  limitations: string[];
}

export function buildLinkedInPerformanceReport(
  input: LinkedInPerformanceInput,
): LinkedInPerformanceReport {
  const metric = (value: number | undefined): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

  const metrics = {
    impressions: metric(input.impressions),
    reactions: metric(input.reactions),
    comments: metric(input.comments),
    shares: metric(input.shares),
    clicks: metric(input.clicks),
    followersGained: metric(input.followersGained),
    postCount: metric(input.postCount),
  };

  const engagementTotal = metrics.reactions + metrics.comments + metrics.shares;

  return {
    periodStart: clean(input.periodStart, 40) || null,
    periodEnd: clean(input.periodEnd, 40) || null,
    metrics,
    engagementRatePercent:
      metrics.impressions > 0
        ? Number(((engagementTotal / metrics.impressions) * 100).toFixed(2))
        : null,
    limitations: [
      "Metrics are user-supplied and have not been independently verified.",
      "Missing, negative or non-finite metric values are treated as zero.",
      "Engagement rate is calculated as (reactions + comments + shares) / impressions.",
      "No LinkedIn account access or live analytics retrieval occurred.",
    ],
  };
}

export interface LinkedInIntelligenceDashboardInput {
  profileAnalysis?: ProfileAnalysis;
  consistency?: LinkedInConsistencyReport;
  marketResearch?: LinkedInMarketResearchBrief;
  performance?: LinkedInPerformanceReport;
}

export interface LinkedInIntelligenceDashboard {
  sections: Array<{
    name: string;
    status: "available" | "partial" | "unavailable";
    summary: string;
  }>;
  limitations: string[];
}

export function buildLinkedInIntelligenceDashboard(
  input: LinkedInIntelligenceDashboardInput,
): LinkedInIntelligenceDashboard {
  const sections: LinkedInIntelligenceDashboard["sections"] = [];

  if (input.profileAnalysis) {
    sections.push({
      name: "Profile analysis",
      status: "available",
      summary: `${input.profileAnalysis.completenessScore}% profile completeness`,
    });
  } else {
    sections.push({
      name: "Profile analysis",
      status: "unavailable",
      summary: "No profile analysis supplied",
    });
  }

  if (input.consistency) {
    sections.push({
      name: "Brand consistency",
      status: input.consistency.consistencyScore === null ? "partial" : "available",
      summary:
        input.consistency.consistencyScore === null
          ? "Insufficient themes for comparison"
          : `${input.consistency.consistencyScore}% exact theme overlap`,
    });
  } else {
    sections.push({
      name: "Brand consistency",
      status: "unavailable",
      summary: "No consistency report supplied",
    });
  }

  if (input.marketResearch) {
    const count =
      input.marketResearch.competitorFindings.length +
      input.marketResearch.industryTrends.length +
      input.marketResearch.contentOpportunities.length;

    sections.push({
      name: "Market intelligence",
      status: count ? "available" : "partial",
      summary: `${count} evidence-linked findings`,
    });
  } else {
    sections.push({
      name: "Market intelligence",
      status: "unavailable",
      summary: "No market research supplied",
    });
  }

  if (input.performance) {
    sections.push({
      name: "Performance",
      status: input.performance.metrics.impressions > 0 ? "available" : "partial",
      summary:
        input.performance.engagementRatePercent === null
          ? "Performance metrics supplied; engagement rate unavailable"
          : `${input.performance.engagementRatePercent}% engagement rate`,
    });
  } else {
    sections.push({
      name: "Performance",
      status: "unavailable",
      summary: "No analytics supplied",
    });
  }

  return {
    sections,
    limitations: [
      "Dashboard summarizes supplied analysis only; it does not fetch LinkedIn account data.",
      "Performance figures are not independently verified.",
      "Unavailable sections must not be interpreted as zero performance or failure.",
    ],
  };
}
