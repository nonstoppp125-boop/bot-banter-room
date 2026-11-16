# Group 13 — Official Social API Feasibility Audit

Audit date: 2026-11-16  
Scope: Instagram, Facebook Pages, YouTube, X and TikTok official developer APIs.  
Status: Feasibility verified; no account authorization or live integration has been performed.

## Findings

| Platform | Official API / supported action | Authorization and eligibility | Important limits / blockers |
|---|---|---|---|
| Instagram | Instagram Platform supports professional-account media, publishing and permitted insights. | Business or Creator account. Instagram Login has `instagram_business_basic` and `instagram_business_content_publishing`; Facebook Login has a distinct Page-linked permission model. | Personal consumer accounts are not supported by the professional-account API. Story support differs by login route/account type. Meta rate limits are dynamic. |
| Facebook | Graph API Page Feed supports publishing Page posts. | Page access token, `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`; authorizing person needs Page `CREATE_CONTENT` task. | Not an API for posting to arbitrary personal profiles. Graph/Pages rate limits are dynamic and must be read from usage headers/dashboard. |
| YouTube | YouTube Data API `videos.insert` supports uploads. | OAuth 2.0 for account data and writes; `youtube.upload` is a documented upload scope. API key is for public data. | Default project quota includes 10,000 units/day for most methods and separate 100/day buckets for `search.list` and `videos.insert`; actual project quota must be checked. |
| X | X API v2 `POST /2/tweets` creates posts. | Approved developer account/project/app; user-context access token using OAuth 2.0 PKCE or OAuth 1.0a. | Access tier and endpoint rate limits apply. Do not assume a free tier or universal quota. Self-serve reply restrictions apply. |
| TikTok | Content Posting API supports Direct Post and upload-to-inbox draft flow. | Registered developer app, Content Posting API product, user authorization and approved `video.publish` or `video.upload` scope. | Unaudited Direct Post clients are restricted to private visibility. Upload-to-inbox requires the user to finish the post in TikTok. Upload-init endpoint documents 6 requests/minute per user token. |

## Security and product decisions

1. No platform is marked connected. API existence does not prove this application has access.
2. Live publishing remains disabled until OAuth, approved scopes, target-account eligibility, durable encrypted token storage, explicit user approval, idempotency and API-specific failure handling are implemented and tested.
3. Do not collect passwords or ask users to paste long-lived provider tokens into chat or the frontend.
4. Keep publishing, replies and messaging disabled by default. Human approval must be enforced server-side, not just represented by a draft status.
5. Rate limits are provider-specific and may change. Prefer response headers, provider dashboards and documented per-endpoint limits over hard-coded global limits.
6. No platform-specific pricing/free-tier claims are made where the official source does not establish a universal allowance.

## Official source references

### Instagram / Meta
- Instagram API changelog and Instagram Login permissions: https://developers.facebook.com/docs/instagram/platform/instagram-api/changelog/
- Instagram Media reference and permission differences: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/
- Meta Graph API rate limiting: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/

### Facebook Pages
- Page Feed publishing and required Page token/permissions/task: https://developers.facebook.com/docs/graph-api/reference/page/feed/
- Page reference and access limitations: https://developers.facebook.com/docs/graph-api/reference/page/

### YouTube
- OAuth 2.0 versus API-key authorization: https://developers.google.com/youtube/data/guides/authentication
- Video upload endpoint and scopes: https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
- Default quotas and method costs: https://developers.google.com/youtube/data/determine_quota_cost

### X
- Manage Posts API, OAuth and create-post endpoint: https://docs.x.com/x-api/posts/manage-tweets/introduction
- X API quickstart: https://docs.x.com/x-api/posts/manage-tweets/quickstart
- API access overview: https://help.x.com/en/rules-and-policies/x-api

### TikTok
- Direct Post requirements, scope approval and audit restriction: https://developers.tiktok.com/docs/en/content-posting-api-get-started
- Upload-to-inbox flow: https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content
- Upload endpoint and per-user request limit: https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video

## Result

S01, S03, S05, S07 and S09: feasibility audit documented.  
S02, S04, S06, S08 and S10: not implemented; require provider app registration, OAuth callback configuration, approved scopes and account consent.  
S22–S25 and S27–S30: no live API execution or analytics claimed. Continue with offline-safe adapters and contracts while keeping external actions fail-closed.
