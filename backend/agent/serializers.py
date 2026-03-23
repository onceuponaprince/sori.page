"""
DRF serializers for the Multiverse Scene Tester API.

These serializers validate incoming request bodies and shape outgoing
response payloads. They bridge the gap between the REST API (JSON) and
the Neo4j graph models.

NAMING CONVENTION
─────────────────
Incoming request serializers are suffixed with `RequestSerializer`.
Outgoing response serializers are suffixed with `ResponseSerializer`.
Mixed-use serializers have no suffix.

CAMEL CASE vs SNAKE CASE
─────────────────────────
The TypeScript types use camelCase. Django uses snake_case. These
serializers accept snake_case from the view layer and output camelCase
for the frontend via explicit `source` mappings on fields.
"""

from rest_framework import serializers


# ============================================================
# REQUEST SERIALIZERS (validate incoming JSON)
# ============================================================


class SimulateRequestSerializer(serializers.Serializer):
    """Validates POST /api/agent/simulate/ request bodies.

    This is the entry point for starting a new simulation. The frontend
    sends this when the writer clicks "Test Plausibility" on a selected
    scene fragment.

    Required fields:
        story_uid: Which story the simulation belongs to
        scene_goal: What the scene is testing, e.g. "Maya tries to steal the key"
        character_ids: Exactly 2 CharacterNode UIDs

    Optional fields:
        state_snapshot_id: null for the first simulation (backend creates one)
        parent_node_id: null for root simulations, set for continuations
    """

    story_uid = serializers.CharField(
        help_text="UID of the StoryNode this simulation belongs to."
    )
    scene_goal = serializers.CharField(
        min_length=10,
        max_length=500,
        help_text="The scene goal, e.g. 'Maya tries to steal the key'."
    )
    state_snapshot_id = serializers.CharField(
        required=False,
        allow_null=True,
        default=None,
        help_text="StateSnapshotNode UID. null for initial simulations."
    )
    character_ids = serializers.ListField(
        child=serializers.CharField(),
        min_length=2,
        max_length=2,
        help_text="Exactly 2 CharacterNode UIDs for the simulation."
    )
    parent_node_id = serializers.CharField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Parent MultiverseSceneNode UID for branched simulations."
    )


class BranchRequestSerializer(serializers.Serializer):
    """Validates POST /api/agent/branch/ request bodies.

    Sent when the writer selects a choice at a decision point. The
    backend creates a new MultiverseSceneNode, takes a fresh snapshot,
    and returns both so the frontend can render the new branch.

    The `intent` field is critical — it determines how the next
    simulation round's Truth Guard prompt is biased.
    """

    source_node_id = serializers.CharField(
        help_text="The decision-point MultiverseSceneNode UID."
    )
    choice_label = serializers.CharField(
        min_length=5,
        max_length=300,
        help_text="Writer-facing description, e.g. 'Maya lies about the letter'."
    )
    intent = serializers.ChoiceField(
        choices=[
            "deception", "confrontation", "avoidance",
            "truth", "discovery", "sacrifice",
        ],
        help_text="The emotional/strategic driver behind this choice."
    )
    state_snapshot_id = serializers.CharField(
        help_text="The StateSnapshotNode UID to branch from."
    )


class CommitRequestSerializer(serializers.Serializer):
    """Validates POST /api/agent/commit/ request bodies.

    Sent when the writer clicks "Commit to Story" on a branch they like.
    This is the moment where the multiverse sandbox meets the canonical
    story: the branch's world state becomes the official state, and a
    RelationalBeat is inserted into the Tiptap sidebar.
    """

    node_id = serializers.CharField(
        help_text="The MultiverseSceneNode UID to commit."
    )
    story_uid = serializers.CharField(
        help_text="The StoryNode UID to update with this branch's state."
    )


# ============================================================
# RESPONSE SERIALIZERS (shape outgoing JSON)
# ============================================================


class DialogueTurnSerializer(serializers.Serializer):
    """Serializes a single dialogue turn for API responses.

    Field names use camelCase to match the TypeScript DialogueTurn type.
    This avoids a camelCase transform layer in the frontend.
    """

    id = serializers.CharField()
    characterId = serializers.CharField(source="character_id")
    characterName = serializers.CharField(source="character_name")
    content = serializers.CharField()
    isParadox = serializers.BooleanField(source="is_paradox")
    paradoxDetail = serializers.CharField(
        source="paradox_detail", allow_null=True
    )
    generatedAt = serializers.CharField(source="generated_at")


class MultiverseNodeMetadataSerializer(serializers.Serializer):
    """Serializes the metadata sub-object on MultiverseNode responses."""

    confidenceScore = serializers.FloatField(source="confidence_score")
    structuralPattern = serializers.CharField(
        source="structural_pattern", allow_null=True
    )
    isParadox = serializers.BooleanField(source="is_paradox")
    paradoxCount = serializers.IntegerField(source="paradox_count")


class ChoiceEdgeSerializer(serializers.Serializer):
    """Serializes a ChoiceEdge for API responses.

    Maps to the TypeScript ChoiceEdge interface.
    """

    id = serializers.CharField()
    label = serializers.CharField()
    targetNodeId = serializers.CharField(
        source="target_node_id", default=""
    )
    intent = serializers.CharField()
    relatedBeatId = serializers.CharField(
        source="related_beat_id", allow_null=True
    )


class MultiverseNodeSerializer(serializers.Serializer):
    """Serializes a full MultiverseNode for API responses.

    This is the main response shape — it includes everything the
    frontend needs to render a node in the tree and its dialogue
    in the Oracle chat.
    """

    id = serializers.CharField()
    type = serializers.CharField(source="node_type")
    sceneGoal = serializers.CharField(source="scene_goal")
    dialogueTurns = DialogueTurnSerializer(
        source="dialogue_turns", many=True
    )
    stateSnapshotId = serializers.CharField(source="state_snapshot_id")
    activeCharacterIds = serializers.ListField(
        source="active_character_ids",
        child=serializers.CharField(),
    )
    choices = ChoiceEdgeSerializer(many=True)
    metadata = MultiverseNodeMetadataSerializer()
    parentNodeId = serializers.CharField(
        source="parent_node_id", allow_null=True
    )
    createdAt = serializers.CharField(source="created_at")


class EpistemicFactSerializer(serializers.Serializer):
    """Serializes a single epistemic fact."""

    factNodeId = serializers.CharField(source="fact_node_id")
    description = serializers.CharField()
    learnedAtBeat = serializers.IntegerField(
        source="learned_at_beat", allow_null=True
    )


class EpistemicProfileSerializer(serializers.Serializer):
    """Serializes a character's epistemic profile for API responses."""

    characterId = serializers.CharField(source="character_id")
    characterName = serializers.CharField(source="character_name")
    roleHint = serializers.CharField(source="role_hint", allow_null=True)
    characterBio = serializers.CharField(source="character_bio")
    knownFacts = EpistemicFactSerializer(source="known_facts", many=True)
    unknownFacts = EpistemicFactSerializer(source="unknown_facts", many=True)


class StateSnapshotSerializer(serializers.Serializer):
    """Serializes a StateSnapshot for API responses."""

    id = serializers.CharField()
    sourceNodeId = serializers.CharField(source="source_node_id")
    storyUid = serializers.CharField(source="story_uid")
    characterProfiles = EpistemicProfileSerializer(
        source="character_profiles", many=True
    )
    locationStates = serializers.DictField(source="location_states")
    relationshipStates = serializers.DictField(source="relationship_states")
    createdAt = serializers.CharField(source="created_at")
