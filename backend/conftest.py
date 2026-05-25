"""Pytest bootstrap for Django agent tests with mocked Neo4j graph modules."""
from __future__ import annotations

import os
import sys
import types
from unittest.mock import MagicMock

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sori.test_settings")


def _install_mock_graph_modules() -> None:
    """Register lightweight graph.* modules so agent.views can import safely."""
    if "graph.models.story" in sys.modules:
        return

    graph = types.ModuleType("graph")
    graph_models = types.ModuleType("graph.models")
    story = types.ModuleType("graph.models.story")
    multiverse = types.ModuleType("graph.models.multiverse")
    chat = types.ModuleType("graph.models.chat")

    class DoesNotExist(Exception):
        pass

    story.CharacterNode = MagicMock()
    story.CharacterNode.DoesNotExist = DoesNotExist
    story.StoryFactNode = MagicMock()
    story.StoryNode = MagicMock()
    story.StoryNode.DoesNotExist = DoesNotExist

    multiverse.MultiverseRootNode = MagicMock()
    multiverse.MultiverseSceneNode = MagicMock()
    multiverse.MultiverseSceneNode.DoesNotExist = DoesNotExist
    multiverse.StateSnapshotNode = MagicMock()
    multiverse.StateSnapshotNode.DoesNotExist = DoesNotExist
    multiverse.ChoiceEdgeNode = MagicMock()

    chat.ChatThreadNode = MagicMock()
    chat.ChatThreadNode.DoesNotExist = DoesNotExist

    graph.models = graph_models
    graph_models.story = story
    graph_models.multiverse = multiverse
    graph_models.chat = chat

    sys.modules["graph"] = graph
    sys.modules["graph.models"] = graph_models
    sys.modules["graph.models.story"] = story
    sys.modules["graph.models.multiverse"] = multiverse
    sys.modules["graph.models.chat"] = chat


_install_mock_graph_modules()

import django

django.setup()
