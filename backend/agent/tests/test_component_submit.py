"""Tests for contributor React component submit endpoint."""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest

SAMPLE_COMPONENT = '''/**
 * @character id=oracle-sage name="The Oracle" tags=mentor,mystic
 * @review required
 */
export function OracleSage() {
  return (
    <CharacterSheet>
      <Voice>Speaks in questions, never answers directly</Voice>
      <Knowledge>Knows the prophecy; does not know the user's name</Knowledge>
    </CharacterSheet>
  );
}
'''


def test_parse_character_component_extracts_jsdoc_and_elements():
    from agent.component_parser import parse_character_component

    result = parse_character_component(SAMPLE_COMPONENT)
    assert result["frontmatter"]["id"] == "oracle-sage"
    assert result["frontmatter"]["name"] == "The Oracle"
    assert "mentor" in result["frontmatter"]["tags"]
    assert "Speaks in questions" in result["frontmatter"]["voice"]
    assert len(result["frontmatter"]["knowledge"]) >= 1


def test_parse_character_component_requires_tag():
    from agent.component_parser import parse_character_component

    with pytest.raises(ValueError, match="@character"):
        parse_character_component("export function NoTag() { return null; }")


def test_submit_component_creates_react_character():
    from rest_framework.test import APIRequestFactory
    from agent.views import submit_character_component

    story_mod = sys.modules["graph.models.story"]
    MockCharacterNode = story_mod.CharacterNode
    MockCharacterNode.reset_mock()

    char_instance = MagicMock()
    char_instance.uid = "char-react-1"
    char_instance.name = "The Oracle"
    char_instance.story_uid = "story-1"
    char_instance.source_type = "react"
    char_instance.virtual_path = "_components/oracle-sage.tsx"
    char_instance.draft_revision = 1
    char_instance.published_at = None
    char_instance.published_revision = 0
    char_instance.review_status = "pending"
    char_instance.tags = ["mentor", "mystic"]
    char_instance.role_hint = None
    char_instance.aliases = []
    char_instance.draft_source = SAMPLE_COMPONENT
    char_instance.published_source = ""
    MockCharacterNode.return_value = char_instance
    MockCharacterNode.nodes.filter.return_value = []

    factory = APIRequestFactory()
    request = factory.post(
        "/api/agent/characters/story-1/component/",
        {"source": SAMPLE_COMPONENT},
        format="json",
    )

    with patch("agent.views._find_character_by_component_id", return_value=None):
        response = submit_character_component(request, "story-1")

    assert response.status_code == 201
    assert response.data["sourceType"] == "react"
    assert response.data["reviewStatus"] == "pending"
    assert response.data["virtualPath"] == "_components/oracle-sage.tsx"
    char_instance.save.assert_called_once()


def test_submit_component_rejects_invalid_source():
    from rest_framework.test import APIRequestFactory
    from agent.views import submit_character_component

    story_mod = sys.modules["graph.models.story"]
    MockCharacterNode = story_mod.CharacterNode
    before_calls = MockCharacterNode.call_count

    factory = APIRequestFactory()
    request = factory.post(
        "/api/agent/characters/story-1/component/",
        {"source": "export function Broken() {}"},
        format="json",
    )
    response = submit_character_component(request, "story-1")

    assert response.status_code == 422
    assert response.data["code"] == "INVALID_COMPONENT"
    assert MockCharacterNode.call_count == before_calls
