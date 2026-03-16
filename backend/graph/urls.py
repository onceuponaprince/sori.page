from django.urls import path
from graph import views

urlpatterns = [
    path("concepts/search/", views.search_concepts, name="search_concepts"),
    path("concepts/<str:uid>/", views.get_concept, name="get_concept"),
    path("stats/", views.graph_stats, name="graph_stats"),
]
