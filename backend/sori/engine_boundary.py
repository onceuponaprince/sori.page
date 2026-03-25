"""
Canonical boundary definitions for the white-label context engine.

This module is intentionally code (not docs) so settings, URL routing,
and middleware can share one source of truth.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


CORE_DJANGO_APPS: tuple[str, ...] = (
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "corsheaders",
)

ENGINE_DOMAIN_APPS: tuple[str, ...] = (
    "graph",
    "retrieval",
    "agent",
)

OPTIONAL_ENGINE_APPS: tuple[str, ...] = (
    "ingestion",
)

PRODUCT_ONLY_APPS: tuple[str, ...] = (
    "contributors",
)

FULL_BACKEND_APPS: tuple[str, ...] = (
    *CORE_DJANGO_APPS,
    *ENGINE_DOMAIN_APPS,
    "ingestion",
    *PRODUCT_ONLY_APPS,
)

ENGINE_REQUIRED_ENV_VARS: tuple[str, ...] = (
    "DJANGO_SECRET_KEY",
    "NEO4J_URI",
    "NEO4J_USER",
    "NEO4J_PASSWORD",
)

ENGINE_OPTIONAL_ENV_VARS: tuple[str, ...] = (
    "WEAVIATE_URL",
    "ANTHROPIC_API_KEY",
    "ENGINE_INCLUDE_INGESTION",
    "ENGINE_REQUIRE_API_KEY",
    "ENGINE_API_KEYS",
    "ENGINE_ALLOWED_ORIGINS",
)

PRODUCT_ONLY_ENV_VARS: tuple[str, ...] = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
)


@dataclass(frozen=True)
class EngineApiKey:
    tenant_id: str | None
    key: str


def parse_engine_api_keys(raw: str | None) -> tuple[EngineApiKey, ...]:
    """
    Parse ENGINE_API_KEYS.

    Accepted formats:
      - "tenantA:keyA,tenantB:keyB"
      - "keyWithoutTenant"
    """
    if not raw:
        return ()

    parsed: list[EngineApiKey] = []
    for part in raw.split(","):
        item = part.strip()
        if not item:
            continue
        if ":" in item:
            tenant_id, key = item.split(":", 1)
            tenant_id = tenant_id.strip() or None
            key = key.strip()
        else:
            tenant_id = None
            key = item
        if key:
            parsed.append(EngineApiKey(tenant_id=tenant_id, key=key))
    return tuple(parsed)


def csv_to_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def build_installed_apps(include_ingestion: bool) -> list[str]:
    apps: list[str] = [*CORE_DJANGO_APPS, *ENGINE_DOMAIN_APPS]
    if include_ingestion:
        apps.extend(OPTIONAL_ENGINE_APPS)
    return apps


def as_set(values: Iterable[str]) -> set[str]:
    return {v for v in values if v}
