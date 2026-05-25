"""Parse contributor React/TSX character components."""
from __future__ import annotations

import re
from typing import Any

_ATTR_RE = re.compile(
    r'(\w+)=("([^"]*)"|\'([^\']*)\'|([^"\s,]+))',
)
_ELEMENT_RE = re.compile(
    r"<(Voice|Knowledge)>\s*(.*?)\s*</\1>",
    re.IGNORECASE | re.DOTALL,
)


def _parse_tag_attrs(raw: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for match in _ATTR_RE.finditer(raw):
        key = match.group(1)
        value = match.group(3) or match.group(4) or match.group(5) or ""
        attrs[key] = value.strip()
    return attrs


def parse_character_component(source: str) -> dict[str, Any]:
    """Extract @character JSDoc metadata and prompt fields from TSX source."""
    text = source.strip()
    if not text:
        raise ValueError("@character JSDoc tag is required")

    tag_match = re.search(r"@character\s+(.+)", text, re.IGNORECASE)
    if not tag_match:
        raise ValueError("@character JSDoc tag is required")

    attrs = _parse_tag_attrs(tag_match.group(1))
    if not attrs.get("id"):
        raise ValueError("Field 'id' is required in @character tag")
    if not attrs.get("name"):
        raise ValueError("Field 'name' is required in @character tag")

    tags_raw = attrs.get("tags", "")
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

    frontmatter: dict[str, Any] = {
        "id": attrs["id"],
        "name": attrs["name"],
        "tags": tags,
        "voice": attrs.get("voice", ""),
        "knowledge": [],
    }
    if attrs.get("role_hint"):
        frontmatter["role_hint"] = attrs["role_hint"]

    for elem_match in _ELEMENT_RE.finditer(text):
        tag_name = elem_match.group(1).lower()
        content = elem_match.group(2).strip()
        if tag_name == "voice" and content:
            frontmatter["voice"] = content
        elif tag_name == "knowledge" and content:
            items = [k.strip() for k in re.split(r"[;\n]", content) if k.strip()]
            frontmatter["knowledge"] = items

    return {"frontmatter": frontmatter, "body": ""}
