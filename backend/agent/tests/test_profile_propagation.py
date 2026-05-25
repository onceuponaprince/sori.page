"""Pytest coverage for end-to-end EpistemicProfile propagation.

These tests verify the data-flow contract introduced by the
multiverse-timeline-twine feature: a character's epistemic profile
must traverse the Celery task result, the cached node-level JSON
field, and the multiverse-tree GET response without loss.

NOTE: This repository does not yet have pytest configured (no
pytest.ini / pyproject.toml / requirements-dev.txt). The file is
written in the correct shape so it can be executed as soon as the
backend test harness is bootstrapped. Run via:

    cd backend && python -m pytest agent/tests/test_profile_propagation.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch


MAYA_PROFILE = {
    "characterId": "char-maya",
    "characterName": "Maya",
    "roleHint": "protagonist",
    "characterBio": "Maya — protagonist",
    "knownFacts": [
        {
            "factNodeId": "f1",
            "description": "The letter is hidden",
            "learnedAtBeat": 0,
        }
    ],
    "unknownFacts": [
        {
            "factNodeId": "f2",
            "description": "Elias is her cousin",
            "learnedAtBeat": None,
        }
    ],
}

ELIAS_PROFILE = {
    "characterId": "char-elias",
    "characterName": "Elias",
    "roleHint": "foil",
    "characterBio": "Elias — foil",
    "knownFacts": [
        {
            "factNodeId": "f2",
            "description": "Elias is her cousin",
            "learnedAtBeat": 0,
        }
    ],
    "unknownFacts": [
        {
            "factNodeId": "f1",
            "description": "The letter is hidden",
            "learnedAtBeat": None,
        }
    ],
}


def _make_sim_result():
    """Build a fake SimulationResult-shaped object the task expects."""
    result = MagicMock()
    result.turns = []
    result.confidence_score = 0.9
    result.is_paradox = False
    result.paradox_count = 0
    result.structural_pattern = "revelation"
    result.suggested_choices = []
    return result


@patch("agent.tasks.MultiverseSceneNode")
@patch("agent.tasks.SimulationManager")
def test_simulation_task_returns_epistemic_profiles(MockManager, MockSceneNode):
    """The Celery task's return payload must include epistemicProfiles."""
    from agent.tasks import run_simulation_task

    MockManager.return_value.run_simulation.return_value = _make_sim_result()
    fake_node = MagicMock()
    MockSceneNode.nodes.get.return_value = fake_node

    result = run_simulation_task.apply(
        kwargs={
            "node_uid": "node-uid-1",
            "scene_goal": "Maya confronts Elias",
            "story_uid": "story-1",
            "character_a_data": MAYA_PROFILE,
            "character_b_data": ELIAS_PROFILE,
            "state_snapshot_id": None,
        }
    ).result

    assert "epistemicProfiles" in result
    assert len(result["epistemicProfiles"]) == 2
    assert result["epistemicProfiles"][0]["characterId"] == "char-maya"
    assert result["epistemicProfiles"][1]["characterId"] == "char-elias"


@patch("agent.tasks.MultiverseSceneNode")
@patch("agent.tasks.SimulationManager")
def test_simulation_task_persists_profiles_on_scene_node(
    MockManager, MockSceneNode
):
    """The cached node-level JSON field must hold both profiles after a run."""
    from agent.tasks import run_simulation_task

    MockManager.return_value.run_simulation.return_value = _make_sim_result()
    fake_node = MagicMock()
    MockSceneNode.nodes.get.return_value = fake_node

    run_simulation_task.apply(
        kwargs={
            "node_uid": "node-uid-1",
            "scene_goal": "Maya confronts Elias",
            "story_uid": "story-1",
            "character_a_data": MAYA_PROFILE,
            "character_b_data": ELIAS_PROFILE,
            "state_snapshot_id": None,
        }
    )

    # The task should have assigned the profile list and then saved.
    assert fake_node.epistemic_profiles == [MAYA_PROFILE, ELIAS_PROFILE]
    assert fake_node.save.called


@patch("agent.views.MultiverseRootNode")
def test_get_multiverse_tree_emits_epistemic_profiles(MockRootNode):
    """Every node returned by /api/agent/multiverse/<uid>/ carries the key."""
    from rest_framework.test import APIRequestFactory
    from agent.views import get_multiverse_tree

    fake_scene = MagicMock()
    fake_scene.uid = "scene-1"
    fake_scene.node_type = "canon"
    fake_scene.scene_goal = "Maya confronts Elias"
    fake_scene.dialogue_turns = []
    fake_scene.active_character_ids = ["char-maya", "char-elias"]
    fake_scene.choices.all.return_value = []
    fake_scene.snapshot.all.return_value = []
    fake_scene.parent.all.return_value = []
    fake_scene.children.all.return_value = []
    fake_scene.confidence_score = 0.9
    fake_scene.structural_pattern = "revelation"
    fake_scene.is_paradox = 0
    fake_scene.paradox_count = 0
    fake_scene.epistemic_profiles = [MAYA_PROFILE, ELIAS_PROFILE]
    fake_scene.created_at = None

    fake_root = MagicMock()
    fake_root.children.all.return_value = [fake_scene]
    MockRootNode.nodes.filter.return_value = [fake_root]

    factory = APIRequestFactory()
    request = factory.get("/api/agent/multiverse/story-1/")
    response = get_multiverse_tree(request, "story-1")

    assert response.status_code == 200
    assert "scene-1" in response.data["nodes"]
    node = response.data["nodes"]["scene-1"]
    assert "epistemicProfiles" in node
    assert len(node["epistemicProfiles"]) == 2
    assert node["epistemicProfiles"][0]["characterId"] == "char-maya"
