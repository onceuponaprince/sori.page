"""
Contributor model — tracks who contributes what and how much credit they earn.

Contributors are the human-in-the-loop. They review algorithm-proposed
clusters, formalize concepts, validate instances, and approve function
definitions via quorum consensus.

Credit formula:
    contribution_credit = gap_importance_score
                          × consensus_quality_score
                          × (1 + peer_review_bonus)
"""
from neomodel import (
    StructuredNode,
    StringProperty,
    FloatProperty,
    IntegerProperty,
    ArrayProperty,
    DateTimeProperty,
    RelationshipTo,
    UniqueIdProperty,
)


class ContributorNode(StructuredNode):
    """A contributor account in the knowledge graph."""

    uid = UniqueIdProperty()
    username = StringProperty(required=True, unique_index=True)
    email = StringProperty(unique_index=True)

    # Contribution metrics
    total_credit = FloatProperty(default=0.0)
    concepts_canonized = IntegerProperty(default=0)
    functions_created = IntegerProperty(default=0)
    instances_verified = IntegerProperty(default=0)
    reviews_completed = IntegerProperty(default=0)

    # Specialization tags (empty for generalists, populated later)
    specializations = ArrayProperty(StringProperty(), default=[])

    # Reputation — weighted consensus authority
    reputation_score = FloatProperty(default=1.0)

    created_at = DateTimeProperty(default_now=True)
    last_active = DateTimeProperty(default_now=True)

    # Relationships
    canonized = RelationshipTo(
        "graph.models.knowledge.ConceptNode", "CANONIZED"
    )
    created_functions = RelationshipTo(
        "graph.models.knowledge.FunctionNode", "CREATED"
    )
    validated = RelationshipTo(
        "graph.models.knowledge.InstanceNode", "VALIDATED"
    )
