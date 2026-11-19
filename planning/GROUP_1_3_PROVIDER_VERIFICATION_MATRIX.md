# Group 1.3 — Provider Verification Matrix

| Area | Evidence / requirement | Status |
|---|---|---|
| Groq integration | Remote source references GROQ_API_KEY | Static source check |
| Model selection | Remote source references openai/gpt-oss-20b | Static source check |
| Provider abstraction | Reconcile existing interfaces | Pending |
| Secret isolation | Static and runtime verification | Pending |
| Error normalization | Trace complete route/provider path | Pending |
| Timeout/cancellation | Verify SDK and route behavior | Pending |
| Retry policy | Establish from source and tests | Pending |
| Streaming contract | Trace route/provider behavior | Pending |
| Provider tests | Inspect existing chat tests | Partial |
| Live connectivity | Not tested | Not verified |
| Build/test runtime | Earlier Termux attempt exited 132 | Blocked |
