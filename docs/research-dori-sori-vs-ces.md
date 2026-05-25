# Research: sori.page vs content-engine-service (CES)

**Date:** 2026-05-25  
**Compared:** `~/code/sori.page` ↔ `content-engine-service`  
**CES docs read:** `docs/user-qa.md`, `docs/mvp-to-sales-roadmap.md`, `README.md`

**Scope note:** `~/code/dori.page` does **not** exist. Research covered **`~/code/sori.page`** only (likely typo).

---

## Executive Summary

| | **sori.page** | **CES** |
|---|---------------|---------|
| **Product** | Consumer writer tool — structure-first narrative AI | B2B operatoer panel for profile-driven content engine |
| **Auth** | Supabase self-serve (OAuth + email) | Admin-gated signup → approval (`docs/user-qa.md` §1.1) |
| **Monetization** | Stripe subscriptions + credits (`lib/billing-config.ts`, `app/api/billing/*`) | Path A concierge — **no public billing by design** (`docs/mvp-to-sales-roadmap.md` §1) |
| **Core loop** | Write → generate beats/characters → talk/simulate in story | Profile → run (chat or form) → boundary → artifact or approval inbox |
| **LLM usage** | Claude Sonnet streaming everywhere (`app/api/generate/character/route.ts`, `backend/agent/chat_service.py`) | Real LLM on runs via BorAI fabric; **heuristic** character gen + council |
| **Differentiator** | Epistemic simulation, Truth Guard, story playground | RBAC, boundary validation, approval pipeline, multi-profile engine, marrk vault refs |

CES is closer to **sellable concierge B2B** than sori is to **operator tooling**, but sori wins on **activation UX**, **streaming**, and **self-serve paywall**. CES wins on **governance**, **enterprise workflow**, and **deploy story**.

---

## 1. UI/UX

### Findings

| Finding | Evidence | Sev |
|---------|----------|-----|
| **sori: writer-first nav, CES: operator sidebar** | sori top nav: Write, Discover, Beats, Characters, Community, Gaps (`app/(app)/layout.tsx`). CES sidebar: Dashboard, Profiles, Characters, Stories, Runs, Skills Guide, Approvals (`panel/src/app/(app)/layout.tsx`) | P2 |
| **sori: live streaming on landing + tools** | Landing runs `/api/analyze` stream demo (`app/(marketing)/page.tsx`, `lib/use-stream.ts`). Character gen SSE (`app/api/generate/character/route.ts`). | P1 |
| **CES: no token streaming on runs** | Runs block until complete; roadmap lists SSE as P2 stretch (`docs/mvp-to-sales-roadmap.md` §5). `RunWorkspace` shows "Generating preview…" pending state (`panel/src/components/RunWorkspace.tsx`). | P1 |
| **CES: dual run entry points** | Chat workspace at `/runs` (`RunWorkspace`) **and** form at `/profiles/[name]/run` (`RunForm`). Dashboard CTA → `/runs`; profiles → form. Onboarding friction. | P1 |
| **sori: story-scoped tab shell** | Editor · Characters · Talk · Scene (`docs/superpowers/specs/2026-05-25-simulation-playground-design.md`, `app/story/[id]/*`). | P2 |
| **CES: Stories are metadata-only** | CRUD + blocker M2M (`backend/apps/stories/models.py`, `panel/src/app/(app)/stories/page.tsx`). No editor, talk, or scene UI. | P2 |
| **sori: mobile-aware layout** | `min-h-[100dvh]`, responsive grids (`app/(app)/layout.tsx`, generate page). | P2 |
| **CES: marketing surface stronger for B2B** | Landing pipeline, pricing, terms, case study (`panel/src/components/landing/LandingPage.tsx`, `docs/mvp-to-sales-roadmap.md` Week 4). sori README still LangChain template boilerplate. | P2 |

### Recommended CES actions (ordered)

1. **P1** — Make `/runs` the primary entry; redirect profile cards to chat workspace with `?profile=` prefill; demote or remove standalone `RunForm` from default flow.
2. **P1** — Add minimal run-progress UX (spinner + elapsed time + cancel) even before full SSE; demo calls feel broken at 30s+ silence.
3. **P2** — First-run empty state on `/runs`: pick profile → example brief → dry-run (borrow sori landing demo pattern).
4. **P2** — Unify Stories into run context picker only; don't build sori-style editor unless product pivots to fiction.

---

## 2. Logical Flow (Signup → First Value → Paywall)

### Findings

| Finding | Evidence | Sev |
|---------|----------|-----|
| **sori: signup → immediate value in ~2 clicks** | Login → `/write` default (`app/(marketing)/login/login-content.tsx`). Protected routes gate app (`middleware.ts`). Credits gate at generation (`lib/credits.ts` → 402). | P1 |
| **CES: signup → admin wait → dashboard** | Signup message + approval gate (`docs/user-qa.md` §1.1). Matches Path A concierge, not self-serve. | P0 (by design for Path A) |
| **sori paywall: Stripe Checkout → credits** | `app/api/billing/checkout/session/route.ts` → success `/generate?billing=success`. Webhook grants credits (`app/api/billing/webhook/route.ts`). | N/A for CES Path A |
| **CES paywall: none public** | QA explicitly checks no billing routes (`docs/user-qa.md` §0.2.6). Pricing page is contact CTA only. | P0 (Path A: invoice, not Stripe) |
| **sori character loop: generate → publish → talk** | Draft/publish gate for Talk/Scene (`backend/agent/character_playground.py`, `backend/agent/chat_service.py` CHAR_NOT_PUBLISHED). | P2 |
| **CES character loop: traits → save → attach to run** | Heuristic gen (`backend/apps/characters/services/generation.py`); attach in `RunWorkspace` via character context. | P1 |
| **CES approval loop (sori has nothing equivalent)** | Inbox profiles → approver-only body visibility (`docs/user-qa.md` §2.4.3, §3.2). Core B2B differentiator. | — (CES strength) |
| **CES council: slash command in chat** | `/council` in `panel/src/lib/runSkills.ts`; heuristic backend (`backend/apps/characters/services/council.py`). | P1 |

### Recommended CES actions (ordered)

1. **P0** — Ship `docs/demo-script.md` + rehearse: landing → signup → approve → dry-run → stage → approval (Week 6 checklist, `docs/mvp-to-sales-roadmap.md` §4 Week 6).
2. **P0** — Document concierge sales motion clearly on `/pricing`: "Book install" not "Start trial" — align copy with Path A decision.
3. **P1** — Post-approval onboarding email with deep link to `/runs?profile=general&skill=brainstorm` and pre-filled example brief.
4. **P1** — Optional LLM character draft mode (flagged) for demo wow; keep heuristic as default to control cost.
5. **P2** — Do **not** port sori Stripe until Path B trigger (≥3 paying concierge customers per roadmap §6).

---

## 3. Optimization & Enhancements

### Findings

| Finding | Evidence | Sev |
|---------|----------|-----|
| **sori: SSE streaming throughout** | Character gen, analyze, chat, simulation use streaming (`use-stream.ts`, `chat_service.py`). | P1 |
| **sori: credit reservation RPC** | Idempotent `reserve_credits` / `finalize_credits` (`lib/credits.ts`). | P2 |
| **sori: rate limiting per tenant** | `lib/rate-limit.ts` on generate/billing routes. | P2 |
| **CES: lane fallback on fabric failure** | `CONTENT_ENGINE_FALLBACK_TOOL` (`docs/mvp-to-sales-roadmap.md` Week 3). | — (CES strength) |
| **CES: boundary validator pre-sink** | Rejection paths in `docs/user-qa.md` §2.5. sori has no equivalent content policy layer. | — (CES strength) |
| **CES: heuristic vs LLM gap** | Character gen + council are rule-based, not fabric-dispatched. Quality ceiling lower than sori Claude paths. | P1 |
| **sori: Celery for heavy simulation** | Multiverse/Scene async (`backend/agent/tasks.py`, playground plan). | P2 |
| **CES: synchronous run pipeline** | `src/content_engine_service/run_pipeline.py` blocks API worker. | P2 |
| **sori: Neo4j graph for epistemic state** | Truth Guard + knowledge facts (`lib/multiverse-truth-guard.ts`, `character_playground.py`). | P2 |
| **CES: marrk vault refs (API-only)** | `vault_refs` on runs; panel picker still stretch (`docs/mvp-to-sales-roadmap.md` §5). | P1 |

### Recommended CES actions (ordered)

1. **P1** — Wire vault refs picker in `RunForm`/`RunWorkspace` (roadmap P2 L — pull forward for demos with marrk).
2. **P1** — Add optional `POST /characters/generate?mode=llm` routing through existing fabric for demo tenants only.
3. **P2** — Council: dispatch multi-turn LLM round via fabric when `COUNCIL_USE_LLM=true`.
4. **P2** — Background job queue for long runs (Path B item; document "email when done" workaround for pilots).
5. **P2** — Borrow sori's idempotent credit pattern only if metering pilots (Path B).

---

## 4. Missing Implementations from Spec Docs

### sori.page (vs its own specs)

| Spec item | Status | Evidence | Sev |
|-----------|--------|----------|-----|
| Simulation playground P0–P1 | **Largely built** | Talk, Characters publish, chat tests exist (`app/story/[id]/talk/page.tsx`, `backend/agent/tests/test_character_chat.py`) | — |
| P2 format presets (novel/script) | **Built** | `lib/format-presets/`, tests | — |
| P3 Scene tab (Multiverse evolution) | **Partial** | `MultiverseSidebar`, simulate routes; plan marks P3 | P2 |
| Community/contribute/gaps | **Surface exists** | Routes in layout; depth unknown | P2 |
| Billing on Account page | **Read-only** | Shows credits/tier; upgrade CTA unclear (`app/(app)/account/page.tsx`) | P1 |

### CES (vs `user-qa.md` + `mvp-to-sales-roadmap.md`)

| Spec item | Status | Evidence | Sev |
|-----------|--------|----------|-----|
| Engine manifest all 6 profiles | **Missing** | `vendor/content-engine/manifest.json` lists only `build-in-public`, `general` | **P0** |
| Email verification on signup | **Open** | Roadmap Week 2 unchecked | P1 |
| Full user-qa sign-off on fresh install | **Open** | Roadmap Week 6 | **P0** |
| Demo script | **Open** | Roadmap Week 6 | **P0** |
| First invoiced pilot | **Open** | Roadmap Week 6 | **P0** |
| Sentry alert routing | **Open** | Roadmap Week 3 | P2 |
| Sample brief library per profile | **Open** | Roadmap stretch | P2 |
| Token streaming SSE | **Open** | Roadmap stretch | P2 |
| Vault refs panel picker | **Open** | Roadmap stretch | P1 |
| Stories in user-qa | **Not covered** | `user-qa.md` has Characters §2.7 but no Stories section | P1 |

### Recommended CES actions (ordered)

1. **P0** — Fix `vendor/content-engine/manifest.json` in engine submodule (4 missing profiles).
2. **P0** — Run full `user-qa.md` on concierge install; record sign-off.
3. **P1** — Add Stories smoke tests to `user-qa.md` (create story → attach in RunWorkspace → verify `story` input).
4. **P1** — Ship demo script + internal pricing doc (`pricing-internal.md` per roadmap).
5. **P2** — Sample brief "Use this example" buttons per profile.

---

## 5. Features for Speed to First Paying Customer

### What sori has that CES should **not** copy for Path A

- Self-serve Stripe Checkout (`app/api/billing/checkout/session/route.ts`)
- Public signup without approval
- Credit-metered consumer UX
- Fiction simulation playground as core SKU

### What sori has that CES **should** borrow (adapted for B2B)

| sori pattern | CES adaptation | Priority |
|--------------|----------------|----------|
| Landing live demo stream | Embedded dry-run preview on marketing page or `/skills-guide` | P1 |
| Immediate post-login destination | Deep link to `/runs` with guided first brief | P0 |
| Credit/paywall clarity | Concierge pricing + license key + "what's included" on `/pricing` | P0 |
| Character talk (LLM in-character) | Optional demo mode for `content-director` / marketing profiles | P2 |
| Publish gate (draft → published) | Mirror as dry-run → stage → approval (already exists; **message it better**) | P1 |

### CES advantages to lead sales calls with

1. **Approval inbox + boundary validation** — enterprise guardrails sori lacks entirely.
2. **Multi-profile engine** — 6 production profiles vs sori's narrative generators.
3. **RBAC + audit + API keys** — operator/approver/admin (`docs/user-qa.md` §2–4).
4. **Concierge install script + license gate** — `deploy/scripts/install_concierge.sh`, `backend/config/license.py`.
5. **marrk vault context** — differentiated for teams with existing knowledge base.

---

## Top 5 P0 Recommendations for CES Speed-to-Revenue

1. **Run full `user-qa.md` on a fresh concierge install and sign off** — blocks any paid handoff (`docs/mvp-to-sales-roadmap.md` Week 6, `docs/user-qa.md` §13).

2. **Close first invoiced pilot from waitlist** — hand outreach, 3 demos, 1 paid install with 30-day kill switch (roadmap Week 6 P0 L).

3. **Ship and rehearse `docs/demo-script.md`** — 10-minute path: landing → signup → approve → dry-run → stage → approval; CES's approval/boundary story is the close, not sori-style character chat.

4. **Fix stale engine manifest** — `vendor/content-engine/manifest.json` missing 4 profiles undermines "6 profiles shipped" claim on sales calls (roadmap Week 1 P0 M).

5. **Consolidate first-value UX to `/runs` chat workspace** — eliminate dual RunForm vs RunWorkspace confusion; add post-approval deep link with example brief so approved operators hit value in one click (sori's `/write` immediacy, adapted for operators).

---

## Appendix: Key File References

**sori.page**

- Nav/layout: `app/(app)/layout.tsx`
- Auth/middleware: `middleware.ts`, `app/(marketing)/login/login-content.tsx`
- Billing: `lib/billing-config.ts`, `app/api/billing/checkout/session/route.ts`, `app/api/billing/webhook/route.ts`
- Character gen (LLM): `app/api/generate/character/route.ts`
- Talk/simulation: `backend/agent/chat_service.py`, `lib/multiverse-truth-guard.ts`
- Playground spec: `docs/superpowers/specs/2026-05-25-simulation-playground-design.md`

**CES**

- Panel nav: `panel/src/app/(app)/layout.tsx`
- Run chat: `panel/src/components/RunWorkspace.tsx`, `panel/src/lib/runSkills.ts`
- Run form (legacy path): `panel/src/app/(app)/profiles/[name]/run/page.tsx`
- Character gen (heuristic): `backend/apps/characters/services/generation.py`
- Council (heuristic): `backend/apps/characters/services/council.py`
- Stories: `backend/apps/stories/models.py`
- Sales roadmap: `docs/mvp-to-sales-roadmap.md`
- QA gate: `docs/user-qa.md`
- Stale manifest: `vendor/content-engine/manifest.json`

---

*Source: deep research subagent task f6882577. dori.page not found; sori.page compared.*
