"""
Knowledge Graph Models — The core of sori.page's context engine.

Architecture:
    FunctionNode (highest value)
        ↑ HAS_FUNCTION
    ConceptNode (named patterns)
        ↑ INSTANCE_OF
    InstanceNode (specific examples)
        ↓ SOURCED_FROM
    SourceNode (verified origins)

Plus: SlangNode (linguistic pointers to concepts) and GapNode (detected absences).

The depth_score (d) is the distance from ground truth:
    d=1: Structural definitions with scholarly consensus
    d=2: Named tropes with overwhelming community consensus
    d=3: Empirically observable patterns with statistical backing
    d=4: Interpretive structural concepts
    d=5+: Contested craft opinions
"""
from neomodel import (
    StructuredNode,
    StringProperty,
    FloatProperty,
    IntegerProperty,
    ArrayProperty,
    JSONProperty,
    DateTimeProperty,
    BooleanProperty,
    RelationshipTo,
    RelationshipFrom,
    UniqueIdProperty,
)


class SourceNode(StructuredNode):
    """A verified source document or URL.

    InstanceNodes and ConceptNodes reference SourceNodes rather than storing
    raw URLs as strings. This lets you track source reliability over time
    and deprecate sources if they're found to be unreliable.
    """

    uid = UniqueIdProperty()
    url = StringProperty(required=True, index=True)
    name = StringProperty(required=True)
    source_type = StringProperty(
        choices={
            "tvtropes": "TV Tropes",
            "craft_book": "Craft Book",
            "academic": "Academic Paper",
            "reddit": "Reddit Post/Thread",
            "youtube": "YouTube Video Essay",
            "gutenberg": "Project Gutenberg",
            "smogon": "Smogon",
            "other": "Other",
        },
        required=True,
    )
    reliability_score = FloatProperty(default=0.5)  # 0-1, improves over time
    created_at = DateTimeProperty(default_now=True)
    deprecated = BooleanProperty(default=False)


class FunctionNode(StructuredNode):
    """A generative pattern — the highest-value node type.

    Instead of saving individual facts, we save the FUNCTION that generates
    answers. Like Newton finding F=Gm1m2/r² instead of cataloguing falling
    objects individually.

    Example: character_death_transformation
        parameters: [character_role, relationship_depth, death_timing, ...]
        → transformation_acceleration_score

    Both mentor deaths and ally deaths live inside this single function
    as different parameter values for character_role.
    """

    uid = UniqueIdProperty()
    name = StringProperty(required=True, unique_index=True)
    domain = StringProperty(default="narrative_structure")
    description = StringProperty()

    # Function signature — what this pattern takes and produces
    parameters = JSONProperty(required=True)
    # e.g., [{"name": "character_role", "type": "enum",
    #         "values": ["mentor", "ally", "rival", "parent", "love_interest"],
    #         "weight_modifier": {"mentor": 1.4, "parent": 1.5, ...}},
    #        {"name": "relationship_depth", "type": "float", "range": [0, 1]}]

    output_name = StringProperty(required=True)
    output_type = StringProperty(default="float")
    formula_description = StringProperty()
    # Human-readable description of the formula, not executable code.
    # e.g., "relationship_depth × role_weight × timing_multiplier → acceleration"

    # Verification spectrum
    depth_score = IntegerProperty(required=True)
    confidence = FloatProperty(required=True)
    contestation_index = FloatProperty(default=0.0)

    # Git-style versioning
    version_number = IntegerProperty(default=1)
    created_in_commit = StringProperty()
    last_modified_commit = StringProperty()

    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)

    # Relationships
    instances = RelationshipFrom("InstanceNode", "INSTANCE_OF")
    previous_version = RelationshipTo("FunctionNode", "PREVIOUS_VERSION")
    slang_refs = RelationshipFrom("SlangNode", "REFERS_TO")


class ConceptNode(StructuredNode):
    """A named narrative phenomenon that may not yet have a formalized function.

    ConceptNodes are the middle layer — patterns abstracted from instances
    but not yet expressed as generative functions. Example:
    'mentor_death_as_catalyst' starts as a ConceptNode. When contributors
    formalize it into a function, it gets a HAS_FUNCTION edge.

    ConceptNodes below the function threshold still exist and are queryable —
    they just return lower confidence answers.
    """

    uid = UniqueIdProperty()
    name = StringProperty(required=True, unique_index=True)
    domain = StringProperty(default="narrative_structure")
    description = StringProperty()

    # Verification spectrum
    depth_score = IntegerProperty(required=True)
    confidence = FloatProperty(required=True)
    contestation_index = FloatProperty(default=0.0)

    # Cluster state — tracks where this concept is in the
    # proposal → review → canonized pipeline
    status = StringProperty(
        choices={
            "proposed": "Proposed by algorithm",
            "under_review": "Being reviewed by contributor",
            "pending_consensus": "Awaiting quorum approval",
            "canonized": "Live — agent can query",
        },
        default="proposed",
    )

    # Git-style versioning
    version_number = IntegerProperty(default=1)
    created_in_commit = StringProperty()
    last_modified_commit = StringProperty()

    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)

    # Relationships
    has_function = RelationshipTo(FunctionNode, "HAS_FUNCTION")
    instances = RelationshipFrom("InstanceNode", "INSTANCE_OF")
    slang_refs = RelationshipFrom("SlangNode", "REFERS_TO")
    sources = RelationshipTo(SourceNode, "SOURCED_FROM")

    # Concept-to-concept relationships (the graph edges)
    related_to = RelationshipTo("ConceptNode", "RELATED_TO")
    subverts = RelationshipTo("ConceptNode", "SUBVERTS")
    homages = RelationshipTo("ConceptNode", "HOMAGES")
    precedes = RelationshipTo("ConceptNode", "PRECEDES_IN_STRUCTURE")


class InstanceNode(StructuredNode):
    """A specific real-world example that evidences a concept or function.

    Always belongs to either a ConceptNode or FunctionNode via INSTANCE_OF.
    Carries source attribution and verification status.

    Example:
        work: "A New Hope"
        character: "Obi-Wan Kenobi"
        protagonist: "Luke Skywalker"
        parameter_values: {"character_role": "mentor", "death_timing": "act2_open"}
    """

    uid = UniqueIdProperty()
    description = StringProperty(required=True)

    # The specific real-world reference
    work = StringProperty()  # "A New Hope", "Lord of the Rings"
    entity = StringProperty()  # Character, trope occurrence, etc.

    # Parameter values for the function this instance belongs to
    parameter_values = JSONProperty(default={})
    # e.g., {"character_role": "mentor", "relationship_depth": 0.85}

    computed_output = FloatProperty()  # The function's output for these params

    # Verification
    verified = BooleanProperty(default=False)
    verified_by = ArrayProperty(StringProperty())

    created_at = DateTimeProperty(default_now=True)

    # Relationships
    concept = RelationshipTo(ConceptNode, "INSTANCE_OF")
    function = RelationshipTo(FunctionNode, "INSTANCE_OF")
    sources = RelationshipTo(SourceNode, "SOURCED_FROM")


class SlangNode(StructuredNode):
    """A community term — never standalone, always connected to a concept.

    "The Obi-Wan moment", "fridging", "passing the torch" are all linguistic
    pointers to concept nodes. Slang isn't stored separately — it's attached
    to the concept it refers to.
    """

    uid = UniqueIdProperty()
    term = StringProperty(required=True, index=True)
    community_origin = StringProperty()  # "screenwriting", "fanfiction", etc.
    confidence = FloatProperty(default=0.5)

    created_at = DateTimeProperty(default_now=True)

    # Relationships
    refers_to_concept = RelationshipTo(ConceptNode, "REFERS_TO")
    refers_to_function = RelationshipTo(FunctionNode, "REFERS_TO")


class GapNode(StructuredNode):
    """A detected absence in the knowledge graph.

    Created when the retrieval layer can't find a graph answer and falls
    back to RAG. Importance is scored dynamically based on query frequency,
    recency, RAG fallback quality, and concept centrality.

    Displayed to contributors like GitHub issues — triaged by importance,
    claimable, with related gaps grouped for efficient work sessions.
    """

    uid = UniqueIdProperty()
    name = StringProperty(required=True, index=True)
    description = StringProperty()

    # Importance scoring (the triage system)
    query_frequency = IntegerProperty(default=1)
    last_queried = DateTimeProperty(default_now=True)
    rag_fallback_quality = FloatProperty(default=0.5)  # How well RAG covered it
    concept_centrality = FloatProperty(default=0.0)  # How many nodes depend on this
    estimated_depth = IntegerProperty(default=3)

    # Computed importance — recalculated periodically
    importance_score = FloatProperty(default=0.0)

    # Workflow state
    status = StringProperty(
        choices={
            "open": "Open — needs contributor",
            "claimed": "Claimed by a contributor",
            "resolved": "Concept node created",
            "deferred": "Revisit later",
        },
        default="open",
    )
    claimed_by = StringProperty()  # contributor uid

    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)

    # Relationships — what existing nodes are waiting for this gap to be filled
    blocks = RelationshipFrom(ConceptNode, "BLOCKS_RESOLUTION_OF")
    related_gaps = RelationshipTo("GapNode", "RELATED_GAP")
