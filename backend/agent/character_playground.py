"""Character playground helpers — draft/publish sync with Neo4j CharacterNode."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from agent.character_parser import extract_character_bio, parse_character_md


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "character"


def character_to_playground_dict(char) -> dict[str, Any]:
    published_at = char.published_at.isoformat() if char.published_at else None
    return {
        "id": char.uid,
        "name": char.name,
        "roleHint": char.role_hint,
        "aliases": list(char.aliases or []),
        "virtualPath": char.virtual_path or f"characters/{slugify(char.name)}.md",
        "sourceType": char.source_type or "analyzer",
        "draftRevision": char.draft_revision or 0,
        "publishedAt": published_at,
        "publishedRevision": char.published_revision or 0,
        "reviewStatus": char.review_status or "none",
        "tags": list(char.tags or []),
        "isPublished": char.published_at is not None,
        "draftSource": char.draft_source or "",
        "publishedSource": char.published_source or "",
    }


def publish_character_node(char, *, expected_revision: int | None = None) -> dict[str, Any]:
    if expected_revision is not None and char.draft_revision != expected_revision:
        raise ValueError("STALE_REVISION")

    if char.source_type == "react" and char.review_status != "approved":
        raise ValueError("REVIEW_REQUIRED")

    if not char.draft_source:
        raise ValueError("EMPTY_DRAFT")

    parsed = parse_character_md(char.draft_source)
    frontmatter = parsed["frontmatter"]
    body = parsed["body"]

    char.published_source = char.draft_source
    char.published_frontmatter = frontmatter
    char.published_revision = char.draft_revision
    char.published_at = datetime.now(timezone.utc)
    char.name = frontmatter["name"]
    char.role_hint = frontmatter.get("role_hint") or char.role_hint
    char.character_bio = extract_character_bio(body)
    char.voice = frontmatter.get("voice") or ""
    char.tags = list(frontmatter.get("tags") or [])
    char.virtual_path = f"characters/{frontmatter['id']}.md"
    char.updated_at = datetime.now(timezone.utc)
    char.save()

    _seed_knowledge_facts(char, frontmatter.get("knowledge") or [])

    return {"published": True, "character": character_to_playground_dict(char)}


def _seed_knowledge_facts(char, knowledge: list[str]) -> None:
    from graph.models.story import StoryFactNode

    beat = 0
    for item in knowledge:
        text = str(item).strip()
        if not text:
            continue
        lower = text.lower()
        if lower.startswith("does not know") or lower.startswith("doesn't know"):
            continue
        description = text
        if lower.startswith("knows "):
            description = text[6:].strip() or text

        fact = StoryFactNode(
            story_uid=char.story_uid,
            description=description,
            introduced_at_beat=beat,
            fact_type="information",
        )
        fact.save()
        char.knows.connect(fact, {"beat_index": beat})
        beat += 1
