# Multiverse Pipeline Context Audit (borai control)

Date: 2026-05-24
Scope: Multiverse simulation pipeline from `SoriEditor` UI through Next API proxy, tenant engine routing, Django agent endpoints, Celery tasks, and Neo4j persistence.

## 1) Current execution status against the plan

Implemented in this pass:
- Phase 1 transport bridge is now live for multiverse traffic.
- Frontend no longer calls the SDK client directly for multiverse operations.
- New Next.js proxy routes were added for:
  - `POST /api/agent/simulate`
  - `GET /api/agent/simulate/:taskId/status`
  - `POST /api/agent/branch`
  - `POST /api/agent/commit`
  - `GET /api/agent/multiverse/:storyUid`
- Commit flow now propagates real `relationalBeatId` into the editor callback path and inserts a beat marker into Tiptap.

Not executed yet:
- Timeline page/components phase.
- Twine import/export phase.
- Dedicated tests from the plan (not run in this pass).

## 2) End-to-end pipeline map

### A. Frontend control surface
- Entry UI: `components/editor/SoriEditor.tsx`
- Multiverse controls: `components/multiverse/MultiverseSidebar.tsx`
- State engine: `lib/use-multiverse.ts`

Core client actions:
1. `startSimulation(sceneGoal, [charA, charB])`
2. poll task status
3. `selectChoice(choiceLabel, intent)`
4. `commitBranch()`

### B. Next.js API proxy layer
- Route helper: `app/api/agent/_proxy.ts`
- Endpoint routes under `app/api/agent/**`

Behavior:
- Validates user/tenant context via `requireRequestContext()`.
- Resolves engine target by tenant via `fetchContextEngine()`.
- Forwards request to engine path and returns upstream status + JSON.

### C. Tenant engine routing (control plane)
- Resolver: `lib/context-engine-gateway.ts`
- Schema: `supabase/migrations/003_customer_readiness.sql`

Routing keys:
- `tenants.engine_base_url`
- `tenants.engine_auth_mode` (`none` or `api_key`)
- `tenant_api_keys.api_key` (active key for tenant)

### D. Engine service (Django)
- URL map: `backend/agent/urls.py`
- Views: `backend/agent/views.py`
- Async tasks: `backend/agent/tasks.py`
- Auth middleware (engine mode): `backend/sori/middleware.py`
- Engine settings: `backend/sori/settings_engine.py`

Flow:
1. `simulate_scene` creates multiverse node + dispatches Celery task (`run_simulation_task`).
2. Client polls `simulation_status` until `SUCCESS`/`FAILURE`.
3. `create_branch` creates choice edge + branched snapshot.
4. `commit_branch` marks node canon + merges snapshot knowledge into canonical graph.
5. `get_multiverse_tree` rebuilds tree for hydration.

### E. Persistence surfaces
- Neo4j graph nodes/edges (`backend/graph/models/multiverse.py` and story models).
- Celery result backend for status polling response payload.

## 3) borai-cc / borai-spore control audit

Search result: no direct in-repo references to identifiers `borai-cc` or `borai-spore`.

Current mechanism that should control them:
- The tenant routing layer already supports per-tenant engine target selection.
- `engine_base_url` should point to the desired engine deployment for each tenant.
- If one tenant should route to borai-cc and another to borai-spore, this is configured entirely in tenant records + API key rows.

Concrete control points:
1. `tenants.engine_base_url`
2. `tenants.engine_auth_mode`
3. `tenant_api_keys` active key
4. Optional `X-Tenant-Id` from client session metadata (already propagated by `use-multiverse.ts`)

## 4) Findings and risks

High impact:
1. Character IDs currently come from analyzer display names slugified in `SoriEditor.tsx`; backend expects real `CharacterNode.uid` values. This can cause `CHARACTER_NOT_FOUND` on simulation start.
2. `profiles` passed to `OracleChat` remains hardcoded `null`, so epistemic state visibility in the multiverse pane is still missing.

Medium impact:
3. `commit_branch` currently returns `parentNodeId: None` in response payload regardless of true parent; this can cause inaccurate client tree metadata after commit.
4. `use-multiverse.ts` still builds simulated-node fields from polling payload fallbacks; task payload does not currently include full snapshot/profile metadata.

Low impact:
5. Route helper returns upstream JSON-or-null only; non-JSON engine failures lose detail.

## 5) Recommended next execution slice

1. Character UID source fix:
- Replace slugified names in `SoriEditor` with real graph character IDs from backend data.

2. Epistemic profile propagation:
- Extend task/status payload or multiverse tree payload to include node-level profiles.
- Wire sidebar `profiles` from active node.

3. Timeline phase kickoff:
- Start with `components/timeline/TimelineNode.tsx` + tests (as plan suggests) since this is UI-contained.

4. Twine phase kickoff:
- Implement `lib/twine/parser.ts` + tests first; keep parser/exporter pure and framework-independent.

