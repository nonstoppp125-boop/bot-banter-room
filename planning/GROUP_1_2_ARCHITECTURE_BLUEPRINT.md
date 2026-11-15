# Group 1.2 — Architecture Blueprint & Integration Inventory

Source baseline: origin/main

## 1. Repository inventory
- Total tracked files: 105
- Source files: 78
- Package dependencies: 63
- Development dependencies: 21

## Routes and API (4)
- `src/routes/README.md`
- `src/routes/__root.tsx`
- `src/routes/api/chat.ts`
- `src/routes/index.tsx`

## Agent workforce (6)
- `src/lib/agents/groq.ts`
- `src/lib/agents/liza-default.ts`
- `src/lib/agents/orchestrator.ts`
- `src/lib/agents/registry.ts`
- `src/lib/agents/specialists.ts`
- `src/lib/agents/types.ts`

## UI and components (55)
- `src/components/ai-elements/conversation.tsx`
- `src/components/ai-elements/message.tsx`
- `src/components/ai-elements/prompt-input.tsx`
- `src/components/ai-elements/shimmer.tsx`
- `src/components/ui/accordion.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/aspect-ratio.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/breadcrumb.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/carousel.tsx`
- `src/components/ui/chart.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/context-menu.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/hover-card.tsx`
- `src/components/ui/input-group.tsx`
- `src/components/ui/input-otp.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/menubar.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/progress.tsx`
- `src/components/ui/radio-group.tsx`
- `src/components/ui/resizable.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/slider.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/spinner.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/toggle-group.tsx`
- `src/components/ui/toggle.tsx`
- `src/components/ui/tooltip.tsx`
- `src/routes/__root.tsx`
- `src/routes/index.tsx`

## Data and persistence candidates (0)

## Authentication candidates (0)

## Tests (3)
- `src/test/app-routing.test.tsx`
- `src/test/chat-api.test.ts`
- `src/test/setup.ts`

## Deployment (1)
- `.github/workflows/build.yml`

## 2. Runtime and integration dependencies

### dependencies
- `@ai-sdk/openai`: `^4.0.106`
- `@ai-sdk/react`: `^4.0.158`
- `@hookform/resolvers`: `^5.2.2`
- `@radix-ui/react-accordion`: `^1.2.12`
- `@radix-ui/react-alert-dialog`: `^1.1.15`
- `@radix-ui/react-aspect-ratio`: `^1.1.8`
- `@radix-ui/react-avatar`: `^1.1.11`
- `@radix-ui/react-checkbox`: `^1.3.3`
- `@radix-ui/react-collapsible`: `^1.1.12`
- `@radix-ui/react-context-menu`: `^2.2.16`
- `@radix-ui/react-dialog`: `^1.1.15`
- `@radix-ui/react-dropdown-menu`: `^2.1.16`
- `@radix-ui/react-hover-card`: `^1.1.15`
- `@radix-ui/react-label`: `^2.1.8`
- `@radix-ui/react-menubar`: `^1.1.16`
- `@radix-ui/react-navigation-menu`: `^1.2.14`
- `@radix-ui/react-popover`: `^1.1.15`
- `@radix-ui/react-progress`: `^1.1.8`
- `@radix-ui/react-radio-group`: `^1.3.8`
- `@radix-ui/react-scroll-area`: `^1.2.10`
- `@radix-ui/react-select`: `^2.2.6`
- `@radix-ui/react-separator`: `^1.1.8`
- `@radix-ui/react-slider`: `^1.3.6`
- `@radix-ui/react-slot`: `^1.2.4`
- `@radix-ui/react-switch`: `^1.2.6`
- `@radix-ui/react-tabs`: `^1.1.13`
- `@radix-ui/react-toggle`: `^1.1.10`
- `@radix-ui/react-toggle-group`: `^1.1.11`
- `@radix-ui/react-tooltip`: `^1.2.8`
- `@streamdown/cjk`: `^1.0.4`
- `@streamdown/code`: `^2.0.0`
- `@streamdown/math`: `^1.0.3`
- `@streamdown/mermaid`: `^1.0.3`
- `@tailwindcss/vite`: `^4.2.1`
- `@tanstack/react-query`: `^5.101.1`
- `@tanstack/react-router`: `1.170.41`
- `@tanstack/react-start`: `1.168.60`
- `@tanstack/router-plugin`: `1.168.42`
- `ai`: `^7.0.154`
- `class-variance-authority`: `^0.7.1`
- `clsx`: `^2.1.1`
- `cmdk`: `^1.1.1`
- `date-fns`: `^4.1.0`
- `embla-carousel-react`: `^8.6.0`
- `input-otp`: `^1.4.2`
- `lucide-react`: `^0.575.0`
- `motion`: `^14.9.0`
- `nanoid`: `^6.0.2`
- `react`: `^19.2.0`
- `react-day-picker`: `^9.14.0`
- `react-dom`: `^19.2.0`
- `react-hook-form`: `^7.71.2`
- `react-resizable-panels`: `^4.6.5`
- `recharts`: `^2.15.4`
- `sonner`: `^2.0.7`
- `streamdown`: `^2.7.1`
- `tailwind-merge`: `^3.5.0`
- `tailwindcss`: `^4.2.1`
- `tw-animate-css`: `^1.3.4`
- `use-stick-to-bottom`: `^1.1.6`
- `vaul`: `^1.1.2`
- `vite-tsconfig-paths`: `^6.0.2`
- `zod`: `^3.25.76`

### devDependencies
- `@eslint/js`: `^9.32.0`
- `@lovable.dev/vite-tanstack-config`: `2.26.5`
- `@testing-library/jest-dom`: `^6.6.0`
- `@testing-library/react`: `^16.0.0`
- `@types/node`: `^22.16.5`
- `@types/react`: `^19.2.0`
- `@types/react-dom`: `^19.2.0`
- `@vitejs/plugin-react`: `^5.2.0`
- `eslint`: `^9.32.0`
- `eslint-config-prettier`: `^10.1.1`
- `eslint-plugin-prettier`: `^5.2.6`
- `eslint-plugin-react-hooks`: `^5.2.0`
- `eslint-plugin-react-refresh`: `^0.4.20`
- `globals`: `^15.15.0`
- `jsdom`: `^20.0.3`
- `nitro`: `3.0.260603-beta`
- `prettier`: `^3.7.3`
- `typescript`: `^5.8.3`
- `typescript-eslint`: `^8.56.1`
- `vite`: `8.1.5`
- `vitest`: `^4.1.10`

## 3. Target architecture — proposed, not yet implemented

```text
Web / PWA / Telegram clients
          |
     API Gateway
          |
Authentication + Workspace Authorization
          |
Conversation / Context Service
          |
Manager + Planner + Policy Gate
          |
Specialist Agent Registry
  | Research | LinkedIn | Social | BI | Coding |
          |
Tool / Integration Gateway
          |
Human Approval for consequential actions
          |
Provider Adapter Layer
          |
Persistence + Memory + Audit Log
```

## 4. Required architectural contracts
- One shared agent interface and typed execution context.
- Manager delegates through registered capabilities, not arbitrary imports.
- Every tool has explicit permission and side-effect classification.
- Provider keys remain server-side and provider adapters are replaceable.
- Conversation, user, and workspace data must be tenant-isolated.
- External publishing, messaging, and code execution require policy checks.
- Each integration uses official APIs, scoped OAuth, and revocable credentials.
- All agent outputs carry provenance, errors, and execution status.

## 5. Integration acceptance requirements
- API contracts and validation documented.
- Auth and workspace ownership enforced server-side.
- Persistence and memory interfaces documented.
- Provider fallback and quota/error behavior tested.
- Agent delegation and specialist failures tested.
- Approval lifecycle tested before external side effects.
- Telegram and web use the same backend contracts.
- Runtime/build/test compatibility established on supported deployment target.

## 6. Important limitation
This inventory is a static repository scan. File names do not prove feature implementation.
The target architecture is a proposal. It must be reconciled with source evidence before coding.
Local checkout remains unmerged; no application source was modified.