# Liza: architecture audit and multi-agent integration plan

## 1. What the app is today (checked in the code)

- **Stack:** TanStack Start v1 with Vite 7, built by Nitro's Cloudflare module preset into a Worker.
- **Routes:** just two.
  - `/` (`src/routes/index.tsx`, 127 lines): the ChatGPT-style page. It uses `useChat` with `DefaultChatTransport` to talk to `/api/chat`.
  - `POST /api/chat` (`src/routes/api/chat.ts`): the only server endpoint.
- **How a chat message flows:**

```text
browser useChat -> POST /api/chat {messages}
  -> read GROQ_API_KEY from request.runtime.cloudflare.env
  -> createOpenAI(baseURL=api.groq.com) .responses("openai/gpt-oss-20b")
  -> streamText(SYSTEM prompt "Doot") -> toUIMessageStreamResponse
```

- **Providers and secrets:** Groq is the only provider in use. The key is read per request from the Worker bindings. There is no `process.env` fallback and the key never reaches the browser.
- **Dead code:** `src/lib/ai/responses.ts` and `src/lib/ai/run-id.ts` (the old Lovable AI Gateway helper) are no longer imported anywhere.
- **Persistence and auth:** none. There is no database, no login, no `src/integrations`, and chats are lost when the page reloads.
- **Agents and tools:** none. There are no tools, no routing, and no agent code in the repo. The system prompt still says "Doot", not Liza.
- **Server entry:** `src/server.ts` only wraps errors. `src/start.ts` adds error and CSRF middleware; the CSRF check covers server functions only.
- **Tests:** one, `src/test/app-routing.test.tsx`.
- **"Balix":** this name does not appear anywhere in the repo.

## 2. Where agents can plug in

1. **Server seam (the main one):** inside the `/api/chat` handler, between reading the request body and calling `streamText`. An orchestrator can take over here and pick an agent, its model, its tools and its prompt.
2. **Transport seam:** the request body can carry an optional `agentId`, sent from `useChat` (`body` / `prepareSendMessagesRequest`). This needs no change to how the reply streams.
3. **UI seam:** `message.parts` can already show tool and step parts. An agent picker can sit in the top bar.
4. **External seam:** if the real agents run as a separate service, the orchestrator forwards the request to it over HTTP, with its key held as a Worker secret.

## 3. Agent registry and orchestrator design

This is scaffolding only. It will contain just one agent, "liza-default", which wraps today's Groq behavior exactly.

```text
src/lib/agents/
  types.ts        AgentDefinition { id, name, description, kind: "local"|"remote",
                  model?, instructions?, tools?, endpoint?, secretName? }
  registry.ts     register/get/list; contains ONLY liza-default
  orchestrator.ts runAgent({agentId, messages, env, signal}) -> Response
                  local  -> streamText (current code moved here verbatim)
                  remote -> fetch(endpoint) and pipe a UI-message stream
  env.ts          getBindings(request) helper (moves the existing cast)
```

- `/api/chat` becomes a thin wrapper: read the env, check the body, then call `runAgent`. If no `agentId` is sent, or it is unknown, the request uses `liza-default`, so current behavior is unchanged.
- The UI changes come later, once real agents exist.

## 4. Steps in priority order

1. **Safety net:** add a test for `/api/chat` with Groq mocked. It checks the 500 error when the key is missing, the 400 error for a bad body, and that a stream comes back.
2. **Pull out the helpers:** move env access and the Groq call into `env.ts` and `orchestrator.ts`. Output stays byte-for-byte the same.
3. **Add the registry** with only `liza-default`, and accept an optional `agentId` (checked against the registry's ids).
4. **Small cleanup (needs your OK):** rename the "Doot" system prompt to Liza, and delete the unused `responses.ts` and `run-id.ts`.
5. **Blocked until the agent source is found:** add the real agents, as local entries or remote adapters.
6. **Optional:** an agent picker in the UI, chat history and login (via Lovable Cloud), and per-agent tool calling with step limits.

## 5. Risks

- **Workers runtime:** the agent code may use Node-only APIs (fs, child_process, long-running processes, Python). If so, it cannot run inside the Worker and must stay a separate remote service.
- **Request time limits:** a long chain of agent steps may run past what one Worker request allows. Remote async runs or step caps would be needed.
- **Secrets:** each agent needs its own Worker secret, and secrets must never be sent in the request body.
- **Open access:** `/api/chat` is public, with no login and no rate limit. Adding paid agents would expose costs.
- **Stream format:** a remote agent's reply has to be converted into the AI SDK's UI-message stream format.
- **Groq models:** the responses-API path only works with models Groq supports that way.

## 6. Minimum missing access

- The source of the multi-agent system: a repo link, a ZIP, or access to that GitHub account or organization.
- Its runtime and language (Node, Python, …), plus whether it already runs as a service and its URL.
- The list of agents with their inputs, outputs and tools, and how they currently decide which agent handles a task.
- The names of the secrets it needs (not the values).
- Clarification of whether "Balix" is a different project or a new name for Liza.

## Files involved

- **Changed:** `src/routes/api/chat.ts`
- **New:** `src/lib/agents/{types,registry,orchestrator,env}.ts`, `src/test/chat-api.test.ts`
- **Optional:** `src/routes/index.tsx` (agent picker), `src/lib/ai/*` (delete)
- **Not touched:** `src/server.ts`, `src/start.ts`, the UI design
