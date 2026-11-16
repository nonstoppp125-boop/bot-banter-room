# DOOT / LIZA — COMPLETE A–Z MASTER DEVELOPMENT ROADMAP

Documentation date: 2026-11-10
Repository: nonstoppp125-boop/bot-banter-room
Branch: main
Baseline commit: 3f0b138105ab3781e920b8853c41ae0d188735ec
Status: MASTER PLAN — IMPLEMENTATION PENDING AUDIT
Product identity: Liza (previously Doot)

==================================================
PART 01 — PRODUCT VISION
==================================================

Build Liza as a professional AI Personal and Business
Operating System, not merely a chatbot.

PRIMARY OBJECTIVES

1. ChatGPT-level conversational experience.
2. Natural Bangla, English and Banglish support.
3. Context-aware personality and communication.
4. Autonomous multi-agent workforce.
5. Manager-led task planning and delegation.
6. End-to-end LinkedIn management.
7. Multi-platform social media management.
8. Research and business intelligence.
9. Coding and development workforce.
10. External application connections.
11. Persistent memory and conversation history.
12. Telegram and web access.
13. Human approval for consequential actions.
14. Secure, privacy-conscious architecture.
15. Free-first infrastructure.
16. Production reliability and scalability.

PRODUCT PRINCIPLE

Liza should understand a goal, plan the work,
select appropriate agents, execute authorized tasks,
review results, request approval when necessary,
and return measurable outcomes.

==================================================
PART 02 — GROUP 01: COMPLETE SOURCE AUDIT
==================================================

G01.01 Verify repository identity and remote.
G01.02 Verify current branch and commit.
G01.03 Inspect complete Git working-tree status.
G01.04 Preserve all existing user modifications.
G01.05 Inventory every tracked source file.
G01.06 Inventory every untracked file.
G01.07 Inventory hidden configuration files.
G01.08 Inventory binary assets and image dimensions.
G01.09 Inventory public assets and PWA icons.
G01.10 Inspect complete package.json.
G01.11 Inventory dependencies and versions.
G01.12 Identify unused and duplicate dependencies.
G01.13 Inspect AGENTS.md and project instructions.
G01.14 Inspect README and roadmap.
G01.15 Inspect Vite and TanStack configuration.
G01.16 Inspect Cloudflare/Nitro configuration.
G01.17 Inspect environment templates.
G01.18 Inspect GitHub Actions workflows.
G01.19 Inventory all API routes.
G01.20 Inventory frontend routes and components.
G01.21 Inventory AI and agent modules.
G01.22 Inventory existing test files.
G01.23 Identify test coverage gaps.
G01.24 Inspect legacy Lovable AI implementation.
G01.25 Inspect backup files without overwriting them.
G01.26 Compare local files with GitHub main.
G01.27 Record source-level implementation evidence.
G01.28 Record unknowns and unresolved discrepancies.
G01.29 Produce complete source audit report.
G01.30 Approve architecture mapping only after audit.

Deliverables:

- SOURCE_INVENTORY.md
- BINARY_ASSET_INVENTORY.md
- GIT_AUDIT.md
- DEPENDENCY_AUDIT.md
- SOURCE_AUDIT_REPORT.md

==================================================
PART 03 — GROUP 02: ARCHITECTURE AND SYSTEM DESIGN
==================================================

G02.01 Map frontend architecture.
G02.02 Map backend architecture.
G02.03 Map application routing.
G02.04 Map API request lifecycle.
G02.05 Map AI provider lifecycle.
G02.06 Map current agent execution.
G02.07 Map streaming response lifecycle.
G02.08 Map error and cancellation lifecycle.
G02.09 Define agent communication contracts.
G02.10 Define specialist input/output schemas.
G02.11 Define manager orchestration architecture.
G02.12 Define tool execution architecture.
G02.13 Define integration hub architecture.
G02.14 Define memory architecture.
G02.15 Define database architecture.
G02.16 Define approval architecture.
G02.17 Define authorization boundaries.
G02.18 Define background task architecture.
G02.19 Define observability and audit architecture.
G02.20 Document architecture and dependency diagrams.

==================================================
PART 04 — GROUP 03: BACKEND AND AI PROVIDER
==================================================

G03.01 Stabilize POST /api/chat. [IMPLEMENTED]
G03.02 Verify Cloudflare Worker environment access. [IMPLEMENTED]
G03.03 Correct GROQ_API_KEY configuration. [IMPLEMENTED]
G03.04 Correct outdated .env.example. [IMPLEMENTED]
G03.05 Verify DOOT_MULTI_AGENT exact toggle. [IMPLEMENTED]
G03.06 Validate request JSON schema. [IMPLEMENTED]
G03.07 Validate individual message structures. [IMPLEMENTED]
G03.08 Enforce request-size limits. [IMPLEMENTED]
G03.09 Implement safe API errors. [IMPLEMENTED]
G03.10 Add provider timeout handling. [IMPLEMENTED]
G03.11 Add retry policy with bounded attempts. [IMPLEMENTED]
G03.12 Preserve abort signal propagation. [IMPLEMENTED]
G03.13 Verify streaming under real Worker runtime. [BLOCKED — real Worker test]
G03.14 Add API rate limiting. [IMPLEMENTED]
G03.15 Add abuse protection. [IMPLEMENTED]
G03.16 Add provider quota monitoring. [BLOCKED — quota telemetry]
G03.17 Add model configuration management. [IMPLEMENTED]
G03.18 Evaluate alternative free providers. [EVALUATED]
G03.19 Add provider failure fallback policy. [IMPLEMENTED]
G03.20 Test production binding and deployment. [BLOCKED — production access]

==================================================PART 05 — GROUP 04: LIZA CONVERSATIONAL INTELLIGENCE
==================================================

G04.01 Establish permanent Liza identity.
G04.02 Create professional system persona.
G04.03 Support Bangla script.
G04.04 Support English.
G04.05 Support Banglish.
G04.06 Detect language and preferred response style.
G04.07 Preserve conversational context.
G04.08 Improve natural conversational quality.
G04.09 Support concise and detailed responses.
G04.10 Understand user intent.
G04.11 Ask for clarification when necessary.
G04.12 Explain technical concepts appropriately.
G04.13 Support structured answers.
G04.14 Improve factual accuracy.
G04.15 Require citations for research outputs.
G04.16 Resist prompt injection.
G04.17 Protect internal instructions.
G04.18 Handle ambiguous and conflicting instructions.
G04.19 Add response quality evaluation.
G04.20 Regression-test multilingual behaviour.

==================================================
PART 06 — GROUP 05: MEMORY AND PERSONALIZATION
==================================================

G05.01 Separate conversation context from durable memory.
G05.02 Design memory data structures.
G05.03 Extract useful user preferences.
G05.04 Store project-specific knowledge.
G05.05 Retrieve relevant memories.
G05.06 Rank memory relevance.
G05.07 Prevent unrelated memory leakage.
G05.08 Resolve conflicting memories.
G05.09 Update outdated information.
G05.10 Support user-controlled memory.
G05.11 Support memory inspection.
G05.12 Support memory correction.
G05.13 Support memory deletion.
G05.14 Establish retention policies.
G05.15 Protect sensitive information.
G05.16 Add memory access controls.
G05.17 Test context across sessions.
G05.18 Test memory isolation.
G05.19 Test retrieval accuracy.
G05.20 Document memory limitations.

==================================================
PART 07 — GROUP 06: MANAGER AGENT AND PLANNER
==================================================

G06.01 Define ManagerAgent contract.
G06.02 Detect task intent.
G06.03 Classify task complexity.
G06.04 Decompose large goals into subtasks.
G06.05 Build dependency graphs.
G06.06 Select appropriate specialist agents.
G06.07 Generate execution plans.
G06.08 Estimate execution cost.
G06.09 Estimate task risk.
G06.10 Check agent capabilities.
G06.11 Check required permissions.
G06.12 Delegate tasks.
G06.13 Track execution state.
G06.14 Handle failed subtasks.
G06.15 Re-plan when necessary.
G06.16 Prevent infinite planning loops.
G06.17 Enforce execution budgets.
G06.18 Request human approval.
G06.19 Verify completed deliverables.
G06.20 Produce final task report.

==================================================
PART 08 — GROUP 07: SPECIALIST AGENT WORKFORCE
==================================================

G07.01 Establish reusable BaseAgent contract.
G07.02 Establish agent registry.
G07.03 Establish capability metadata.
G07.04 Establish agent permission definitions.
G07.05 Build Research Agent.
G07.06 Build Web Intelligence Agent.
G07.07 Build Coding Agent.
G07.08 Build Debugging Agent.
G07.09 Build Data Analyst Agent.
G07.10 Build Business Analyst Agent.
G07.11 Build LinkedIn Agent.
G07.12 Build Social Media Agent.
G07.13 Build Content Writer Agent.
G07.14 Build Content Reviewer Agent.
G07.15 Build SEO Agent.
G07.16 Build Marketing Strategist Agent.
G07.17 Build Quality Reviewer Agent.
G07.18 Build Security Reviewer Agent.
G07.19 Build Automation Agent.
G07.20 Build Reporting Agent.
G07.21 Add specialist-specific system prompts.
G07.22 Add specialist-specific tools.
G07.23 Add agent capability tests.
G07.24 Add specialist failure tests.
G07.25 Never register nonfunctional placeholder agents.

==================================================
PART 09 — GROUP 08: MULTI-AGENT COORDINATION
==================================================

G08.01 Implement task-to-agent routing.
G08.02 Implement parallel execution.
G08.03 Implement sequential execution.
G08.04 Implement dependency-aware execution.
G08.05 Implement agent-to-agent handoff.
G08.06 Implement structured agent messages.
G08.07 Implement shared task context.
G08.08 Implement isolated agent contexts.
G08.09 Implement result aggregation.
G08.10 Implement final synthesis.
G08.11 Implement independent quality review.
G08.12 Implement partial-success handling.
G08.13 Implement complete-failure fallback.
G08.14 Implement execution timeouts.
G08.15 Implement bounded retries.
G08.16 Implement cancellation.
G08.17 Prevent duplicate external actions.
G08.18 Prevent circular delegation.
G08.19 Add agent performance metrics.
G08.20 Add multi-agent integration tests.

==================================================
PART 10 — GROUP 09: RESEARCH AND WEB INTELLIGENCE
==================================================

G09.01 Define authorized research tools.
G09.02 Search the web.
G09.03 Open and inspect sources.
G09.04 Extract relevant information.
G09.05 Compare multiple sources.
G09.06 Verify important factual claims.
G09.07 Generate cited reports.
G09.08 Conduct market research.
G09.09 Conduct competitor research.
G09.10 Conduct audience research.
G09.11 Conduct industry research.
G09.12 Conduct product research.
G09.13 Monitor relevant trends.
G09.14 Identify emerging opportunities.
G09.15 Separate facts from assumptions.
G09.16 Detect outdated information.
G09.17 Preserve source references.
G09.18 Protect against malicious web instructions.
G09.19 Add research quality review.
G09.20 Add research evaluation tests.

==================================================
PART 11 — GROUP 10: LINKEDIN INTELLIGENCE
==================================================

LI01 Official LinkedIn API feasibility audit.
LI02 LinkedIn developer application setup.
LI03 Official OAuth authorization.
LI04 State and CSRF protection.
LI05 Permission scope management.
LI06 Token encryption and secure storage.
LI07 Token refresh and revocation.
LI08 Connection health monitoring.
LI09 Account identity verification.
LI10 Authorized profile data retrieval.
LI11 Profile completeness analysis.
LI12 Headline analysis.
LI13 About section analysis.
LI14 Experience section analysis.
LI15 Skills and positioning analysis.
LI16 Profile improvement recommendations.
LI17 Draft profile improvements.
LI18 Personal brand positioning.
LI19 Professional niche identification.
LI20 Target audience definition.
LI21 Audience persona creation.
LI22 Audience pain-point research.
LI23 Competitor identification.
LI24 Authorized competitor research.
LI25 Competitor content analysis.
LI26 Industry trend analysis.
LI27 Content opportunity identification.
LI28 Personal brand consistency review.
LI29 Profile performance reporting.
LI30 LinkedIn intelligence dashboard.

==================================================
PART 12 — GROUP 11: LINKEDIN CONTENT STUDIO
==================================================

LI31 Define content pillars.
LI32 Create long-term content strategy.
LI33 Create monthly content calendar.
LI34 Create weekly content calendar.
LI35 Generate daily post ideas.
LI36 Generate hooks.
LI37 Generate professional posts.
LI38 Generate storytelling posts.
LI39 Generate educational posts.
LI40 Generate opinion posts.
LI41 Generate case-study posts.
LI42 Generate carousel outlines.
LI43 Generate document content.
LI44 Generate calls to action.
LI45 Recommend relevant hashtags.
LI46 Recommend keywords.
LI47 Adapt content to target audience.
LI48 Preserve personal brand voice.
LI49 Support Bangla content.
LI50 Support English content.
LI51 Support Banglish content.
LI52 Repurpose long-form content.
LI53 Generate campaign themes.
LI54 Create content variants.
LI55 Review factual accuracy.
LI56 Review grammar and readability.
LI57 Review originality and duplication.
LI58 Review brand consistency.
LI59 Review engagement suitability.
LI60 Save versioned drafts.
LI61 Allow editing and regeneration.
LI62 Preview content before publication.
LI63 Maintain content calendar history.

==================================================
PART 13 — GROUP 12: LINKEDIN END-TO-END GROWTH
==================================================

LI64 Human approval before publication.
LI65 Reject and revise drafts.
LI66 Schedule approved content.
LI67 Validate API publishing permission.
LI68 Publish through supported official APIs.
LI69 Track publication status.
LI70 Handle publishing failures.
LI71 Prevent duplicate publication.
LI72 Maintain publication audit logs.
LI73 Retrieve permitted post analytics.
LI74 Collect available impressions.
LI75 Collect available reach metrics.
LI76 Collect available engagement metrics.
LI77 Analyze reactions and comments.
LI78 Compare post performance.
LI79 Analyze content pillar performance.
LI80 Analyze posting-time performance.
LI81 Track campaign KPIs.
LI82 Create weekly reports.
LI83 Create monthly reports.
LI84 Learn from historical performance.
LI85 Recommend content improvements.
LI86 Recommend strategy adjustments.
LI87 Generate engagement reply drafts.
LI88 Require approval for replies.
LI89 Support authorized lead research.
LI90 Generate prospect research summaries.
LI91 Support approved follow-up workflows.
LI92 Build LinkedIn growth dashboard.
LI93 Add account connection diagnostics.
LI94 Document unavailable LinkedIn API capabilities.

All publishing, profile modifications and messaging
must respect official LinkedIn API permissions and terms.

No scraping or restriction bypassing.

==================================================
PART 14 — GROUP 13: MULTI-PLATFORM SOCIAL WORKFORCE
==================================================

S01 Instagram integration feasibility.
S02 Official Instagram authorization.
S03 Facebook integration feasibility.
S04 Official Facebook authorization.
S05 YouTube integration feasibility.
S06 Official YouTube authorization.
S07 X integration feasibility.
S08 Official X authorization.
S09 TikTok integration feasibility.
S10 Official TikTok authorization.
S11 Build platform-specific specialist agents.
S12 Create unified social content calendar.
S13 Adapt content to each platform.
S14 Generate platform-specific captions.
S15 Generate short-form video concepts.
S16 Generate scripts and storyboards.
S17 Generate campaign strategies.
S18 Generate creative briefs.
S19 Manage drafts and versions.
S20 Add human approval workflows.
S21 Schedule supported content.
S22 Publish through supported APIs.
S23 Track publication status.
S24 Handle API restrictions and failures.
S25 Monitor permitted engagement metrics.
S26 Generate reply suggestions.
S27 Add cross-platform analytics.
S28 Compare platform performance.
S29 Repurpose successful content.
S30 Generate social performance reports.

==================================================
PART 15 — GROUP 14: ANALYTICS AND BUSINESS INTELLIGENCE
==================================================

BI01 Define unified analytics schema.
BI02 Build data ingestion adapters.
BI03 Normalize platform metrics.
BI04 Store historical metrics.
BI05 Build KPI definitions.
BI06 Build performance dashboards.
BI07 Build campaign dashboards.
BI08 Build audience reports.
BI09 Build content reports.
BI10 Build trend reports.
BI11 Compare date ranges.
BI12 Identify anomalies.
BI13 Identify growth opportunities.
BI14 Calculate engagement rates correctly.
BI15 Show metric source and limitations.
BI16 Export reports.
BI17 Generate executive summaries.
BI18 Generate recommendations.
BI19 Add data freshness indicators.
BI20 Add analytics accuracy tests.

==================================================
PART 16 — GROUP 15: CODING AND TECHNICAL WORKFORCE
==================================================

C01 Understand project repositories.
C02 Inventory source files.
C03 Analyze dependencies.
C04 Understand existing architecture.
C05 Create implementation plans.
C06 Generate code changes.
C07 Edit approved files.
C08 Diagnose bugs.
C09 Debug application failures.
C10 Generate tests.
C11 Execute tests in controlled environments.
C12 Run type checks.
C13 Run lint.
C14 Run build verification.
C15 Review diffs.
C16 Detect security problems.
C17 Review dependencies.
C18 Create technical documentation.
C19 Support Git workflows.
C20 Support approved commits.
C21 Preserve existing modifications.
C22 Prevent destructive commands.
C23 Require approval for risky operations.
C24 Maintain task execution logs.
C25 Produce engineering reports.

==================================================
PART 17 — GROUP 16: EXTERNAL APP CONNECTION HUB
==================================================

APP01 Design centralized connection manager.
APP02 Define provider registry.
APP03 Build official OAuth framework.
APP04 Implement secure callback validation.
APP05 Implement state and PKCE where applicable.
APP06 Implement least-privilege scopes.
APP07 Implement encrypted token storage.
APP08 Implement refresh lifecycle.
APP09 Implement revocation.
APP10 Implement connection status UI.
APP11 Implement disconnect controls.
APP12 Implement permission inspection.
APP13 Implement API capability discovery.
APP14 Implement webhook verification.
APP15 Implement retry and rate-limit handling.
APP16 Implement integration health checks.
APP17 Implement per-user access isolation.
APP18 Implement audit logging.
APP19 Implement secret rotation.
APP20 Implement integration tests.

INITIAL INTEGRATION CANDIDATES

- LinkedIn.
- Instagram / Meta.
- Facebook.
- YouTube / Google.
- X.
- TikTok.
- Telegram.
- GitHub.
- Google Drive.
- Gmail.
- Google Calendar.
- Slack.
- Discord.
- Notion.
- Other useful productivity and business services.

Each integration requires an individual official API audit.

For every candidate record:

- Official API availability.
- OAuth requirements.
- Permissions and scopes.
- Free-tier availability.
- API quotas.
- Supported actions.
- Restricted actions.
- Webhook support.
- Data retention.
- Security requirements.
- Testing evidence.

Do not claim an integration works before real verification.

==================================================
PART 18 — GROUP 17: DATABASE AND USER WORKSPACE
==================================================

DB01 Compare free database providers.
DB02 Select architecture based on actual requirements.
DB03 Design user schema.
DB04 Design session schema.
DB05 Design conversation schema.
DB06 Design message schema.
DB07 Design project schema.
DB08 Design memory schema.
DB09 Design agent task schema.
DB10 Design approval schema.
DB11 Design app connection schema.
DB12 Design social account schema.
DB13 Design content draft schema.
DB14 Design publication schema.
DB15 Design analytics schema.
DB16 Implement migrations.
DB17 Implement ownership controls.
DB18 Implement data validation.
DB19 Implement backups.
DB20 Implement restoration tests.
DB21 Implement retention policies.
DB22 Implement export.
DB23 Implement account deletion.
DB24 Implement data isolation.
DB25 Test concurrent operations.

==================================================
PART 19 — GROUP 18: AUTHENTICATION AND WORKSPACE UX
==================================================

UX01 Evaluate authentication providers.
UX02 Implement secure registration.
UX03 Implement secure login.
UX04 Implement supported OAuth login.
UX05 Implement session management.
UX06 Implement logout.
UX07 Implement account recovery.
UX08 Implement authorization.
UX09 Implement workspace creation.
UX10 Implement project management.
UX11 Implement conversation history.
UX12 Implement conversation search.
UX13 Implement conversation deletion.
UX14 Implement conversation export.
UX15 Implement settings.
UX16 Implement agent selection.
UX17 Implement task progress view.
UX18 Implement approval center.
UX19 Implement integration settings.
UX20 Implement responsive dashboard.

==================================================
PART 20 — GROUP 19: TELEGRAM AND CROSS-PLATFORM
==================================================

TG01 Audit existing Telegram bot.
TG02 Identify existing commands.
TG03 Identify bot hosting and runtime.
TG04 Identify existing bot capabilities.
TG05 Verify bot ownership and configuration.
TG06 Design shared Liza backend.
TG07 Implement secure webhook.
TG08 Verify webhook requests.
TG09 Map Telegram user identity.
TG10 Connect conversations to shared storage.
TG11 Support multilingual interaction.
TG12 Support Manager delegation.
TG13 Support specialist task execution.
TG14 Support approval notifications.
TG15 Support approval callbacks.
TG16 Support task status notifications.
TG17 Support content draft previews.
TG18 Support reports and analytics.
TG19 Handle Telegram failures.
TG20 Test web-to-Telegram continuity.

Never expose bot tokens in frontend code.

==================================================
PART 21 — GROUP 20: SECURITY AND HUMAN CONTROL
==================================================

SEC01 Threat model.
SEC02 Authentication review.
SEC03 Authorization review.
SEC04 Tenant and workspace isolation.
SEC05 API request validation.
SEC06 Request-size limits.
SEC07 Rate limiting.
SEC08 Abuse prevention.
SEC09 Prompt injection protection.
SEC10 Tool permission isolation.
SEC11 OAuth security review.
SEC12 Token encryption.
SEC13 Secret management.
SEC14 CSRF and origin review.
SEC15 CORS review.
SEC16 SSRF prevention.
SEC17 Safe file processing.
SEC18 Safe code execution.
SEC19 Command execution restrictions.
SEC20 Human approval enforcement.
SEC21 Publishing approval enforcement.
SEC22 Messaging approval enforcement.
SEC23 Destructive action approval.
SEC24 Audit log integrity.
SEC25 Data retention and deletion.
SEC26 Privacy review.
SEC27 Dependency vulnerability review.
SEC28 Security regression tests.
SEC29 Incident response plan.
SEC30 Recovery and credential rotation plan.

APPROVAL POLICY

Require approval before:

- Publishing social content.
- Sending messages.
- Changing account/profile data.
- Performing consequential external actions.
- Destructive operations.
- Connecting sensitive services.

Read-only research may run within granted permissions.

==================================================
PART 22 — GROUP 21: PWA, MOBILE AND ACCESSIBILITY
==================================================

PWA01 Audit current manifest.
PWA02 Verify all icon assets.
PWA03 Verify Android installation.
PWA04 Verify iOS installation.
PWA05 Improve mobile navigation.
PWA06 Improve responsive chat.
PWA07 Improve message rendering.
PWA08 Improve composer.
PWA09 Improve attachment workflow.
PWA10 Improve loading states.
PWA11 Improve error states.
PWA12 Improve accessibility.
PWA13 Support keyboard navigation.
PWA14 Verify screen-reader semantics.
PWA15 Verify Bengali font rendering.
PWA16 Verify dark and light themes.
PWA17 Improve dashboard responsiveness.
PWA18 Test low-bandwidth behaviour.
PWA19 Test mobile browser compatibility.
PWA20 Document PWA limitations.

Offline functionality must be separately evaluated.
No APK or IPA is claimed unless actually developed.

==================================================
PART 23 — GROUP 22: PRODUCTION INFRASTRUCTURE
==================================================

OPS01 Audit Cloudflare deployment.
OPS02 Verify production Worker.
OPS03 Verify production commit.
OPS04 Verify secrets and bindings.
OPS05 Configure environment separation.
OPS06 Audit CI/CD.
OPS07 Improve automated build checks.
OPS08 Add automated tests to CI.
OPS09 Add deployment verification.
OPS10 Add health endpoints.
OPS11 Add structured logging.
OPS12 Add error monitoring.
OPS13 Add performance monitoring.
OPS14 Add quota monitoring.
OPS15 Add cost monitoring.
OPS16 Add backup monitoring.
OPS17 Document rollback.
OPS18 Document disaster recovery.
OPS19 Review Cloudflare limits.
OPS20 Document production operations.

==================================================
PART 24 — GROUP 23: TESTING AND QUALITY
==================================================

QA01 Unit tests.
QA02 Component tests.
QA03 API tests.
QA04 Provider tests.
QA05 Agent registry tests.
QA06 Specialist tests.
QA07 Manager tests.
QA08 Delegation tests.
QA09 Multi-agent failure tests.
QA10 Streaming tests.
QA11 Cancellation tests.
QA12 Memory tests.
QA13 Database tests.
QA14 Authentication tests.
QA15 Authorization tests.
QA16 OAuth tests.
QA17 Integration adapter tests.
QA18 LinkedIn permission tests.
QA19 Publishing approval tests.
QA20 Telegram tests.
QA21 PWA tests.
QA22 Accessibility tests.
QA23 Performance tests.
QA24 Security tests.
QA25 Regression tests.
QA26 End-to-end tests.
QA27 Cloudflare runtime tests.
QA28 Production smoke tests.
QA29 Documentation verification.
QA30 Release acceptance.

==================================================
PART 25 — GROUP 24: FINAL PRODUCT RELEASE
==================================================

REL01 Complete feature inventory.
REL02 Verify every mandatory requirement.
REL03 Resolve critical bugs.
REL04 Resolve security blockers.
REL05 Verify all integration permissions.
REL06 Verify approval enforcement.
REL07 Verify database recovery.
REL08 Verify multilingual quality.
REL09 Verify mobile experience.
REL10 Verify production deployment.
REL11 Verify monitoring.
REL12 Verify backup and rollback.
REL13 Publish technical documentation.
REL14 Publish user documentation.
REL15 Publish known limitations.
REL16 Prepare release notes.
REL17 Tag approved release.
REL18 Conduct final acceptance review.
REL19 Confirm production health.
REL20 Maintain post-release improvement roadmap.

==================================================
PART 26 — CROSS-CUTTING REQUIREMENTS
==================================================

Every group must consider:

1. Free-first implementation.
2. Privacy and data minimization.
3. Bangla/English/Banglish usability.
4. Mobile-first experience.
5. Security and authorization.
6. Failure handling.
7. Observability.
8. Cost and quota controls.
9. Unit and integration testing.
10. Documentation.
11. Backward compatibility.
12. Existing source preservation.

==================================================
PART 27 — IMPLEMENTATION ORDER AND DEPENDENCIES
==================================================

Foundation:
G01 -> G02 -> G03 -> G04 -> G05

Agent platform:
G06 -> G07 -> G08 -> G09

Business workforce:
G10 -> G11 -> G12 -> G13 -> G14

Technical workforce:
G15

Integrations:
G16

Persistence and identity:
G17 -> G18

Cross-platform:
G19

Security:
G20

Client experience:
G21

Operations:
G22

Verification:
G23 -> G24

Some work may proceed in parallel only when dependencies
and security boundaries are understood.

Security is a continuous requirement, not a final-only task.

==================================================
PART 28 — DEVELOPMENT EXECUTION RULES
==================================================

1. Inspect git status before every modification batch.
2. Preserve pre-existing user changes.
3. Never modify ~/ai-agent-system.
4. Never touch unrelated projects.
5. Work only in the authorized Doot repository.
6. Do not expose API keys or tokens.
7. Never rewrite published Git history.
8. Preserve Lovable synchronization.
9. Inspect actual source before changing code.
10. Do not invent source files or features.
11. Do not create fake agents.
12. Do not bypass external platform restrictions.
13. Do not silently introduce paid services.
14. Do not deploy unverified changes.
15. Keep changes reversible.
16. Update documentation with every completed group.
17. Run consolidated verification per group.
18. Fix failures before proceeding.
19. Preserve existing backup files.
20. Ask before expanding scope into unrelated projects.

==================================================
PART 29 — GROUP COMPLETION CRITERIA
==================================================

A group is complete only when:

- Requirements are implemented.
- Actual source evidence exists.
- Acceptance criteria are met.
- Unit tests pass.
- Relevant integration tests pass.
- Type checking passes where configured.
- Lint passes where configured.
- Production build passes where feasible.
- Security review passes.
- Git diff is reviewed.
- Existing unrelated changes are preserved.
- Documentation is updated.
- Verification results are recorded.

Use statuses:
NOT STARTED
IN PROGRESS
BLOCKED
IMPLEMENTED
VERIFIED
COMPLETED

IMPLEMENTED does not mean VERIFIED.
A planned feature does not mean IMPLEMENTED.

==================================================
PART 30 — BASELINE AND CURRENT POSITION
==================================================

Verified baseline information from the handover:

Frontend:
React 19, TypeScript, TanStack Start, TanStack Router.

Backend:
POST /api/chat.

AI SDK:
Vercel AI SDK.

Current provider:
Groq.

Current model:
openai/gpt-oss-20b.

Default agent:
liza-default.

Specialists:
problem-solver, quality-reviewer.

Multi-agent flag:
DOOT_MULTI_AGENT=true.

Hosting target:
Cloudflare Workers.

PWA:
Manifest and icon references exist.

Database:
Not verified.

Authentication:
Not verified.

Telegram:
Pending full architecture audit.

LinkedIn:
End-to-end integration not verified.

External app OAuth:
Not verified.

Offline capability:
Not verified.

Native APK/IPA:
Not verified.

Baseline commit:
3f0b138105ab3781e920b8853c41ae0d188735ec

==================================================
PART 31 — CURRENT EXECUTION POSITION
==================================================

Previously agreed workflow:
Step 2/7 — Project Audit.

Substeps 2.1–2.5 were reported complete in the handover.

Remaining:

- Finish local read-only audit.
- Verify full source inventory.
- Reconcile local and GitHub main.
- Verify Cloudflare configuration.
- Inspect actual tests.
- Complete architecture report.
- Prepare Step 3 implementation plan.

No source implementation is authorized merely by this plan.

==================================================
PART 32 — DOCUMENTATION AND PROGRESS CONTROL
==================================================

Maintain these documents:

planning/DOOT_LIZA_MASTER_ROADMAP.md
Complete A-Z roadmap and all group tasks.

planning/DOOT_LIZA_ARCHITECTURE.md
Actual verified system architecture.

planning/DOOT_LIZA_PROJECT_STATE.md
Current step, commit, branch and exact progress.

planning/DOOT_LIZA_DEVELOPMENT_RULES.md
Permanent development and safety rules.

planning/DOOT_LIZA_VERIFICATION_LOG.md
Tests, builds, reviews and deployment evidence.

planning/DOOT_LIZA_INTEGRATION_MATRIX.md
Every external app, API, OAuth scope and limitation.

planning/DOOT_LIZA_REQUIREMENTS_MATRIX.md
Every user requirement mapped to implementation and tests.

At each session handover record:

- Current step.
- Completed groups.
- Current group.
- Completed task IDs.
- Pending task IDs.
- Blocked tasks.
- Latest commit.
- Git status.
- Test/build status.
- Exact next action.
- Exact next Termux command.

Do not rely on chat memory alone.

==================================================
FINAL PRODUCT ACCEPTANCE
==================================================

Liza is ready for final release only when all mandatory
requirements have implementation evidence, successful
verification, documented permissions and known limitations.

END OF COMPLETE MASTER ROADMAP


## 2026-11-16 — Runtime execution clarification

- The Group 06 implementation includes authenticated synchronous execution of persisted Manager tasks, approval-bound unlock and a manual retry control. These are not background queue processing.
- See `planning/PART06_GROUP06_STATUS.md` for exact security and runtime boundaries.