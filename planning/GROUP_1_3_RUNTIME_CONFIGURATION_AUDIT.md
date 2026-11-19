# Group 1.3.5 — Provider Configuration & Runtime Audit

Baseline: origin/main
Method: read-only static inspection


## .env.example
Lines: 3
L1: # Server-only Lovable AI Gateway key. Set your own value locally or in your host.
L2: # Never expose this through a VITE_ variable or commit the real .env file.
L3: LOVABLE_API_KEY=<REDACTED>

## package.json
Lines: 107
L1: {
L2:   "name": "tanstack_start_ts",
L3:   "private": true,
L4:   "sideEffects": false,
L5:   "type": "module",
L6:   "scripts": {
L7:     "dev": "vite dev",
L8:     "build": "vite build",
L9:     "build:dev": "vite build --mode development",
L10:     "preview": "vite preview",
L11:     "lint": "eslint .",
L12:     "format": "prettier --write .",
L13:     "test": "vitest run",
L14:     "test:watch": "vitest"
L15:   },
L16:   "overrides": {
L17:     "rolldown": "1.2.1"
L18:   },
L19:   "dependencies": {
L20:     "@ai-sdk/openai": "^4.0.106",
L21:     "@ai-sdk/react": "^4.0.158",
L22:     "@hookform/resolvers": "^5.2.2",
L23:     "@radix-ui/react-accordion": "^1.2.12",
L24:     "@radix-ui/react-alert-dialog": "^1.1.15",
L25:     "@radix-ui/react-aspect-ratio": "^1.1.8",
L26:     "@radix-ui/react-avatar": "^1.1.11",
L27:     "@radix-ui/react-checkbox": "^1.3.3",
L28:     "@radix-ui/react-collapsible": "^1.1.12",
L29:     "@radix-ui/react-context-menu": "^2.2.16",
L30:     "@radix-ui/react-dialog": "^1.1.15",
L31:     "@radix-ui/react-dropdown-menu": "^2.1.16",
L32:     "@radix-ui/react-hover-card": "^1.1.15",
L33:     "@radix-ui/react-label": "^2.1.8",
L34:     "@radix-ui/react-menubar": "^1.1.16",
L35:     "@radix-ui/react-navigation-menu": "^1.2.14",
L36:     "@radix-ui/react-popover": "^1.1.15",
L37:     "@radix-ui/react-progress": "^1.1.8",
L38:     "@radix-ui/react-radio-group": "^1.3.8",
L39:     "@radix-ui/react-scroll-area": "^1.2.10",
L40:     "@radix-ui/react-select": "^2.2.6",
L41:     "@radix-ui/react-separator": "^1.1.8",
L42:     "@radix-ui/react-slider": "^1.3.6",
L43:     "@radix-ui/react-slot": "^1.2.4",
L44:     "@radix-ui/react-switch": "^1.2.6",
L45:     "@radix-ui/react-tabs": "^1.1.13",
L46:     "@radix-ui/react-toggle": "^1.1.10",
L47:     "@radix-ui/react-toggle-group": "^1.1.11",
L48:     "@radix-ui/react-tooltip": "^1.2.8",
L49:     "@streamdown/cjk": "^1.0.4",
L50:     "@streamdown/code": "^2.0.0",
L51:     "@streamdown/math": "^1.0.3",
L52:     "@streamdown/mermaid": "^1.0.3",
L53:     "@tailwindcss/vite": "^4.2.1",
L54:     "@tanstack/react-query": "^5.101.1",
L55:     "@tanstack/react-router": "1.170.41",
L56:     "@tanstack/react-start": "1.168.60",
L57:     "@tanstack/router-plugin": "1.168.42",
L58:     "ai": "^7.0.154",
L59:     "class-variance-authority": "^0.7.1",
L60:     "clsx": "^2.1.1",
L61:     "cmdk": "^1.1.1",
L62:     "date-fns": "^4.1.0",
L63:     "embla-carousel-react": "^8.6.0",
L64:     "input-otp": "^1.4.2",
L65:     "lucide-react": "^0.575.0",
L66:     "motion": "^14.9.0",
L67:     "nanoid": "^6.0.2",
L68:     "react": "^19.2.0",
L69:     "react-day-picker": "^9.14.0",
L70:     "react-dom": "^19.2.0",
L71:     "react-hook-form": "^7.71.2",
L72:     "react-resizable-panels": "^4.6.5",
L73:     "recharts": "^2.15.4",
L74:     "sonner": "^2.0.7",
L75:     "streamdown": "^2.7.1",
L76:     "tailwind-merge": "^3.5.0",
L77:     "tailwindcss": "^4.2.1",
L78:     "tw-animate-css": "^1.3.4",
L79:     "use-stick-to-bottom": "^1.1.6",
L80:     "vaul": "^1.1.2",
L81:     "vite-tsconfig-paths": "^6.0.2",
L82:     "zod": "^3.25.76"
L83:   },
L84:   "devDependencies": {
L85:     "@eslint/js": "^9.32.0",
L86:     "@lovable.dev/vite-tanstack-config": "2.26.5",
L87:     "@testing-library/jest-dom": "^6.6.0",
L88:     "@testing-library/react": "^16.0.0",
L89:     "@types/node": "^22.16.5",
L90:     "@types/react": "^19.2.0",
L91:     "@types/react-dom": "^19.2.0",
L92:     "@vitejs/plugin-react": "^5.2.0",
L93:     "eslint": "^9.32.0",
L94:     "eslint-config-prettier": "^10.1.1",
L95:     "eslint-plugin-prettier": "^5.2.6",
L96:     "eslint-plugin-react-hooks": "^5.2.0",
L97:     "eslint-plugin-react-refresh": "^0.4.20",
L98:     "globals": "^15.15.0",
L99:     "jsdom": "^20.0.3",
L100:     "nitro": "3.0.260603-beta",
L101:     "prettier": "^3.7.3",
L102:     "typescript": "^5.8.3",
L103:     "typescript-eslint": "^8.56.1",
L104:     "vite": "8.1.5",
L105:     "vitest": "^4.1.10"
L106:   }
L107: }

## vite.config.ts
Lines: 15
L1: // @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
L2: // or the app will break with duplicate plugins:
L3: //   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
L4: //     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
L5: //     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
L6: // You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
L7: import { defineConfig } from "@lovable.dev/vite-tanstack-config";
L8: 
L9: export default defineConfig({
L10:   tanstackStart: {
L11:     // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
L12:     // nitro/vite builds from this
L13:     server: { entry: "server" },
L14:   },
L15: });

## wrangler.toml
Not present in origin/main.

## wrangler.json
Not present in origin/main.

## wrangler.jsonc
Not present in origin/main.

## .github/workflows/build.yml
Lines: 22
L1: name: Doot Cloud Build
L2: 
L3: on:
L4:   push:
L5:     branches: [main]
L6:   pull_request:
L7:     branches: [main]
L8:   workflow_dispatch:
L9: 
L10: permissions:
L11:   contents: read
L12: 
L13: jobs:
L14:   build:
L15:     runs-on: ubuntu-latest
L16:     steps:
L17:       - uses: actions/checkout@v4
L18:       - uses: actions/setup-node@v4
L19:         with:
L20:           node-version: 22
L21:       - run: npm install --no-audit --no-fund
L22:       - run: npm run build

## src/server.ts
Lines: 61
L1: import "./lib/error-capture";
L2: 
L3: import { consumeLastCapturedError } from "./lib/error-capture";
L4: import { renderErrorPage } from "./lib/error-page";
L5: 
L6: type ServerEntry = {
L7:   fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
L8: };
L9: 
L10: let serverEntryPromise: Promise<ServerEntry> | undefined;
L11: 
L12: async function getServerEntry(): Promise<ServerEntry> {
L13:   if (!serverEntryPromise) {
L14:     serverEntryPromise = import("@tanstack/react-start/server-entry").then(
L15:       (m) => (m.default ?? m) as ServerEntry,
L16:     );
L17:   }
L18:   return serverEntryPromise;
L19: }
L20: 
L21: // h3 swallows in-handler throws into a normal 500 Response with body
L22: // {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
L23: async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
L24:   if (response.status < 500) return response;
L25:   const contentType = response.headers.get("content-type") ?? "";
L26:   if (!contentType.includes("application/json")) return response;
L27: 
L28:   const body = await response.clone().text();
L29:   if (!isH3SwallowedErrorBody(body)) return response;
L30: 
L31:   console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
L32:   return new Response(renderErrorPage(), {
L33:     status: 500,
L34:     headers: { "content-type": "text/html; charset=utf-8" },
L35:   });
L36: }
L37: 
L38: function isH3SwallowedErrorBody(body: string): boolean {
L39:   try {
L40:     const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
L41:     return payload.unhandled === true && payload.message === "HTTPError";
L42:   } catch {
L43:     return false;
L44:   }
L45: }
L46: 
L47: export default {
L48:   async fetch(request: Request, env: unknown, ctx: unknown) {
L49:     try {
L50:       const handler = await getServerEntry();
L51:       const response = await handler.fetch(request, env, ctx);
L52:       return await normalizeCatastrophicSsrResponse(response);
L53:     } catch (error) {
L54:       console.error(error);
L55:       return new Response(renderErrorPage(), {
L56:         status: 500,
L57:         headers: { "content-type": "text/html; charset=utf-8" },
L58:       });
L59:     }
L60:   },
L61: };

## src/lib/agents/groq.ts
Lines: 9
L1: import { createOpenAI } from "@ai-sdk/openai";
L2: 
L3: export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
L4: export const GROQ_MODEL = "openai/gpt-oss-20b";
L5: 
L6: /** The single Groq model every agent uses (same provider/model as the original chat). */
L7: export function groqModel(apiKey: string) {
L8:   return createOpenAI({ baseURL: GROQ_BASE_URL, apiKey }).responses(GROQ_MODEL);
L9: }

## Audit questions
- [ ] Does .env.example match the active provider?
- [ ] Are required secrets server-only?
- [ ] Are package dependencies and scripts consistent?
- [ ] Does CI use a supported Node version?
- [ ] Does deployment runtime support the selected SDK?
- [ ] Are runtime bindings documented?
- [ ] Are local Termux runtime limitations separated from CI?

No secrets were intentionally printed.
No build, deployment, or live provider request was performed.
