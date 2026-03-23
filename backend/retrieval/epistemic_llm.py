"""
Optional LLM enrichment for epistemic tracking.

Called only when the retrieval view receives enrich=true. Takes the heuristic
extraction results + raw outline, asks Claude for corrected/enriched character,
fact, and temporal-edge data, then merges the result back into the Neo4j graph
with upgraded confidence scores.

This module is intentionally kept separate so the heuristic-only path remains
fast and independent of API availability.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from django.conf import settings

from neomodel import db

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a structural analysis engine for sori.page.

Given a story outline and a heuristic extraction of characters, facts, and
temporal relationships, return a corrected and enriched version of the same
data. Focus on:

1. Characters: confirm names, add any missed characters, assign role hints
   (protagonist, antagonist, mentor, ally, etc.)
2. Facts: correct or refine fact descriptions, fix introduced_at_beat numbers,
   add any missed information-transfer events.
3. Temporal edges: for each fact, determine which characters learn it (KNOWS_AT)
   and which characters act on it (ACTS_ON) at which beat. A character should
   not have an ACTS_ON edge unless they plausibly know the information at that
   point.

Return raw JSON only. No markdown. No commentary. Use this schema exactly:

{
  "characters": [
    { "name": "string", "role_hint": "string|null", "aliases": ["string"] }
  ],
  "facts": [
    {
      "description": "string",
      "introduced_at_beat": number,
      "fact_type": "information|secret|revelation|deception",
      "knows_at": [{ "character": "string", "beat_index": number }],
      "acts_on": [{ "character": "string", "beat_index": number }]
    }
  ]
}

Constraints:
- Beat indices are 1-based and correspond to outline line numbers.
- A character cannot act on information before learning it.
- Keep descriptions concise (under 120 characters).
- Do not invent characters or facts not present or strongly implied in the outline."""


def enrich_epistemic_graph(
    story_uid: str,
    outline: str,
    heuristic_state: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Call Claude to upgrade the epistemic graph and return the enriched state."""
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    if not api_key:
        logger.debug("No ANTHROPIC_API_KEY configured; skipping LLM enrichment")
        return None

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed; skipping LLM enrichment")
        return None

    client = anthropic.Anthropic(api_key=api_key)

    user_prompt = f"""Story outline:
{outline}

Heuristic extraction (may contain errors):
{json.dumps(heuristic_state or {}, indent=2)}

Return the corrected and enriched JSON now."""

    try:
        result = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1400,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = "".join(
            block.text for block in result.content if hasattr(block, "text")
        )
        enriched = _extract_json(text)
        if not enriched:
            logger.warning("LLM enrichment returned unparseable output")
            return None

        _merge_enriched_graph(story_uid, enriched)
        return _build_enriched_snapshot(story_uid, enriched)

    except Exception:
        logger.exception("LLM epistemic enrichment failed")
        return None


def _extract_json(text: str) -> dict[str, Any] | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None


def _merge_enriched_graph(story_uid: str, enriched: dict[str, Any]) -> None:
    """Merge LLM-enriched data into the existing Neo4j epistemic graph."""
    characters = enriched.get("characters", [])
    facts = enriched.get("facts", [])

    for char in characters:
        name = char.get("name", "").strip()
        if not name:
            continue

        db.cypher_query(
            """
            MERGE (c:CharacterNode {name: $name, story_uid: $story_uid})
            ON CREATE SET c.uid = $uid, c.role_hint = $role_hint,
                          c.created_at = datetime()
            ON MATCH SET c.role_hint = $role_hint
            """,
            {
                "name": name,
                "story_uid": story_uid,
                "uid": uuid.uuid4().hex,
                "role_hint": char.get("role_hint"),
            },
        )

    for fact in facts:
        description = (fact.get("description") or "").strip()
        beat = fact.get("introduced_at_beat")
        if not description or beat is None:
            continue

        fact_uid = uuid.uuid4().hex
        fact_type = fact.get("fact_type", "information")

        # MERGE on description+story to avoid duplicates from the heuristic pass
        db.cypher_query(
            """
            MERGE (f:StoryFactNode {description: $description, story_uid: $story_uid})
            ON CREATE SET f.uid = $uid, f.introduced_at_beat = $beat,
                          f.fact_type = $fact_type, f.created_at = datetime()
            ON MATCH SET f.introduced_at_beat = $beat, f.fact_type = $fact_type
            """,
            {
                "uid": fact_uid,
                "story_uid": story_uid,
                "description": description,
                "beat": beat,
                "fact_type": fact_type,
            },
        )

        for edge in fact.get("knows_at", []):
            char_name = (edge.get("character") or "").strip()
            edge_beat = edge.get("beat_index")
            if not char_name or edge_beat is None:
                continue

            db.cypher_query(
                """
                MATCH (c:CharacterNode {name: $name, story_uid: $story_uid})
                MATCH (f:StoryFactNode {description: $description, story_uid: $story_uid})
                MERGE (c)-[r:KNOWS_AT]->(f)
                SET r.beat_index = $beat, r.confidence = 0.9, r.source = 'llm'
                """,
                {
                    "name": char_name,
                    "story_uid": story_uid,
                    "description": description,
                    "beat": edge_beat,
                },
            )

        for edge in fact.get("acts_on", []):
            char_name = (edge.get("character") or "").strip()
            edge_beat = edge.get("beat_index")
            if not char_name or edge_beat is None:
                continue

            db.cypher_query(
                """
                MATCH (c:CharacterNode {name: $name, story_uid: $story_uid})
                MATCH (f:StoryFactNode {description: $description, story_uid: $story_uid})
                MERGE (c)-[r:ACTS_ON]->(f)
                SET r.beat_index = $beat, r.confidence = 0.9, r.source = 'llm'
                """,
                {
                    "name": char_name,
                    "story_uid": story_uid,
                    "description": description,
                    "beat": edge_beat,
                },
            )


def _build_enriched_snapshot(
    story_uid: str,
    enriched: dict[str, Any],
) -> dict[str, Any]:
    """Build the frontend-facing snapshot from the enriched data, then re-detect violations."""
    from retrieval.epistemic import detect_violations

    characters = [
        {"name": c.get("name", ""), "role_hint": c.get("role_hint")}
        for c in enriched.get("characters", [])
        if c.get("name")
    ]

    facts = []
    for f in enriched.get("facts", []):
        facts.append({
            "description": f.get("description", ""),
            "introduced_at_beat": f.get("introduced_at_beat", 0),
            "known_by": [
                {"character": e["character"], "beat_index": e.get("beat_index", 0)}
                for e in f.get("knows_at", [])
                if e.get("character")
            ],
            "acted_on_by": [
                {"character": e["character"], "beat_index": e.get("beat_index", 0)}
                for e in f.get("acts_on", [])
                if e.get("character")
            ],
        })

    try:
        violations = detect_violations(story_uid)
    except Exception:
        violations = []

    return {
        "characters": characters,
        "facts": facts,
        "violations": violations,
    }
