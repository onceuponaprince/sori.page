# Live QA — Multiverse Timeline + Twine

Manual walkthrough for multiverse timeline + Twine work. Use branch **`feat/simulation-playground`** (includes merged multiverse timeline features).

Use this doc top-to-bottom. Check each box as you go. Record failures in the **Issues log** at the bottom.

## Before you start

### 0.1 Checkout the feature branch

```bash
git checkout feat/simulation-playground
```

> **Note:** `main` does not include timeline/Twine/playground pages yet. All routes below assume this branch.

### 0.2 Start infrastructure

**Terminal 1 — Docker (Neo4j, Weaviate, Redis, context-engine):**

```bash
./scripts/start-stack.sh
# or: docker compose up -d neo4j weaviate redis context-engine
```

Optional: also run `backend` in Docker, or run Django locally (see 0.3).

**Terminal 2 — Celery worker (required for simulations):**

```bash
cd backend
celery -A sori worker --loglevel=info
```

**Terminal 3 — Next.js frontend:**

```bash
yarn dev
```

**Terminal 4 (if not using Docker backend) — Django:**

```bash
cd backend && python manage.py runserver
```

### 0.3 Verify `.env`

Minimum for this QA pass:

| Variable | Used for |
|----------|----------|
| `ANTHROPIC_API_KEY` | Simulation dialogue |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Auth + API context |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser login |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Multiverse graph |
| `NEXT_PUBLIC_API_URL=http://localhost:8001` | Context-engine proxy |
| `CELERY_BROKER_URL=redis://localhost:6379/0` | Task queue (default) |

### 0.4 Health checks

| Check | How | Pass? |
|-------|-----|-------|
| Frontend | http://localhost:3010 loads | ☐ |
| Context engine | http://localhost:8001/api/health/ or similar responds | ☐ |
| Neo4j | http://localhost:7474 (neo4j / soripage_dev_2024) | ☐ |
| Redis | `redis-cli ping` → `PONG` | ☐ |
| Celery | Worker log shows `ready` | ☐ |

### 0.5 Sign in

1. Go to http://localhost:3010/login
2. Sign in with Google / GitHub / Twitter (whatever your Supabase project supports)
3. Confirm you land in the app (not bounced back to marketing)

| Pass? |
|-------|
| ☐ |

---

## Section 1 — Story editor entry points

### 1.1 Legacy write route (`/write`)

**URL:** http://localhost:3010/write

| Step | Expected | Pass? |
|------|----------|-------|
| Page loads with Tiptap editor | Title input, draft area, structural sidebar | ☐ |
| Chip shows first 8 chars of `storyUid` | Random UUID from localStorage on first visit | ☐ |
| **Test** button toggles Multiverse Lab sidebar | Third column opens/closes | ☐ |
| **Analyze** disabled until ≥ 40 chars | Button greyed out below threshold | ☐ |

Copy the **story UID chip** value — you'll need it for timeline URLs.

### 1.2 Story-scoped editor (`/story/[id]`)

**URL:** http://localhost:3010/story/`<your-story-uid>`

| Step | Expected | Pass? |
|------|----------|-------|
| Same editor UI as `/write` | Layout matches | ☐ |
| Story UID chip matches URL `id` | Not a fresh random UUID | ☐ |
| Multiverse sidebar uses same `storyUid` | Network tab: `/api/agent/multiverse/<id>` | ☐ |

> There is **no "Open timeline" button** in the editor yet. Navigate manually to Section 4.

---

## Section 2 — Multiverse Lab (API bridge + simulation)

Open Multiverse Lab via **Test** on either editor route.

### 2.1 Empty tree load

| Step | Expected | Pass? |
|------|----------|-------|
| Open DevTools → Network | — | ☐ |
| Open Multiverse Lab | `GET /api/agent/multiverse/<storyUid>` fires | ☐ |
| Response is 200 (or 404 if brand-new story) | No 401 / 502 | ☐ |
| **Tree** tab shows node count badge | `0` or root count | ☐ |

**401?** → Auth/session broken. **502?** → Context engine down or `NEXT_PUBLIC_API_URL` wrong.

### 2.2 Character dropdowns (canonical UIDs)

| Step | Expected | Pass? |
|------|----------|-------|
| Network: `GET /api/agent/characters/<storyUid>` | 200 with `{ characters: [...] }` | ☐ |
| Agent A / Agent B dropdowns populated | Names from graph, not slugified analyzer names | ☐ |

**If empty:** You need `CharacterNode` rows in Neo4j for this story. Options:

- Run analyze + ingestion pipeline that persists characters, **or**
- Create characters via admin/backend tooling, **or**
- Skip to **Section 6 (Twine import)** to seed a tree without live simulation

### 2.3 Start a simulation

Prerequisites: Redis running, Celery worker running, `ANTHROPIC_API_KEY` set, **two distinct characters** selected.

| Step | Expected | Pass? |
|------|----------|-------|
| Enter scene goal (e.g. "Maya tries to steal the key") | Text accepted | ☐ |
| Select Agent A and Agent B (different) | **Test Plausibility** enables | ☐ |
| Click **Test Plausibility** | Button → "Agents interacting..." | ☐ |
| Network: `POST /api/agent/simulate` | **202** with `{ taskId, nodeId }` | ☐ |
| Network: polling `GET /api/agent/simulate/<taskId>/status` | Repeats until `SUCCESS` | ☐ |
| Oracle tab streams dialogue turns | Messages appear incrementally | ☐ |
| Simulation completes | Button returns to "Test Plausibility" | ☐ |

**Stuck on "Agents interacting..."?** → Celery worker or Redis not running.

**CHARACTER_NOT_FOUND?** → Dropdown IDs don't match Neo4j `CharacterNode.uid`.

### 2.4 Branch + commit flow

| Step | Expected | Pass? |
|------|----------|-------|
| After simulation, mark a decision / select a choice | Tree tab shows new branch | ☐ |
| Network: `POST /api/agent/branch` | 200/201 with new node | ☐ |
| Commit branch to canon (if UI exposes it) | `POST /api/agent/commit` | ☐ |
| Committed node type → `canon` in tree state | Gold styling in Tree tab | ☐ |

### 2.5 Epistemic profiles ("who knows what")

After a **completed** simulation on an explored node:

| Step | Expected | Pass? |
|------|----------|-------|
| Oracle tab → **show knowledge** | Toggle visible | ☐ |
| Two character knowledge panels render | Not empty / not hidden | ☐ |
| DevTools: active node has `epistemicProfiles.length === 2` | In multiverse state or tree GET response | ☐ |

Navigate away and back — profiles should persist (cached on `MultiverseSceneNode` in Neo4j).

---

## Section 3 — Resume deep link (`?resumeNode=`)

You need a **simulation or decision node UID** from Section 2 (copy from Tree tab or Network response).

**URL:** http://localhost:3010/story/`<storyUid>`/scene?resumeNode=`<nodeUid>`

| Step | Expected | Pass? |
|------|----------|-------|
| Page loads in Scene workspace with selected branch active | No need to switch routes | ☐ |
| Active node in Tree tab matches `resumeNode` | Highlighted / navigated | ☐ |
| Oracle context matches that node | Dialogue from that simulation | ☐ |
| Change URL to invalid UID | Graceful — no crash; stays on last valid node | ☐ |

---

## Section 4 — Full-page timeline

**URL:** http://localhost:3010/story/`<storyUid>`/timeline

### 4.1 Page chrome

| Step | Expected | Pass? |
|------|----------|-------|
| Header: "Multiverse Timeline" | Dark theme header bar | ☐ |
| **← Back to editor** | Goes to `/story/<id>` | ☐ |
| Badge: `N nodes` | Matches tree size | ☐ |
| Badge: `★ M canon` | Count of canon nodes | ☐ |
| **Export to Twine** link present | Green chip in header | ☐ |

### 4.2 Timeline rendering

| Step | Expected | Pass? |
|------|----------|-------|
| Nodes arranged in columns (depth left → right) | Horizontal branching layout | ☐ |
| SVG edges connect parent → child | Curved lines between cards | ☐ |
| **DECISION** nodes | Purple border, clickable | ☐ |
| **EXPLORED** (simulation) nodes | Red/dark border, clickable | ☐ |
| **CANON** nodes | Gold border, **not** clickable (default cursor) | ☐ |
| Paradox nodes | Paradox badge visible | ☐ |
| Confidence pips | 5 dots, filled by confidence score | ☐ |
| Structural pattern chip | When node has pattern metadata | ☐ |
| Active node | White border highlight | ☐ |

### 4.3 Click-to-resume

| Step | Expected | Pass? |
|------|----------|-------|
| Click an **EXPLORED** or **DECISION** node | Navigates away | ☐ |
| URL becomes `/story/<id>/scene?resumeNode=<uid>` | Query param present | ☐ |
| Multiverse Lab open + correct node (Section 3) | End-to-end resume works | ☐ |
| Click a **CANON** node | Nothing happens (no navigation) | ☐ |

### 4.4 Empty / error states

Test with a **brand-new random UUID** (no multiverse data):

**URL:** http://localhost:3010/story/00000000-0000-0000-0000-000000000099/timeline

| Step | Expected | Pass? |
|------|----------|-------|
| Loading state briefly | "Loading timeline…" | ☐ |
| Empty tree or error banner | No white screen / no uncaught exception | ☐ |

---

## Section 5 — Twine export

From timeline header, click **Export to Twine**.

| Step | Expected | Pass? |
|------|----------|-------|
| Browser downloads `.html` file | Filename like `sori-story-<uid>.html` | ☐ |
| File opens in Twine 2 (optional) | Passages + links visible | ☐ |
| Canon nodes tagged `canon` in passage metadata | Inspect HTML `tags` attribute | ☐ |
| Decision nodes tagged `decision` | Not collapsed to `explored` | ☐ |
| Simulation nodes tagged `explored` | — | ☐ |
| Paradox nodes tagged `paradox` | When applicable | ☐ |

**API-only check (if download fails):**

```bash
# Replace STORY_UID and paste session cookie or use browser while logged in
curl -b "your-cookies" -o export.html \
  "http://localhost:3010/api/story/STORY_UID/export/twine"
```

| Pass? |
|-------|
| ☐ |

---

## Section 6 — Twine import

> **Known gap:** The timeline page has **Export** but no **Import from Twine** button yet (spec'd, not shipped). Test import via API or DevTools.

### 6.1 API import (recommended)

Use the file from Section 5, or any valid Twee / Twine 2 HTML file (< 25 MB).

**Browser console** (while logged in on localhost:3010):

```javascript
const file = /* pick from Section 5 download */;
const fd = new FormData();
fd.append("file", file);
fd.append("storyTitle", "QA Round-Trip Story");

const res = await fetch("/api/story/import/twine", { method: "POST", body: fd });
const data = await res.json();
console.log(res.status, data);
// Expect 201 + { storyUid: "..." }
```

| Step | Expected | Pass? |
|------|----------|-------|
| Response **201** | `{ storyUid: "<new-uuid>" }` | ☐ |
| Open `/story/<newStoryUid>/timeline` | Imported structure renders | ☐ |
| Node count matches export | Same passages/branches | ☐ |
| Canon / decision / simulation types preserved | Match Section 5 tags | ☐ |

### 6.2 Round-trip fidelity (export → import → compare)

| Step | Expected | Pass? |
|------|----------|-------|
| Export story A from timeline | `story-a.html` | ☐ |
| Import as new story B | New `storyUid` | ☐ |
| Timeline B node count = Timeline A | ±0 | ☐ |
| Edge labels preserved | Choice text matches | ☐ |
| Decision nodes still **DECISION** in UI | Not degraded to EXPLORED | ☐ |

### 6.3 Import error cases

| Case | How | Expected | Pass? |
|------|-----|----------|-------|
| Empty file | Upload blank `.html` | 422 "No passages found" | ☐ |
| Oversized file | > 25 MB | 413 | ☐ |
| Not logged in | Log out, retry import | 401 | ☐ |
| Invalid format | Upload random `.txt` | 422 parse error | ☐ |

---

## Section 7 — Auth & proxy edge cases

| Case | How | Expected | Pass? |
|------|-----|----------|-------|
| Unauthenticated multiverse fetch | Log out, open Lab | 401, user-friendly error | ☐ |
| Context engine down | Stop `context-engine` container | 502 "Backend unavailable" | ☐ |
| Simulation timeout | (Hard to trigger) — watch 2 min | Error state + retry affordance | ☐ |

---

## Section 8 — Regression spot-checks (unchanged app areas)

Quick smoke on routes that shouldn't break:

| Route | Expected | Pass? |
|-------|----------|-------|
| `/` | Landing / waitlist loads | ☐ |
| `/generate` | Beat generator page loads | ☐ |
| `/characters` | Character generator loads | ☐ |
| `/contribute` | Contributor queue loads | ☐ |
| `/admin` | Admin dashboard (if you have access) | ☐ |

---

## Automated tests (optional pre-QA)

On `feat/simulation-playground`:

```bash
yarn test          # Vitest — expect 49 passing
yarn typecheck     # May show pre-existing baseline errors
```

Backend pytest files exist but need a harness:

```bash
cd backend && pytest agent/tests/ -v   # May not run yet
```

---

## Issues log

| # | Section | Steps to reproduce | Expected | Actual | Severity |
|---|---------|-------------------|----------|--------|----------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## Quick reference — URLs

| Purpose | URL |
|---------|-----|
| Editor (local draft) | `/write` |
| Editor (pinned story) | `/story/<storyUid>` |
| Timeline | `/story/<storyUid>/timeline` |
| Resume branch | `/story/<storyUid>/scene?resumeNode=<nodeUid>` |
| Export Twine | `/api/story/<storyUid>/export/twine` |
| Import Twine | `POST /api/story/import/twine` (multipart) |

## Quick reference — API proxy routes

| Frontend route | Backend |
|----------------|---------|
| `GET /api/agent/multiverse/<uid>` | Tree fetch |
| `POST /api/agent/simulate` | Start simulation |
| `GET /api/agent/simulate/<taskId>/status` | Poll task |
| `POST /api/agent/branch` | Create branch |
| `POST /api/agent/commit` | Commit to canon |
| `GET /api/agent/characters/<uid>` | Character list |

---

*Generated for branch `feat/simulation-playground`.*
