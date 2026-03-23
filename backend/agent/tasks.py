"""
Celery tasks for the Multiverse Scene Tester.

These tasks are the async bridge between the Django REST API and the
SimulationManager. When a writer clicks "Test Plausibility", the view
dispatches a Celery task rather than blocking the HTTP request.

TASK FLOW
─────────
1. API view receives POST /api/agent/simulate/
2. View validates input, creates a MultiverseSceneNode in Neo4j
3. View dispatches run_simulation_task.delay(node_uid, ...)
4. View returns 202 Accepted with the task ID
5. Frontend polls GET /api/agent/simulate/{task_id}/status/
6. Task runs SimulationManager.run_simulation()
7. Task writes results back to the MultiverseSceneNode
8. Frontend's next poll sees the completed state

WHY CELERY INSTEAD OF ASYNC VIEWS?
───────────────────────────────────
Django's async views could work for a single API call, but the
simulation involves 4-6 sequential Claude calls (8-48 seconds total).
Celery gives us:
- Automatic retries on transient failures
- Task cancellation (writer navigates away)
- Task monitoring via Flower (optional)
- Clean separation between HTTP layer and AI logic
"""

import logging
import uuid

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="agent.simulate",
    max_retries=2,
    default_retry_delay=5,
    soft_time_limit=120,
    time_limit=180,
)
def run_simulation_task(
    self,
    node_uid: str,
    scene_goal: str,
    story_uid: str,
    character_a_data: dict,
    character_b_data: dict,
    state_snapshot_id: str | None = None,
    intent: str | None = None,
):
    """Run a full simulation round as a background Celery task.

    This task is the async wrapper around SimulationManager.run_simulation().
    It handles:
    - Loading character profiles from the serialized data
    - Running the simulation
    - Persisting results to the Neo4j MultiverseSceneNode
    - Creating ChoiceEdgeNodes for any detected decision points

    Args:
        self: Celery task instance (bound task for retry support).
        node_uid: The MultiverseSceneNode UID to write results to.
            Created by the API view before dispatching this task.
        scene_goal: The writer's scene description.
        story_uid: The StoryNode UID this simulation belongs to.
        character_a_data: Serialized CharacterProfile for Agent A.
            Dict with keys: character_id, character_name, role_hint,
            character_bio, known_facts, unknown_facts.
        character_b_data: Same shape, for Agent B.
        state_snapshot_id: The StateSnapshotNode UID to constrain
            epistemic state. None for the initial simulation.
        intent: Optional ChoiceIntent from a parent branch.

    Returns:
        A dict with the simulation results, matching ApiSimulateResponse.
        Celery stores this in Redis so the polling endpoint can read it.

    Raises:
        Retries on anthropic.APIError (transient API failures).
        Fails permanently after max_retries (2) attempts.
    """
    from agent.simulation import SimulationManager, CharacterProfile
    from graph.models.multiverse import (
        MultiverseSceneNode,
        ChoiceEdgeNode,
    )

    logger.info(
        "Starting simulation task for node %s (story %s)",
        node_uid,
        story_uid,
    )

    # Reconstruct CharacterProfile objects from the serialized dicts.
    # The API view serializes these because Celery tasks must receive
    # JSON-serializable arguments (no Python objects).
    profile_a = _deserialize_profile(character_a_data)
    profile_b = _deserialize_profile(character_b_data)

    # Run the simulation.
    manager = SimulationManager()

    try:
        result = manager.run_simulation(
            scene_goal=scene_goal,
            character_a=profile_a,
            character_b=profile_b,
            max_turns=6,
            intent=intent,
        )
    except Exception as exc:
        # Retry on transient errors (API rate limits, network issues).
        # After max_retries, the task fails and the frontend shows an error.
        logger.error(
            "Simulation failed for node %s: %s", node_uid, str(exc)
        )
        raise self.retry(exc=exc)

    # ── Persist results to Neo4j ──

    # Find the MultiverseSceneNode created by the API view.
    try:
        scene_node = MultiverseSceneNode.nodes.get(uid=node_uid)
    except MultiverseSceneNode.DoesNotExist:
        logger.error("MultiverseSceneNode %s not found", node_uid)
        return {"error": f"Node {node_uid} not found"}

    # Write the dialogue turns as a JSON array.
    scene_node.dialogue_turns = [t.to_dict() for t in result.turns]
    scene_node.confidence_score = result.confidence_score
    scene_node.is_paradox = 1 if result.is_paradox else 0
    scene_node.paradox_count = result.paradox_count
    scene_node.structural_pattern = result.structural_pattern
    scene_node.save()

    # Create ChoiceEdgeNodes for each suggested decision branch.
    choice_edges = []
    for idx, choice_data in enumerate(result.suggested_choices):
        edge_node = ChoiceEdgeNode(
            label=choice_data.get("label", f"Choice {idx + 1}"),
            intent=choice_data.get("intent", "truth"),
        )
        edge_node.save()

        # Link the choice to the scene node.
        scene_node.choices.connect(edge_node, {"order": idx})

        choice_edges.append({
            "id": edge_node.uid,
            "label": edge_node.label,
            "targetNodeId": "",  # Filled when the writer selects this choice
            "intent": edge_node.intent,
            "relatedBeatId": None,
        })

    logger.info(
        "Simulation complete for node %s: %d turns, %d paradoxes, %d choices",
        node_uid,
        len(result.turns),
        result.paradox_count,
        len(choice_edges),
    )

    # Return the result for the polling endpoint.
    # This gets stored in Redis by Celery's result backend.
    return {
        "nodeId": node_uid,
        "turns": [t.to_dict() for t in result.turns],
        "confidenceScore": result.confidence_score,
        "isParadox": result.is_paradox,
        "paradoxCount": result.paradox_count,
        "structuralPattern": result.structural_pattern,
        "choices": choice_edges,
        "warnings": [
            t.paradox_detail
            for t in result.turns
            if t.is_paradox and t.paradox_detail
        ],
    }


@shared_task(
    name="agent.create_snapshot",
    soft_time_limit=30,
    time_limit=60,
)
def create_snapshot_task(
    story_uid: str,
    source_node_id: str,
    character_profiles: list[dict],
    location_states: dict,
    relationship_states: dict,
) -> dict:
    """Create a StateSnapshot in Neo4j as a background task.

    Snapshots are created at every branch point so that different
    multiverse branches maintain independent world states.

    This task is lighter than the simulation task (no Claude calls),
    but we run it async anyway because Neo4j writes can be slow when
    creating many CharacterSnapshotNode relationships.

    Args:
        story_uid: The StoryNode this snapshot belongs to.
        source_node_id: The MultiverseSceneNode that triggered this snapshot.
        character_profiles: List of serialized EpistemicProfile dicts.
        location_states: { characterId: "location" }
        relationship_states: { "charA-charB": "relationship label" }

    Returns:
        Dict with the snapshot UID and creation timestamp.
    """
    from graph.models.multiverse import (
        StateSnapshotNode,
        CharacterSnapshotNode,
        MultiverseSceneNode,
    )
    from graph.models.story import StoryFactNode

    logger.info(
        "Creating snapshot for node %s (story %s)",
        source_node_id,
        story_uid,
    )

    # Create the snapshot node with the full JSON representation.
    snapshot = StateSnapshotNode(
        source_node_id=source_node_id,
        story_uid=story_uid,
        character_profiles_json=character_profiles,
        location_states=location_states,
        relationship_states=relationship_states,
    )
    snapshot.save()

    # Create CharacterSnapshotNodes for graph-queryable lookups.
    # This is the "write" path that mirrors the JSON blob.
    for profile_data in character_profiles:
        char_snapshot = CharacterSnapshotNode(
            character_id=profile_data["characterId"],
            character_name=profile_data["characterName"],
            role_hint=profile_data.get("roleHint"),
        )
        char_snapshot.save()

        # Link the character snapshot to the state snapshot.
        snapshot.characters.connect(
            char_snapshot,
            {
                "location": location_states.get(
                    profile_data["characterId"], "unknown"
                ),
            },
        )

        # Link the character snapshot to the facts they know.
        for fact_data in profile_data.get("knownFacts", []):
            fact_node_id = fact_data.get("factNodeId")
            if fact_node_id:
                try:
                    fact_node = StoryFactNode.nodes.get(uid=fact_node_id)
                    char_snapshot.knows_facts.connect(fact_node)
                except StoryFactNode.DoesNotExist:
                    logger.warning(
                        "StoryFactNode %s not found during snapshot",
                        fact_node_id,
                    )

    # Link the snapshot to the source MultiverseSceneNode.
    try:
        source_node = MultiverseSceneNode.nodes.get(uid=source_node_id)
        source_node.snapshot.connect(snapshot)
    except MultiverseSceneNode.DoesNotExist:
        logger.warning(
            "Source node %s not found when linking snapshot", source_node_id
        )

    logger.info("Snapshot %s created with %d character profiles",
                snapshot.uid, len(character_profiles))

    return {
        "snapshotId": snapshot.uid,
        "storyUid": story_uid,
        "sourceNodeId": source_node_id,
        "createdAt": snapshot.created_at.isoformat() if snapshot.created_at else "",
    }


# ============================================================
# HELPERS
# ============================================================


def _deserialize_profile(data: dict):
    """Convert a serialized dict back into a CharacterProfile.

    The API view serializes CharacterProfile objects into plain dicts
    for Celery (which requires JSON-serializable task arguments). This
    function reverses that serialization.

    Args:
        data: Dict with keys matching CharacterProfile fields.
            known_facts and unknown_facts are lists of 3-element lists
            [fact_id, description, learned_at_beat].

    Returns:
        A CharacterProfile instance.
    """
    from agent.simulation import CharacterProfile

    return CharacterProfile(
        character_id=data["characterId"],
        character_name=data["characterName"],
        role_hint=data.get("roleHint"),
        character_bio=data.get("characterBio", ""),
        known_facts=[
            (f["factNodeId"], f["description"], f.get("learnedAtBeat"))
            for f in data.get("knownFacts", [])
        ],
        unknown_facts=[
            (f["factNodeId"], f["description"], f.get("learnedAtBeat"))
            for f in data.get("unknownFacts", [])
        ],
    )
