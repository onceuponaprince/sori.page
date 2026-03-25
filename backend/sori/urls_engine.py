from __future__ import annotations

import os

from django.urls import include, path

urlpatterns = [
    path("api/graph/", include("graph.urls")),
    path("api/retrieval/", include("retrieval.urls")),
    path("api/agent/", include("agent.urls")),
]

if os.environ.get("ENGINE_INCLUDE_INGESTION", "false").lower() == "true":
    urlpatterns.append(path("api/ingestion/", include("ingestion.urls")))
