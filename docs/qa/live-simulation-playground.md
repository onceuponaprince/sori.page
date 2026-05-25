# Live QA — Simulation Playground (Talk path)

Manual walkthrough for the **Talk** tab on branch **`feat/simulation-playground`**.

Focus: story-scoped character roster → publish gate → 1:1 SSE chat. Scene tab and Multiverse simulations are out of scope here (see `live-multiverse-timeline-twine.md`).

Use this doc top-to-bottom. Check each box as you go. Record failures in the **Issues log** at the bottom.

---

## Before you start

### 0.1 Checkout the feature branch

```bash
git checkout feat/simulation-playground
```

### 0.2 Start infrastructure

**Terminal 1 — Docker:**

```bash
./scripts/start-stack.sh
```

Talk chat is **sync SSE** (no Celery required). Redis is only needed if you also test Scene simulations.

**Terminal 2 — Next.js frontend:**

```bash
yarn dev
```

**Terminal 3 — Context engine (if not started by script):**

Included in `./scripts/start-stack.sh`. Verify http://localhost:8001 responds.

**Terminal 4 (optional) — Django locally:**

Only if you are **not** using the Docker `backend` / `context-engine` services:

```bash
cd backend && python manage.py runserver
```

### 0.3 Verify `.env`

| Variable | Used for |
|----------|----------|
| `ANTHROPIC_API_KEY` | Character chat replies |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Auth + API context |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser login |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | CharacterNode storage |
| `NEXT_PUBLIC_API_URL=http://localhost:8001` | Agent proxy to context-engine |

### 0.4 Health checks

| Check | How | Pass? |
|-------|-----|-------|
| Frontend | http://localhost:3010 loads | ☐ |
| Context engine | http://localhost:8001/api/health/ or similar | ☐ |
| Neo4j | http://localhost:7474 (neo4j / soripage_dev_2024) | ☐ |

### 0.5 Sign in

1. Go to http://localhost:3010/login
2. Sign in with your Supabase provider
3. Confirm you land in the app

| Pass? |
|-------|
| ☐ |

---

## Section 1 — Story shell & tab navigation

**URL:** http://localhost:3010/story/`<storyUid>`

Use an existing story UID from `/write` or create one by visiting `/story/<new-uuid>`.

### 1.1 Tab bar

| Step | Expected | Pass? |
|------|----------|-------|
| Header shows **Editor · Characters · Talk · Scene** | Four tabs visible | ☐ |
| Story UID chip shows first 8 chars | Matches URL `id` | ☐ |
| **Editor** tab active on `/story/<id>` | Highlighted tab | ☐ |
| Click **Characters** | Navigates to `/story/<id>/characters` | ☐ |

### 1.2 Publish gate (no published characters)

On a **fresh story** with zero published characters:

| Step | Expected | Pass? |
|------|----------|-------|
| **Talk** tab appears disabled (greyed) | `cursor-not-allowed`, title tooltip | ☐ |
| **Scene** tab appears disabled | Same | ☐ |
| Click disabled **Talk** | Does not navigate | ☐ |
| Tooltip / title mentions publishing a character first | — | ☐ |

---

## Section 2 — Characters tab (setup for Talk)

**URL:** http://localhost:3010/story/`<storyUid>`/characters

### 2.1 Create a character

| Step | Expected | Pass? |
|------|----------|-------|
| Click **New character** (or equivalent) | Prompt for name | ☐ |
| Enter name (e.g. "Maya Chen") | Character appears in folder list | ☐ |
| Network: `POST /api/agent/characters/<storyUid>` | 201/200 | ☐ |
| MD editor opens with default frontmatter template | `id`, `name` fields present | ☐ |

### 2.2 Edit draft

| Step | Expected | Pass? |
|------|----------|-------|
| Edit body / frontmatter (voice, knowledge, bio) | Editor accepts input | ☐ |
| **Save draft** | Network: `PUT .../draft` → 200 | ☐ |
| Unpublished badge visible | Not yet in Talk picker | ☐ |

### 2.3 Publish to graph

| Step | Expected | Pass? |
|------|----------|-------|
| Click **Publish to graph** | Network: `POST .../publish` → 200 | ☐ |
| Character shows published state | Badge / bar updates | ☐ |
| **Talk** tab in header becomes enabled | No longer greyed out | ☐ |

**Optional:** Create a second character and leave it **draft-only** to verify Talk picker excludes unpublished rows.

---

## Section 3 — Talk tab (1:1 chat)

**URL:** http://localhost:3010/story/`<storyUid>`/talk

Prerequisites: at least one **published** character (Section 2).

### 3.1 Empty / loading states

| Step | Expected | Pass? |
|------|----------|-------|
| Page loads without crash | Talk panel visible | ☐ |
| Character picker lists **published only** | Draft character absent | ☐ |
| First published character auto-selected | Picker + subtitle show name | ☐ |
| Empty thread message | "Say something to …" placeholder | ☐ |

### 3.2 Send a message (SSE stream)

| Step | Expected | Pass? |
|------|----------|-------|
| Type a message and click **Send** | User bubble appears immediately | ☐ |
| Network: `POST /api/agent/chat` | 200, `text/event-stream` | ☐ |
| Assistant reply streams incrementally | Character bubble grows token-by-token | ☐ |
| Send button disabled while loading | Shows `…` on button | ☐ |
| Reply completes | Button returns to **Send** | ☐ |

**502 / 401?** → Context engine down or session expired. Re-login and check `NEXT_PUBLIC_API_URL`.

**CHARACTER_NOT_FOUND?** → Character not published or wrong `character_id`.

### 3.3 Multi-turn thread

| Step | Expected | Pass? |
|------|----------|-------|
| Send a follow-up message | Prior turns remain visible | ☐ |
| Second `POST /api/agent/chat` includes `thread_id` | Body has prior thread | ☐ |
| Character response references prior context | Subjective — sanity check | ☐ |

### 3.4 Switch character

| Step | Expected | Pass? |
|------|----------|-------|
| Select a different published character | Picker updates | ☐ |
| Message history clears | Fresh thread (or prior thread for that character if one exists) | ☐ |
| New message works | New stream | ☐ |

### 3.5 Thread reload on refresh

Prerequisites: at least one exchange in Section 3.2 (thread persisted).

| Step | Expected | Pass? |
|------|----------|-------|
| Send 1+ messages so a `thread_id` is returned in SSE | Network shows `type: "thread"` event | ☐ |
| Hard refresh `/story/<id>/talk` (F5) | Page reloads without crash | ☐ |
| Network: `GET /api/agent/chat/<threadId>` | 200 with prior `messages` array | ☐ |
| Prior user + assistant bubbles reappear | Same content as before refresh | ☐ |
| Send a follow-up after reload | `POST` body includes same `thread_id`; context retained | ☐ |
| Optional: open `/story/<id>/talk?thread_id=<threadId>` in new tab | History loads from URL param | ☐ |

### 3.6 Credit / error handling

| Step | Expected | Pass? |
|------|----------|-------|
| (If credits exhausted) Send message | Error banner + link to `/account` | ☐ |
| Invalid empty send | Submit disabled | ☐ |

---

## Section 4 — API proxy spot checks

| Frontend route | Method | Expected |
|----------------|--------|----------|
| `/api/agent/characters/<uid>` | GET | `{ characters: [...] }` |
| `/api/agent/characters/<uid>` | POST | Create character |
| `/api/agent/characters/<uid>/<charId>/draft` | PUT | Save draft |
| `/api/agent/characters/<uid>/<charId>/publish` | POST | Publish |
| `/api/agent/chat` | POST | SSE stream |
| `/api/agent/chat/<threadId>` | GET | Thread history |

DevTools → Network while exercising Section 3.

| All routes 200 (or expected 402 for credits)? | Pass? |
|-----------------------------------------------|-------|
| ☐ |

---

## Section 5 — Scene tab (published-only simulate guard)

**URL:** http://localhost:3010/story/`<storyUid>`/scene

Prerequisites: Celery + Redis running if testing full simulation; at least one published character.

| Step | Expected | Pass? |
|------|----------|-------|
| Scene picker lists **published only** | Draft character absent | ☐ |
| Run simulation with two published characters | `POST /api/agent/simulate` → 200 / task queued | ☐ |
| (DevTools) Submit unpublished `character_id` in simulate body | Backend **409** `CHARACTER_NOT_PUBLISHED` (or equivalent) | ☐ |
| UI does not offer draft characters in picker | Cannot select unpublished ID from UI | ☐ |

---

## Section 6 — Characters React component submit

**URL:** http://localhost:3010/story/`<storyUid>`/characters

| Step | Expected | Pass? |
|------|----------|-------|
| Upload or paste a `.tsx` file with `@character` JSDoc tags | Component accepted by folder UI | ☐ |
| Network: `POST /api/agent/characters/<storyUid>/component` | 200/201 | ☐ |
| Character row shows `review_status: pending` (or pending badge) | Not yet in Talk/Scene pickers until approved | ☐ |
| Contributor queue entry created (if wired) | Visible in `/contribute` or admin review | ☐ |

---

## Section 7 — Editor beat insert *(pending verification)*

**URL:** http://localhost:3010/story/`<storyUid>` (Editor tab)

> **Status:** Not verified in live QA yet — check when Scene ↔ Editor integration is stable.

| Step | Expected | Pass? |
|------|----------|-------|
| Select text or beat in Editor | Selection active | ☐ |
| Use **Insert beat** / scene-goal action (if exposed) | Selected text prefills Scene goal or inserts beat node | ☐ *(pending)* |
| Beat appears in timeline / document | Structural link preserved | ☐ *(pending)* |

---

## Section 8 — Regression (unchanged routes)

| Route | Expected | Pass? |
|-------|----------|-------|
| `/story/<id>` (Editor) | TipTap loads | ☐ |
| `/story/<id>/timeline` | Timeline still loads (if data exists) | ☐ |
| `/write` | Local draft editor loads | ☐ |

---

## Automated tests (optional pre-QA)

```bash
yarn test lib/__tests__/use-story-characters.test.ts
yarn test lib/__tests__/use-character-chat.test.ts
yarn test lib/__tests__/character-md.test.ts
cd backend && pytest agent/tests/test_character_chat.py agent/tests/test_character_publish.py -v
```

---

## Issues log

| # | Section | Steps to reproduce | Expected | Actual | Severity |
|---|---------|-------------------|----------|--------|----------|
| 1 | | | | | |
| 2 | | | | | |

---

## Quick reference — URLs

| Purpose | URL |
|---------|-----|
| Story editor | `/story/<storyUid>` |
| Characters | `/story/<storyUid>/characters` |
| Talk | `/story/<storyUid>/talk` |
| Scene | `/story/<storyUid>/scene` |

---

*Generated for branch `feat/simulation-playground` — Talk path QA.*
