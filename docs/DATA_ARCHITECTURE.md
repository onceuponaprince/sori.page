# sori.page — Data Input, Sanitization, and Embedding Architecture

## Overview

This document outlines how raw data enters the sori.page system, gets cleaned, embedded, and ultimately trains the knowledge graph that powers the AI context engine.

```
Raw Sources ──→ Ingestion ──→ Sanitization ──→ Embedding ──→ Clustering ──→ Human Review ──→ Canonical Graph
                                                                              ↑
                                                                         The key step.
                                                                    Humans have final say.
```

---

## 1. Data Sources (Input)

### Tier 1 — Structured Sources (auto-canonize at d=1, d=2)
These are highly reliable and can be ingested with minimal human oversight.

| Source | What We Extract | Depth Score | Pipeline |
|--------|----------------|-------------|----------|
| TV Tropes | Named tropes, descriptions, examples | d=2 | `ingest_tvtropes` |
| Craft Books (summaries) | Structural definitions, beat descriptions | d=1 | Manual upload via admin |
| PokeAPI-equivalent story DBs | Categorical story data (genre tags, character roles) | d=1 | API fetch |

### Tier 2 — Semi-Structured Sources (cluster + human review at d=3)
These contain valuable patterns but need algorithmic grouping and human validation.

| Source | What We Extract | Depth Score | Pipeline |
|--------|----------------|-------------|----------|
| IMDB | Movie metadata, plot keywords, genre combos, ratings | d=3 | `ingest_imdb` |
| Project Gutenberg | Full text of public domain fiction, chapter structure | d=3 | `ingest_gutenberg` |
| Reddit (r/writing, r/screenwriting) | Community analysis of narrative patterns | d=3-4 | `ingest_reddit` (planned) |

### Tier 3 — Unstructured Sources (highest human oversight needed, d=4-5)
Rich but noisy. Requires heavy clustering and expert review.

| Source | What We Extract | Depth Score | Pipeline |
|--------|----------------|-------------|----------|
| YouTube video essays | Narrative analysis transcripts | d=4 | Planned |
| Academic papers (JSTOR) | Literary theory, formal analysis | d=4 | Planned |
| Consumer reviews/sentiment | Audience reception patterns | d=5 | Brainstorm phase |

---

## 2. Ingestion Pipeline

### Architecture
```
                    ┌──────────────┐
Raw Source ────────→│   Scraper    │────→ Raw Instance Buffer (staging table)
                    │  (per-source)│
                    └──────────────┘
                           │
                    Rate limited, logged,
                    source-attributed
```

### Scraper Design Principles
1. **One scraper per source** — Each source has its own module (tvtropes.py, imdb_scraper.py, etc.)
2. **Rate limiting** — Respectful delays between requests (2-3 seconds minimum)
3. **Source attribution** — Every piece of data links back to a `SourceNode` with URL, reliability score
4. **Idempotent** — Running a scraper twice doesn't create duplicates (upsert by URL/identifier)
5. **Dry-run mode** — Every scraper supports `--dry-run` to preview without writing

### Raw Instance Buffer
Before anything enters the knowledge graph, it lands in a staging area:

```python
class RawInstance:
    source_url: str          # Where it came from
    source_type: str         # tvtropes, imdb, gutenberg, etc.
    raw_text: str            # Original text
    extracted_entities: dict  # Parsed metadata
    scraped_at: datetime
    status: str              # pending | sanitized | embedded | clustered | reviewed
```

This is stored in Postgres (not Neo4j) because it's transient staging data, not canonical knowledge.

---

## 3. Sanitization Pipeline

### Step 1: Text Cleaning
```
Raw text ──→ Strip HTML ──→ Normalize whitespace ──→ Fix encoding ──→ Remove boilerplate
```

- HTML entities decoded (`&amp;` → `&`)
- Multiple whitespace collapsed
- Source-specific boilerplate removed (TV Tropes navigation, IMDB headers)
- Non-English content filtered (v1 is English-only)

### Step 2: Entity Extraction
Using Claude (or a smaller model for cost efficiency):

```
Cleaned text ──→ LLM extraction ──→ Structured entities
```

Extract:
- **Work references**: Title, author/director, year, medium (film/book/TV)
- **Character references**: Names, roles, relationships
- **Trope indicators**: Narrative patterns described in the text
- **Structural markers**: Act references, beat descriptions, timing cues

### Step 3: Deduplication
```
Extracted entity ──→ Fuzzy match against existing graph ──→ Merge or create new
```

- Exact URL match: skip entirely (already ingested)
- Entity name fuzzy match (>0.85 similarity): flag for human review
- No match: proceed to embedding

### Step 4: Content Filtering
Remove data that shouldn't enter the graph:
- Personally identifiable information (names of non-public figures)
- Copyrighted full text (we store references, not full works)
- Spam/low-quality content (detected by length and coherence heuristics)
- Factually disputed claims below a contestation threshold

---

## 4. Embedding Pipeline

### Architecture
```
Sanitized Instance ──→ Sentence Transformer ──→ 384-dim vector ──→ Weaviate
                                                        │
                                                        └──→ Neo4j (stored on node)
```

### Model Choice: all-MiniLM-L6-v2
- **384 dimensions** — good balance of quality and storage efficiency
- **Runs locally** — no API costs, no data leaving the server
- **Fast** — can embed thousands of instances per minute
- **Good for semantic similarity** — which is exactly what clustering needs

### What Gets Embedded
Not everything. Only text that needs to be compared semantically:

| Data Type | Embedded? | Why |
|-----------|-----------|-----|
| Trope descriptions | Yes | Need to find similar/overlapping tropes |
| Instance descriptions | Yes | Need to cluster into concept proposals |
| Function descriptions | Yes | Need to match queries to relevant functions |
| Concept names | No | Use exact match / full-text search instead |
| Parameter values | No | Structured data, not semantic |
| Source URLs | No | Exact match only |

### Dual Storage
Embeddings are stored in two places:
1. **Weaviate** — for fast vector similarity search (RAG fallback)
2. **Neo4j node property** — for graph-traversal-aware similarity (future feature)

---

## 5. Clustering Pipeline (Concept Emergence)

### Architecture
```
Embedded Instances ──→ HDBSCAN ──→ Proposed Clusters ──→ Human Review Queue
```

### Why HDBSCAN?
- **No fixed cluster count** — it finds natural groupings
- **Handles noise** — not every instance belongs to a cluster (that's okay)
- **Variable density** — some concepts have many instances, some have few
- **Stable** — small additions don't radically reshape existing clusters

### Clustering Parameters
```python
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=3,      # At least 3 instances to form a concept
    min_samples=2,           # Density requirement
    metric='cosine',         # Works well with sentence embeddings
    cluster_selection_method='eom',  # Excess of mass (better for varying sizes)
)
```

### Cluster → Concept Proposal
When HDBSCAN identifies a cluster:
1. Extract the centroid text (most representative instance)
2. Auto-generate a proposed concept name using Claude
3. Calculate initial depth score estimate based on source reliability
4. Enter the cluster into the contributor review queue

### Bias Correction Loop
The clustering algorithm's groupings are **proposals, not decisions**. Humans correct them:

```
Algorithm proposes cluster ──→ Human splits/merges/accepts/rejects
                                        │
                                        ↓
                              Correction logged as training signal
                                        │
                                        ↓
                              Algorithm improves over time
```

This is the key insight: **the machine's bias becomes visible and correctable** rather than invisible and embedded.

---

## 6. Human Review → Canonical Graph

### The Five Actions
When a contributor reviews a proposed cluster:

1. **Accept** — Formalize as a ConceptNode, assign name and description
2. **Split** — Break into two or more separate concepts
3. **Merge** — Combine with an existing ConceptNode
4. **Promote** — Elevate one instance to a concept-level generalization
5. **Reject** — Not ready yet, send back for more instance accumulation

### Quorum System
Approval threshold depends on depth score:

| Depth | Required Approvals | Rationale |
|-------|-------------------|-----------|
| d=1-2 | 0 (auto-canonize) | Verifiable against primary sources |
| d=3 | 1 contributor | Low-contestation empirical patterns |
| d=4 | 2 contributors | Interpretive claims need peer review |
| d=5+ | All active contributors | Contested claims need full consensus |

### Git-Style Versioning
Every change is a Commit. Contributors work on Branches. Approval merges to main.

```
main (canonical) ←──── merge (quorum approved)
                           ↑
                     review branch (submitted for consensus)
                           ↑
                     draft branch (contributor working)
```

---

## 7. Training the LLM (Future — Not in MVP)

sori.page doesn't fine-tune a model. It **constrains** a general-purpose model (Claude) with structured knowledge. But there are two future paths for using the graph to improve AI performance:

### Path A: Prompt Engineering (Current)
The graph provides structured context that shapes the LLM's output:
```
User query ──→ Graph retrieval ──→ Structured prompt with concept nodes ──→ Claude ──→ Grounded output
```

### Path B: Fine-Tuning (Future)
Use the canonical graph to generate training data:
```
For each FunctionNode:
  Generate (input, ideal_output) pairs from verified instances
  ──→ Fine-tune a smaller model specifically for sori.page's domain
```

This would let you run a cheaper, faster, domain-specific model alongside Claude for cost-sensitive queries.

### Path C: Retrieval-Augmented Generation (Active)
The three-layer retrieval stack already does this:
```
1. Graph Retrieval (structured, verified) ──→ primary knowledge
2. RAG Retrieval (Weaviate vectors) ──→ supplementary context
3. LLM Generation ──→ constrained by both layers
```

---

## 8. Data Flow Summary

```
TV Tropes ──┐
IMDB ───────┤
Gutenberg ──┤──→ Scraper ──→ Sanitize ──→ Embed ──→ Cluster ──→ Human ──→ Neo4j
Reddit ─────┤                    │                      │                    │
YouTube ────┘                    │                      │                    ▼
                                 ▼                      ▼               Graph Query
                           Weaviate (RAG)        Contributor Queue    ──→ Claude
                                                                     ──→ Generated Scene
```

Each arrow is a concrete pipeline component with its own module, rate limiting, error handling, and dry-run capability.
