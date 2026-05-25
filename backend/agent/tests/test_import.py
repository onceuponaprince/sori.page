"""Pytest coverage for POST /api/agent/import/.

Verifies the contract between the Next.js Twine import route and the
Django bulk-import view: a flat nodes/edges payload becomes a
StoryNode + MultiverseRootNode + N MultiverseSceneNodes +
M ChoiceEdgeNodes in Neo4j, and the response carries the new
story_uid the frontend redirects to.

NOTE: pytest is not configured in this repository yet. The file is
written in the correct shape so it executes as soon as the backend
test harness is bootstrapped:

    cd backend && python -m pytest agent/tests/test_import.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch


VALID_PAYLOAD = {
    "story_title": "Imported Story",
    "nodes": [
        {
            "source_name": "Start",
            "type": "decision",
            "summary": "Opening scene",
            "confidence": 1.0,
            "has_paradox": False,
            "structural_pattern": "",
        },
        {
            "source_name": "Truth",
            "type": "canon",
            "summary": "She tells the truth",
            "confidence": 0.9,
            "has_paradox": False,
            "structural_pattern": "Confrontation",
        },
    ],
    "edges": [
        {"from_name": "Start", "to_name": "Truth", "label": "tell truth", "order": 0},
    ],
}


@patch("graph.models.multiverse.ChoiceEdgeNode")
@patch("graph.models.multiverse.MultiverseSceneNode")
@patch("graph.models.multiverse.MultiverseRootNode")
@patch("graph.models.story.StoryNode")
def test_import_creates_story_and_returns_uid(
    MockStoryNode, MockRoot, MockScene, MockEdge
):
    """Happy path: 2 nodes + 1 edge yield a 201 with story_uid."""
    from rest_framework.test import APIRequestFactory
    from agent.views import import_multiverse

    story_instance = MagicMock()
    story_instance.uid = "story-imported-1"
    MockStoryNode.return_value = story_instance

    root_instance = MagicMock()
    MockRoot.return_value = root_instance

    scene_a = MagicMock()
    scene_a.uid = "uid-a"
    scene_b = MagicMock()
    scene_b.uid = "uid-b"
    MockScene.side_effect = [scene_a, scene_b]
    MockScene.nodes.get_or_none.side_effect = lambda uid: (
        scene_a if uid == "uid-a" else scene_b if uid == "uid-b" else None
    )

    edge_instance = MagicMock()
    MockEdge.return_value = edge_instance

    factory = APIRequestFactory()
    request = factory.post(
        "/api/agent/import/", VALID_PAYLOAD, format="json"
    )
    request.user = MagicMock(is_authenticated=False)
    response = import_multiverse(request)

    assert response.status_code == 201
    assert response.data == {"story_uid": "story-imported-1"}

    # Story was persisted with the right title.
    story_instance.save.assert_called_once()
    # Two scenes were saved.
    assert scene_a.save.called
    assert scene_b.save.called
    # One edge was saved.
    edge_instance.save.assert_called_once()


def test_import_rejects_empty_nodes():
    """An empty nodes list is a 400 with a serializer error."""
    from rest_framework.test import APIRequestFactory
    from agent.views import import_multiverse

    factory = APIRequestFactory()
    request = factory.post(
        "/api/agent/import/",
        {"story_title": "Empty", "nodes": [], "edges": []},
        format="json",
    )
    request.user = MagicMock(is_authenticated=False)
    response = import_multiverse(request)
    assert response.status_code == 400


def test_import_rejects_invalid_type():
    """Type outside the allowed choices is rejected by the serializer."""
    from rest_framework.test import APIRequestFactory
    from agent.views import import_multiverse

    factory = APIRequestFactory()
    request = factory.post(
        "/api/agent/import/",
        {
            "story_title": "Bad",
            "nodes": [
                {
                    "source_name": "x",
                    "type": "bogus",
                    "summary": "x",
                    "confidence": 1.0,
                    "has_paradox": False,
                    "structural_pattern": "",
                }
            ],
            "edges": [],
        },
        format="json",
    )
    request.user = MagicMock(is_authenticated=False)
    response = import_multiverse(request)
    assert response.status_code == 400


@patch("graph.models.multiverse.ChoiceEdgeNode")
@patch("graph.models.multiverse.MultiverseSceneNode")
@patch("graph.models.multiverse.MultiverseRootNode")
@patch("graph.models.story.StoryNode")
def test_import_skips_edges_with_unknown_endpoints(
    MockStoryNode, MockRoot, MockScene, MockEdge
):
    """Edges referencing absent node names must be silently skipped."""
    from rest_framework.test import APIRequestFactory
    from agent.views import import_multiverse

    story_instance = MagicMock()
    story_instance.uid = "story-2"
    MockStoryNode.return_value = story_instance

    scene = MagicMock()
    scene.uid = "uid-only"
    MockScene.return_value = scene
    MockScene.nodes.get_or_none.return_value = scene

    edge_instance = MagicMock()
    MockEdge.return_value = edge_instance

    payload = {
        "story_title": "Imported Story",
        "nodes": [
            {
                "source_name": "Only",
                "type": "canon",
                "summary": "Only node",
                "confidence": 1.0,
                "has_paradox": False,
                "structural_pattern": "",
            }
        ],
        "edges": [
            {"from_name": "Only", "to_name": "Missing", "label": "x", "order": 0},
        ],
    }

    factory = APIRequestFactory()
    request = factory.post("/api/agent/import/", payload, format="json")
    request.user = MagicMock(is_authenticated=False)
    response = import_multiverse(request)

    assert response.status_code == 201
    # Edge with unknown to_name should NOT have been saved.
    edge_instance.save.assert_not_called()
