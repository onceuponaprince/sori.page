# Multiverse Timeline + Twine Integration — Design Spec

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Three sequential phases — API bridge (prerequisite), timeline view (new feature), Twine round-trip (new feature)

---

## Context

The Multiverse Lab and SoriEditor are ~70% implemented. The backend (Django REST API, Celery tasks, Neo4j models, serializers) is fully operational. The frontend reducer and type definitions are complete and well-designed. The critical gap is a transport mismatch: `useMultiverse` calls a phantom context-engine SDK client instead of the real Django `/api/agent/*` endpoints. Nothing works end-to-end until that bridge is in place.

On top of the wiring fix, two user-facing features are in scope: a full-page Multiverse Timeline View that lets writers navigate their branching story history and resume simulation from any past decision point, and a Twine round-trip that lets writers import Twine stories as seeded multiverse trees and export any multiverse as a playable Twine HTML file.

---

## Phase 1 — API Bridge (Prerequisite)

### Problem

`lib/use-multiverse.ts` calls `createContextEngineClient()` from a non-existent SDK. All five async operations (load tree, start simulation, poll status, create branch, commit branch) are broken at the transport layer. Everything else — the reducer, state machine, polling loop, type definitions — is sound.

### Solution

Replace every SDK call with `fetch` to a Next.js proxy layer that forwards to Django. Follow the existing pattern established by `/api/analyze` and `/api/drafts`.

### Files to Change

**`lib/use-multiverse.ts`** — Replace 5 SDK calls with direct `fetch`:

| Hook action | Old call | New endpoint |
|---|---|---|
| `loadTree` | `sdk.getMultiverseTree(storyUid)` | `GET /api/agent/multiverse/[storyUid]` |
| `startSimulation` | `sdk.startSimulation(req)` | `POST /api/agent/simulate` |
| `pollStatus` | `sdk.getSimulationStatus(taskId)` | `GET /api/agent/simulate/[taskId]/status` |
| `createBranch` | `sdk.createBranch(req)` | `POST /api/agent/branch` |
| `commitBranch` | `sdk.commitBranch(req)` | `POST /api/agent/commit` |

The reducer actions, polling interval, and timeout logic are unchanged. Only the transport swaps.

**New Next.js proxy routes** (thin — no business logic, forward auth token from Supabase session):

- `app/api/agent/simulate/route.ts`
- `app/api/agent/simulate/[taskId]/status/route.ts`
- `app/api/agent/branch/route.ts`
- `app/api/agent/commit/route.ts`
- `app/api/agent/multiverse/[storyUid]/route.ts`

Each reads the Supabase session, extracts the user token, forwards the request to `DJANGO_API_URL/api/agent/...`, and returns the response.

**`components/editor/MultiverseLab.tsx`** — Remove the local `createSeedMultiverseTree()` call and replace with `useMultiverse(storyUid)`. The existing `useMultiverse` hook already exports `loadTree`, `startSimulation`, `commitBranch` etc — wire them to the corresponding UI handlers that currently operate on local state.

**`components/editor/SoriEditor.tsx`** — Fix `onBeatCreated`. Currently updates a label only. After fix: call `editor.commands.insertContent(beatBlock)` where `beatBlock` is a structured Tiptap node built from the committed beat summary and structural pattern label. Insert at the end of the current document.

**`components/editor/OracleChat.tsx` / `MultiverseSidebar.tsx`** — Remove the hardcoded `profiles = null`. After Phase 1, `state.activeNode` carries `epistemicProfiles` from the simulation status response (Django already builds this via `_build_epistemic_profile()`). Pass `state.activeNode?.epistemicProfiles ?? null` as the `profiles` prop.

### Invariants

- No new business logic enters the Next.js proxy routes — they are transparent forwarders.
- The Django API contract is not changed.
- The reducer, action types, and polling loop in `use-multiverse.ts` are not changed.

---

## Phase 2 — Multiverse Timeline View

### Overview

A full-page route at `/story/[id]/timeline`. Writers navigate their complete branching narrative history as a horizontal flow map. Canon beats are highlighted in gold. Explored/abandoned branches are dimmed. Clicking any node resumes simulation from that point.

### Layout

Horizontal left-to-right flow using CSS flexbox column groups. An SVG overlay (absolute-positioned, full-width) draws the connecting edges. Framer Motion animations from the existing `sori-motion.ts` (`treeStagger`, `nodePopIn`, `canonCommit`) are used for entry animation and node state transitions.

Layout algorithm: BFS traversal of the multiverse tree groups nodes by their depth level. Each depth level becomes a flex column. Nodes at the same depth that share a parent are stacked vertically within their column group. The SVG edge layer computes connector coordinates from node DOM refs using `getBoundingClientRect`.

### Visual Node States

| Node type | Border | Background | Label chip |
|---|---|---|---|
| `decision` | purple `#8a6abf` | `#1a1530` | `DECISION` — purple |
| `canon` | gold `#c8a840` | `#1a1a0e` | `CANON ★` — gold |
| `simulation` / explored | muted red `#3a2020` | `#120e0e` | `EXPLORED` — dim, 65% opacity |
| `+ placeholder` | dashed purple | transparent | `Simulate next beat` |

Each node card displays four data fields:
- **Beat title** — `node.summary` truncated to 2 lines
- **Structural pattern chip** — `node.structuralPattern` (e.g. "Revelation", "Confrontation")
- **Paradox badge** — `⚠ paradox` in red, only when `node.hasParadox === true`
- **Confidence pip scale** — 5 pips filled proportionally from `node.confidence` (0–1)

### Click-to-Resume

Clicking any non-canon, non-placeholder node:
1. Calls `createBranch({ fromNodeUid: node.uid, storyUid })` via the wired `useMultiverse` hook
2. On success, pushes router to `/story/[id]/scene` with a `?resumeNode=<uid>` query param
3. `ScenePanel` reads `resumeNode` on mount and calls `navigateTo(uid)` to restore simulation context

### New Files

- `app/story/[id]/timeline/page.tsx` — fetches tree, renders layout, owns click-to-resume navigation
- `components/timeline/MultiverseTimeline.tsx` — layout engine (CSS flex + SVG overlay)
- `components/timeline/TimelineNode.tsx` — single node card, props: `node`, `isActive`, `onClick`
- `components/timeline/TimelineEdge.tsx` — SVG connector, props: `fromRef`, `toRef`, `isCanon`

### Modified Files

- `components/playground/ScenePanel.tsx` — read `?resumeNode` query param on mount; call `navigateTo(resumeNodeUid)` to restore simulation context when arriving from the timeline page

### Header

The timeline page header shows: story title, node count, canon node count, a back link to the editor, and (Phase 3) the Export to Twine button.

---

## Phase 3 — Twine Round-Trip

### Export → Twine

**Route:** `GET /api/story/[id]/export/twine`

Steps:
1. Fetch full multiverse tree via the existing `/api/agent/multiverse/[storyUid]/` endpoint
2. Map each `MultiverseSceneNode` to a Twine 2 passage:
   - Passage name: `node.uid` (slugified)
   - Passage text: `node.summary` + dialogue turns joined as quoted lines
   - Tags: `canon` if `node.isCanon`, `paradox` if `node.hasParadox`, structural pattern label
3. Map each `ChoiceEdge` to a Twine link appended to the source passage: `[[edge.label|target-uid]]`
4. Wrap passages in a valid Twine 2 HTML archive (`<tw-storydata>` containing `<tw-passagedata>` elements)
5. Return as `Content-Disposition: attachment; filename="story-name.html"`

No new dependency — Twine 2 HTML is string templating.

**UI:** "Export to Twine" button in the timeline page header. Triggers a `window.location` download.

### Import ← Twine

**Route:** `POST /api/story/import/twine`  
**Input:** multipart form with the `.tw` or `.html` file + `storyTitle`

Steps:
1. Detect format: if file starts with `<!DOCTYPE` parse as Twine 2 HTML (read `<tw-passagedata>` elements); otherwise parse as Twee (split on `:: Passage Name` headers, extract `[[link]]` syntax with regex)
2. Build an in-memory tree: passages → `SimulationNodeShape[]`, links → `ChoiceEdgeShape[]`
3. POST to new Django endpoint `POST /api/agent/import/` with the tree payload
4. Django creates a new `StoryNode` in Neo4j, bulk-creates `MultiverseSceneNode` objects and `ChoiceEdge` relationships using existing neomodel classes
5. Return `{ storyUid }`, redirect client to `/story/[storyUid]/timeline`

**New Django endpoint:** `POST /api/agent/import/` in `backend/agent/views.py`. Uses the existing `MultiverseSceneNode`, `ChoiceEdgeNode` neomodel classes. Requires a new `ImportRequestSerializer` in `backend/agent/serializers.py`.

**UI:** "Import from Twine" button in the timeline page header, opens a modal with a file input accepting `.tw` and `.html`.

---

## Data Flow Summary

```
Writer uploads .tw/.html
  → POST /api/story/import/twine (Next.js)
  → POST /api/agent/import/ (Django)
  → Neo4j: StoryNode + MultiverseSceneNodes + ChoiceEdges
  → redirect /story/[uid]/timeline

Writer views /story/[uid]/timeline
  → useMultiverse(storyUid).loadTree()
  → GET /api/agent/multiverse/[storyUid]/ (Next.js proxy)
  → GET /api/agent/multiverse/[storyUid]/ (Django)
  → Neo4j BFS traversal → MultiverseState

Writer clicks a node → resumes simulation
  → createBranch({ fromNodeUid })
  → POST /api/agent/branch/ → Neo4j
   → router.push /story/[id]/scene?resumeNode=<uid>
   → Scene panel mounts, loads context, ready to simulate

Writer exports
  → GET /api/story/[id]/export/twine (Next.js)
  → fetch tree → map to Twine 2 HTML → download
```

---

## Error Handling

- **Simulation timeout** (>120s): existing Celery hard limit triggers; hook polls until 2min timeout, then dispatches `SIMULATION_ERROR` — UI shows retry button.
- **Branch creation on canon node**: disallow in UI (no click handler on canon nodes); backend also validates node type and returns 400 if attempted.
- **Twine import parse failure**: return 422 with the specific parse error (passage name, line number). UI shows inline error in the import modal.
- **Twine export on empty tree**: return 400 if story has zero nodes. UI disables the export button when `nodeCount === 0`.
- **Django unavailable**: proxy routes return 502 with a structured error; UI surfaces "Backend unavailable, try again."

---

## Testing

**Phase 1 — API bridge:**
- Unit: mock `fetch` in `use-multiverse.test.ts`, assert all 5 actions call the correct endpoints with correct payloads
- Integration: spin up Django test server, call each proxy route, assert Neo4j state

**Phase 2 — Timeline view:**
- Playwright: navigate to `/story/[id]/timeline`, assert all nodes render with correct visual state (canon gold border, paradox badge present)
- Playwright: click an explored node, assert redirect to Scene with `?resumeNode` param
- Vitest: `MultiverseTimeline` unit test with a mock tree — assert correct column grouping from BFS layout

**Phase 3 — Twine round-trip:**
- Unit: `parseTwee(input)` and `parseTwineHtml(input)` with fixture files, assert correct node/edge shapes
- Unit: `buildTwineHtml(tree)` with a fixture tree, assert valid `<tw-storydata>` output
- Integration: import a known `.tw` fixture → assert Neo4j nodes created → export → re-parse → assert structural equivalence (round-trip fidelity)

---

## Out of Scope (v1)

- Real-time collaborative multiverse editing
- Twine format v1 (only Twine 2 HTML and Twee 3 supported)
- Exporting to Ink (Inkle's scripting language) — structurally similar but separate feature
- Auto-layout beyond 3 branch levels (CSS flex handles this; canvas renderer is a future upgrade)
