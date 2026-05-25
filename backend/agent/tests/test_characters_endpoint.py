"""Pytest coverage for character list serialization."""

from __future__ import annotations

from unittest.mock import MagicMock

from agent.character_playground import character_to_playground_dict


def _mock_character(**overrides):
    node = MagicMock()
    node.uid = overrides.get("uid", "uid-1")
    node.name = overrides.get("name", "Maya")
    node.role_hint = overrides.get("role_hint", "protagonist")
    node.aliases = overrides.get("aliases", [])
    node.virtual_path = overrides.get("virtual_path", "characters/maya.md")
    node.source_type = overrides.get("source_type", "md")
    node.draft_revision = overrides.get("draft_revision", 1)
    node.published_at = overrides.get("published_at", None)
    node.published_revision = overrides.get("published_revision", 0)
    node.review_status = overrides.get("review_status", "none")
    node.tags = overrides.get("tags", [])
    node.draft_source = overrides.get("draft_source", "")
    node.published_source = overrides.get("published_source", "")
    return node


def test_character_to_playground_dict_includes_publish_state():
    published = _mock_character(published_at=MagicMock(isoformat=lambda: "2026-05-25T00:00:00+00:00"))
    result = character_to_playground_dict(published)
    assert result["isPublished"] is True
    assert result["publishedAt"] == "2026-05-25T00:00:00+00:00"


def test_character_to_playground_dict_marks_unpublished():
    draft = _mock_character()
    result = character_to_playground_dict(draft)
    assert result["isPublished"] is False
    assert result["publishedAt"] is None
