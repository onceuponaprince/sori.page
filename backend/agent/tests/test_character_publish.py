import pytest
from unittest.mock import MagicMock, patch

from agent.character_parser import build_default_character_md
from agent.character_playground import publish_character_node


@pytest.fixture
def mock_char_node():
    draft = build_default_character_md("Maya Chen", "maya-chen")
    node = MagicMock()
    node.uid = "char-uid-1"
    node.story_uid = "story-1"
    node.name = "Maya Chen"
    node.source_type = "md"
    node.draft_source = draft
    node.draft_revision = 1
    node.published_at = None
    node.review_status = "none"
    node.role_hint = None
    node.character_bio = ""
    node.voice = ""
    node.tags = []
    node.virtual_path = ""
    node.draft_frontmatter = {}
    node.published_source = ""
    node.published_frontmatter = {}
    node.published_revision = 0
    node.aliases = []
    return node


@patch("agent.character_playground._seed_knowledge_facts")
def test_publish_promotes_draft_to_published(mock_seed, mock_char_node):
    result = publish_character_node(mock_char_node, expected_revision=1)

    assert result["published"] is True
    assert mock_char_node.published_source == mock_char_node.draft_source
    assert "Maya Chen" in mock_char_node.character_bio
    mock_char_node.save.assert_called()
    mock_seed.assert_called_once()


def test_publish_rejects_stale_revision(mock_char_node):
    mock_char_node.draft_revision = 2
    with pytest.raises(ValueError, match="STALE_REVISION"):
        publish_character_node(mock_char_node, expected_revision=1)


def test_publish_rejects_unapproved_react(mock_char_node):
    mock_char_node.source_type = "react"
    mock_char_node.review_status = "pending"
    with pytest.raises(ValueError, match="REVIEW_REQUIRED"):
        publish_character_node(mock_char_node, expected_revision=1)
