"""Parse and serialize author MD character files."""
from __future__ import annotations

import re
from typing import Any

import yaml

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def parse_character_md(source: str) -> dict[str, Any]:
    match = _FRONTMATTER_RE.match(source.strip())
    if not match:
        raise ValueError(
            "Character MD must start with YAML frontmatter delimited by ---"
        )
    raw_yaml, body = match.group(1), match.group(2).strip()
    frontmatter = yaml.safe_load(raw_yaml) or {}
    if not isinstance(frontmatter, dict):
        raise ValueError("Frontmatter must be a YAML mapping")
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
    return body.strip()


def build_default_character_md(name: str, id_slug: str) -> str:
    frontmatter = {
        "id": id_slug,
        "name": name,
        "tags": [],
        "knowledge": [],
    }
    body = (
        f"{name} — describe voice, boundaries, and backstory here.\n\n"
        "## Speech patterns\n"
        "- \n\n"
        "## Boundaries\n"
        "- "
    )
    return serialize_character_md(frontmatter, body)
