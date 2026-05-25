"""Tests for published-only guard on simulate_scene and commit parent id."""
from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

SIMULATE_PAYLOAD = {
    "story_uid": "story-1",
    "scene_goal": "Maya tries to steal the key from the vault",
    "character_ids": ["char-unpublished", "char-published"],
}


def test_simulate_rejects_unpublished_character():
    from rest_framework.test import APIRequestFactory
    from agent.views import simulate_scene

    story_mod = sys.modules["graph.models.story"]
    MockCharacterNode = story_mod.CharacterNode

    unpublished = MagicMock()
    unpublished.uid = "char-unpublished"
    unpublished.published_at = None

    published = MagicMock()
    published.uid = "char-published"
    published.published_at = MagicMock()

    MockCharacterNode.nodes.get.side_effect = [unpublished, published]

    factory = APIRequestFactory()
    request = factory.post("/api/agent/simulate/", SIMULATE_PAYLOAD, format="json")

    with patch("agent.views.run_simulation_task") as mock_task:
        response = simulate_scene(request)

    assert response.status_code == 409
    assert response.data["code"] == "CHARACTER_NOT_PUBLISHED"
    mock_task.delay.assert_not_called()


def test_commit_branch_returns_parent_node_id():
    from rest_framework.test import APIRequestFactory
    from agent.views import commit_branch

    multiverse_mod = sys.modules["graph.models.multiverse"]
    MockSceneNode = multiverse_mod.MultiverseSceneNode

    parent = MagicMock()
    parent.uid = "parent-node-1"

    node = MagicMock()
    node.uid = "node-1"
    node.node_type = "simulation"
    node.scene_goal = "Test scene"
    node.dialogue_turns = []
    node.active_character_ids = []
    node.confidence_score = 1.0
    node.structural_pattern = None
    node.is_paradox = 0
    node.paradox_count = 0
    node.epistemic_profiles = []
    node.created_at = None
    node.snapshot.all.return_value = []
    node.parent.all.return_value = [parent]

    MockSceneNode.nodes.get.return_value = node

    factory = APIRequestFactory()
    request = factory.post(
        "/api/agent/commit/",
        {"node_id": "node-1", "story_uid": "story-1"},
        format="json",
    )
    response = commit_branch(request)

    assert response.status_code == 200
    assert response.data["node"]["parentNodeId"] == "parent-node-1"
