# Multiverse Timeline + Twine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Multiverse Lab frontend to the live Django API, ship a full-page branching narrative timeline with click-to-resume, and enable Twine 2 round-trip import/export.

**Architecture:** Three sequential phases, each independently committable. Phase 1 replaces phantom SDK calls in `useMultiverse` with `fetch` to Next.js proxy routes that forward to Django's existing `/api/agent/*` endpoints. Phase 2 adds a horizontal-flow timeline page at `/story/[id]/timeline` using CSS flex + Framer Motion, with computed SVG edges and click-to-resume branching. Phase 3 adds Twine 2 parse/emit via two new Next.js routes and one new Django bulk-import endpoint.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tiptap editor, Framer Motion, neomodel (Neo4j), Django REST Framework, Supabase auth, Vitest + React Testing Library, Playwright (e2e notes only)

**Spec:** `docs/superpowers/specs/2026-05-24-multiverse-timeline-twine-design.md`

---

## File Map

### Phase 1 — API Bridge

| Action | Path |
|--------|------|
| Modify | `lib/use-multiverse.ts` |
| Create | `app/api/agent/simulate/route.ts` |
| Create | `app/api/agent/simulate/[taskId]/status/route.ts` |
| Create | `app/api/agent/branch/route.ts` |
| Create | `app/api/agent/commit/route.ts` |
| Create | `app/api/agent/multiverse/[storyUid]/route.ts` |
| Modify | `components/editor/MultiverseLab.tsx` |
| Modify | `components/editor/SoriEditor.tsx` |
| Modify | `components/editor/OracleChat.tsx` |
| Create | `lib/__tests__/use-multiverse.test.ts` |

### Phase 2 — Timeline View

| Action | Path |
|--------|------|
| Create | `components/timeline/TimelineNode.tsx` |
| Create | `components/timeline/TimelineEdge.tsx` |
| Create | `components/timeline/MultiverseTimeline.tsx` |
| Create | `app/story/[id]/timeline/page.tsx` |
| Modify | `components/editor/SoriEditor.tsx` (resumeNode reading) |
| Create | `components/timeline/__tests__/TimelineNode.test.tsx` |
| Create | `components/timeline/__tests__/MultiverseTimeline.test.tsx` |

### Phase 3 — Twine Round-Trip

| Action | Path |
|--------|------|
| Create | `lib/twine/parser.ts` |
| Create | `lib/twine/exporter.ts` |
| Create | `app/api/story/[id]/export/twine/route.ts` |
| Create | `app/api/story/import/twine/route.ts` |
| Modify | `backend/agent/views.py` |
| Modify | `backend/agent/serializers.py` |
| Modify | `backend/agent/urls.py` |
| Create | `lib/twine/__tests__/parser.test.ts` |
| Create | `lib/twine/__tests__/exporter.test.ts` |
| Create | `backend/agent/tests/test_import.py` |

---

## Phase 1 — API Bridge

---

### Task 1: Next.js proxy routes

**Before starting:** Open `app/api/analyze/route.ts` and note exactly how it reads the Supabase session and extracts the auth token. All five proxy routes use the same pattern.

**Files:**
- Create: `app/api/agent/simulate/route.ts`
- Create: `app/api/agent/simulate/[taskId]/status/route.ts`
- Create: `app/api/agent/branch/route.ts`
- Create: `app/api/agent/commit/route.ts`
- Create: `app/api/agent/multiverse/[storyUid]/route.ts`

- [ ] **Step 1: Create the simulate proxy**

```typescript
// app/api/agent/simulate/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DJANGO = process.env.DJANGO_API_URL

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  try {
    const upstream = await fetch(`${DJANGO}/api/agent/simulate/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}
```

> Note: If the existing `app/api/analyze/route.ts` uses a different Supabase client import (e.g. `createServerComponentClient` from `@supabase/auth-helpers-nextjs`), match that pattern exactly here and in all routes below. Also wrap every `upstream` fetch in a `try/catch` that returns `NextResponse.json({ error: 'Backend unavailable' }, { status: 502 })` — the simulate route above shows the pattern; apply it identically to the four remaining routes.

- [ ] **Step 2: Create the status poll proxy**

```typescript
// app/api/agent/simulate/[taskId]/status/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DJANGO = process.env.DJANGO_API_URL

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const upstream = await fetch(
    `${DJANGO}/api/agent/simulate/${params.taskId}/status/`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  )
  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
```

- [ ] **Step 3: Create the branch proxy**

```typescript
// app/api/agent/branch/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DJANGO = process.env.DJANGO_API_URL

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const upstream = await fetch(`${DJANGO}/api/agent/branch/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
```

- [ ] **Step 4: Create the commit proxy**

```typescript
// app/api/agent/commit/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DJANGO = process.env.DJANGO_API_URL

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const upstream = await fetch(`${DJANGO}/api/agent/commit/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
```

- [ ] **Step 5: Create the multiverse tree proxy**

```typescript
// app/api/agent/multiverse/[storyUid]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DJANGO = process.env.DJANGO_API_URL

export async function GET(
  req: NextRequest,
  { params }: { params: { storyUid: string } }
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const upstream = await fetch(
    `${DJANGO}/api/agent/multiverse/${params.storyUid}/`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  )
  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/agent/
git commit -m "feat(api): add Next.js proxy routes for multiverse agent endpoints"
```

---

### Task 2: Rewrite useMultiverse transport layer

**Files:**
- Modify: `lib/use-multiverse.ts`
- Create: `lib/__tests__/use-multiverse.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/__tests__/use-multiverse.test.ts
import { renderHook, act } from '@testing-library/react'
import { vi, it, expect, beforeEach, describe } from 'vitest'
import { useMultiverse } from '@/lib/use-multiverse'
import type { MultiverseState } from '@/types/multiverse'

const mockTree: Pick<MultiverseState, 'tree'> = {
  tree: {
    rootUid: 'node-1',
    nodes: {
      'node-1': {
        uid: 'node-1',
        type: 'decision',
        summary: 'Opening scene',
        structuralPattern: 'Revelation',
        confidence: 0.9,
        hasParadox: false,
        dialogueTurns: [],
        storyUid: 'story-abc',
      },
    },
    edges: [],
  },
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('loadTree', () => {
  it('calls /api/agent/multiverse/[storyUid]', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTree.tree,
    })

    const { result } = renderHook(() => useMultiverse())
    await act(async () => {
      await result.current.loadTree('story-abc')
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/agent/multiverse/story-abc',
      expect.objectContaining({ method: undefined })
    )
    expect(result.current.state.tree.rootUid).toBe('node-1')
  })
})

describe('startSimulation', () => {
  it('calls POST /api/agent/simulate and dispatches SIMULATION_START', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: 'task-xyz' }),
    })

    const { result } = renderHook(() => useMultiverse())
    await act(async () => {
      await result.current.startSimulation({
        storyUid: 'story-abc',
        sceneGoal: 'Test goal',
        characterIds: ['char-1', 'char-2'],
        fromNodeUid: 'node-1',
      })
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/agent/simulate',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.current.state.simulationStatus).toBe('running')
  })
})

describe('commitBranch', () => {
  it('calls POST /api/agent/commit and returns beatId', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ beatId: 'beat-001' }),
    })

    const { result } = renderHook(() => useMultiverse())
    let beatId: string | undefined
    await act(async () => {
      beatId = await result.current.commitBranch({
        nodeUid: 'node-1',
        storyUid: 'story-abc',
        beatSummary: 'She opens the letter',
      })
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/agent/commit',
      expect.objectContaining({ method: 'POST' })
    )
    expect(beatId).toBe('beat-001')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd ~/code/sori.page && pnpm vitest run lib/__tests__/use-multiverse.test.ts
```

Expected output: FAIL (SDK import error or wrong endpoint called)

- [ ] **Step 3: Replace SDK transport in use-multiverse.ts**

Open `lib/use-multiverse.ts`. Find every call to `contextEngineClient` (or `createContextEngineClient()`). Replace the five operations:

```typescript
// REPLACE: sdk.getMultiverseTree(storyUid)
const res = await fetch(`/api/agent/multiverse/${storyUid}`)
if (!res.ok) throw new Error(`Tree fetch failed: ${res.status}`)
return res.json()

// REPLACE: sdk.startSimulation(request)
const res = await fetch('/api/agent/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
})
if (!res.ok) throw new Error(`Simulation failed: ${res.status}`)
return res.json() // { taskId: string }

// REPLACE: sdk.getSimulationStatus(taskId)
const res = await fetch(`/api/agent/simulate/${taskId}/status`)
if (!res.ok) throw new Error(`Status poll failed: ${res.status}`)
return res.json()

// REPLACE: sdk.createBranch(request)
const res = await fetch('/api/agent/branch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
})
if (!res.ok) throw new Error(`Branch failed: ${res.status}`)
return res.json()

// REPLACE: sdk.commitBranch(request)
const res = await fetch('/api/agent/commit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
})
if (!res.ok) throw new Error(`Commit failed: ${res.status}`)
const data = await res.json()
return data.beatId as string
```

Delete the `createContextEngineClient()` import and any SDK initialization at the top of the file.

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run lib/__tests__/use-multiverse.test.ts
```

Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add lib/use-multiverse.ts lib/__tests__/use-multiverse.test.ts
git commit -m "feat(lib): wire useMultiverse to real Django endpoints via fetch"
```

---

### Task 3: Wire MultiverseLab to live hook

**Files:**
- Modify: `components/editor/MultiverseLab.tsx`

- [ ] **Step 1: Identify the local state that useMultiverse replaces**

Open `components/editor/MultiverseLab.tsx`. Find:
- The call to `createSeedMultiverseTree()` — this creates the hardcoded demo tree
- All `useState` hooks for scene goals, nodes, oracle lines that are backed by demo data
- The `// "until Django + Neo4j back the live loop"` comment

- [ ] **Step 2: Replace demo initialization with hook**

At the top of the component, add:

```typescript
import { useMultiverse } from '@/lib/use-multiverse'

// Inside the component, replace createSeedMultiverseTree() with:
const { state, loadTree, startSimulation, createBranch, commitBranch } = useMultiverse()

// On mount, load the real tree:
useEffect(() => {
  if (storyUid) loadTree(storyUid)
}, [storyUid])
```

The component receives `storyUid` as a prop. If it doesn't already, add it:

```typescript
interface MultiverseLabProps {
  storyUid: string
  onBeatCreated: (beatId: string, summary: string, pattern: string) => void
}
```

- [ ] **Step 3: Replace demo handlers with hook calls**

Find the simulate button handler and replace with:

```typescript
const handleStartSimulation = async () => {
  if (!sceneGoal || characterIds.length < 2) return
  await startSimulation({
    storyUid,
    sceneGoal,
    characterIds,
    fromNodeUid: state.activeNodeUid ?? state.tree?.rootUid ?? '',
  })
}
```

Find the commit handler and replace with:

```typescript
const handleCommit = async () => {
  const beatSummary = state.tree?.nodes[state.activeNodeUid ?? '']?.summary ?? ''
  const pattern = state.tree?.nodes[state.activeNodeUid ?? '']?.structuralPattern ?? ''
  const beatId = await commitBranch({
    nodeUid: state.activeNodeUid ?? '',
    storyUid,
    beatSummary,
  })
  if (beatId) onBeatCreated(beatId, beatSummary, pattern)
}
```

Remove the `naiveParadoxScan` import if it was only used in the demo path.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd ~/code/sori.page && pnpm typecheck
```

Expected: no errors in `MultiverseLab.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/editor/MultiverseLab.tsx
git commit -m "feat(editor): wire MultiverseLab to live useMultiverse hook"
```

---

### Task 4: Fix SoriEditor beat insertion

**Files:**
- Modify: `components/editor/SoriEditor.tsx`

- [ ] **Step 1: Find the broken onBeatCreated handler**

Open `components/editor/SoriEditor.tsx`. Find the `onBeatCreated` callback — it currently just updates a label string. The `editor` instance from Tiptap is available in scope via `useEditor`.

- [ ] **Step 2: Replace label update with Tiptap content insertion**

```typescript
const handleBeatCreated = (beatId: string, summary: string, pattern: string) => {
  if (!editor) return
  editor.commands.insertContent([
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'bold' }],
          text: `[Beat: ${pattern}] `,
        },
        { type: 'text', text: summary },
      ],
    },
    { type: 'paragraph' },
  ])
}
```

Pass `handleBeatCreated` as the `onBeatCreated` prop to `<MultiverseLab>` (or `<MultiverseSidebar>`, wherever the callback is wired).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors in `SoriEditor.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/editor/SoriEditor.tsx
git commit -m "fix(editor): insert committed beat into Tiptap document"
```

---

### Task 5: Fix epistemic profiles propagation

**Files:**
- Modify: `components/editor/OracleChat.tsx`
- Modify: `components/editor/MultiverseSidebar.tsx` (if profiles prop is set there)

- [ ] **Step 1: Find hardcoded null**

Open `components/editor/SoriEditor.tsx` or `MultiverseSidebar.tsx`. Search for `profiles = null` or `const profiles: [...] | null = null`. This is the line to replace.

- [ ] **Step 2: Replace with live state**

In the component that renders `<OracleChat>` or `<MultiverseSidebar>`, the `useMultiverse` state is already available after Task 3. Replace the hardcoded null:

```typescript
// BEFORE:
const profiles: EpistemicProfile[] | null = null

// AFTER:
const activeNode = state.tree?.nodes[state.activeNodeUid ?? '']
const profiles = activeNode?.epistemicProfiles ?? null
```

The `EpistemicProfile` type is already defined in `types/multiverse.ts`.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/editor/OracleChat.tsx components/editor/MultiverseSidebar.tsx
git commit -m "fix(editor): pass real epistemic profiles from simulation state"
```

---

## Phase 2 — Multiverse Timeline View

---

### Task 6: TimelineNode component

**Files:**
- Create: `components/timeline/TimelineNode.tsx`
- Create: `components/timeline/__tests__/TimelineNode.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// components/timeline/__tests__/TimelineNode.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, it, expect, describe } from 'vitest'
import { TimelineNode } from '@/components/timeline/TimelineNode'
import type { MultiverseNode } from '@/types/multiverse'

const canon: MultiverseNode = {
  uid: 'n1', type: 'canon', summary: 'She finds the letter',
  structuralPattern: 'Revelation', confidence: 0.9, hasParadox: false,
  dialogueTurns: [], storyUid: 'story-abc',
}
const explored: MultiverseNode = {
  uid: 'n2', type: 'simulation', summary: 'She stays silent',
  structuralPattern: 'Avoidance', confidence: 0.4, hasParadox: true,
  dialogueTurns: [], storyUid: 'story-abc',
}

describe('TimelineNode', () => {
  it('renders beat summary truncated', () => {
    render(<TimelineNode node={canon} isActive={false} onClick={vi.fn()} />)
    expect(screen.getByText('She finds the letter')).toBeInTheDocument()
  })

  it('renders structural pattern chip', () => {
    render(<TimelineNode node={canon} isActive={false} onClick={vi.fn()} />)
    expect(screen.getByText('Revelation')).toBeInTheDocument()
  })

  it('does not call onClick on canon node', () => {
    const onClick = vi.fn()
    render(<TimelineNode node={canon} isActive={false} onClick={onClick} />)
    fireEvent.click(screen.getByText('She finds the letter').closest('div')!)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick with node on non-canon click', () => {
    const onClick = vi.fn()
    render(<TimelineNode node={explored} isActive={false} onClick={onClick} />)
    fireEvent.click(screen.getByText('She stays silent').closest('div')!)
    expect(onClick).toHaveBeenCalledWith(explored)
  })

  it('shows paradox badge when hasParadox is true', () => {
    render(<TimelineNode node={explored} isActive={false} onClick={vi.fn()} />)
    expect(screen.getByText('⚠ paradox')).toBeInTheDocument()
  })

  it('renders 4 filled pips for confidence=0.9', () => {
    render(<TimelineNode node={canon} isActive={false} onClick={vi.fn()} />)
    // 5 pips total, Math.round(0.9 * 5) = 5 filled
    const pips = document.querySelectorAll('[data-pip]')
    expect(pips).toHaveLength(5)
    expect(document.querySelectorAll('[data-pip="filled"]')).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run components/timeline/__tests__/TimelineNode.test.tsx
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create the component**

```typescript
// components/timeline/TimelineNode.tsx
'use client'
import { motion } from 'framer-motion'
import { nodePopIn } from '@/lib/sori-motion'
import type { MultiverseNode } from '@/types/multiverse'

interface Props {
  node: MultiverseNode
  isActive: boolean
  onClick: (node: MultiverseNode) => void
}

const STYLE: Record<string, { border: string; bg: string; chipColor: string; chipBg: string; label: string }> = {
  decision: { border: '#8a6abf', bg: '#1a1530', chipColor: '#a98fd4', chipBg: '#2a1a50', label: 'DECISION' },
  canon:    { border: '#c8a840', bg: '#1a1a0e', chipColor: '#f5d060', chipBg: '#2a200a', label: 'CANON'    },
  simulation:{ border: '#3a2020', bg: '#120e0e', chipColor: '#bf6a6a', chipBg: '#200a0a', label: 'EXPLORED' },
}

export function TimelineNode({ node, isActive, onClick }: Props) {
  const s = STYLE[node.type] ?? STYLE.simulation
  const isCanon = node.type === 'canon'
  const filledPips = Math.round((node.confidence ?? 0) * 5)

  return (
    <motion.div
      {...nodePopIn}
      data-node-uid={node.uid}
      onClick={() => !isCanon && onClick(node)}
      style={{
        background: s.bg,
        border: `2px solid ${isActive ? '#ffffff' : s.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        width: 160,
        cursor: isCanon ? 'default' : 'pointer',
        opacity: node.type === 'simulation' ? 0.65 : 1,
        boxShadow: isActive ? `0 0 16px ${s.border}66` : undefined,
        userSelect: 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ background: s.chipBg, border: `1px solid ${s.border}`, borderRadius: 3, padding: '1px 5px', fontSize: 9, color: s.chipColor, fontFamily: 'monospace' }}>
          {s.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {isCanon && <span style={{ color: '#f5d060', fontSize: 10 }}>★</span>}
          {node.hasParadox && <span style={{ color: '#bf4040', fontSize: 10 }} title="Paradox detected">⚠</span>}
        </div>
      </div>

      {/* Summary */}
      <div style={{ color: '#e8e0f8', fontSize: 11, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {node.summary}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #2a2040', paddingTop: 6, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {node.structuralPattern && (
          <span style={{ background: '#1e1040', borderRadius: 2, padding: '1px 4px', fontSize: 8, color: '#7a6aaa', fontFamily: 'monospace', alignSelf: 'flex-start' }}>
            {node.structuralPattern}
          </span>
        )}
        {node.hasParadox && (
          <span style={{ background: '#3a0a0a', borderRadius: 2, padding: '1px 4px', fontSize: 8, color: '#bf4040', fontFamily: 'monospace', alignSelf: 'flex-start' }}>
            ⚠ paradox
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: '#5a5070' }}>confidence</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                data-pip={i < filledPips ? 'filled' : 'empty'}
                style={{ width: 6, height: 6, borderRadius: 1, background: i < filledPips ? '#6abf8c' : '#2a2040' }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run components/timeline/__tests__/TimelineNode.test.tsx
```

Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add components/timeline/
git commit -m "feat(timeline): TimelineNode component with all four data fields"
```

---

### Task 7: MultiverseTimeline layout engine + TimelineEdge

**Files:**
- Create: `components/timeline/TimelineEdge.tsx`
- Create: `components/timeline/MultiverseTimeline.tsx`
- Create: `components/timeline/__tests__/MultiverseTimeline.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// components/timeline/__tests__/MultiverseTimeline.test.tsx
import { render, screen } from '@testing-library/react'
import { it, expect, describe } from 'vitest'
import { MultiverseTimeline } from '@/components/timeline/MultiverseTimeline'
import type { MultiverseState } from '@/types/multiverse'

// Minimal tree: root decision → two children (canon + explored)
const mockState: Pick<MultiverseState, 'tree'> = {
  tree: {
    rootUid: 'root',
    nodes: {
      root: { uid: 'root', type: 'decision', summary: 'Root scene', structuralPattern: 'Opening', confidence: 1, hasParadox: false, dialogueTurns: [], storyUid: 's1' },
      n1:   { uid: 'n1',   type: 'canon',    summary: 'Truth path', structuralPattern: 'Truth', confidence: 1, hasParadox: false, dialogueTurns: [], storyUid: 's1' },
      n2:   { uid: 'n2',   type: 'simulation',summary: 'Lie path',  structuralPattern: 'Deception', confidence: 0.4, hasParadox: true, dialogueTurns: [], storyUid: 's1' },
    },
    edges: [
      { uid: 'e1', fromUid: 'root', toUid: 'n1', label: 'tells truth', intent: 'truth', order: 0 },
      { uid: 'e2', fromUid: 'root', toUid: 'n2', label: 'tells a lie', intent: 'deception', order: 1 },
    ],
  },
}

describe('MultiverseTimeline', () => {
  it('renders all three nodes', () => {
    render(<MultiverseTimeline state={mockState as MultiverseState} activeNodeUid={null} onNodeClick={() => {}} />)
    expect(screen.getByText('Root scene')).toBeInTheDocument()
    expect(screen.getByText('Truth path')).toBeInTheDocument()
    expect(screen.getByText('Lie path')).toBeInTheDocument()
  })

  it('groups root in column 0, children in column 1', () => {
    render(<MultiverseTimeline state={mockState as MultiverseState} activeNodeUid={null} onNodeClick={() => {}} />)
    const cols = document.querySelectorAll('[data-timeline-col]')
    expect(cols).toHaveLength(2)
    expect(cols[0].querySelectorAll('[data-node-uid]')).toHaveLength(1)
    expect(cols[1].querySelectorAll('[data-node-uid]')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run components/timeline/__tests__/MultiverseTimeline.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Create TimelineEdge**

```typescript
// components/timeline/TimelineEdge.tsx
interface Props {
  fromX: number; fromY: number
  toX: number;   toY: number
  isCanon: boolean
}

export function TimelineEdge({ fromX, fromY, toX, toY, isCanon }: Props) {
  const cx = (fromX + toX) / 2
  const d = `M ${fromX} ${fromY} C ${cx} ${fromY}, ${cx} ${toY}, ${toX} ${toY}`
  return (
    <path
      d={d}
      stroke={isCanon ? '#f5d060' : '#3a3050'}
      strokeWidth={isCanon ? 2 : 1.5}
      fill="none"
      strokeDasharray={isCanon ? undefined : '4 3'}
    />
  )
}
```

- [ ] **Step 4: Create MultiverseTimeline**

```typescript
// components/timeline/MultiverseTimeline.tsx
'use client'
import { useRef, useLayoutEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { treeStagger } from '@/lib/sori-motion'
import { TimelineNode } from './TimelineNode'
import { TimelineEdge } from './TimelineEdge'
import type { MultiverseNode, ChoiceEdge, MultiverseState } from '@/types/multiverse'

const NODE_W = 160
const NODE_H = 122
const COL_GAP = 44
const ROW_GAP = 12

interface Props {
  state: MultiverseState
  activeNodeUid: string | null
  onNodeClick: (node: MultiverseNode) => void
}

function buildColumns(tree: MultiverseState['tree']): MultiverseNode[][] {
  const childMap = new Map<string, string[]>()
  Object.values(tree.nodes).forEach(n => childMap.set(n.uid, []))
  tree.edges.forEach(e => childMap.get(e.fromUid)?.push(e.toUid))

  const columns: MultiverseNode[][] = []
  const visited = new Set<string>()
  let queue = [tree.rootUid]

  while (queue.length > 0) {
    const col: MultiverseNode[] = []
    const next: string[] = []
    for (const uid of queue) {
      if (visited.has(uid)) continue
      visited.add(uid)
      const node = tree.nodes[uid]
      if (node) col.push(node)
      next.push(...(childMap.get(uid) ?? []))
    }
    if (col.length > 0) columns.push(col)
    queue = next
  }
  return columns
}

function buildPositionMap(columns: MultiverseNode[][]): Map<string, { x: number; y: number; colH: number }> {
  const map = new Map<string, { x: number; y: number; colH: number }>()
  columns.forEach((col, ci) => {
    const colH = col.length * NODE_H + Math.max(0, col.length - 1) * ROW_GAP
    col.forEach((node, ri) => {
      map.set(node.uid, {
        x: ci * (NODE_W + COL_GAP),
        y: ri * (NODE_H + ROW_GAP),
        colH,
      })
    })
  })
  return map
}

export function MultiverseTimeline({ state, activeNodeUid, onNodeClick }: Props) {
  if (!state.tree) return null
  const columns = buildColumns(state.tree)
  const posMap = buildPositionMap(columns)

  const totalW = columns.length * (NODE_W + COL_GAP) - COL_GAP
  const maxH = Math.max(...columns.map(col => col.length * (NODE_H + ROW_GAP)))

  return (
    <div style={{ position: 'relative', overflowX: 'auto', padding: '24px 32px', minHeight: maxH + 48 }}>
      {/* SVG edge layer */}
      <svg
        style={{ position: 'absolute', inset: '24px 32px', width: totalW, height: maxH, pointerEvents: 'none' }}
      >
        {state.tree.edges.map(edge => {
          const from = posMap.get(edge.fromUid)
          const to = posMap.get(edge.toUid)
          if (!from || !to) return null
          const isCanon =
            state.tree.nodes[edge.toUid]?.type === 'canon' ||
            state.tree.nodes[edge.fromUid]?.type === 'canon'
          return (
            <TimelineEdge
              key={edge.uid}
              fromX={from.x + NODE_W}
              fromY={from.y + NODE_H / 2}
              toX={to.x}
              toY={to.y + NODE_H / 2}
              isCanon={isCanon}
            />
          )
        })}
      </svg>

      {/* Node columns */}
      <motion.div
        {...treeStagger}
        style={{ display: 'flex', alignItems: 'flex-start', gap: COL_GAP, position: 'relative' }}
      >
        {columns.map((col, ci) => (
          <div
            key={ci}
            data-timeline-col={ci}
            style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}
          >
            {col.map(node => (
              <TimelineNode
                key={node.uid}
                node={node}
                isActive={node.uid === activeNodeUid}
                onClick={onNodeClick}
              />
            ))}
          </div>
        ))}

        {/* + Simulate placeholder at end of canon path */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: NODE_H }}>
          <div
            style={{
              border: '2px dashed #3a2a5a',
              borderRadius: 10,
              padding: '10px 12px',
              width: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              opacity: 0.5,
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px dashed #5a4a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a6aaa', fontSize: 16 }}>+</div>
            <span style={{ color: '#5a4a7a', fontSize: 9, textAlign: 'center' }}>Simulate next beat</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm vitest run components/timeline/__tests__/MultiverseTimeline.test.tsx
```

Expected: 2 passing

- [ ] **Step 6: Commit**

```bash
git add components/timeline/
git commit -m "feat(timeline): MultiverseTimeline layout engine with SVG edges"
```

---

### Task 8: Timeline page + click-to-resume

**Files:**
- Create: `app/story/[id]/timeline/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/story/[id]/timeline/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMultiverse } from '@/lib/use-multiverse'
import { MultiverseTimeline } from '@/components/timeline/MultiverseTimeline'
import type { MultiverseNode } from '@/types/multiverse'

interface Props {
  params: { id: string }
}

export default function TimelinePage({ params }: Props) {
  const storyUid = params.id
  const router = useRouter()
  const { state, loadTree, createBranch } = useMultiverse()

  useEffect(() => {
    loadTree(storyUid)
  }, [storyUid])

  const nodeCount = state.tree ? Object.keys(state.tree.nodes).length : 0
  const canonCount = state.tree
    ? Object.values(state.tree.nodes).filter(n => n.type === 'canon').length
    : 0

  const handleNodeClick = async (node: MultiverseNode) => {
    await createBranch({ fromNodeUid: node.uid, storyUid })
    router.push(`/story/${storyUid}?resumeNode=${node.uid}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', color: '#e8e0f8' }}>
      {/* Header */}
      <div style={{ background: '#12121e', borderBottom: '1px solid #2a2040', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.push(`/story/${storyUid}`)}
          style={{ background: 'none', border: 'none', color: '#5a4a7a', fontSize: 12, cursor: 'pointer' }}
        >
          ← Back to editor
        </button>
        <span style={{ color: '#4a3a6a' }}>|</span>
        <span style={{ color: '#c4b8e8', fontWeight: 600 }}>Multiverse Timeline</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{ background: '#1a1530', border: '1px solid #3a2a5a', borderRadius: 4, padding: '3px 8px', color: '#8a7aaa', fontSize: 10 }}>
            {nodeCount} nodes
          </span>
          <span style={{ background: '#2a200a', border: '1px solid #6a5020', borderRadius: 4, padding: '3px 8px', color: '#c8a840', fontSize: 10 }}>
            ★ {canonCount} canon
          </span>
          <a
            href={`/api/story/${storyUid}/export/twine`}
            style={{ background: '#1a2a1a', border: '1px solid #3a6a3a', borderRadius: 4, padding: '3px 8px', color: '#6abf8c', fontSize: 10, textDecoration: 'none' }}
            download
          >
            Export to Twine
          </a>
        </div>
      </div>

      {/* Timeline */}
      {state.simulationStatus === 'running' ? (
        <div style={{ padding: 48, color: '#6a5a8a', textAlign: 'center' }}>Loading timeline…</div>
      ) : (
        <MultiverseTimeline
          state={state}
          activeNodeUid={state.activeNodeUid}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd ~/code/sori.page && pnpm typecheck
```

Expected: no errors in the timeline page

- [ ] **Step 3: Commit**

```bash
git add app/story/
git commit -m "feat(pages): /story/[id]/timeline page with click-to-resume"
```

---

### Task 9: SoriEditor resumeNode reading

**Files:**
- Modify: `components/editor/SoriEditor.tsx`

- [ ] **Step 1: Add resumeNode reading on mount**

Open `components/editor/SoriEditor.tsx`. Import `useSearchParams` (already likely imported since it's Next.js). Add:

```typescript
import { useSearchParams } from 'next/navigation'

// Inside component:
const searchParams = useSearchParams()
const resumeNodeUid = searchParams.get('resumeNode')

useEffect(() => {
  if (resumeNodeUid && storyUid) {
    loadTree(storyUid).then(() => {
      // dispatch SET_ACTIVE_NODE — check use-multiverse.ts for the exact action name
      // The hook should expose setActiveNode or dispatch it internally via loadTree
      // If the hook does not expose setActiveNode, call loadTree which will restore state
    })
  }
}, [resumeNodeUid, storyUid])
```

> Note: Check `lib/use-multiverse.ts` for whether `setActiveNode(uid)` is exported or whether tree loading from the API already restores the active node from the URL param. If `setActiveNode` is not exported, add it as a thin dispatch wrapper:

```typescript
// In use-multiverse.ts, inside the returned object:
setActiveNode: (uid: string) => dispatch({ type: 'SET_ACTIVE_NODE', payload: uid }),
```

Confirm `SET_ACTIVE_NODE` exists in the reducer — check the action types in the file. If the action type is named differently, use the correct name.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/editor/SoriEditor.tsx lib/use-multiverse.ts
git commit -m "feat(editor): restore simulation context from ?resumeNode query param"
```

---

## Phase 3 — Twine Round-Trip

---

### Task 10: Twine parser

**Files:**
- Create: `lib/twine/parser.ts`
- Create: `lib/twine/__tests__/parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/twine/__tests__/parser.test.ts
import { it, expect, describe } from 'vitest'
import { parseTwee, parseTwineHtml } from '@/lib/twine/parser'

const tweeSample = `:: Start [canon]
She opens the letter and reads it carefully.
[[Tell the truth|Truth]]
[[Stay silent|Silence]]

:: Truth [canon]
She confronts her brother directly.

:: Silence [paradox]
She hides the letter under the floorboards.
`

const twineHtmlSample = `<!DOCTYPE html><html><body>
<tw-storydata name="Test" startnode="1">
<tw-passagedata pid="1" name="Start" tags="canon">She opens the letter [[Tell the truth|Truth]] [[Stay silent|Silence]]</tw-passagedata>
<tw-passagedata pid="2" name="Truth" tags="canon">She confronts her brother.</tw-passagedata>
<tw-passagedata pid="3" name="Silence" tags="paradox">She hides it.</tw-passagedata>
</tw-storydata></body></html>`

describe('parseTwee', () => {
  it('parses passage names', () => {
    const passages = parseTwee(tweeSample)
    expect(passages.map(p => p.name)).toEqual(['Start', 'Truth', 'Silence'])
  })

  it('parses tags', () => {
    const passages = parseTwee(tweeSample)
    expect(passages[0].tags).toContain('canon')
    expect(passages[2].tags).toContain('paradox')
  })

  it('parses links with label and target', () => {
    const passages = parseTwee(tweeSample)
    expect(passages[0].links).toEqual([
      { label: 'Tell the truth', target: 'Truth' },
      { label: 'Stay silent',    target: 'Silence' },
    ])
  })

  it('passage with no links returns empty links array', () => {
    const passages = parseTwee(tweeSample)
    expect(passages[1].links).toHaveLength(0)
  })
})

describe('parseTwineHtml', () => {
  it('parses all three passages', () => {
    const passages = parseTwineHtml(twineHtmlSample)
    expect(passages).toHaveLength(3)
  })

  it('extracts tags from tw-passagedata attributes', () => {
    const passages = parseTwineHtml(twineHtmlSample)
    expect(passages[0].tags).toContain('canon')
    expect(passages[2].tags).toContain('paradox')
  })

  it('parses links from passage body', () => {
    const passages = parseTwineHtml(twineHtmlSample)
    expect(passages[0].links).toHaveLength(2)
    expect(passages[0].links[0]).toEqual({ label: 'Tell the truth', target: 'Truth' })
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run lib/twine/__tests__/parser.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create the parser**

```typescript
// lib/twine/parser.ts

export interface TwinePassage {
  name: string
  tags: string[]
  content: string
  links: Array<{ label: string; target: string }>
}

function extractLinks(body: string): Array<{ label: string; target: string }> {
  const links: Array<{ label: string; target: string }> = []
  const re = /\[\[(.+?)(?:\|(.+?))?\]\]/g
  let m
  while ((m = re.exec(body)) !== null) {
    const [, first, second] = m
    links.push({ label: second ? first : first, target: second ?? first })
  }
  return links
}

export function parseTwee(content: string): TwinePassage[] {
  return content
    .split(/^:: /m)
    .slice(1)
    .map(block => {
      const nl = block.indexOf('\n')
      const header = block.slice(0, nl).trim()
      const body = block.slice(nl + 1).trim()
      const hm = header.match(/^(.+?)(?:\s+\[(.+?)\])?\s*$/)
      if (!hm) return null
      const name = hm[1].trim()
      const tags = hm[2] ? hm[2].split(/\s+/) : []
      return { name, tags, content: body, links: extractLinks(body) }
    })
    .filter((p): p is TwinePassage => p !== null)
}

export function parseTwineHtml(content: string): TwinePassage[] {
  const passages: TwinePassage[] = []
  const re = /<tw-passagedata[^>]*\bname="([^"]*)"[^>]*\btags="([^"]*)"[^>]*>([\s\S]*?)<\/tw-passagedata>/g
  let m
  while ((m = re.exec(content)) !== null) {
    const [, name, tagsStr, raw] = m
    const body = raw
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()
    const tags = tagsStr.split(/\s+/).filter(Boolean)
    passages.push({ name, tags, content: body, links: extractLinks(body) })
  }
  return passages
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run lib/twine/__tests__/parser.test.ts
```

Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add lib/twine/
git commit -m "feat(twine): Twee and Twine 2 HTML passage parser"
```

---

### Task 11: Twine exporter

**Files:**
- Create: `lib/twine/exporter.ts`
- Create: `lib/twine/__tests__/exporter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/twine/__tests__/exporter.test.ts
import { it, expect, describe } from 'vitest'
import { buildTwineHtml } from '@/lib/twine/exporter'
import type { TwinePassage } from '@/lib/twine/parser'

const passages: TwinePassage[] = [
  { name: 'Start', tags: ['canon'], content: 'She opens the letter.', links: [{ label: 'Tell truth', target: 'Truth' }] },
  { name: 'Truth', tags: ['canon'], content: 'She confronts him.', links: [] },
  { name: 'Silence', tags: ['paradox'], content: 'She hides it.', links: [] },
]

describe('buildTwineHtml', () => {
  it('produces valid Twine 2 HTML with tw-storydata', () => {
    const html = buildTwineHtml('My Story', passages)
    expect(html).toContain('<tw-storydata')
    expect(html).toContain('name="My Story"')
    expect(html).toContain('</tw-storydata>')
  })

  it('includes all passages as tw-passagedata', () => {
    const html = buildTwineHtml('My Story', passages)
    expect(html.match(/<tw-passagedata/g)).toHaveLength(3)
  })

  it('encodes passage content as HTML entities', () => {
    const ps: TwinePassage[] = [
      { name: 'Test', tags: [], content: 'A & B < C > D', links: [] }
    ]
    const html = buildTwineHtml('T', ps)
    expect(html).toContain('A &amp; B &lt; C &gt; D')
  })

  it('appends links as [[Label|Target]] in passage body', () => {
    const html = buildTwineHtml('My Story', passages)
    expect(html).toContain('[[Tell truth|Truth]]')
  })

  it('sets startnode to the first canon passage pid', () => {
    const html = buildTwineHtml('My Story', passages)
    expect(html).toContain('startnode="1"')
  })

  it('round-trips through parser and recovers original passages', () => {
    const { parseTwineHtml } = require('@/lib/twine/parser')
    const html = buildTwineHtml('My Story', passages)
    const recovered = parseTwineHtml(html)
    expect(recovered).toHaveLength(3)
    expect(recovered[0].name).toBe('Start')
    expect(recovered[0].tags).toContain('canon')
    expect(recovered[0].links[0].target).toBe('Truth')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run lib/twine/__tests__/exporter.test.ts
```

- [ ] **Step 3: Create the exporter**

```typescript
// lib/twine/exporter.ts
import type { TwinePassage } from './parser'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildTwineHtml(storyName: string, passages: TwinePassage[]): string {
  let pid = 1
  const firstCanonIdx = passages.findIndex(p => p.tags.includes('canon'))
  const startnode = firstCanonIdx >= 0 ? firstCanonIdx + 1 : 1

  const passageHtml = passages
    .map(p => {
      const linkStr = p.links.map(l => `[[${l.label}|${l.target}]]`).join('\n')
      const body = esc([p.content, linkStr].filter(Boolean).join('\n'))
      const tags = p.tags.join(' ')
      return `<tw-passagedata pid="${pid++}" name="${esc(p.name)}" tags="${tags}">${body}</tw-passagedata>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${esc(storyName)}</title></head>
<body>
<tw-storydata name="${esc(storyName)}" startnode="${startnode}" creator="sori.page" creator-version="1.0" ifid="">
${passageHtml}
</tw-storydata>
</body>
</html>`
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run lib/twine/__tests__/exporter.test.ts
```

Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add lib/twine/exporter.ts lib/twine/__tests__/exporter.test.ts
git commit -m "feat(twine): Twine 2 HTML exporter with round-trip fidelity"
```

---

### Task 12: Export route + Import route (Next.js)

**Files:**
- Create: `app/api/story/[id]/export/twine/route.ts`
- Create: `app/api/story/import/twine/route.ts`

- [ ] **Step 1: Create the export route**

```typescript
// app/api/story/[id]/export/twine/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { buildTwineHtml } from '@/lib/twine/exporter'
import type { TwinePassage } from '@/lib/twine/parser'
import type { MultiverseNode, ChoiceEdge } from '@/types/multiverse'

const DJANGO = process.env.DJANGO_API_URL

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const upstream = await fetch(
    `${DJANGO}/api/agent/multiverse/${params.id}/`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  )
  if (!upstream.ok) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  const tree: { rootUid: string; nodes: Record<string, MultiverseNode>; edges: ChoiceEdge[] } = await upstream.json()

  if (Object.keys(tree.nodes).length === 0) {
    return NextResponse.json({ error: 'Story has no nodes' }, { status: 400 })
  }

  // Build edge index by fromUid
  const edgeIndex = new Map<string, ChoiceEdge[]>()
  tree.edges.forEach(e => {
    edgeIndex.set(e.fromUid, [...(edgeIndex.get(e.fromUid) ?? []), e])
  })

  // Map nodes → TwinePassage
  const passages: TwinePassage[] = Object.values(tree.nodes).map(node => ({
    name: node.uid,
    tags: [
      node.type === 'canon' ? 'canon' : 'explored',
      ...(node.hasParadox ? ['paradox'] : []),
      ...(node.structuralPattern ? [node.structuralPattern.toLowerCase()] : []),
    ],
    content: node.summary,
    links: (edgeIndex.get(node.uid) ?? []).map(e => ({
      label: e.label,
      target: e.toUid,
    })),
  }))

  const html = buildTwineHtml(`sori-story-${params.id}`, passages)
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="story-${params.id}.html"`,
    },
  })
}
```

- [ ] **Step 2: Create the import route**

```typescript
// app/api/story/import/twine/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parseTwee, parseTwineHtml } from '@/lib/twine/parser'

const DJANGO = process.env.DJANGO_API_URL

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const storyTitle = form.get('storyTitle') as string | null

  if (!file || !storyTitle) {
    return NextResponse.json({ error: 'file and storyTitle required' }, { status: 400 })
  }

  const text = await file.text()
  let passages
  try {
    passages = text.trimStart().startsWith('<!DOCTYPE')
      ? parseTwineHtml(text)
      : parseTwee(text)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 422 })
  }

  if (passages.length === 0) {
    return NextResponse.json({ error: 'No passages found in file' }, { status: 422 })
  }

  // Build payload for Django
  const nodes = passages.map(p => ({
    source_name: p.name,
    type: p.tags.includes('canon') ? 'canon' : 'simulation',
    summary: p.content.slice(0, 500), // truncate to fit summary field
    has_paradox: p.tags.includes('paradox'),
    confidence: 1.0,
    structural_pattern: '',
  }))

  const nameSet = new Set(passages.map(p => p.name))
  const edges = passages.flatMap((p, i) =>
    p.links
      .filter(l => nameSet.has(l.target))
      .map((l, j) => ({
        from_name: p.name,
        to_name: l.target,
        label: l.label,
        order: j,
      }))
  )

  const upstream = await fetch(`${DJANGO}/api/agent/import/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ story_title: storyTitle, nodes, edges }),
  })

  const data = await upstream.json()
  if (!upstream.ok) return NextResponse.json(data, { status: upstream.status })
  return NextResponse.json({ storyUid: data.story_uid }, { status: 201 })
}
```

- [ ] **Step 3: Typecheck both routes**

```bash
cd ~/code/sori.page && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/api/story/
git commit -m "feat(api): Twine export and import Next.js routes"
```

---

### Task 13: Django import endpoint

**Files:**
- Modify: `backend/agent/views.py`
- Modify: `backend/agent/serializers.py`
- Modify: `backend/agent/urls.py`
- Create: `backend/agent/tests/test_import.py`

- [ ] **Step 1: Write failing test**

```python
# backend/agent/tests/test_import.py
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def auth_user(db):
    return User.objects.create_user(username='testuser', password='pass')

@pytest.mark.django_db
def test_import_creates_story_and_returns_uid(client, auth_user):
    client.force_authenticate(user=auth_user)
    payload = {
        'story_title': 'Imported Story',
        'nodes': [
            {'source_name': 'Start', 'type': 'decision', 'summary': 'Opening scene', 'confidence': 1.0, 'has_paradox': False, 'structural_pattern': ''},
            {'source_name': 'Truth', 'type': 'canon',    'summary': 'She tells truth', 'confidence': 0.9, 'has_paradox': False, 'structural_pattern': 'Confrontation'},
        ],
        'edges': [
            {'from_name': 'Start', 'to_name': 'Truth', 'label': 'tell truth', 'order': 0}
        ],
    }
    response = client.post('/api/agent/import/', payload, format='json')
    assert response.status_code == 201
    assert 'story_uid' in response.data

@pytest.mark.django_db
def test_import_rejects_empty_nodes(client, auth_user):
    client.force_authenticate(user=auth_user)
    response = client.post('/api/agent/import/', {'story_title': 'Empty', 'nodes': [], 'edges': []}, format='json')
    assert response.status_code == 400
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd ~/code/sori.page && uv run pytest backend/agent/tests/test_import.py -v
```

Expected: FAIL (endpoint does not exist)

- [ ] **Step 3: Add ImportRequestSerializer**

Open `backend/agent/serializers.py`. Add at the end:

```python
class ImportNodeSerializer(serializers.Serializer):
    source_name      = serializers.CharField()
    type             = serializers.ChoiceField(choices=['decision', 'canon', 'simulation'])
    summary          = serializers.CharField(max_length=500)
    confidence       = serializers.FloatField(default=1.0)
    has_paradox      = serializers.BooleanField(default=False)
    structural_pattern = serializers.CharField(allow_blank=True, default='')


class ImportEdgeSerializer(serializers.Serializer):
    from_name = serializers.CharField()
    to_name   = serializers.CharField()
    label     = serializers.CharField()
    order     = serializers.IntegerField(default=0)


class ImportRequestSerializer(serializers.Serializer):
    story_title = serializers.CharField()
    nodes       = ImportNodeSerializer(many=True)
    edges       = ImportEdgeSerializer(many=True)

    def validate_nodes(self, value):
        if len(value) == 0:
            raise serializers.ValidationError('At least one node is required.')
        return value
```

- [ ] **Step 4: Add ImportMultiverseView**

Open `backend/agent/views.py`. Add this view (import neomodel models at the top of the file if not already imported):

```python
from .serializers import ImportRequestSerializer
from graph.models.multiverse import MultiverseRootNode, MultiverseSceneNode
from graph.models.story import StoryNode

class ImportMultiverseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ImportRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        owner_id = str(request.user.id)

        # Create story node
        story = StoryNode(
            title=data['story_title'],
            owner_id=owner_id,
            status='draft',
        ).save()

        # Create multiverse root
        root = MultiverseRootNode(story_uid=story.uid).save()
        root.story.connect(story)

        # Create scene nodes; track source_name → uid mapping
        uid_map: dict[str, str] = {}
        for node_data in data['nodes']:
            node = MultiverseSceneNode(
                story_uid=story.uid,
                node_type=node_data['type'],
                summary=node_data['summary'],
                structural_pattern=node_data['structural_pattern'],
                confidence=node_data['confidence'],
                has_paradox=node_data['has_paradox'],
                dialogue_turns=[],
            ).save()
            uid_map[node_data['source_name']] = node.uid
            root.scenes.connect(node)

        # Create edges
        for edge_data in data['edges']:
            from_uid = uid_map.get(edge_data['from_name'])
            to_uid = uid_map.get(edge_data['to_name'])
            if not from_uid or not to_uid:
                continue
            from_node = MultiverseSceneNode.nodes.get_or_none(uid=from_uid)
            to_node = MultiverseSceneNode.nodes.get_or_none(uid=to_uid)
            if from_node and to_node:
                from_node.choices.connect(
                    to_node,
                    {'label': edge_data['label'], 'order': edge_data['order']}
                )

        return Response({'story_uid': story.uid}, status=status.HTTP_201_CREATED)
```

> Note: Check `backend/graph/models/multiverse.py` to confirm the exact field names on `MultiverseSceneNode` (e.g. `node_type` vs `type`, `has_paradox` vs `hasParadox`). Match whatever the neomodel definition uses.

- [ ] **Step 5: Register the URL**

Open `backend/agent/urls.py`. Add:

```python
from .views import ImportMultiverseView

urlpatterns = [
    # ... existing patterns ...
    path('import/', ImportMultiverseView.as_view(), name='multiverse-import'),
]
```

- [ ] **Step 6: Run tests — expect pass**

```bash
uv run pytest backend/agent/tests/test_import.py -v
```

Expected: 2 passing

- [ ] **Step 7: Run full backend test suite**

```bash
uv run pytest backend/ -v
```

Expected: all passing (no regressions)

- [ ] **Step 8: Commit**

```bash
git add backend/agent/views.py backend/agent/serializers.py backend/agent/urls.py backend/agent/tests/test_import.py
git commit -m "feat(django): ImportMultiverseView bulk-creates Neo4j nodes from Twine import"
```

---

## Final Verification

- [ ] **Run all frontend tests**

```bash
cd ~/code/sori.page && pnpm vitest run
```

Expected: all passing

- [ ] **Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Run backend tests**

```bash
uv run pytest backend/ -v
```

Expected: all passing

- [ ] **Playwright smoke test (manual)**

1. Start services: `docker compose up -d`
2. Navigate to `/story/[a real story uid]/timeline`
3. Confirm nodes render with gold canon border + paradox badge where applicable
4. Click an explored node → confirm redirect to editor with `?resumeNode=` in URL
5. In editor, confirm simulation context restores (active node highlighted in MultiverseLab)
6. In timeline header, click "Export to Twine" → confirm `.html` file downloads
7. In timeline header, click "Import from Twine" → upload the downloaded file → confirm redirect to new story timeline with same structure
