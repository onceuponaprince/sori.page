# Simulation Playground — Design Spec

**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** Story-scoped simulation playground with character roster, TipTap format presets, solo chat, and multi-agent scenes

---

## Context

sori.page already has:

- **SoriEditor** — TipTap prose editor at `/write` and (on feature branch) `/story/[id]`
- **Multiverse Lab** — two-character simulation with Truth Guard, epistemic profiles, branching (`MultiverseSidebar`, `SimulationManager`, Celery tasks)
- **CharacterNode** — Neo4j model scoped by `story_uid` (name, aliases, role_hint); no author-facing source files yet
- **Contributor infrastructure** — review queues, versioning states (`draft` → `review` → canonized)
- **Character generator** — archetype-based `/characters` page (separate from user-submitted agents)

This spec defines a **Simulation Playground** that merges character-first authoring (within a story) with an evolved Multiverse Lab. It is intentionally **story-scoped in v1** — no global character marketplace.

### Decisions locked in brainstorming

| Topic | Decision |
|-------|----------|
| Product shape | Hybrid **Multiverse evolution + character-first within story** |
| Editor | **TipTap + format presets** (not raw HTML / Twine source editing) |
| Character formats | **MD for authors**; **React components for contributors** (reviewed) |
| Simulation UX | **Talk tab first** (1:1 chat); **Scene tab second** (multi-agent); shared backend |
| Format presets v1 | **Novel + script** only |
| Library scope v1 | **Story-scoped** — no public catalog |
| Navigation | **Tabs on `/story/[id]`** — Editor · Characters · Talk · Scene |
| Storage | **Neo4j-native** + git-style virtual folder UX |
| Sync | **Commit-based** — folder edits are drafts; **Publish to graph** promotes to runtime |

### Recommended architecture

**Approach 1 — Extend `CharacterNode` with draft/published fields** (chosen over split draft nodes or Postgres-backed drafts). Reuses epistemic edges and simulation paths. Revision counter + `published_snapshot` JSON allow migrating to separate draft nodes later without a breaking change.

---

## Section 1 — Product surface & navigation

### Story shell (`/story/[id]`)

Single layout, four tabs:

```
┌─────────────────────────────────────────────────────────┐
│  Story title                    [Novel ▾] [Format ✨]     │
├──────────┬────────────┬────────────┬─────────────────────┤
│  Editor  │ Characters │    Talk    │       Scene         │
└──────────┴────────────┴────────────┴─────────────────────┘
```

| Tab | Purpose |
|-----|---------|
| **Editor** | TipTap scenario/scene writing; preset selector (Novel / Script); **Format document** runs transformer |
| **Characters** | Git-style folder for this story; create/upload MD; contributor React submissions; draft edit + **Publish to graph** |
| **Talk** | Pick one **published** character → 1:1 chat (primary v1 path) |
| **Scene** | Pick 2+ published characters + scene goal → multi-agent simulation (evolved Multiverse Lab) |

**Default landing:**

- Empty roster → open **Characters** tab with empty-state CTA
- Otherwise → **Editor**

**Publish gate:**

- **Talk** and **Scene** only list characters where `published_at` is set
- Drafts show **Unpublished draft** badge in Characters tab

**Format presets (v1):**

- **Novel** — paragraph flow, scene break nodes, emphasis rules
- **Script** — custom TipTap nodes: Character / Dialogue / Parenthetical / Action / Scene Heading

Presets are **transformers on TipTap JSON** (Prettier-like), not separate documents. User selects preset → clicks **Format** → content restructures in place; undo/redo via TipTap history.

`/write` (localStorage draft) remains for quick capture. Playground features require a persisted story at `/story/[id]`. Migration path: "Save to story" promotes local draft → `StoryNode`.

---

## Section 2 — Character files, folder UX, publish flow

### Virtual folder layout

Each story exposes a logical folder (not a real git repo in v1):

```
story/<story_uid>/characters/
  maya-chen.md          ← author MD (default)
  elias-voss.md
  _components/
    oracle-panel.tsx    ← contributor React (review required)
```

The UI renders this as a file tree + editor pane (Characters tab). Paths are stable slugs derived from `name` or frontmatter `id`.

### MD character file format (author path)

```markdown
---
id: maya-chen
name: Maya Chen
tags: [protagonist, thief, guarded]
role_hint: protagonist
voice: clipped, observant, dry humor
knowledge:
  - knows the vault layout from childhood
  - does not know Elias is the mole
---

Maya grew up in the dock district. She trusts actions over words.

## Speech patterns
- Short sentences under stress
- Deflects personal questions with jokes

## Boundaries
- Will not betray children
- Will lie to authority figures
```

**Frontmatter fields (v1):**

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | yes | Stable slug; maps to virtual file path |
| `name` | yes | Display name + simulation identity |
| `tags` | no | Retrieval filters in Characters tab |
| `role_hint` | no | Prompt injection + graph metadata |
| `voice` | no | Style guidance for agent |
| `knowledge` | no | Seed facts before epistemic graph is populated |

Body markdown becomes `character_bio` on publish. Structured lists (`Speech patterns`, `Boundaries`) are parsed into prompt sections.

### React component format (contributor path)

Contributors submit JSX/HTML-tagged components stored under `_components/`. Required wrapper:

```tsx
/**
 * @character id=oracle-sage name="The Oracle" tags=mentor,mystic
 * @review required
 */
export function OracleSage() {
  return (
    <CharacterSheet>
      <Voice>Speaks in questions, never answers directly</Voice>
      <Knowledge>Knows the prophecy; does not know the user's name</Knowledge>
    </CharacterSheet>
  );
}
```

**Contributor gate:**

- `source_type: react` + `review_status: pending` until approved
- Reuses existing contributor review patterns (`draft` → `review` → approved)
- React submissions **cannot** be published to graph until `review_status === approved`
- MD submissions from story owner auto-approve on publish (no contributor queue)

### Draft vs published on `CharacterNode`

Extend `backend/graph/models/story.py` → `CharacterNode`:

```python
# New fields (v1)
source_type          # "md" | "react" | "analyzer" (legacy from outline analysis)
virtual_path         # e.g. "characters/maya-chen.md"
draft_source         # full MD or component source (draft)
draft_frontmatter    # JSON — parsed YAML / @character tags
draft_revision       # int, incremented on each save
published_source     # snapshot at last publish
published_frontmatter
published_at         # DateTime — null = never published
published_revision   # matches draft_revision at publish time
review_status        # "none" | "pending" | "approved" | "rejected" (react only)
character_bio        # extracted body for prompt injection
voice                # string
tags                 # ArrayProperty
agent_config         # JSON — optional runtime knobs (temperature cap, max turns)
```

Legacy analyzer-created characters (outline extraction) get `source_type: analyzer`, empty draft fields, and are treated as published if they already have simulation history.

### Save and publish flow

```
┌─────────────┐    save draft     ┌──────────────────┐
│  Folder UI  │ ────────────────▶ │ CharacterNode    │
│  (edit MD)  │                   │ draft_* fields   │
└─────────────┘                   └────────┬─────────┘
                                           │
                                  Publish to graph
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ published_* set  │
                                  │ rebuild profile  │
                                  │ index tags       │
                                  └──────────────────┘
                                           │
                                           ▼
                                  Talk / Scene eligible
```

**Save draft** (`PUT /api/agent/characters/<story_uid>/<char_id>/draft`):

- Validates frontmatter schema
- Writes `draft_source`, `draft_frontmatter`, bumps `draft_revision`
- Does **not** change Talk/Scene runtime behavior

**Publish** (`POST /api/agent/characters/<story_uid>/<char_id>/publish`):

- Validates draft completeness
- For `react`: requires `review_status === approved`
- Copies draft → published fields, sets `published_at`
- Extracts `character_bio`, `voice`, `tags` into indexed properties
- Optionally seeds `StoryFactNode` rows from `knowledge` frontmatter (creates KNOWS_AT edges)
- Returns updated character for UI

**Discard draft** — revert draft fields to last `published_*` snapshot.

### Retrieval in Characters tab

Story-scoped search/filter only (v1):

- Filter by `tags` (frontmatter)
- Full-text search on `name`, `character_bio`, `draft_source`
- Sort: recently edited, published first, name A–Z

No Weaviate dependency for v1 character retrieval — Neo4j property indexes + in-memory filter suffice at story scale. Tag index: `tags` ArrayProperty on CharacterNode.

---

## Section 3 — Agent runtime: Talk vs Scene

Both modes share one **Agent Runtime** layer that builds prompts from published `CharacterNode` data + story epistemic state.

### Shared: profile builder

Extend `_build_epistemic_profile` in `backend/agent/views.py`:

1. Load published `CharacterNode`
2. Inject `character_bio`, `voice`, `tags` from published frontmatter
3. Merge Neo4j `KNOWS_AT` / `ACTS_ON` facts (existing Truth Guard path)
4. Return `CharacterProfile` / `EpistemicProfile` shape consumed by simulation

Published MD `knowledge` frontmatter seeds facts on first publish; subsequent simulation updates flow through existing snapshot machinery.

### Talk tab — solo chat (v1 primary)

**UX:** Character picker (published only) → chat thread → streaming messages.

**Backend:** New endpoint `POST /api/agent/chat/` (sync streaming SSE, not Celery):

```json
{
  "story_uid": "...",
  "character_id": "...",
  "message": "Why did you take the key?",
  "thread_id": "optional-uuid-for-continuity"
}
```

**Prompt shape:**

- System: character identity from published profile + Truth Guard (known/unknown facts)
- User/assistant alternating history (last N turns, configurable)
- Explicit constraint: in-character dialogue only; no novel prose for the writer

**Persistence:**

- `ChatThreadNode` (new Neo4j node, story-scoped) linked to `CharacterNode`
- Stores message array JSON; optional link to Editor selection for context ("talk about this scene")

**Why sync SSE, not Celery:** 1:1 chat expects sub-second first token; multi-turn latency matters more than batch simulation throughput.

### Scene tab — multi-agent (v1 secondary)

**UX:** Evolved Multiverse Lab — scene goal, pick 2 characters, run simulation, branch/commit. Lives in Scene tab instead of sidebar (sidebar deprecated on `/story/[id]`).

**Backend:** Reuse existing pipeline unchanged:

- `POST /api/agent/simulate` → Celery → `SimulationManager`
- `GET /api/agent/simulate/<taskId>/status`
- `POST /api/agent/branch`, `POST /api/agent/commit`
- `GET /api/agent/multiverse/<storyUid>`

**Changes:**

- Character picker reads **published** characters only
- Scene goal can pre-fill from Editor selection or current TipTap paragraph
- Oracle / Tree sub-tabs mirror current MultiverseSidebar behavior

### Mode comparison

| | Talk | Scene |
|---|------|-------|
| Agents | 1 | 2+ |
| Transport | SSE sync | Celery async + poll |
| Truth Guard | yes | yes |
| Branching | no (v1) | yes |
| Celery required | no | yes |
| Primary v1 | **yes** | secondary tab |

---

## Section 4 — Editor & format presets

### TipTap extensions (v1)

**Shared:**

- Preset selector in story header (applies to Editor tab content)
- **Format** button runs selected transformer
- Document stored as TipTap JSON on `StoryNode` (new field `editor_document JSONProperty`) or existing draft pipeline

**Novel preset transformer:**

- Merge consecutive plain paragraphs
- Insert `sceneBreak` node between `#` headings or `---` horizontal rules
- Normalize `"quoted dialogue"` inline vs block quote heuristics

**Script preset transformer:**

- Detect `NAME:` lines → `scriptCharacter` + `scriptDialogue` nodes
- `INT./EXT.` lines → `scriptSceneHeading`
- Parentheticals in `()` → `scriptParenthetical`
- Action lines → `scriptAction`

**Export (v2, out of scope v1):** TipTap JSON → Fountain / FDX / plain MD.

### Editor ↔ playground context

Optional **"Use as scene goal"** action: selected TipTap text → prefills Scene tab scene goal or Talk tab opening context. Stored as ephemeral UI state, not persisted until simulation runs.

---

## Section 5 — API surface (new + modified)

### New Django endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agent/characters/<story_uid>/` | List characters (draft + published metadata) |
| GET | `/api/agent/characters/<story_uid>/<char_id>/` | Single character with draft source |
| PUT | `/api/agent/characters/<story_uid>/<char_id>/draft` | Save draft |
| POST | `/api/agent/characters/<story_uid>/<char_id>/publish` | Publish to graph |
| POST | `/api/agent/characters/<story_uid>/` | Create character (MD template) |
| DELETE | `/api/agent/characters/<story_uid>/<char_id>/` | Delete unpublished; soft-delete published |
| POST | `/api/agent/chat/` | Solo chat (SSE stream) |
| GET | `/api/agent/chat/<thread_id>/` | Thread history |

React contributor submit: `POST /api/agent/characters/<story_uid>/component` → sets `review_status: pending`, creates contributor queue item (integrate with `/contribute`).

### New Next.js proxy routes

Mirror pattern from `app/api/agent/_proxy.ts`:

- `app/api/agent/characters/[storyUid]/...`
- `app/api/agent/chat/route.ts` (SSE passthrough)

### Modified frontend

| File / area | Change |
|-------------|--------|
| `app/story/[id]/layout.tsx` | **New** — tab shell (Editor · Characters · Talk · Scene) |
| `app/story/[id]/page.tsx` | Editor tab content (SoriEditor scoped) |
| `app/story/[id]/characters/page.tsx` | **New** — folder + MD editor |
| `app/story/[id]/talk/page.tsx` | **New** — solo chat |
| `app/story/[id]/scene/page.tsx` | **New** — Multiverse Lab full tab |
| `components/playground/*` | **New** — shared pickers, publish bar, format toolbar |
| `lib/format-presets/*` | **New** — novel + script transformers |
| `components/multiverse/MultiverseSidebar.tsx` | Deprecated on story routes; logic moves to Scene tab |

---

## Section 6 — Data model additions

### CharacterNode extensions

See Section 2 field list. Migration via `init_graph` Cypher defaults for new properties on existing nodes.

### ChatThreadNode (new)

```python
class ChatThreadNode(StructuredNode):
    uid = UniqueIdProperty()
    story_uid = StringProperty(required=True, index=True)
    character_id = StringProperty(required=True)  # CharacterNode.uid
    messages = JSONProperty(default=[])  # [{role, content, at}]
    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)
```

Linked: `(StoryNode)-[:HAS_CHAT]->(ChatThreadNode)`, `(ChatThreadNode)-[:WITH_CHARACTER]->(CharacterNode)`.

### StoryNode extension

```python
editor_document = JSONProperty(default=None)  # TipTap JSON for Editor tab
editor_preset = StringProperty(default="novel")  # "novel" | "script"
default_tab = StringProperty(default="editor")
```

---

## Section 7 — Error handling & edge cases

| Case | Behavior |
|------|----------|
| Talk with unpublished character | Block in UI; API returns 409 `CHARACTER_NOT_PUBLISHED` |
| Publish invalid frontmatter | 422 with field-level errors in editor |
| React publish without approval | 403 `REVIEW_REQUIRED` |
| Chat references unknown fact | Truth Guard flags in metadata; show inline warning (soft, v1) |
| Simulation without Celery | Scene tab shows actionable error (reuse existing pattern) |
| Empty character roster | Characters tab empty state; Talk/Scene disabled with link |
| Analyzer-created legacy characters | Shown as published if used in prior sims; editable MD optional |
| Concurrent draft edits | Last save wins on draft; publish validates `draft_revision` matches (409 on stale) |

---

## Section 8 — Testing strategy

### Backend (pytest)

- MD frontmatter parse + publish promotes fields correctly
- Publish rejects react without approval
- Chat endpoint streams in-character response; rejects unpublished character
- Scene simulate still works with published-only picker filter
- Stale revision publish returns 409

### Frontend (Vitest + RTL)

- Tab navigation and publish gate
- Format preset transformers (novel + script fixture JSON)
- Characters folder: save draft does not enable Talk; publish does
- Talk tab: message send + stream mock

### Manual QA

Follow pattern of `docs/qa/live-multiverse-timeline-twine.md` — story-scoped checklist for Editor → Characters → Publish → Talk → Scene.

---

## Section 9 — v1 scope & out of scope

### In scope (v1)

- `/story/[id]` tab shell with Editor, Characters, Talk, Scene
- MD character create/edit/upload; virtual folder UX
- Draft save + Publish to graph (commit-based sync)
- Contributor React submit + review gate (minimal queue integration)
- Novel + script format presets on Editor tab
- Talk: 1:1 streaming chat with published characters
- Scene: existing multiverse simulation with published-only characters
- Story-scoped tag search in Characters tab

### Out of scope (v1)

- Global public character catalog
- Graphic novel + essay presets
- Raw HTML / Twine source editing
- Bidirectional or auto-sync (only explicit publish)
- Talk branching / group chat
- React component sandbox execution in browser (components are parsed for metadata + stored source; runtime uses extracted prompt fields)
- Mobile-optimized layout (responsive but desktop-first)
- Credit metering for chat (reuse existing credits hook if present; otherwise defer)

### Phased delivery (recommended)

| Phase | Deliverable |
|-------|-------------|
| **P0** | Story tab shell + CharacterNode draft/publish API + Characters tab |
| **P1** | Talk tab + chat endpoint + thread persistence |
| **P2** | Editor format presets (novel, script) |
| **P3** | Scene tab (Multiverse Lab migration) + contributor React path |

P0 + P1 constitutes the **user-visible MVP** (character roster + solo chat). P2 + P3 complete the hybrid B+C vision.

---

## Section 10 — Open questions (non-blocking)

1. **Credits:** Does each chat message deduct credits like beat generation? Default: yes, same pool, lower cost per message.
2. **Thread retention:** Infinite history vs last 50 messages in prompt context — default: last 20 in prompt, full history in Neo4j.
3. **`/write` migration:** Prompt to create story on first Publish or first Talk — default: soft banner linking to `/story/new`.

These can be resolved during implementation planning without spec revision.

---

## Approval

- [x] User reviewed spec
- [ ] Ready for implementation plan (`writing-plans` skill) — plan at `docs/superpowers/plans/2026-05-25-simulation-playground.md`
