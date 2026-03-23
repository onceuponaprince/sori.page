"""
REST API views for the Multiverse Scene Tester.

ENDPOINTS
─────────
POST /api/agent/simulate/          → Start a new simulation round
GET  /api/agent/simulate/<task_id>/status/ → Poll simulation progress
POST /api/agent/branch/            → Create a new branch from a decision point
POST /api/agent/commit/            → Commit a branch to the canonical story
GET  /api/agent/multiverse/<story_uid>/ → Load the full multiverse tree

FLOW
────
1. Frontend POST /simulate/ → receives 202 + Celery task_id
2. Frontend polls /simulate/<task_id>/status/ every 2 seconds
3. When complete, frontend has the full MultiverseNode with dialogue
4. If decision points exist, frontend shows choices
5. Writer picks a choice → POST /branch/
6. Repeat from step 1 with the new branch node
7. Writer likes a branch → POST /commit/ → world state updates

ERROR HANDLING
──────────────
All views return consistent error shapes:
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
"""

import logging
import uuid

from celery.result import AsyncResult
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from agent.serializers import (
    SimulateRequestSerializer,
    BranchRequestSerializer,
    CommitRequestSerializer,
)
from agent.tasks import run_simulation_task, create_snapshot_task

logger = logging.getLogger(__name__)


# ============================================================
# POST /api/agent/simulate/
# ============================================================


@api_view(["POST"])
def simulate_scene(request):
    """Start a new multiverse simulation round.

    This endpoint:
    1. Validates the request body
    2. Loads the two characters from Neo4j
    3. Builds epistemic profiles from the state snapshot (or creates one)
    4. Creates an empty MultiverseSceneNode in Neo4j
    5. Dispatches the simulation as a Celery task
    6. Returns 202 Accepted with the task ID for polling

    The actual AI work happens in the Celery task (agent/tasks.py).
    This keeps the HTTP response time under 500ms regardless of
    how long the simulation takes.

    Request body: See SimulateRequestSerializer.
    Response (202): { "taskId": str, "nodeId": str }
    """
    serializer = SimulateRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Invalid request", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data

    # ── Load characters from Neo4j ──
    from graph.models.story import CharacterNode, StoryFactNode
    from graph.models.multiverse import (
        MultiverseSceneNode,
        MultiverseRootNode,
        StateSnapshotNode,
    )

    character_profiles = []
    for char_id in data["character_ids"]:
        try:
            char_node = CharacterNode.nodes.get(uid=char_id)
        except CharacterNode.DoesNotExist:
            return Response(
                {
                    "error": f"Character {char_id} not found",
                    "code": "CHARACTER_NOT_FOUND",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Build the epistemic profile for this character.
        # If a state snapshot ID was provided, use it to constrain
        # which facts the character knows. Otherwise, use the current
        # graph state (for the initial simulation).
        profile = _build_epistemic_profile(
            char_node=char_node,
            story_uid=data["story_uid"],
            snapshot_id=data.get("state_snapshot_id"),
        )
        character_profiles.append(profile)

    # ── Ensure a MultiverseRootNode exists for this story ──
    root_nodes = MultiverseRootNode.nodes.filter(
        story_uid=data["story_uid"]
    )
    if len(root_nodes) == 0:
        root = MultiverseRootNode(story_uid=data["story_uid"])
        root.save()
    else:
        root = root_nodes[0]

    # ── Create the MultiverseSceneNode (empty, awaiting simulation) ──
    scene_node = MultiverseSceneNode(
        node_type="simulation",
        scene_goal=data["scene_goal"],
        active_character_ids=data["character_ids"],
    )
    scene_node.save()

    # Link to root (or to parent if this is a branched simulation)
    parent_id = data.get("parent_node_id")
    if parent_id:
        try:
            parent_node = MultiverseSceneNode.nodes.get(uid=parent_id)
            parent_node.children.connect(scene_node)
        except MultiverseSceneNode.DoesNotExist:
            logger.warning("Parent node %s not found, linking to root", parent_id)
            root.children.connect(scene_node)
    else:
        root.children.connect(scene_node)

    # ── Dispatch the Celery task ──
    task = run_simulation_task.delay(
        node_uid=scene_node.uid,
        scene_goal=data["scene_goal"],
        story_uid=data["story_uid"],
        character_a_data=character_profiles[0],
        character_b_data=character_profiles[1],
        state_snapshot_id=data.get("state_snapshot_id"),
    )

    logger.info(
        "Simulation dispatched: task=%s, node=%s", task.id, scene_node.uid
    )

    # Return 202 Accepted — the frontend polls for completion.
    return Response(
        {
            "taskId": task.id,
            "nodeId": scene_node.uid,
        },
        status=status.HTTP_202_ACCEPTED,
    )


# ============================================================
# GET /api/agent/simulate/<task_id>/status/
# ============================================================


@api_view(["GET"])
def simulation_status(request, task_id):
    """Poll the status of an in-flight simulation task.

    The frontend calls this every 2 seconds after receiving the 202
    from simulate_scene(). It returns the Celery task state and,
    when complete, the full simulation results.

    States:
        PENDING  → Task is queued but not yet started
        STARTED  → Task is running (agents are talking)
        SUCCESS  → Simulation complete, results in `data`
        FAILURE  → Simulation failed, error in `error`
        REVOKED  → Task was cancelled

    Response: {
        "state": str,
        "data": SimulationResult | null,
        "error": str | null
    }
    """
    result = AsyncResult(task_id)

    response_data = {
        "state": result.state,
        "data": None,
        "error": None,
    }

    if result.state == "SUCCESS":
        response_data["data"] = result.result
    elif result.state == "FAILURE":
        response_data["error"] = str(result.result)

    return Response(response_data)


# ============================================================
# POST /api/agent/branch/
# ============================================================


@api_view(["POST"])
def create_branch(request):
    """Create a new branch from a decision point.

    When the writer selects a choice at a decision point, this endpoint:
    1. Creates a new empty MultiverseSceneNode (the branch target)
    2. Links the ChoiceEdgeNode to the new node
    3. Creates a new StateSnapshot branched from the parent's snapshot
    4. Returns everything the frontend needs to render the new branch

    The new node is empty — the writer must trigger a new simulation
    to populate it with dialogue.

    Request body: See BranchRequestSerializer.
    Response (201): { "edge": ChoiceEdge, "targetNode": MultiverseNode, "snapshot": ... }
    """
    serializer = BranchRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Invalid request", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data

    from graph.models.multiverse import (
        MultiverseSceneNode,
        ChoiceEdgeNode,
        StateSnapshotNode,
    )

    # ── Find the source node and its snapshot ──
    try:
        source_node = MultiverseSceneNode.nodes.get(uid=data["source_node_id"])
    except MultiverseSceneNode.DoesNotExist:
        return Response(
            {"error": "Source node not found", "code": "NODE_NOT_FOUND"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        parent_snapshot = StateSnapshotNode.nodes.get(uid=data["state_snapshot_id"])
    except StateSnapshotNode.DoesNotExist:
        return Response(
            {"error": "Snapshot not found", "code": "SNAPSHOT_NOT_FOUND"},
            status=status.HTTP_404_NOT_FOUND,
        )

    # ── Create the branch target node ──
    target_node = MultiverseSceneNode(
        node_type="simulation",
        scene_goal=data["choice_label"],
        active_character_ids=list(source_node.active_character_ids or []),
    )
    target_node.save()

    # Link parent → child
    source_node.children.connect(target_node)

    # ── Create or update the ChoiceEdgeNode ──
    edge = ChoiceEdgeNode(
        label=data["choice_label"],
        intent=data["intent"],
    )
    edge.save()
    edge.target.connect(target_node)
    source_node.choices.connect(edge)

    # ── Branch the snapshot ──
    # Copy the parent snapshot's data into a new snapshot for this branch.
    # This is the isolation mechanism: changes in this branch won't affect
    # sibling branches because they each have their own snapshot.
    branched_snapshot = StateSnapshotNode(
        source_node_id=target_node.uid,
        story_uid=parent_snapshot.story_uid,
        character_profiles_json=list(parent_snapshot.character_profiles_json or []),
        location_states=dict(parent_snapshot.location_states or {}),
        relationship_states=dict(parent_snapshot.relationship_states or {}),
    )
    branched_snapshot.save()
    target_node.snapshot.connect(branched_snapshot)

    return Response(
        {
            "edge": {
                "id": edge.uid,
                "label": edge.label,
                "targetNodeId": target_node.uid,
                "intent": edge.intent,
                "relatedBeatId": None,
            },
            "targetNode": {
                "id": target_node.uid,
                "type": target_node.node_type,
                "sceneGoal": target_node.scene_goal,
                "dialogueTurns": [],
                "stateSnapshotId": branched_snapshot.uid,
                "activeCharacterIds": list(target_node.active_character_ids or []),
                "choices": [],
                "metadata": {
                    "confidenceScore": 1.0,
                    "structuralPattern": None,
                    "isParadox": False,
                    "paradoxCount": 0,
                },
                "parentNodeId": source_node.uid,
                "createdAt": (
                    target_node.created_at.isoformat()
                    if target_node.created_at
                    else ""
                ),
            },
            "snapshot": {
                "id": branched_snapshot.uid,
                "sourceNodeId": target_node.uid,
                "storyUid": branched_snapshot.story_uid,
                "characterProfiles": branched_snapshot.character_profiles_json,
                "locationStates": branched_snapshot.location_states,
                "relationshipStates": branched_snapshot.relationship_states,
                "createdAt": (
                    branched_snapshot.created_at.isoformat()
                    if branched_snapshot.created_at
                    else ""
                ),
            },
        },
        status=status.HTTP_201_CREATED,
    )


# ============================================================
# POST /api/agent/commit/
# ============================================================


@api_view(["POST"])
def commit_branch(request):
    """Commit a multiverse branch to the canonical story.

    This is the "Make Canon" action. When the writer likes a branch,
    this endpoint:
    1. Changes the MultiverseSceneNode type to 'canon'
    2. Loads the branch's StateSnapshot
    3. Merges snapshot knowledge into the main CharacterNode edges
    4. Generates a summary to insert as a RelationalBeat
    5. Returns the updated node and beat ID

    WORLD STATE UPDATE:
    The snapshot's character knowledge (KNOWS_ABOUT edges) is merged
    into the canonical graph. This means committing a branch has
    irreversible effects on the story's knowledge flow.

    Request body: See CommitRequestSerializer.
    Response (200): { "node": MultiverseNode, "relationalBeatId": str, ... }
    """
    serializer = CommitRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "Invalid request", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data

    from graph.models.multiverse import MultiverseSceneNode, StateSnapshotNode
    from graph.models.story import CharacterNode, StoryFactNode

    # ── Find the node to commit ──
    try:
        node = MultiverseSceneNode.nodes.get(uid=data["node_id"])
    except MultiverseSceneNode.DoesNotExist:
        return Response(
            {"error": "Node not found", "code": "NODE_NOT_FOUND"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if node.node_type == "canon":
        return Response(
            {"error": "Node is already committed", "code": "ALREADY_CANON"},
            status=status.HTTP_409_CONFLICT,
        )

    # ── Mark as canon ──
    node.node_type = "canon"
    node.save()

    # ── Merge snapshot knowledge into the canonical graph ──
    # Find the snapshot attached to this node.
    snapshot_nodes = node.snapshot.all()
    world_state_changes = []

    if snapshot_nodes:
        snapshot = snapshot_nodes[0]

        # Iterate through the snapshot's character profiles and create
        # any missing KNOWS_AT edges in the canonical CharacterNode.
        for profile_data in (snapshot.character_profiles_json or []):
            char_id = profile_data.get("characterId")
            if not char_id:
                continue

            try:
                char_node = CharacterNode.nodes.get(uid=char_id)
            except CharacterNode.DoesNotExist:
                continue

            for fact_data in profile_data.get("knownFacts", []):
                fact_id = fact_data.get("factNodeId")
                if not fact_id:
                    continue

                try:
                    fact_node = StoryFactNode.nodes.get(uid=fact_id)
                except StoryFactNode.DoesNotExist:
                    continue

                # Check if this KNOWS_AT edge already exists.
                existing = char_node.knows.relationship(fact_node)
                if existing is None:
                    # Create the canonical knowledge edge.
                    beat = fact_data.get("learnedAtBeat", 0) or 0
                    char_node.knows.connect(
                        fact_node,
                        {"beat_index": beat, "source": "multiverse_commit"},
                    )
                    world_state_changes.append(
                        f"{char_node.name} now knows: {fact_node.description}"
                    )

    # ── Generate a relational beat ID ──
    # In a full implementation, this would create a RelationalBeat in
    # the story's beat plan. For v1, we generate a placeholder ID that
    # the frontend can use to insert a beat into the Tiptap sidebar.
    beat_id = str(uuid.uuid4())

    change_summary = (
        "; ".join(world_state_changes) if world_state_changes
        else "No knowledge changes (branch was consistent with current state)"
    )

    return Response({
        "node": {
            "id": node.uid,
            "type": node.node_type,
            "sceneGoal": node.scene_goal,
            "dialogueTurns": node.dialogue_turns or [],
            "stateSnapshotId": snapshot_nodes[0].uid if snapshot_nodes else "",
            "activeCharacterIds": list(node.active_character_ids or []),
            "choices": [],
            "metadata": {
                "confidenceScore": node.confidence_score,
                "structuralPattern": node.structural_pattern,
                "isParadox": bool(node.is_paradox),
                "paradoxCount": node.paradox_count,
            },
            "parentNodeId": None,
            "createdAt": node.created_at.isoformat() if node.created_at else "",
        },
        "relationalBeatId": beat_id,
        "worldStateChangeSummary": change_summary,
    })


# ============================================================
# GET /api/agent/multiverse/<story_uid>/
# ============================================================


@api_view(["GET"])
def get_multiverse_tree(request, story_uid):
    """Load the full multiverse tree for a story.

    Returns the complete tree of MultiverseSceneNodes, including all
    dialogue turns, choices, and metadata. The frontend uses this to
    reconstruct the tree visualization on page load.

    This is a read-heavy endpoint — it traverses the entire tree in
    Neo4j. For stories with deep branches (20+ nodes), consider
    pagination in v2.

    Response: {
        "rootNodeId": str,
        "nodes": { [nodeId]: MultiverseNode }
    }
    """
    from graph.models.multiverse import MultiverseRootNode, MultiverseSceneNode

    # ── Find the multiverse root ──
    root_nodes = MultiverseRootNode.nodes.filter(story_uid=story_uid)
    if len(root_nodes) == 0:
        return Response(
            {"rootNodeId": None, "nodes": {}},
            status=status.HTTP_200_OK,
        )

    root = root_nodes[0]

    # ── Traverse the tree and collect all nodes ──
    # BFS traversal from the root to collect all MultiverseSceneNodes.
    nodes_map = {}
    queue = list(root.children.all())

    while queue:
        current = queue.pop(0)
        if current.uid in nodes_map:
            continue

        # Load choices for this node
        choice_nodes = current.choices.all()
        choices = []
        for choice in choice_nodes:
            target_nodes = choice.target.all()
            choices.append({
                "id": choice.uid,
                "label": choice.label,
                "targetNodeId": target_nodes[0].uid if target_nodes else "",
                "intent": choice.intent,
                "relatedBeatId": choice.related_beat_id,
            })

        # Load snapshot ID
        snapshots = current.snapshot.all()
        snapshot_id = snapshots[0].uid if snapshots else ""

        # Find parent
        parents = current.parent.all()
        parent_id = parents[0].uid if parents else None

        nodes_map[current.uid] = {
            "id": current.uid,
            "type": current.node_type,
            "sceneGoal": current.scene_goal,
            "dialogueTurns": current.dialogue_turns or [],
            "stateSnapshotId": snapshot_id,
            "activeCharacterIds": list(current.active_character_ids or []),
            "choices": choices,
            "metadata": {
                "confidenceScore": current.confidence_score,
                "structuralPattern": current.structural_pattern,
                "isParadox": bool(current.is_paradox),
                "paradoxCount": current.paradox_count,
            },
            "parentNodeId": parent_id,
            "createdAt": (
                current.created_at.isoformat() if current.created_at else ""
            ),
        }

        # Add children to the queue
        queue.extend(current.children.all())

    # Determine root node ID (first child of MultiverseRootNode)
    first_children = root.children.all()
    root_node_id = first_children[0].uid if first_children else None

    return Response({
        "rootNodeId": root_node_id,
        "nodes": nodes_map,
    })


# ============================================================
# HELPERS
# ============================================================


def _build_epistemic_profile(
    char_node,
    story_uid: str,
    snapshot_id: str | None,
) -> dict:
    """Build a serializable epistemic profile for a character.

    If a snapshot_id is provided, the profile is constrained to the
    facts in that snapshot. Otherwise, it uses the current graph state.

    Returns a dict matching the Celery task's expected input format
    (not a CharacterProfile object, because Celery needs JSON).
    """
    from graph.models.story import StoryFactNode
    from graph.models.multiverse import StateSnapshotNode, CharacterSnapshotNode

    # Load all facts for this story.
    all_facts = StoryFactNode.nodes.filter(story_uid=story_uid)
    all_fact_ids = {f.uid for f in all_facts}

    known_facts = []
    known_fact_ids = set()

    if snapshot_id:
        # Use the snapshot to determine what this character knows.
        try:
            snapshot = StateSnapshotNode.nodes.get(uid=snapshot_id)
            for profile_data in (snapshot.character_profiles_json or []):
                if profile_data.get("characterId") == char_node.uid:
                    for f in profile_data.get("knownFacts", []):
                        known_facts.append(f)
                        known_fact_ids.add(f["factNodeId"])
                    break
        except StateSnapshotNode.DoesNotExist:
            pass
    else:
        # No snapshot — use the current canonical graph state.
        # Traverse KNOWS_AT edges from the CharacterNode.
        for fact_node in char_node.knows.all():
            rel = char_node.knows.relationship(fact_node)
            known_facts.append({
                "factNodeId": fact_node.uid,
                "description": fact_node.description,
                "learnedAtBeat": rel.beat_index if rel else None,
            })
            known_fact_ids.add(fact_node.uid)

    # Unknown facts = all story facts minus known facts.
    unknown_facts = []
    for fact in all_facts:
        if fact.uid not in known_fact_ids:
            unknown_facts.append({
                "factNodeId": fact.uid,
                "description": fact.description,
                "learnedAtBeat": None,
            })

    return {
        "characterId": char_node.uid,
        "characterName": char_node.name,
        "roleHint": char_node.role_hint,
        "characterBio": f"{char_node.name} — {char_node.role_hint or 'a character in the story'}",
        "knownFacts": known_facts,
        "unknownFacts": unknown_facts,
    }
