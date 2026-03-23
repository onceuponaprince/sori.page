"""
Retrieval services for the structure analyzer.

This layer stays deterministic and graph-first:
- normalize the writer's outline
- query Neo4j concept/function indexes
- gather representative instance matches
- produce lightweight epistemic/timeline warnings

The Next.js analyzer route can then turn this payload into a streamed,
writer-facing response without duplicating retrieval logic.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from neomodel import db


STOP_WORDS = {
    "about",
    "after",
    "against",
    "almost",
    "because",
    "before",
    "being",
    "between",
    "could",
    "every",
    "first",
    "their",
    "there",
    "these",
    "those",
    "through",
    "where",
    "while",
    "which",
    "would",
    "story",
    "outline",
    "character",
    "characters",
    "scene",
}

KNOWLEDGE_MARKERS = (
    "know",
    "knows",
    "knew",
    "learn",
    "learns",
    "learned",
    "discovers",
    "discover",
    "realizes",
    "realize",
    "finds out",
    "find out",
    "reveals",
    "reveal",
    "secret",
    "truth",
    "hides",
    "hidden",
    "leak",
    "leaks",
)


@dataclass
class OutlineStats:
    line_count: int
    sentence_count: int
    word_count: int


def build_structural_context(
    outline: str,
    title: str | None = None,
    story_uid: str | None = None,
) -> dict[str, Any]:
    normalized = normalize_outline(outline)
    lines = outline_lines(normalized)
    stats = OutlineStats(
        line_count=len(lines),
        sentence_count=max(1, len(re.split(r"[.!?]\s+", normalized))),
        word_count=len(re.findall(r"\b[\w'-]+\b", normalized)),
    )

    queries = extract_candidate_queries(normalized, lines)
    concept_matches = query_index_bundle("concept_search", queries, "concept")
    function_matches = query_index_bundle("function_search", queries, "function")
    similar_stories = fetch_similar_stories(concept_matches, function_matches)
    epistemic_result = _run_epistemic_check(story_uid, lines)
    timeline_warnings = epistemic_result["timeline_warnings"]
    epistemic_state = epistemic_result["epistemic_state"]
    current_arc = infer_current_arc(lines)

    # This is intentionally a heuristic "confidence of retrieval richness", not a
    # judgment about writing quality. The LLM layer rephrases it for the UI.
    coverage = min(
        0.96,
        (
            len(concept_matches) * 0.13
            + len(function_matches) * 0.09
            + len(similar_stories) * 0.08
        ),
    )

    return {
        "title": title or "Untitled outline",
        "outline_excerpt": normalized[:1200],
        "outline_lines": lines[:12],
        "outline_stats": {
            "line_count": stats.line_count,
            "sentence_count": stats.sentence_count,
            "word_count": stats.word_count,
        },
        "current_arc": current_arc,
        "concept_matches": concept_matches[:6],
        "function_matches": function_matches[:4],
        "similar_stories": similar_stories[:6],
        "timeline_warnings": timeline_warnings[:6],
        "epistemic_state": epistemic_state,
        "retrieval_notes": build_retrieval_notes(
            concept_matches=concept_matches,
            function_matches=function_matches,
            timeline_warnings=timeline_warnings,
            current_arc=current_arc,
        ),
        "confidence_signal": {
            "retrieval_coverage": round(coverage, 2),
            "graph_hits": len(concept_matches) + len(function_matches),
            "instance_hits": len(similar_stories),
        },
    }


def normalize_outline(outline: str) -> str:
    return re.sub(r"\s+", " ", outline or "").strip()


def outline_lines(outline: str) -> list[str]:
    if not outline:
        return []
    rough_lines = re.split(r"(?:\n|\s{2,}|(?<=\.)\s+)", outline)
    return [line.strip(" -•\t") for line in rough_lines if line.strip(" -•\t")]


def extract_candidate_queries(outline: str, lines: list[str]) -> list[str]:
    if not outline:
        return []

    queries: list[str] = []
    seen: set[str] = set()

    def add_query(value: str) -> None:
        cleaned = value.strip().lower()
        if len(cleaned) < 4 or cleaned in seen:
            return
        seen.add(cleaned)
        queries.append(value[:140])

    # Start broad, then narrow: the first query preserves the outline's overall
    # shape, while the later line/bigram queries give the full-text indexes
    # smaller hooks that often match better than the entire premise.
    add_query(outline[:180])

    for line in lines[:5]:
        add_query(line)

    words = [
        token
        for token in re.findall(r"[a-zA-Z']+", outline.lower())
        if len(token) > 3 and token not in STOP_WORDS
    ]

    for idx in range(len(words) - 1):
        add_query(f"{words[idx]} {words[idx + 1]}")
        if len(queries) >= 10:
            break

    return queries[:10]


def query_index_bundle(
    index_name: str, queries: list[str], result_type: str
) -> list[dict[str, Any]]:
    results_by_uid: dict[str, dict[str, Any]] = {}

    for query in queries:
        rows, _ = db.cypher_query(
            f"""
            CALL db.index.fulltext.queryNodes('{index_name}', $query)
            YIELD node, score
            WHERE $result_type <> 'concept' OR node.status = 'canonized'
            RETURN node.uid AS uid,
                   node.name AS name,
                   node.description AS description,
                   node.depth_score AS depth_score,
                   node.confidence AS confidence,
                   score
            ORDER BY score DESC
            LIMIT 5
            """,
            {"query": query, "result_type": result_type},
        )

        for row in rows:
            uid = row[0]
            existing = results_by_uid.get(uid)
            candidate = {
                "uid": uid,
                "name": row[1],
                "description": row[2],
                "depth_score": row[3],
                "confidence": row[4],
                "relevance_score": round(float(row[5]), 4),
                "type": result_type,
                "matched_on": query,
            }
            # The same node can surface for multiple queries. Keep the best-scoring
            # version so downstream consumers get one clean match per node.
            if not existing or candidate["relevance_score"] > existing["relevance_score"]:
                results_by_uid[uid] = candidate

    results = list(results_by_uid.values())
    results.sort(key=lambda item: item["relevance_score"], reverse=True)
    return results


def fetch_similar_stories(
    concept_matches: list[dict[str, Any]], function_matches: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    concept_ids = [match["uid"] for match in concept_matches[:4]]
    function_ids = [match["uid"] for match in function_matches[:3]]

    if not concept_ids and not function_ids:
        return []

    # We reuse InstanceNode as the "stories like yours" bridge because it already
    # ties works back to concept/function evidence. This keeps comparison grounded
    # in graph data instead of inventing a parallel recommendation model.
    rows, _ = db.cypher_query(
        """
        MATCH (i:InstanceNode)
        OPTIONAL MATCH (i)-[:INSTANCE_OF]->(c:ConceptNode)
        OPTIONAL MATCH (i)-[:INSTANCE_OF]->(f:FunctionNode)
        WHERE c.uid IN $concept_ids OR f.uid IN $function_ids
        WITH i,
             collect(DISTINCT c.name) + collect(DISTINCT f.name) AS matched_names
        WHERE i.work IS NOT NULL
        RETURN i.work AS work,
               i.description AS description,
               [name IN matched_names WHERE name IS NOT NULL][0..3] AS matched_patterns,
               i.verified AS verified
        LIMIT 8
        """,
        {"concept_ids": concept_ids, "function_ids": function_ids},
    )

    stories = []
    for row in rows:
        stories.append(
            {
                "title": row[0],
                "description": row[1],
                "matched_patterns": row[2] or [],
                "verified": bool(row[3]),
            }
        )

    deduped: dict[str, dict[str, Any]] = {}
    for story in stories:
        deduped.setdefault(story["title"], story)

    return list(deduped.values())


def infer_current_arc(lines: list[str]) -> str:
    if not lines:
        return "Structural arc still forming"

    line_count = len(lines)
    joined = " ".join(lines).lower()

    if any(token in joined for token in ("must decide", "choice", "decide whether")):
        return "Approaching decisive value shift"
    if line_count <= 3:
        return "Early setup and pressure discovery"
    if line_count <= 5:
        return "Escalation through layered complication"
    return "Late-stage convergence and payoff pressure"


def _run_epistemic_check(
    story_uid: str | None,
    lines: list[str],
) -> dict[str, Any]:
    """Delegate to the graph-backed epistemic module with a safe fallback."""
    try:
        from retrieval.epistemic import extract_and_check
        return extract_and_check(story_uid, lines)
    except Exception:
        # If Neo4j is down or the epistemic module fails, fall back to the old
        # keyword approach so the analyzer route stays operational.
        return _keyword_timeline_fallback(lines)


def _keyword_timeline_fallback(lines: list[str]) -> dict[str, Any]:
    """Lightweight keyword-only fallback if the graph epistemic check fails."""
    warnings: list[dict[str, str]] = []

    for index, line in enumerate(lines, start=1):
        lowered = line.lower()
        if not any(marker in lowered for marker in KNOWLEDGE_MARKERS):
            continue

        severity = "medium"
        if "before" in lowered or "without" in lowered:
            severity = "high"
        elif "secret" in lowered or "hidden" in lowered:
            severity = "low"

        warnings.append({
            "label": f"Knowledge checkpoint at beat {index}",
            "detail": (
                "Clarify who learns this information, who acts on it, and "
                f"whether beat {index} occurs before that knowledge is earned."
            ),
            "severity": severity,
        })

    if not warnings and len(lines) >= 4:
        warnings.append({
            "label": "Knowledge handoff not yet explicit",
            "detail": (
                "The outline shows strong escalation, but it does not yet "
                "pin down when crucial information changes hands."
            ),
            "severity": "low",
        })

    return {
        "timeline_warnings": warnings[:4],
        "epistemic_state": {
            "characters": [],
            "facts": [],
            "violations": [],
        },
    }


def build_retrieval_notes(
    *,
    concept_matches: list[dict[str, Any]],
    function_matches: list[dict[str, Any]],
    timeline_warnings: list[dict[str, str]],
    current_arc: str,
) -> list[str]:
    notes = [
        f"Current arc inference: {current_arc}.",
        f"Graph retrieval found {len(concept_matches)} concept hits and {len(function_matches)} function hits.",
    ]

    if concept_matches:
        notes.append(
            "Top concept anchors: "
            + ", ".join(match["name"] for match in concept_matches[:3])
            + "."
        )
    if function_matches:
        notes.append(
            "Top function anchors: "
            + ", ".join(match["name"] for match in function_matches[:2])
            + "."
        )
    if timeline_warnings:
        notes.append(
            "Timeline pass surfaced "
            + str(len(timeline_warnings))
            + " possible knowledge-sequencing checks."
        )

    return notes
