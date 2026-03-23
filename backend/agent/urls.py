"""
URL configuration for the Multiverse Scene Tester agent API.

All endpoints are mounted under /api/agent/ by the root URLconf
in sori/urls.py.

ENDPOINT MAP
────────────
POST /api/agent/simulate/
    Start a new simulation → returns 202 + task ID

GET  /api/agent/simulate/<task_id>/status/
    Poll simulation progress → returns task state + results

POST /api/agent/branch/
    Create a new branch from a decision point → returns 201

POST /api/agent/commit/
    Commit a branch to the canonical story → returns 200

GET  /api/agent/multiverse/<story_uid>/
    Load the full multiverse tree for a story → returns 200
"""

from django.urls import path
from agent import views

urlpatterns = [
    path(
        "simulate/",
        views.simulate_scene,
        name="agent-simulate",
    ),
    path(
        "simulate/<str:task_id>/status/",
        views.simulation_status,
        name="agent-simulate-status",
    ),
    path(
        "branch/",
        views.create_branch,
        name="agent-branch",
    ),
    path(
        "commit/",
        views.commit_branch,
        name="agent-commit",
    ),
    path(
        "multiverse/<str:story_uid>/",
        views.get_multiverse_tree,
        name="agent-multiverse-tree",
    ),
]
