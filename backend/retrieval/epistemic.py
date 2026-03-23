"""
Epistemic tracking — graph-backed "who knows what when" analysis.

This replaces the keyword-only infer_timeline_warnings with a real model:
1. Extract characters and story facts from the outline (heuristic pass)
2. Build CharacterNode / StoryFactNode / temporal edges in Neo4j
3. Run a Cypher query that detects "acts on unearned knowledge" violations
4. Return structured warnings the frontend can render per-character

The optional LLM enrichment layer in epistemic_llm.py can refine these
extractions when the writer has credits and the request includes enrich=true.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from neomodel import db

from retrieval.services import KNOWLEDGE_MARKERS

# Verbs that indicate a character is *acting on* information, not just learning it
ACTION_MARKERS = (
    "decides",
    "decide",
    "acts",
    "confronts",
    "confront",
    "uses",
    "leverages",
    "publishes",
    "publish",
    "exposes",
    "expose",
    "tells",
    "warns",
    "sends",
    "escapes",
    "escape",
    "betrays",
    "betray",
    "fights",
    "fight",
    "chooses",
    "choose",
    "refuses",
    "refuse",
    "accepts",
    "accept",
)

# Common non-character capitalized words to skip during name extraction
NON_CHARACTER_WORDS = {
    "the", "act", "chapter", "scene", "beat", "part", "when", "after",
    "before", "each", "every", "finally", "meanwhile", "later", "she",
    "they", "must", "will", "this", "that", "their", "into", "from",
    "with", "about", "through", "where", "what", "which", "could",
    "would", "should", "does", "her", "his", "its", "are", "has",
    "have", "had", "been", "being", "not", "but", "for", "and",
    "a", "an", "in", "on", "at", "to", "of", "is", "it", "as",
    "if", "or", "so", "no", "my", "he", "we", "do", "by", "up",
    "one", "two", "three", "new", "old", "all",
}


def extract_and_check(
    story_uid: str | None,
    lines: list[str],
) -> dict[str, Any]:
    """Full epistemic pass: extract, build graph, detect violations, return state."""
    if not lines:
        return _empty_state()

    effective_uid = story_uid or f"transient-{uuid.uuid4().hex[:12]}"
    characters = extract_characters_heuristic(lines)
    facts = extract_facts_heuristic(lines)

    try:
        build_epistemic_graph(effective_uid, characters, facts, lines)
        violations = detect_violations(effective_uid)
    except Exception:
        violations = []

    warnings = format_epistemic_warnings(violations)
    if not warnings and len(lines) >= 4:
        warnings.append({
            "label": "Knowledge handoff not yet explicit",
            "detail": (
                "The outline shows strong escalation, but the epistemic layer "
                "could not yet pin down when crucial information changes hands."
            ),
            "severity": "low",
        })

    state = {
        "characters": [
            {"name": c["name"], "role_hint": c.get("role_hint")}
            for c in characters
        ],
        "facts": _build_fact_snapshot(effective_uid, facts),
        "violations": violations,
    }

    if not story_uid and effective_uid.startswith("transient-"):
        _cleanup_transient(effective_uid)

    return {
        "timeline_warnings": warnings[:6],
        "epistemic_state": state,
    }


def extract_characters_heuristic(lines: list[str]) -> list[dict[str, Any]]:
    """Pull character names from outline lines using capitalized-name patterns."""
    seen: dict[str, dict[str, Any]] = {}
    name_pattern = re.compile(r"\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]{2,}){0,2}\b")

    for beat_index, line in enumerate(lines, start=1):
        for match in name_pattern.finditer(line):
            full_name = match.group(0)
            first_word = full_name.split()[0].lower()
            if first_word in NON_CHARACTER_WORDS:
                continue
            if len(full_name) < 3:
                continue

            key = full_name.lower()
            if key not in seen:
                role_hint = _infer_role(line, full_name, beat_index)
                seen[key] = {
                    "name": full_name,
                    "beat_index": beat_index,
                    "role_hint": role_hint,
                }

    return list(seen.values())


def extract_facts_heuristic(lines: list[str]) -> list[dict[str, Any]]:
    """Identify information-transfer events from outline lines."""
    facts: list[dict[str, Any]] = []

    for beat_index, line in enumerate(lines, start=1):
        lowered = line.lower()
        if not any(marker in lowered for marker in KNOWLEDGE_MARKERS):
            continue

        characters_in_line = _names_in_line(line)

        learner = None
        actor = None
        for marker in KNOWLEDGE_MARKERS:
            pos = lowered.find(marker)
            if pos == -1:
                continue
            prefix = line[:pos].strip()
            # The character closest to the knowledge verb is likely the learner
            for char in characters_in_line:
                if char.lower() in prefix.lower():
                    learner = char
                    break

        for marker in ACTION_MARKERS:
            if marker in lowered:
                prefix = line[:lowered.find(marker)].strip()
                for char in characters_in_line:
                    if char.lower() in prefix.lower():
                        actor = char
                        break

        fact_desc = _extract_fact_description(line)
        facts.append({
            "description": fact_desc,
            "introduced_at_beat": beat_index,
            "learner": learner,
            "actor": actor,
            "characters_involved": characters_in_line,
        })

    return facts


def build_epistemic_graph(
    story_uid: str,
    characters: list[dict[str, Any]],
    facts: list[dict[str, Any]],
    lines: list[str],
) -> None:
    """Create/update CharacterNode, StoryFactNode, and temporal edges in Neo4j."""
    _clear_story_epistemic(story_uid)

    for char in characters:
        db.cypher_query(
            """
            MERGE (c:CharacterNode {name: $name, story_uid: $story_uid})
            ON CREATE SET c.uid = $uid, c.role_hint = $role_hint,
                          c.created_at = datetime()
            ON MATCH SET c.role_hint = $role_hint
            """,
            {
                "name": char["name"],
                "story_uid": story_uid,
                "uid": uuid.uuid4().hex,
                "role_hint": char.get("role_hint"),
            },
        )

    for fact in facts:
        fact_uid = uuid.uuid4().hex
        db.cypher_query(
            """
            CREATE (f:StoryFactNode {
                uid: $uid,
                story_uid: $story_uid,
                description: $description,
                introduced_at_beat: $beat,
                fact_type: 'information',
                created_at: datetime()
            })
            """,
            {
                "uid": fact_uid,
                "story_uid": story_uid,
                "description": fact["description"],
                "beat": fact["introduced_at_beat"],
            },
        )

        # KNOWS_AT: the learner knows this fact at the beat it appears
        if fact.get("learner"):
            db.cypher_query(
                """
                MATCH (c:CharacterNode {name: $name, story_uid: $story_uid})
                MATCH (f:StoryFactNode {uid: $fact_uid})
                MERGE (c)-[r:KNOWS_AT]->(f)
                ON CREATE SET r.beat_index = $beat, r.confidence = 0.7,
                              r.source = 'heuristic'
                """,
                {
                    "name": fact["learner"],
                    "story_uid": story_uid,
                    "fact_uid": fact_uid,
                    "beat": fact["introduced_at_beat"],
                },
            )

        # ACTS_ON: any character who acts on this information in later beats
        if fact.get("actor"):
            db.cypher_query(
                """
                MATCH (c:CharacterNode {name: $name, story_uid: $story_uid})
                MATCH (f:StoryFactNode {uid: $fact_uid})
                MERGE (c)-[r:ACTS_ON]->(f)
                ON CREATE SET r.beat_index = $beat, r.confidence = 0.7,
                              r.source = 'heuristic'
                """,
                {
                    "name": fact["actor"],
                    "story_uid": story_uid,
                    "fact_uid": fact_uid,
                    "beat": fact["introduced_at_beat"],
                },
            )

    # Scan remaining lines for action verbs referencing known characters+facts
    _infer_downstream_actions(story_uid, characters, facts, lines)


def detect_violations(story_uid: str) -> list[dict[str, Any]]:
    """Find ACTS_ON edges with no preceding KNOWS_AT for the same character+fact."""
    rows, _ = db.cypher_query(
        """
        MATCH (c:CharacterNode {story_uid: $story_uid})-[a:ACTS_ON]->(f:StoryFactNode)
        WHERE NOT EXISTS {
            MATCH (c)-[k:KNOWS_AT]->(f)
            WHERE k.beat_index <= a.beat_index
        }
        RETURN c.name AS character,
               f.description AS fact,
               a.beat_index AS acts_at,
               f.introduced_at_beat AS fact_introduced
        ORDER BY a.beat_index
        """,
        {"story_uid": story_uid},
    )

    violations = []
    for row in rows:
        violations.append({
            "character": row[0],
            "fact": row[1],
            "acts_at_beat": row[2],
            "fact_introduced_at": row[3],
            "severity": "high" if row[2] < (row[3] or 999) else "medium",
        })

    return violations


def format_epistemic_warnings(
    violations: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Convert raw violations into the TimelineWarning shape for the UI."""
    warnings = []
    for violation in violations:
        char = violation["character"]
        fact = violation["fact"][:80]
        beat = violation["acts_at_beat"]
        severity = violation.get("severity", "medium")

        warnings.append({
            "label": f"{char} acts on unearned knowledge at beat {beat}",
            "detail": (
                f'{char} appears to act on "{fact}" at beat {beat}, '
                f"but the outline does not show them learning this information "
                f"before that point."
            ),
            "severity": severity,
        })

    return warnings


def get_epistemic_state(story_uid: str) -> dict[str, Any]:
    """Return the full epistemic graph for a story, including current violations."""
    chars_raw, _ = db.cypher_query(
        """
        MATCH (c:CharacterNode {story_uid: $story_uid})
        RETURN c.name AS name, c.role_hint AS role_hint
        ORDER BY c.name
        """,
        {"story_uid": story_uid},
    )

    facts_raw, _ = db.cypher_query(
        """
        MATCH (f:StoryFactNode {story_uid: $story_uid})
        OPTIONAL MATCH (c_k:CharacterNode)-[k:KNOWS_AT]->(f)
        OPTIONAL MATCH (c_a:CharacterNode)-[a:ACTS_ON]->(f)
        RETURN f.description AS description,
               f.introduced_at_beat AS introduced_at,
               collect(DISTINCT {character: c_k.name, beat: k.beat_index}) AS known_by,
               collect(DISTINCT {character: c_a.name, beat: a.beat_index}) AS acted_on_by
        ORDER BY f.introduced_at_beat
        """,
        {"story_uid": story_uid},
    )

    characters = [{"name": r[0], "role_hint": r[1]} for r in chars_raw]
    facts = []
    for row in facts_raw:
        facts.append({
            "description": row[0],
            "introduced_at_beat": row[1],
            "known_by": [
                e for e in row[2] if e.get("character") is not None
            ],
            "acted_on_by": [
                e for e in row[3] if e.get("character") is not None
            ],
        })

    violations = detect_violations(story_uid)

    return {
        "characters": characters,
        "facts": facts,
        "violations": violations,
    }


# ── Internal helpers ────────────────────────────────────────


def _empty_state() -> dict[str, Any]:
    return {
        "timeline_warnings": [],
        "epistemic_state": {
            "characters": [],
            "facts": [],
            "violations": [],
        },
    }


def _names_in_line(line: str) -> list[str]:
    pattern = re.compile(r"\b([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]{2,}){0,2}\b")
    return [
        m.group(0)
        for m in pattern.finditer(line)
        if m.group(0).split()[0].lower() not in NON_CHARACTER_WORDS
    ]


def _infer_role(line: str, name: str, beat_index: int) -> str | None:
    lowered = line.lower()
    if beat_index <= 2:
        return "protagonist"
    if any(word in lowered for word in ("antagonist", "villain", "enemy", "rival")):
        return "antagonist"
    if any(word in lowered for word in ("mentor", "guide", "teacher")):
        return "mentor"
    return None


def _extract_fact_description(line: str) -> str:
    """Pull a concise fact description from a line containing a knowledge marker."""
    for marker in KNOWLEDGE_MARKERS:
        pos = line.lower().find(marker)
        if pos == -1:
            continue
        after = line[pos:].strip()
        if len(after) > 10:
            return after[:120]
    return line[:120]


def _build_fact_snapshot(
    story_uid: str,
    facts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build a frontend-friendly snapshot from the extracted facts."""
    return [
        {
            "description": f["description"],
            "introduced_at_beat": f["introduced_at_beat"],
            "known_by": (
                [{"character": f["learner"], "beat_index": f["introduced_at_beat"]}]
                if f.get("learner")
                else []
            ),
            "acted_on_by": (
                [{"character": f["actor"], "beat_index": f["introduced_at_beat"]}]
                if f.get("actor")
                else []
            ),
        }
        for f in facts
    ]


def _clear_story_epistemic(story_uid: str) -> None:
    """Remove existing epistemic nodes for a story before rebuilding."""
    db.cypher_query(
        """
        MATCH (n)
        WHERE (n:CharacterNode OR n:StoryFactNode)
          AND n.story_uid = $story_uid
        DETACH DELETE n
        """,
        {"story_uid": story_uid},
    )


def _infer_downstream_actions(
    story_uid: str,
    characters: list[dict[str, Any]],
    facts: list[dict[str, Any]],
    lines: list[str],
) -> None:
    """Scan all lines for action verbs + character names to add ACTS_ON edges."""
    char_names = {c["name"].lower(): c["name"] for c in characters}
    fact_descriptions = {f["description"].lower()[:40]: f for f in facts}

    for beat_index, line in enumerate(lines, start=1):
        lowered = line.lower()
        if not any(marker in lowered for marker in ACTION_MARKERS):
            continue

        acting_chars = [
            canonical
            for key, canonical in char_names.items()
            if key in lowered
        ]
        if not acting_chars:
            continue

        related_facts = [
            f
            for desc_key, f in fact_descriptions.items()
            if any(word in lowered for word in desc_key.split()[:3] if len(word) > 4)
        ]

        for char_name in acting_chars:
            for fact in related_facts:
                if beat_index == fact["introduced_at_beat"]:
                    continue
                db.cypher_query(
                    """
                    MATCH (c:CharacterNode {name: $name, story_uid: $story_uid})
                    MATCH (f:StoryFactNode {
                        story_uid: $story_uid,
                        description: $fact_desc
                    })
                    MERGE (c)-[r:ACTS_ON]->(f)
                    ON CREATE SET r.beat_index = $beat,
                                  r.confidence = 0.55,
                                  r.source = 'heuristic-inferred'
                    """,
                    {
                        "name": char_name,
                        "story_uid": story_uid,
                        "fact_desc": fact["description"],
                        "beat": beat_index,
                    },
                )
