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
import socket
from pathlib import Path
from urllib.parse import parse_qsl, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
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

def _strtobool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_ipv4(hostname: str) -> str | None:
    try:
        addresses = socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM)
        if not addresses:
            return None
        return addresses[0][4][0]
    except OSError:
        return None


def _build_database_settings() -> dict:
    postgres_url = os.environ.get("POSTGRES_POOLER_URL") or os.environ.get("POSTGRES_URL")

    if postgres_url:
        parsed = urlparse(postgres_url)
        query_params = dict(parse_qsl(parsed.query))
        host = parsed.hostname or os.environ.get("POSTGRES_HOST", "")

        db_settings = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": (parsed.path or "").lstrip("/") or os.environ.get("POSTGRES_DB", "postgres"),
            "USER": parsed.username or os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": parsed.password or os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": host,
            "PORT": str(parsed.port or os.environ.get("POSTGRES_PORT", "5432")),
        }
    else:
        host = os.environ.get("POSTGRES_HOST", "postgres")
        db_settings = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "postgres"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": host,
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
        query_params = {}

    sslmode = os.environ.get("POSTGRES_SSLMODE") or query_params.get("sslmode")
    if not sslmode and host.endswith(".supabase.co"):
        sslmode = "require"

    options = {}
    if sslmode:
        options["sslmode"] = sslmode

    hostaddr = os.environ.get("POSTGRES_HOSTADDR")
    if not hostaddr and host.endswith(".supabase.co"):
        # Docker hosts often cannot route IPv6 to Supabase direct DB endpoints.
        # Pinning hostaddr to IPv4 avoids "Network is unreachable" crashes.
        force_ipv4 = _strtobool(os.environ.get("POSTGRES_FORCE_IPV4"), default=True)
        if force_ipv4:
            hostaddr = _resolve_ipv4(host)
    if hostaddr:
        options["hostaddr"] = hostaddr

    if options:
        db_settings["OPTIONS"] = options

    return db_settings


# Postgres via Supabase — handles auth, credits, generation history.
# Neo4j handles the knowledge graph. Postgres handles everything else.
DATABASES = {"default": _build_database_settings()}

# Neo4j connection
NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "soripage_dev_2024")

# Weaviate connection
WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "http://localhost:8080")

# Anthropic API
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# ── Celery (async task queue for Multiverse Scene Tester) ──
# Redis serves as both the message broker (task dispatch) and the
# result backend (task status/return values). The default URL assumes
# the Docker Compose redis service on the standard port.
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# Serialize task arguments and results as JSON so they're inspectable
# in Redis and don't require pickle (security risk with untrusted data).
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"

# Keep results for 1 hour. The frontend polls for completion, then the
# result can be garbage collected. No need to keep it longer since the
# actual data lives in Neo4j.
CELERY_RESULT_EXPIRES = 3600

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
