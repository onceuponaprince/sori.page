"""Pytest coverage for GET /api/agent/characters/<story_uid>/.

This endpoint returns canonical CharacterNode UIDs scoped to a story,
which the Multiverse Sidebar needs to pass to simulate_scene. Without
real UIDs the backend raises CHARACTER_NOT_FOUND on every simulation
attempt (see audit doc 2026-05-24).

NOTE: This repository does not yet have pytest configured. The file is
written in the correct shape so it executes as soon as the backend
test harness is bootstrapped:

    cd backend && python -m pytest agent/tests/test_characters_endpoint.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch


@patch("graph.models.story.CharacterNode")
def test_list_characters_returns_canonical_uids(MockCharacterNode):
    """Every CharacterNode for a story must be returned with id/name/roleHint."""
    from rest_framework.test import APIRequestFactory
    from agent.views import list_characters

    maya = MagicMock()
    maya.uid = "uid-maya"
    maya.name = "Maya"
    maya.role_hint = "protagonist"
    maya.aliases = []

    elias = MagicMock()
    elias.uid = "uid-elias"
    elias.name = "Elias"
    elias.role_hint = "foil"
    elias.aliases = ["Eli"]

    MockCharacterNode.nodes.filter.return_value = [maya, elias]

    factory = APIRequestFactory()
    request = factory.get("/api/agent/characters/story-1/")
    response = list_characters(request, "story-1")

    assert response.status_code == 200
    assert len(response.data["characters"]) == 2
    assert response.data["characters"][0]["id"] == "uid-maya"
    assert response.data["characters"][0]["name"] == "Maya"
    assert response.data["characters"][0]["roleHint"] == "protagonist"
    assert response.data["characters"][1]["aliases"] == ["Eli"]


@patch("graph.models.story.CharacterNode")
def test_list_characters_returns_empty_when_story_has_no_characters(
    MockCharacterNode,
):
    """The endpoint must return an empty list rather than 404."""
    from rest_framework.test import APIRequestFactory
    from agent.views import list_characters

    MockCharacterNode.nodes.filter.return_value = []

    factory = APIRequestFactory()
    request = factory.get("/api/agent/characters/empty-story/")
    response = list_characters(request, "empty-story")

    assert response.status_code == 200
    assert response.data["characters"] == []


@patch("graph.models.story.CharacterNode")
def test_list_characters_scopes_to_story_uid(MockCharacterNode):
    """The filter must match story_uid exactly to avoid leaking other stories."""
    from rest_framework.test import APIRequestFactory
    from agent.views import list_characters

    MockCharacterNode.nodes.filter.return_value = []

    factory = APIRequestFactory()
    request = factory.get("/api/agent/characters/story-abc/")
    list_characters(request, "story-abc")

    MockCharacterNode.nodes.filter.assert_called_once_with(story_uid="story-abc")
