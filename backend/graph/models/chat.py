"""Chat thread persistence for solo character Talk mode."""
from neomodel import (
    JSONProperty,
    StructuredNode,
    StringProperty,
    DateTimeProperty,
    UniqueIdProperty,
    RelationshipTo,
)


class ChatThreadNode(StructuredNode):
    uid = UniqueIdProperty()
    story_uid = StringProperty(required=True, index=True)
    character_id = StringProperty(required=True, index=True)
    messages = JSONProperty(default=[])
    created_at = DateTimeProperty(default_now=True)
    updated_at = DateTimeProperty(default_now=True)

    with_character = RelationshipTo("graph.models.story.CharacterNode", "WITH_CHARACTER")
