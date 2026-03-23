from django.urls import path

from retrieval import views

urlpatterns = [
    path("analyze/", views.analyze_outline, name="analyze_outline"),
    path(
        "epistemic/<str:story_uid>/",
        views.epistemic_state,
        name="epistemic_state",
    ),
]
