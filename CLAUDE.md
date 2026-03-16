# sori.page — Development Guide

## What is this?

sori.page is an AI context engine for writers. It generates story scenes and characters that are **structurally grounded** in verified narrative concepts — tropes, archetypes, and story beats — rather than statistical word prediction.

The core idea: instead of AI that sounds like it knows about stories, build AI that actually reasons from narrative structure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                    │
│  Landing Page │ Generators │ Admin │ Contributor UI   │
└────────────────────┬────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────┐
│                  Django Backend                       │
│  Graph API │ Ingestion │ Retrieval │ Contributors     │
└──┬──────────────┬──────────────────┬────────────────┘
   │              │                  │
   ▼              ▼                  ▼
 Neo4j         Weaviate          Supabase
 (Knowledge    (RAG Vector      (Auth, Credits,
  Graph)        Store)           User Data)
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 + React + Tailwind + shadcn/ui | UI, landing page, generators |
| Backend | Django + DRF | API, ingestion pipelines, graph operations |
| Knowledge Graph | Neo4j | Concept nodes, function nodes, story structure |
| Vector Store | Weaviate | RAG fallback when graph can't answer |
| Database | Supabase (Postgres) | Auth, user profiles, credits, generation history |
| AI | Anthropic Claude API | Scene and character generation |
| Clustering | HDBSCAN | Auto-groups raw instances into concept proposals |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.12+
- Docker & Docker Compose
- A Supabase project (free tier works)
- An Anthropic API key

### 1. Clone and install
```bash
git clone <repo-url> && cd sori.page
yarn install                          # Frontend dependencies
cd backend && pip install -r requirements.txt  # Backend dependencies
```

### 2. Environment setup
```bash
cp .env.example .env
# Fill in your keys:
#   ANTHROPIC_API_KEY
#   SUPABASE_URL, SUPABASE_SERVICE_KEY
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Start infrastructure
```bash
docker compose up -d neo4j weaviate   # Start databases
```

### 4. Initialize databases
```bash
# Run the Supabase migration (in Supabase dashboard SQL editor):
# Copy contents of supabase/migrations/001_initial_schema.sql

# Initialize Neo4j schema:
cd backend && python manage.py init_graph
```

### 5. Run the app
```bash
# Terminal 1 — Frontend
yarn dev

# Terminal 2 — Backend
cd backend && python manage.py runserver
```

Frontend: http://localhost:3000
Backend API: http://localhost:8000
Neo4j Browser: http://localhost:7474

## Project Structure

```
sori.page/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Public pages (landing, login)
│   │   ├── page.tsx              # Landing page + waitlist
│   │   └── login/page.tsx        # Social login (Google/GitHub/Twitter)
│   ├── (app)/                    # Authenticated app pages
│   │   ├── layout.tsx            # App shell with nav
│   │   ├── generate/page.tsx     # Story Beat Generator
│   │   ├── characters/page.tsx   # Character Generator
│   │   ├── contribute/page.tsx   # Contributor review queue
│   │   ├── gaps/page.tsx         # Knowledge gap queue
│   │   └── admin/                # Admin dashboard
│   ├── api/                      # Next.js API routes
│   │   ├── generate/beat/        # Beat generation (streaming SSE)
│   │   ├── generate/character/   # Character generation (streaming SSE)
│   │   ├── waitlist/             # Waitlist signup (Supabase)
│   │   ├── tropes/               # Trope search (Neo4j → fallback)
│   │   └── admin/                # Admin CRUD operations
│   └── auth/callback/            # OAuth callback handler
│
├── lib/                          # Shared frontend utilities
│   ├── narrative-concepts.ts     # Seeded story beats, archetypes, templates
│   ├── supabase.ts               # Supabase client (server + browser)
│   ├── auth.ts                   # Auth helpers (sign in, sign out)
│   ├── credits.ts                # Credit checking/deduction
│   └── use-stream.ts             # SSE streaming hook for generators
│
├── components/                   # React components
│   ├── Navbar.tsx                # Active link navigation
│   └── ui/                       # shadcn/ui components
│
├── backend/                      # Django backend
│   ├── sori/                     # Django project settings
│   ├── graph/                    # Neo4j graph models & API
│   │   ├── models/               # Node definitions (knowledge.py, versioning.py, etc.)
│   │   └── views.py              # Search, detail, stats endpoints
│   ├── ingestion/                # Data ingestion pipelines
│   │   ├── tvtropes.py           # TV Tropes scraper
│   │   ├── imdb_scraper.py       # IMDB scraper
│   │   ├── gutenberg.py          # Project Gutenberg scraper
│   │   └── management/commands/  # Django management commands
│   ├── retrieval/                # GraphRAG + vector retrieval
│   ├── contributors/             # Contributor workflows & consensus
│   └── agent/                    # LLM query interface
│
├── supabase/migrations/          # Postgres schema (auth, credits, history)
├── docker/neo4j/init/            # Neo4j schema initialization
└── docker-compose.yml            # Development infrastructure
```

## Key Concepts

### The Verification Spectrum
Every piece of knowledge has a **depth score** (d) measuring distance from ground truth:

| d | Level | Example | Quorum |
|---|-------|---------|--------|
| 1 | Structural definitions | "Three-act structure has setup, confrontation, resolution" | Auto-canonized |
| 2 | Named tropes | TV Tropes entries with overwhelming consensus | Auto-canonized |
| 3 | Empirical patterns | "Mentor death appears in 70%+ of hero's journey stories" | 1 contributor |
| 4 | Interpretive concepts | "Subverting the Chosen One increases thematic resonance" | 2 contributors |
| 5 | Contested opinions | "Prologues weaken narrative hooks" | All contributors |

### Neo4j Node Types
- **ConceptNode** — A named narrative pattern (may or may not have a function yet)
- **FunctionNode** — A generative pattern with parameters and formula
- **InstanceNode** — A specific real-world example (Obi-Wan's death in ANH)
- **SlangNode** — Community terms pointing to concepts ("fridging")
- **GapNode** — Detected knowledge absence (prioritized for contributors)
- **StoryNode/SceneNode** — User-created story structures (v2)
- **Commit/Branch** — Git-style versioning for graph changes

### The Three-Layer Retrieval Stack
1. **Graph Retrieval** (Neo4j) — fires first, returns verified concept nodes
2. **RAG Retrieval** (Weaviate) — fires only when graph can't answer
3. **LLM Generation** (Claude) — receives structured knowledge, generates prose

### Generators
Both generators use **Server-Sent Events (SSE)** for real-time streaming.
The `useStream` hook in `lib/use-stream.ts` handles the client-side consumption.

Generations are saved to Supabase's `generations` table with full input/output history.

## Management Commands

```bash
# Scrape TV Tropes narrative indexes
python manage.py ingest_tvtropes --max-per-index 25
python manage.py ingest_tvtropes --dry-run          # Preview without writing

# Scrape IMDB top movies
python manage.py ingest_imdb --max-works 50
python manage.py ingest_imdb --dry-run

# Scrape Project Gutenberg fiction
python manage.py ingest_gutenberg --subject Fiction --max-works 20

# Initialize Neo4j schema
python manage.py init_graph
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API for generation |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (server-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client-side) |
| `NEO4J_URI` | For backend | Neo4j bolt connection |
| `NEO4J_USER` | For backend | Neo4j username |
| `NEO4J_PASSWORD` | For backend | Neo4j password |
| `WEAVIATE_URL` | For backend | Weaviate REST endpoint |
| `NEXT_PUBLIC_API_URL` | Optional | Django backend URL (default: localhost:8000) |
