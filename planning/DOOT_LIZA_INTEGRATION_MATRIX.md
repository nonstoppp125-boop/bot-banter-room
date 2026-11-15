# Doot / Liza — Integration Matrix

Status: planning checklist. No integration is considered connected until OAuth/API operation is tested.

| Integration          | Intended capability                                                   | Required audit                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| LinkedIn             | Conditional OIDC identity and approved organization capabilities only | LI01 feasibility documented; no app, approved scopes, OAuth, token store or connected account verified. See GROUP_10_LINKEDIN_API_FEASIBILITY.md |
| Instagram / Facebook | Publishing, insights, inbox where permitted                           | Meta app review, permissions, account types, rate limits                                                                                         |
| YouTube / Google     | Channel research, upload and analytics where permitted                | OAuth scopes, quota units, API policy                                                                                                            |
| X                    | Posts and analytics where permitted                                   | Current API access tier, costs, scopes and limits                                                                                                |
| TikTok               | Content and analytics where permitted                                 | Product eligibility, app review and scopes                                                                                                       |
| Telegram             | User interface and bot commands                                       | Bot token storage, webhook security, authorization                                                                                               |
| GitHub               | Repository analysis and approved coding workflows                     | OAuth/App scopes, webhook validation, write approval                                                                                             |
| Google Drive         | User-authorized file access                                           | OAuth scopes, file-level permissions and revocation                                                                                              |
| Gmail                | User-authorized email workflows                                       | Restricted scopes, verification and approval                                                                                                     |
| Google Calendar      | Scheduling and event workflows                                        | OAuth scopes, time zones and approval                                                                                                            |
| Slack / Discord      | Workspace communication                                               | Bot permissions, workspace consent and rate limits                                                                                               |
| Notion               | Workspace knowledge access                                            | OAuth scopes and page-level permissions                                                                                                          |

For every integration record: official documentation URL, supported endpoints, approval status, scopes, token storage, refresh/revocation, quotas, pricing, error handling, tests and verified date.

Never promise unsupported endpoints or bypass platform restrictions.
