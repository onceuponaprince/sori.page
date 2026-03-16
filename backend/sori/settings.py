"""
sori.page Django settings.

The backend handles:
- Knowledge graph operations (Neo4j)
- Contributor workflows and consensus
- Ingestion pipelines (scrapers, clustering)
- GraphRAG retrieval orchestration
- LLM query interface
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "corsheaders",
    "graph",
    "ingestion",
    "retrieval",
    "contributors",
    "agent",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
]

ROOT_URLCONF = "sori.urls"
WSGI_APPLICATION = "sori.wsgi.application"

# Postgres via Supabase — handles auth, credits, generation history.
# Neo4j handles the knowledge graph. Postgres handles everything else.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "postgres"),
        "USER": os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

# Neo4j connection
NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "soripage_dev_2024")

# Weaviate connection
WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "http://localhost:8080")

# Anthropic API
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# CORS - allow Next.js frontend
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # Open for v1, lock down later
    ],
}

# Verification spectrum thresholds
# Maps depth scores to required quorum counts
QUORUM_THRESHOLDS = {
    1: 0,  # Auto-canonized, no human needed
    2: 0,  # Derivable, auto-verified
    3: 1,  # Empirical patterns, one contributor
    4: 2,  # Interpretive concepts, two contributors
    5: 3,  # Contested claims, all contributors (at bootstrap scale)
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
