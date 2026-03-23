"""
Multiverse Scene Tester — Neo4j graph models.

These models extend the existing story graph (StoryNode, SceneNode,
CharacterNode, StoryFactNode) with branching simulation infrastructure.

GRAPH TOPOLOGY
──────────────
    StoryNode
        └── CONTAINS_SCENE → SceneNode (the "canon" story)
        └── HAS_MULTIVERSE → MultiverseRootNode
                                 └── HAS_CHILD → MultiverseSceneNode
                                                    ├── HAS_CHILD → MultiverseSceneNode (recursion)
                                                    ├── HAS_CHOICE → ChoiceEdgeNode
                                                    └── HAS_SNAPSHOT → StateSnapshotNode

    StateSnapshotNode
        └── SNAPSHOT_CHARACTER → CharacterSnapshotNode
                                    └── SNAPSHOT_KNOWS → StoryFactNode

HOW IT WORKS
────────────
1. A writer triggers a simulation from the Tiptap editor. The backend
   creates a MultiverseRootNode linked to the StoryNode.

2. Each simulation round creates a MultiverseSceneNode. The AI agent
   dialogue is stored as a JSON array in `dialogue_turns`.

3. When the system identifies a decision point, it creates ChoiceEdgeNodes
   that describe the available paths. Each choice, when selected, spawns
   a new MultiverseSceneNode child.

4. At every branch point, the backend takes a StateSnapshotNode — a frozen
   copy of every character's epistemic state. This ensures that different
   branches don't contaminate each other's knowledge graphs.

5. When a writer commits a branch ("Make Canon"), the MultiverseSceneNode's
   type changes to 'canon', and the snapshot's knowledge updates are merged
   into the main CharacterNode → StoryFactNode edges.

WHY SEPARATE FROM SceneNode?
────────────────────────────
SceneNode is the writer's canonical scene graph (the "real" story).
MultiverseSceneNode is the experimental sandbox. A committed multiverse
node creates/updates a SceneNode, but the two remain structurally
independent so that discarded branches don't pollute the story graph.
"""

from neomodel import (
    ArrayProperty,
    FloatProperty,
    IntegerProperty,
    JSONProperty,
    RelationshipFrom,
    RelationshipTo,
    StringProperty,
    StructuredNode,
    StructuredRel,
    DateTimeProperty,
    UniqueIdProperty,
)


# ============================================================
# RELATIONSHIP MODELS (Edge properties)
# ============================================================


class ChoiceRel(StructuredRel):
    """Edge properties on the HAS_CHOICE relationship.

    This sits between a MultiverseSceneNode (parent) and the
    ChoiceEdgeNode that describes one branching option. The `order`
    field controls display order in the frontend choice list.
    """

    order = IntegerProperty(default=0)
    created_at = DateTimeProperty(default_now=True)


class SnapshotCharacterRel(StructuredRel):
    """Edge properties on the SNAPSHOT_CHARACTER relationship.

    Links a StateSnapshotNode to a CharacterSnapshotNode. The
    `location` field stores where the character physically was at
    snapshot time — a lightweight alternative to creating a full
    LocationNode.
    """

    location = StringProperty(default="unknown")
    relationship_label = StringProperty(default="")


# ============================================================
# NODE MODELS
# ============================================================


class MultiverseRootNode(StructuredNode):
    """The root container for all multiverse branches of a single story.

    One StoryNode has at most one MultiverseRootNode. Think of it as
    the "laboratory" that holds all the experiments for a story.
    """

    uid = UniqueIdProperty()

    # Back-reference to the canonical story this multiverse belongs to.
    # Stored as a string rather than a relationship so the graph query
    # `MATCH (m:MultiverseRootNode {story_uid: $uid})` stays fast.
    story_uid = StringProperty(required=True, index=True)

    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)

    # The tree of simulated scenes hangs off this root
    children = RelationshipTo(
        "MultiverseSceneNode", "HAS_CHILD"
    )


class MultiverseSceneNode(StructuredNode):
    """A single node in the multiverse branching tree.

    Each node represents one round of agent-to-agent simulation.
    Dialogue turns are stored as a JSON array rather than individual
    nodes because:
    - A simulation round is atomic (4-6 turns generated together)
    - The turns are always read/written as a group
    - Keeping them inline avoids N extra node lookups per render

    NODE TYPES:
        'simulation' — Contains AI-generated dialogue, may have children
        'decision'   — A fork point with no dialogue, only choices
        'canon'      — A simulation that the writer committed to the story
    """

    uid = UniqueIdProperty()

    node_type = StringProperty(
        required=True,
        choices={
            "simulation": "AI agent dialogue round",
            "decision": "Writer decision fork point",
            "canon": "Committed to the canonical story",
        },
        default="simulation",
    )

    # The writer's scene prompt, e.g. "Maya tries to steal the key"
    scene_goal = StringProperty(required=True)

    # JSON array of DialogueTurn objects (see types/multiverse.ts)
    # Stored as JSON because turns are always read/written atomically.
    dialogue_turns = JSONProperty(default=[])

    # The IDs of the two characters interacting in this simulation
    active_character_ids = ArrayProperty(StringProperty(), default=[])

    # ── Structural metadata (computed post-generation) ──

    confidence_score = FloatProperty(default=1.0)

    structural_pattern = StringProperty(
        choices={
            "rising_action": "Rising Action",
            "climax": "Climax",
            "falling_action": "Falling Action",
            "revelation": "Revelation",
            "reversal": "Reversal",
            "false_victory": "False Victory",
            "dark_moment": "Dark Moment",
            "resolution": "Resolution",
        },
        default=None,
    )

    is_paradox = IntegerProperty(default=0)
    paradox_count = IntegerProperty(default=0)

    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)

    # ── Relationships ──

    parent = RelationshipFrom(
        "MultiverseSceneNode", "HAS_CHILD"
    )
    children = RelationshipTo(
        "MultiverseSceneNode", "HAS_CHILD"
    )
    choices = RelationshipTo(
        "ChoiceEdgeNode", "HAS_CHOICE", model=ChoiceRel
    )
    snapshot = RelationshipTo(
        "StateSnapshotNode", "HAS_SNAPSHOT"
    )
    # Also linked from the root
    root = RelationshipFrom(
        MultiverseRootNode, "HAS_CHILD"
    )


class ChoiceEdgeNode(StructuredNode):
    """A single branching choice available at a decision point.

    Each ChoiceEdgeNode is a distinct option the writer can pick.
    When selected, it triggers creation of a new MultiverseSceneNode
    as a child of the decision node.

    The `intent` field is critical: it shapes the Truth Guard prompt
    for the next simulation round. A 'deception' intent tells the
    agent to withhold information; a 'truth' intent tells it to be
    forthcoming.
    """

    uid = UniqueIdProperty()

    # What the writer sees, e.g. "Maya lies about the letter"
    label = StringProperty(required=True)

    # Strategic/emotional driver — fed into the next simulation's prompt
    intent = StringProperty(
        required=True,
        choices={
            "deception": "Character withholds or distorts",
            "confrontation": "Character pushes toward conflict",
            "avoidance": "Character deflects or changes subject",
            "truth": "Character reveals information honestly",
            "discovery": "Character seeks new information",
            "sacrifice": "Character acts against self-interest",
        },
        default="truth",
    )

    # Set when the writer commits this choice's branch to the story
    related_beat_id = StringProperty(default=None)

    created_at = DateTimeProperty(default_now=True)

    # ── Relationships ──

    # Which MultiverseSceneNode this choice leads to (the child node)
    target = RelationshipTo(
        MultiverseSceneNode, "LEADS_TO"
    )

    # Which MultiverseSceneNode this choice originates from
    source = RelationshipFrom(
        MultiverseSceneNode, "HAS_CHOICE"
    )


class StateSnapshotNode(StructuredNode):
    """A frozen copy of the story world at a specific branch point.

    CRITICAL FOR BRANCHING:
    When the writer explores Branch A, the characters learn new things.
    When they backtrack to explore Branch B, those Branch A learnings
    must not bleed over. The StateSnapshotNode is the mechanism that
    makes branches independent.

    STORAGE STRATEGY:
    Character knowledge is stored in two ways:
    1. `character_profiles_json` — Full JSON blob for fast API serialization
    2. CharacterSnapshotNode relationships — For Cypher graph queries

    The JSON is the "read" path (fast, single node fetch).
    The graph relationships are the "query" path (find all snapshots
    where character X knows fact Y).
    """

    uid = UniqueIdProperty()

    # Which multiverse node triggered this snapshot
    source_node_id = StringProperty(required=True, index=True)

    # Which story this belongs to (for scoped queries)
    story_uid = StringProperty(required=True, index=True)

    # ── The full world state as JSON (fast read path) ──

    # Array of EpistemicProfile objects (see types/multiverse.ts)
    character_profiles_json = JSONProperty(default=[])

    # { characterId: "location description" }
    location_states = JSONProperty(default={})

    # { "charA-charB": "relationship label" }
    relationship_states = JSONProperty(default={})

    created_at = DateTimeProperty(default_now=True)

    # ── Relationships (graph query path) ──

    characters = RelationshipTo(
        "CharacterSnapshotNode",
        "SNAPSHOT_CHARACTER",
        model=SnapshotCharacterRel,
    )

    # Back-link from MultiverseSceneNode
    scene = RelationshipFrom(
        MultiverseSceneNode, "HAS_SNAPSHOT"
    )


class CharacterSnapshotNode(StructuredNode):
    """A frozen copy of a single character's knowledge at a branch point.

    This node is the graph-queryable mirror of the EpistemicProfile
    stored in StateSnapshotNode.character_profiles_json. It exists so
    that Cypher queries like "find all snapshots where Maya knows about
    the hidden will" are efficient (graph traversal instead of JSON parsing).

    Each CharacterSnapshotNode links to the original CharacterNode and
    to the StoryFactNodes the character knows at this point.
    """

    uid = UniqueIdProperty()

    # Reference to the original CharacterNode
    character_id = StringProperty(required=True, index=True)
    character_name = StringProperty(required=True)
    role_hint = StringProperty(default=None)

    created_at = DateTimeProperty(default_now=True)

    # ── Relationships ──

    # Facts this character knows at this snapshot point
    knows_facts = RelationshipTo(
        "graph.models.story.StoryFactNode", "SNAPSHOT_KNOWS"
    )

    # Back-link to the snapshot
    snapshot = RelationshipFrom(
        StateSnapshotNode, "SNAPSHOT_CHARACTER"
    )
