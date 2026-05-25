import pytest

from agent.character_parser import (
    build_default_character_md,
    parse_character_md,
    serialize_character_md,
)

SAMPLE = """---
id: maya-chen
name: Maya Chen
tags: [protagonist, thief]
role_hint: protagonist
voice: clipped, dry humor
knowledge:
  - knows the vault layout
  - does not know Elias is the mole
---

Maya grew up in the dock district.
"""


def test_parse_character_md_extracts_frontmatter_and_body():
    result = parse_character_md(SAMPLE)
    assert result["frontmatter"]["id"] == "maya-chen"
    assert result["frontmatter"]["name"] == "Maya Chen"
    assert "protagonist" in result["frontmatter"]["tags"]
    assert "dock district" in result["body"]


def test_parse_character_md_requires_id_and_name():
    with pytest.raises(ValueError, match="id"):
        parse_character_md("---\nname: Only Name\n---\nbody")


def test_serialize_round_trip():
    parsed = parse_character_md(SAMPLE)
    reserialized = serialize_character_md(parsed["frontmatter"], parsed["body"])
    reparsed = parse_character_md(reserialized)
    assert reparsed["frontmatter"]["id"] == "maya-chen"
    assert reparsed["body"].strip().startswith("Maya grew up")


def test_build_default_character_md():
    md = build_default_character_md("Maya Chen", "maya-chen")
    parsed = parse_character_md(md)
    assert parsed["frontmatter"]["name"] == "Maya Chen"
