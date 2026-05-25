# Simulation Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a story-scoped simulation playground at `/story/[id]` with Characters (MD draft/publish), Talk (1:1 agent chat), Editor format presets (novel/script), and Scene (evolved Multiverse Lab).

**Architecture:** Four sequential phases (P0–P3), each independently committable. Extend Neo4j `CharacterNode` with draft/published fields and commit-based sync from a virtual folder UI. Talk uses a new sync SSE chat endpoint; Scene reuses existing Celery multiverse pipeline with published-only character gating. TipTap format presets are pure JSON transformers + script custom nodes.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, TipTap, Framer Motion, neomodel (Neo4j), Django REST Framework, Anthropic Claude API, Supabase auth, Vitest + RTL, Celery + Redis (Scene tab only)

**Spec:** `docs/superpowers/specs/2026-05-25-simulation-playground-design.md`

**Prerequisite:** Merge `feat/multiverse-timeline-twine` into your working branch first (provides `/story/[id]`, Vitest harness, `app/api/agent/_proxy.ts`, extended `list_characters`). If not merged, complete **Task 0** before P0.

---

## File Map

### Prerequisite — Task 0 (only if feat branch not merged)

| Action | Path |
|--------|------|
| Merge/cherry-pick | `feat/multiverse-timeline-twine` → working branch |
| Or create | `vitest.config.ts`, `vitest.setup.ts`, `app/api/agent/_proxy.ts`, `app/story/[id]/page.tsx` |

### P0 — Story shell + Characters draft/publish

| Action | Path |
|--------|------|
| Modify | `backend/graph/models/story.py` |
| Create | `backend/graph/models/chat.py` |
| Create | `backend/agent/character_parser.py` |
| Modify | `backend/agent/serializers.py` |
| Modify | `backend/agent/views.py` |
| Modify | `backend/agent/urls.py` |
| Modify | `docker/neo4j/init/` (constraints if needed) |
| Create | `backend/agent/tests/test_character_parser.py` |
| Create | `backend/agent/tests/test_character_publish.py` |
| Create | `types/character.ts` |
| Create | `lib/character-md.ts` |
| Create | `lib/use-playground-characters.ts` |
| Create | `lib/__tests__/character-md.test.ts` |
| Create | `app/story/[id]/layout.tsx` |
| Create | `app/story/[id]/characters/page.tsx` |
| Modify | `app/story/[id]/page.tsx` |
| Create | `components/playground/StoryTabNav.tsx` |
| Create | `components/playground/CharacterFolder.tsx` |
| Create | `components/playground/CharacterEditor.tsx` |
| Create | `components/playground/PublishBar.tsx` |
| Create | `app/api/agent/characters/[storyUid]/route.ts` |
| Create | `app/api/agent/characters/[storyUid]/[charId]/route.ts` |
| Create | `app/api/agent/characters/[storyUid]/[charId]/draft/route.ts` |
| Create | `app/api/agent/characters/[storyUid]/[charId]/publish/route.ts` |

### P1 — Talk tab + SSE chat

| Action | Path |
|--------|------|
| Create | `backend/agent/chat_service.py` |
| Modify | `backend/agent/views.py` (chat endpoints) |
| Modify | `backend/agent/urls.py` |
| Create | `backend/agent/tests/test_character_chat.py` |
| Create | `app/api/agent/chat/route.ts` |
| Create | `app/api/agent/chat/[threadId]/route.ts` |
| Create | `lib/use-character-chat.ts` |
| Create | `lib/__tests__/use-character-chat.test.ts` |
| Create | `app/story/[id]/talk/page.tsx` |
| Create | `components/playground/TalkPanel.tsx` |
| Create | `components/playground/CharacterPicker.tsx` |

### P2 — Editor format presets (novel + script)

| Action | Path |
|--------|------|
| Create | `lib/format-presets/types.ts` |
| Create | `lib/format-presets/novel.ts` |
| Create | `lib/format-presets/script.ts` |
| Create | `lib/tiptap/script-nodes.ts` |
| Create | `lib/__tests__/format-presets-novel.test.ts` |
| Create | `lib/__tests__/format-presets-script.test.ts` |
| Create | `components/playground/FormatToolbar.tsx` |
| Modify | `components/editor/SoriEditor.tsx` |
| Modify | `backend/graph/models/story.py` (`editor_document`, `editor_preset`) |
| Create | `app/api/story/[id]/document/route.ts` |

### P3 — Scene tab + contributor React path

| Action | Path |
|--------|------|
| Create | `app/story/[id]/scene/page.tsx` |
| Create | `components/playground/ScenePanel.tsx` |
| Modify | `components/multiverse/MultiverseSidebar.tsx` (extract shared internals) |
| Modify | `backend/agent/views.py` (published-only simulate guard) |
| Create | `backend/agent/component_parser.py` |
| Create | `backend/agent/tests/test_component_submit.py` |
| Create | `app/api/agent/characters/[storyUid]/component/route.ts` |
| Create | `docs/qa/live-simulation-playground.md` |

---

## Task 0: Prerequisite — story shell + test harness

**Skip if** `feat/multiverse-timeline-twine` is already merged.

**Files:**
- Merge: `feat/multiverse-timeline-twine`

- [ ] **Step 1: Merge feature branch**

```bash
git checkout main
git merge feat/multiverse-timeline-twine
```

Expected: `/story/[id]/page.tsx`, `vitest.config.ts`, `app/api/agent/_proxy.ts` present.

- [ ] **Step 2: Verify harness**

```bash
yarn test
yarn typecheck
```

Expected: Vitest runs (may be 0 tests on main portions); no new regressions.

- [ ] **Step 3: Commit** (if merge produced conflicts resolved)

```bash
git commit -m "chore: merge multiverse timeline branch as playground prerequisite"
```

---

## Phase P0 — Story shell + Characters draft/publish

---

### Task 1: Character MD parser (backend)

**Files:**
- Create: `backend/agent/character_parser.py`
- Create: `backend/agent/tests/test_character_parser.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/agent/tests/test_character_parser.py
import pytest
from agent.character_parser import parse_character_md, serialize_character_md

SAMPLE = """---
id: maya-chen
name: Maya Chen
tags: [protagonist, thief]
role_hint: protagonist
voice: clipped, dry humor
knowledge:
  - knows the vault layout
  - does not know Elias is the mole
---

Maya grew up in the dock district.
"""

def test_parse_character_md_extracts_frontmatter_and_body():
    result = parse_character_md(SAMPLE)
    assert result["frontmatter"]["id"] == "maya-chen"
    assert result["frontmatter"]["name"] == "Maya Chen"
    assert "protagonist" in result["frontmatter"]["tags"]
    assert "dock district" in result["body"]

def test_parse_character_md_requires_id_and_name():
    with pytest.raises(ValueError, match="id"):
        parse_character_md("---\nname: Only Name\n---\nbody")

def test_serialize_round_trip():
    parsed = parse_character_md(SAMPLE)
    reserialized = serialize_character_md(parsed["frontmatter"], parsed["body"])
    reparsed = parse_character_md(reserialized)
    assert reparsed["frontmatter"]["id"] == "maya-chen"
    assert reparsed["body"].strip().startswith("Maya grew up")
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && python -m pytest agent/tests/test_character_parser.py -v
```

- [ ] **Step 3: Implement parser**

```python
# backend/agent/character_parser.py
"""Parse and serialize author MD character files."""
from __future__ import annotations

import re
from typing import Any

import yaml

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def parse_character_md(source: str) -> dict[str, Any]:
    match = _FRONTMATTER_RE.match(source.strip())
    if not match:
        raise ValueError("Character MD must start with YAML frontmatter delimited by ---")
    raw_yaml, body = match.group(1), match.group(2).strip()
    frontmatter = yaml.safe_load(raw_yaml) or {}
    if not frontmatter.get("id"):
        raise ValueError("Frontmatter field 'id' is required")
    if not frontmatter.get("name"):
        raise ValueError("Frontmatter field 'name' is required")
    tags = frontmatter.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    frontmatter["tags"] = tags
    knowledge = frontmatter.get("knowledge") or []
    if isinstance(knowledge, str):
        knowledge = [knowledge]
    frontmatter["knowledge"] = knowledge
    return {"frontmatter": frontmatter, "body": body}


def serialize_character_md(frontmatter: dict[str, Any], body: str) -> str:
    payload = dict(frontmatter)
    yaml_block = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True).strip()
    return f"---\n{yaml_block}\n---\n\n{body.strip()}\n"


def extract_character_bio(body: str) -> str:
    """First paragraph + ## sections appended for prompt injection."""
    return body.strip()
```

Add `pyyaml` to `backend/requirements.txt` if not present.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/agent/character_parser.py backend/agent/tests/test_character_parser.py backend/requirements.txt
git commit -m "feat(agent): MD character file parser with frontmatter validation"
```

---

### Task 2: Extend CharacterNode + StoryNode (Neo4j models)

**Files:**
- Modify: `backend/graph/models/story.py`

- [ ] **Step 1: Add fields to CharacterNode**

Add after existing `role_hint` field:

```python
    source_type = StringProperty(default="analyzer")  # md | react | analyzer
    virtual_path = StringProperty()
    draft_source = StringProperty(default="")
    draft_frontmatter = JSONProperty(default={})
    draft_revision = IntegerProperty(default=0)
    published_source = StringProperty(default="")
    published_frontmatter = JSONProperty(default={})
    published_at = DateTimeProperty()
    published_revision = IntegerProperty(default=0)
    review_status = StringProperty(default="none")  # none | pending | approved | rejected
    character_bio = StringProperty(default="")
    voice = StringProperty(default="")
    tags = ArrayProperty(StringProperty(), default=[])
    agent_config = JSONProperty(default={})
    updated_at = DateTimeProperty(default_now=True)
```

Add to `StoryNode`:

```python
    editor_document = JSONProperty(default=None)
    editor_preset = StringProperty(default="novel")
    default_tab = StringProperty(default="editor")
```

- [ ] **Step 2: Commit**

```bash
git add backend/graph/models/story.py
git commit -m "feat(graph): extend CharacterNode and StoryNode for playground drafts"
```

---

### Task 3: Character serializers + publish logic

**Files:**
- Modify: `backend/agent/serializers.py`
- Modify: `backend/agent/views.py`
- Modify: `backend/agent/urls.py`
- Create: `backend/agent/tests/test_character_publish.py`

- [ ] **Step 1: Write failing publish tests**

```python
# backend/agent/tests/test_character_publish.py
import pytest
from unittest.mock import MagicMock, patch
from agent.character_parser import serialize_character_md

FRONTMATTER = {
    "id": "maya-chen",
    "name": "Maya Chen",
    "tags": ["protagonist"],
    "voice": "clipped",
    "knowledge": ["knows the vault layout"],
}
BODY = "Maya grew up in the dock district."
DRAFT = serialize_character_md(FRONTMATTER, BODY)


@pytest.fixture
def mock_char_node():
    node = MagicMock()
    node.uid = "char-uid-1"
    node.story_uid = "story-1"
    node.name = "Maya Chen"
    node.source_type = "md"
    node.draft_source = DRAFT
    node.draft_frontmatter = FRONTMATTER
    node.draft_revision = 1
    node.published_at = None
    node.review_status = "none"
    node.character_bio = ""
    node.voice = ""
    node.tags = []
    return node


@patch("agent.views.MultiverseSceneNode", create=True)
@patch("agent.views.CharacterNode")
def test_publish_promotes_draft_to_published(mock_char_cls, _scene, mock_char_node):
    from agent.views import _publish_character_node

    mock_char_cls.nodes.get.return_value = mock_char_node
    result = _publish_character_node(mock_char_node, expected_revision=1)

    assert result["published"] is True
    assert mock_char_node.published_source == DRAFT
    assert mock_char_node.character_bio == BODY
    assert mock_char_node.voice == "clipped"
    mock_char_node.save.assert_called()


@patch("agent.views.CharacterNode")
def test_publish_rejects_stale_revision(mock_char_cls, mock_char_node):
    from agent.views import _publish_character_node

    mock_char_node.draft_revision = 2
    with pytest.raises(ValueError, match="STALE_REVISION"):
        _publish_character_node(mock_char_node, expected_revision=1)


@patch("agent.views.CharacterNode")
def test_publish_rejects_unapproved_react(mock_char_cls, mock_char_node):
    from agent.views import _publish_character_node

    mock_char_node.source_type = "react"
    mock_char_node.review_status = "pending"
    with pytest.raises(ValueError, match="REVIEW_REQUIRED"):
        _publish_character_node(mock_char_node, expected_revision=1)
```

Extract `_publish_character_node` as a testable pure function in `views.py`.

- [ ] **Step 2: Add serializers**

```python
# backend/agent/serializers.py (append)

class CharacterDraftSerializer(serializers.Serializer):
    source = serializers.CharField()
    expected_revision = serializers.IntegerField(required=False)


class CharacterCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    id_slug = serializers.CharField(max_length=200, required=False)


class CharacterListSerializer(serializers.Serializer):
    """Response shape — built manually in view."""
    pass
```

- [ ] **Step 3: Implement views**

Add to `backend/agent/views.py`:

- `list_story_characters(story_uid)` — GET list with draft/published metadata
- `get_story_character(story_uid, char_id)` — GET single incl. `draft_source`
- `create_story_character(story_uid)` — POST MD template
- `save_character_draft(story_uid, char_id)` — PUT draft + bump revision
- `publish_character(story_uid, char_id)` — POST publish
- `delete_story_character(story_uid, char_id)` — DELETE

Response shape for list item:

```python
{
    "id": char.uid,
    "name": char.name,
    "virtualPath": char.virtual_path,
    "sourceType": char.source_type,
    "draftRevision": char.draft_revision,
    "publishedAt": char.published_at.isoformat() if char.published_at else None,
    "reviewStatus": char.review_status,
    "tags": list(char.tags or []),
    "isPublished": char.published_at is not None,
}
```

On create, seed `draft_source` from template:

```python
TEMPLATE_FRONTMATTER = {"id": slug, "name": name, "tags": [], "knowledge": []}
TEMPLATE_BODY = f"{name} — describe voice, boundaries, and backstory here."
```

- [ ] **Step 4: Register URLs**

```python
    path("characters/<str:story_uid>/", views.list_story_characters, name="agent-characters-list"),
    path("characters/<str:story_uid>/create/", views.create_story_character, name="agent-characters-create"),
    path("characters/<str:story_uid>/<str:char_id>/", views.get_story_character, name="agent-character-detail"),
    path("characters/<str:story_uid>/<str:char_id>/draft/", views.save_character_draft, name="agent-character-draft"),
    path("characters/<str:story_uid>/<str:char_id>/publish/", views.publish_character, name="agent-character-publish"),
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && python -m pytest agent/tests/test_character_publish.py agent/tests/test_character_parser.py -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/agent/serializers.py backend/agent/views.py backend/agent/urls.py backend/agent/tests/test_character_publish.py
git commit -m "feat(agent): character draft save and publish-to-graph endpoints"
```

---

### Task 4: Frontend character MD utilities

**Files:**
- Create: `types/character.ts`
- Create: `lib/character-md.ts`
- Create: `lib/__tests__/character-md.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// lib/__tests__/character-md.test.ts
import { describe, it, expect } from "vitest";
import { parseCharacterMd, buildDefaultCharacterMd } from "@/lib/character-md";

describe("parseCharacterMd", () => {
  it("extracts id, name, tags, body", () => {
    const src = buildDefaultCharacterMd("Maya Chen", "maya-chen");
    const parsed = parseCharacterMd(src);
    expect(parsed.frontmatter.id).toBe("maya-chen");
    expect(parsed.frontmatter.name).toBe("Maya Chen");
    expect(parsed.body.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// types/character.ts
export interface CharacterFrontmatter {
  id: string;
  name: string;
  tags?: string[];
  role_hint?: string;
  voice?: string;
  knowledge?: string[];
}

export interface PlaygroundCharacter {
  id: string;
  name: string;
  virtualPath: string;
  sourceType: "md" | "react" | "analyzer";
  draftRevision: number;
  publishedAt: string | null;
  reviewStatus: "none" | "pending" | "approved" | "rejected";
  tags: string[];
  isPublished: boolean;
  draftSource?: string;
}
```

Use same regex/YAML approach as backend or lightweight frontmatter parser (install `yaml` package).

- [ ] **Step 3: Run `yarn test lib/__tests__/character-md.test.ts` — PASS**

- [ ] **Step 4: Commit**

---

### Task 5: Next.js character API proxies

**Files:**
- Create: `app/api/agent/characters/[storyUid]/route.ts`
- Create: `app/api/agent/characters/[storyUid]/[charId]/route.ts`
- Create: `app/api/agent/characters/[storyUid]/[charId]/draft/route.ts`
- Create: `app/api/agent/characters/[storyUid]/[charId]/publish/route.ts`

- [ ] **Step 1: List + create proxy**

```typescript
// app/api/agent/characters/[storyUid]/route.ts
import { NextRequest } from "next/server";
import { proxyAgentRequest } from "@/app/api/agent/_proxy";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string }> },
) {
  const { storyUid } = await params;
  return proxyAgentRequest(req, {
    method: "GET",
    path: `/api/agent/characters/${storyUid}/`,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyUid: string }> },
) {
  const { storyUid } = await params;
  const body = await req.json();
  return proxyAgentRequest(req, {
    method: "POST",
    path: `/api/agent/characters/${storyUid}/create/`,
    body,
  });
}
```

Mirror pattern for GET detail, PUT draft, POST publish.

- [ ] **Step 2: Commit**

```bash
git add app/api/agent/characters/
git commit -m "feat(api): Next.js proxies for character draft and publish"
```

---

### Task 6: Story tab shell + Characters tab UI

**Files:**
- Create: `app/story/[id]/layout.tsx`
- Create: `components/playground/StoryTabNav.tsx`
- Create: `app/story/[id]/characters/page.tsx`
- Create: `components/playground/CharacterFolder.tsx`
- Create: `components/playground/CharacterEditor.tsx`
- Create: `components/playground/PublishBar.tsx`
- Create: `lib/use-playground-characters.ts`

- [ ] **Step 1: Story layout with tabs**

```tsx
// app/story/[id]/layout.tsx
"use client";

import { use } from "react";
import { StoryTabNav } from "@/components/playground/StoryTabNav";

export default function StoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="min-h-screen bg-background">
      <StoryTabNav storyUid={id} />
      {children}
    </div>
  );
}
```

```tsx
// components/playground/StoryTabNav.tsx
const TABS = [
  { href: (id: string) => `/story/${id}`, label: "Editor" },
  { href: (id: string) => `/story/${id}/characters`, label: "Characters" },
  { href: (id: string) => `/story/${id}/talk`, label: "Talk" },
  { href: (id: string) => `/story/${id}/scene`, label: "Scene" },
] as const;
```

Use `usePathname()` for active state. Talk/Scene tabs show disabled tooltip when roster has zero published characters (fetch via hook).

- [ ] **Step 2: usePlaygroundCharacters hook**

```typescript
// lib/use-playground-characters.ts
export function usePlaygroundCharacters(storyUid: string) {
  // fetch GET /api/agent/characters/${storyUid}
  // expose: characters, publishedCharacters, saveDraft, publish, create, refresh
}
```

- [ ] **Step 3: Characters page — folder + editor + publish bar**

Layout: left file tree (`CharacterFolder`), right monospace editor (`CharacterEditor`), bottom sticky `PublishBar` with:
- "Save draft" → PUT draft
- "Publish to graph" → POST publish (disabled if frontmatter invalid)
- "Discard" → reload from last published
- Badge: `Unpublished draft` / `Published`

Empty state CTA: "Create your first character" → POST create with name prompt.

- [ ] **Step 4: Default landing redirect**

In `layout.tsx` or characters page: if roster empty and path is `/story/[id]` only, optionally redirect to `/characters` (use `usePlaygroundCharacters` + `useEffect`).

- [ ] **Step 5: Manual smoke**

1. Open `/story/<uid>/characters`
2. Create character → edit MD → Save draft
3. Publish → `isPublished: true` in network response
4. Talk tab becomes enabled (even if page stub)

- [ ] **Step 6: Commit**

```bash
git add app/story/ components/playground/ lib/use-playground-characters.ts
git commit -m "feat(playground): story tab shell and Characters draft/publish UI"
```

---

### Task 7: P0 checkpoint

- [ ] **Run backend tests**

```bash
cd backend && python -m pytest agent/tests/test_character_parser.py agent/tests/test_character_publish.py -v
```

- [ ] **Run frontend tests**

```bash
yarn test lib/__tests__/character-md.test.ts
yarn typecheck
```

- [ ] **Tag commit if desired:** `p0-playground-characters`

---

## Phase P1 — Talk tab + SSE chat

---

### Task 8: ChatThreadNode model

**Files:**
- Create: `backend/graph/models/chat.py`
- Modify: `backend/graph/models/story.py` (import/register if needed)

- [ ] **Step 1: Add model per spec Section 6**

- [ ] **Step 2: Commit**

---

### Task 9: Chat service + SSE endpoint

**Files:**
- Create: `backend/agent/chat_service.py`
- Modify: `backend/agent/views.py`
- Modify: `backend/agent/urls.py`
- Create: `backend/agent/tests/test_character_chat.py`

- [ ] **Step 1: Write failing test — rejects unpublished character**

```python
def test_chat_rejects_unpublished_character():
    char = MagicMock()
    char.published_at = None
    with pytest.raises(PermissionError, match="CHARACTER_NOT_PUBLISHED"):
        validate_character_for_chat(char)
```

- [ ] **Step 2: Implement `chat_service.py`**

```python
def build_chat_system_prompt(profile: CharacterProfile) -> str:
    """Character identity + Truth Guard known/unknown facts."""

def stream_chat_reply(
    *,
    story_uid: str,
    character_id: str,
    message: str,
    thread_messages: list[dict],
) -> Iterator[str]:
    """Yield SSE text chunks from Anthropic messages API."""
```

Use last 20 messages in prompt context; persist full history on `ChatThreadNode`.

- [ ] **Step 3: Add views**

```python
@api_view(["POST"])
def character_chat(request):
    # validate published character
    # load/create ChatThreadNode
    # return StreamingHttpResponse(text/event-stream)

@api_view(["GET"])
def character_chat_thread(request, thread_id):
    # return messages JSON
```

- [ ] **Step 4: URL routes**

```python
path("chat/", views.character_chat, name="agent-chat"),
path("chat/<str:thread_id>/", views.character_chat_thread, name="agent-chat-thread"),
```

- [ ] **Step 5: Run tests — PASS**

- [ ] **Step 6: Commit**

---

### Task 10: Talk tab frontend

**Files:**
- Create: `app/api/agent/chat/route.ts`
- Create: `app/api/agent/chat/[threadId]/route.ts`
- Create: `lib/use-character-chat.ts`
- Create: `components/playground/TalkPanel.tsx`
- Create: `components/playground/CharacterPicker.tsx`
- Create: `app/story/[id]/talk/page.tsx`

- [ ] **Step 1: SSE proxy route**

```typescript
// app/api/agent/chat/route.ts
// POST — forward to engine, pipe text/event-stream (do NOT buffer full body)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Use `fetchContextEngine` with `Accept: text/event-stream` and return `new Response(upstream.body, { headers: { "Content-Type": "text/event-stream" } })`.

- [ ] **Step 2: useCharacterChat hook**

```typescript
export function useCharacterChat(storyUid: string, characterId: string | null) {
  // POST message, consume SSE via ReadableStream
  // append { role: "user" | "assistant", content, at }
}
```

- [ ] **Step 3: TalkPanel UI**

- `CharacterPicker` — published characters only
- Message list + input
- Empty state: "Publish a character in the Characters tab to start talking"

- [ ] **Step 4: Vitest mock stream test**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(playground): Talk tab with SSE character chat"
```

---

### Task 11: P1 MVP checkpoint

Manual QA path:
1. Create + publish character
2. Open Talk tab → select character → send message → streaming reply
3. Refresh page → thread history loads

- [ ] **Commit QA doc stub:** `docs/qa/live-simulation-playground.md` (Talk section)

---

## Phase P2 — Editor format presets

---

### Task 12: Script TipTap nodes

**Files:**
- Create: `lib/tiptap/script-nodes.ts`

- [ ] **Step 1: Define nodes**

`scriptSceneHeading`, `scriptAction`, `scriptCharacter`, `scriptDialogue`, `scriptParenthetical`, `sceneBreak`

- [ ] **Step 2: Register in SoriEditor when `editorPreset === "script"`**

- [ ] **Step 3: Commit**

---

### Task 13: Format transformers

**Files:**
- Create: `lib/format-presets/types.ts`
- Create: `lib/format-presets/novel.ts`
- Create: `lib/format-presets/script.ts`
- Create: `lib/__tests__/format-presets-novel.test.ts`
- Create: `lib/__tests__/format-presets-script.test.ts`

- [ ] **Step 1: Novel transformer test + impl**

Input fixture: flat paragraphs + `# Scene 2` heading → output contains `sceneBreak` node between sections.

- [ ] **Step 2: Script transformer test + impl**

Input fixture plain text:

```
INT. WAREHOUSE - NIGHT

MAYA:
(whispering)
We need to move.
```

→ script nodes.

- [ ] **Step 3: Commit**

---

### Task 14: FormatToolbar + StoryNode persistence

**Files:**
- Create: `components/playground/FormatToolbar.tsx`
- Modify: `components/editor/SoriEditor.tsx`
- Create: `app/api/story/[id]/document/route.ts`

- [ ] **Step 1: Toolbar in story layout header**

Preset `<select>` (novel | script) + **Format** button calls `applyFormatPreset(editorJson, preset)`.

- [ ] **Step 2: Persist `editor_document` on debounced save**

GET/PUT `/api/story/[id]/document` → Django or Supabase (match existing draft pattern).

- [ ] **Step 3: Commit**

---

## Phase P3 — Scene tab + contributor React

---

### Task 15: Scene tab (Multiverse Lab migration)

**Files:**
- Create: `app/story/[id]/scene/page.tsx`
- Create: `components/playground/ScenePanel.tsx`
- Modify: `components/multiverse/MultiverseSidebar.tsx`

- [ ] **Step 1: Extract shared simulation UI**

Move oracle/tree/simulation controls from `MultiverseSidebar` into `ScenePanel` (full-width tab layout).

- [ ] **Step 2: Published-only character picker**

Filter `availableCharacterIds` to `isPublished === true`. Backend `simulate_scene` returns 409 if unpublished ID submitted.

- [ ] **Step 3: Remove Multiverse sidebar toggle from story-scoped SoriEditor**

Story routes use tabs; `/write` keeps legacy sidebar optional.

- [ ] **Step 4: Commit**

---

### Task 16: Contributor React component submit

**Files:**
- Create: `backend/agent/component_parser.py`
- Create: `backend/agent/tests/test_component_submit.py`
- Create: `app/api/agent/characters/[storyUid]/component/route.ts`

- [ ] **Step 1: Parser extracts `@character` JSDoc tags**

- [ ] **Step 2: POST component → `source_type: react`, `review_status: pending`**

- [ ] **Step 3: Minimal contribute queue entry** (link to existing `GapNode` or contributor review table)

- [ ] **Step 4: Characters tab `_components/` folder upload UI**

- [ ] **Step 5: Commit**

---

### Task 17: Final QA doc + verification

**Files:**
- Create: `docs/qa/live-simulation-playground.md`

- [ ] **Step 1: Write full manual QA checklist** (Editor → Characters → Publish → Talk → Scene)

- [ ] **Step 2: Run full test suite**

```bash
yarn test
yarn typecheck
cd backend && python -m pytest agent/tests/ -v
```

- [ ] **Step 3: Final commit**

```bash
git commit -m "docs(qa): simulation playground live testing checklist"
```

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| Tabs on `/story/[id]` | Task 6 |
| MD draft + publish | Tasks 1–3, 6 |
| Virtual folder UX | Task 6 |
| Publish gate for Talk/Scene | Tasks 6, 10, 15 |
| Talk SSE chat | Tasks 8–10 |
| Scene multiverse reuse | Task 15 |
| Novel + script presets | Tasks 12–14 |
| React contributor path | Task 16 |
| ChatThreadNode | Task 8 |
| CharacterNode extensions | Task 2 |
| Stale revision 409 | Task 3 |
| Story-scoped tags search | Task 6 (folder filter) |

**Out of scope verified:** global catalog, essay/graphic novel presets, raw HTML editing, bidirectional sync — not assigned tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-25-simulation-playground.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks, commit per subsystem
2. **Inline Execution** — implement tasks in this session with checkpoints after each phase (P0 → P1 → P2 → P3)

Which approach?
