"""
Engine-only Django settings for white-label deployment.

This keeps the AI context engine (graph + retrieval + agent) deployable as
its own service surface without forking model code.
"""

from __future__ import annotations

import os

from sori.engine_boundary import build_installed_apps, csv_to_list
from sori.settings import *  # noqa: F403,F401


ENGINE_INCLUDE_INGESTION = os.environ.get("ENGINE_INCLUDE_INGESTION", "false").lower() == "true"
ENGINE_REQUIRE_API_KEY = os.environ.get("ENGINE_REQUIRE_API_KEY", "true").lower() == "true"
ENGINE_API_KEYS = os.environ.get("ENGINE_API_KEYS", "")

INSTALLED_APPS = build_installed_apps(include_ingestion=ENGINE_INCLUDE_INGESTION)
ROOT_URLCONF = "sori.urls_engine"

engine_allowed_origins = csv_to_list(os.environ.get("ENGINE_ALLOWED_ORIGINS"))
if engine_allowed_origins:
    CORS_ALLOWED_ORIGINS = engine_allowed_origins  # noqa: F405

if ENGINE_REQUIRE_API_KEY:
    MIDDLEWARE = [  # noqa: F405
        "corsheaders.middleware.CorsMiddleware",
        "sori.middleware.ContextEngineApiKeyMiddleware",
        "django.middleware.common.CommonMiddleware",
        "django.middleware.csrf.CsrfViewMiddleware",
        "django.contrib.sessions.middleware.SessionMiddleware",
        "django.contrib.auth.middleware.AuthenticationMiddleware",
    ]
