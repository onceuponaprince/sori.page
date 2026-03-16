"""
Git-style versioning for the knowledge graph.

Every change to the canonical graph is a Commit. Contributors work on Branches
that merge to main via quorum approval. This gives you:

- Full audit trail (who changed what and when)
- Revertability (undo bad changes without data loss)
- Conflict detection (two contributors formalizing the same concept)
- Contribution attribution (for the donation-sharing credit model)

Branching model:
    main       — canonical graph, agent queries only main
    draft      — contributor working on a gap/concept (not visible to reviewers)
    review     — submitted for consensus (visible, commentable)
    merged     — approved, merged to main
    rejected   — quorum rejected
"""
from neomodel import (
    StructuredNode,
    StringProperty,
    IntegerProperty,
    JSONProperty,
    DateTimeProperty,
    RelationshipTo,
    UniqueIdProperty,
)


class Commit(StructuredNode):
    """An atomic, immutable record of a change to the knowledge graph.

    Analogous to a git commit. Contains a diff summary describing what
    changed, who changed it, and why. Commits chain together via
    PARENT_COMMIT to form a traversable history.
    """

    uid = UniqueIdProperty()
    message = StringProperty(required=True)
    contributor_id = StringProperty(required=True)
    branch_id = StringProperty(required=True)
    timestamp = DateTimeProperty(default_now=True)

    # What changed in this commit
    diff_summary = JSONProperty(required=True)
    # e.g., {"nodes_added": 1, "nodes_modified": 0,
    #        "edges_added": 5, "function_params_changed": false,
    #        "affected_node_uids": ["abc123"]}

    # Relationships
    parent_commit = RelationshipTo("Commit", "PARENT_COMMIT")


class Branch(StructuredNode):
    """A working space for a contributor to formalize concepts.

    Draft branches are invisible to the review queue. When submitted,
    they become review branches visible to other contributors.
    Quorum approval merges them to main (the canonical graph).
    """

    uid = UniqueIdProperty()
    name = StringProperty(required=True, index=True)
    contributor_id = StringProperty(required=True)

    status = StringProperty(
        choices={
            "draft": "Work in progress",
            "review": "Submitted for consensus",
            "merged": "Approved and merged to main",
            "rejected": "Quorum rejected",
        },
        default="draft",
    )

    # What gap this branch addresses (if any)
    gap_id = StringProperty()

    # Quorum tracking
    quorum_required = IntegerProperty(default=2)
    approvals = JSONProperty(default=[])  # list of contributor_ids
    rejections = JSONProperty(default=[])

    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)
    merged_at = DateTimeProperty()

    # Relationships
    commits = RelationshipTo(Commit, "CONTAINS_COMMIT")
    head_commit = RelationshipTo(Commit, "HEAD")
