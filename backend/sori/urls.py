from django.urls import path, include

urlpatterns = [
    path("api/graph/", include("graph.urls")),
    path("api/ingestion/", include("ingestion.urls")),
    path("api/retrieval/", include("retrieval.urls")),
    path("api/contributors/", include("contributors.urls")),
    path("api/agent/", include("agent.urls")),
]
