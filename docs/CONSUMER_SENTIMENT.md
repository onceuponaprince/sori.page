# Consumer Sentiment Integration — Design Brief

> **Status**: Brainstorm phase. NOT in the 1-week MVP.
> This document outlines how audience reception data could enrich the knowledge graph.

## The Idea

Right now, sori.page knows about narrative **structure** (what patterns exist in stories). Adding consumer sentiment data would let it also know about narrative **impact** (which patterns resonate with audiences and why).

This is the difference between:
- "The mentor death trope appears at the midpoint" (structural knowledge)
- "The mentor death trope at the midpoint correlates with 23% higher audience emotional engagement" (impact knowledge)

## What This Enables

### For the Story Beat Generator
Instead of just generating a structurally correct scene, the generator could say:
- "This beat pattern has a 91% positive reception when executed in thriller genre"
- "Warning: This trope combination has audience fatigue — 60% of recent reviews cite it as predictable"
- "Audiences respond 2.3x more positively when this beat includes a subversion"

### For the Character Generator
- "This archetype in this genre has highest audience approval when given X trait"
- "Audiences report stronger connection to this archetype when the core wound is revealed in Act 1 rather than Act 2"

### For Writers (the real value)
Writers get data-informed guidance without reducing art to data. The system says "audiences tend to respond this way" — the writer decides what to do with that information.

## Data Sources

### IMDB Reviews + Ratings
- **What**: Per-movie ratings, review text, vote counts
- **Extraction**: Sentiment analysis on review text, correlation with structural elements
- **Signal**: Which narrative patterns correlate with high/low ratings
- **Caveat**: Ratings are noisy (reflect production quality, acting, etc. — not just story structure)

### Goodreads / StoryGraph
- **What**: Book ratings, tagged shelves, review text
- **Extraction**: Reader sentiment tied to specific narrative elements they mention
- **Signal**: More story-focused than IMDB (less confounded by production quality)
- **Caveat**: Selection bias (people who review books are not average readers)

### Reddit Discussion Threads
- **What**: Post-viewing/reading discussions (r/movies, r/books, r/TrueFilm)
- **Extraction**: NLP on discussion text to identify which structural elements provoke the most debate
- **Signal**: Contestation signal — heavily debated structural choices map to high-contestation concept nodes
- **Caveat**: Reddit demographics skew young and male

### Letterboxd
- **What**: Film reviews with more nuanced rating scales and tags
- **Extraction**: Tag co-occurrence with narrative structure labels
- **Signal**: More film-literate audience, better for structural analysis
- **Caveat**: Smaller scale than IMDB

### Box Office / Streaming Data (if accessible)
- **What**: Commercial performance metrics
- **Extraction**: Correlation between structural patterns and commercial success
- **Signal**: What narrative structures sell (separate from what critics love)
- **Caveat**: Confounded by marketing budgets, star power, release timing

## How It Maps to the Knowledge Graph

### New Node Type: SentimentNode
```
SentimentNode:
    concept_id: str           # Which ConceptNode this sentiment is about
    source: str               # imdb, goodreads, reddit, etc.
    sentiment_score: float    # -1 (negative) to +1 (positive)
    engagement_score: float   # How much discussion/votes this generates
    sample_size: int          # How many data points
    time_period: str          # When this data was collected
    genre_context: str        # Sentiment may differ by genre
    confidence: float         # Statistical confidence
```

### New Relationship: HAS_SENTIMENT
```
(ConceptNode)-[:HAS_SENTIMENT]->(SentimentNode)
```

### Impact on Depth Score
Sentiment data doesn't change what's structurally true. But it adds a new dimension to the agent's output — the `audience_impact_score` alongside the existing `depth_score` and `confidence`.

A concept could be:
- High confidence, high audience impact → Strong recommendation
- High confidence, low audience impact → Structurally valid but audience fatigue
- Low confidence, high audience impact → Popular but not well-understood structurally

## Ethical Considerations

1. **Art is not popularity** — The system should present sentiment as information, never as instruction. A writer should be free to ignore audience data entirely.

2. **Survivorship bias** — We only have sentiment data for works that were made and released. This biases toward conventional structures that got greenlit.

3. **Cultural context** — Audience reception varies massively by culture, era, and platform. Sentiment should always be tagged with its source and context.

4. **Gaming** — If the system's recommendations are visible, creators might optimize for the metrics rather than for genuine storytelling. This needs to be a "here's what happened historically" tool, not a "do this to score well" tool.

## Implementation Timeline

This is a post-v1 feature. Estimated phases:

1. **Phase 1**: IMDB sentiment scraping + basic correlation with existing ConceptNodes
2. **Phase 2**: Goodreads integration + book-specific sentiment analysis
3. **Phase 3**: Reddit discussion NLP + contestation scoring
4. **Phase 4**: Cross-source sentiment aggregation + confidence scoring
5. **Phase 5**: Integration into generator prompts as optional context

Each phase adds a new data source and refines the sentiment-to-concept mapping. No phase depends on the others, so they can be built incrementally.
