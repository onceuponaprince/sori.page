"""
Graph app — connects Django to Neo4j on startup.

neomodel needs to be configured with the Neo4j connection string
before any graph models can be used. We do this in the app's ready()
method so it happens exactly once when Django starts.
"""
from django.apps import AppConfig
from django.conf import settings


class GraphConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "graph"

    def ready(self):
        from neomodel import config as neomodel_config

        neomodel_config.DATABASE_URL = (
            f"bolt://{settings.NEO4J_USER}:{settings.NEO4J_PASSWORD}"
            f"@{settings.NEO4J_URI.replace('bolt://', '')}"
        )
