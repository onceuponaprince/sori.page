"""Tests for solo character chat validation."""
from unittest.mock import MagicMock

from agent.chat_service import stream_character_chat


def test_stream_rejects_unpublished_character():
    char = MagicMock()
    char.published_at = None
    events = list(
        stream_character_chat(
            char_node=char,
            profile_dict={},
            user_message="Hello",
            prior_messages=[],
        )
    )
    assert any("CHARACTER_NOT_PUBLISHED" in e for e in events)
