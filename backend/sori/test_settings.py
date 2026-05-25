"""Lightweight Django settings for pytest (SQLite, agent-only apps)."""
from sori.settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "rest_framework",
    "corsheaders",
    "agent",
]

SECRET_KEY = SECRET_KEY or "test-secret-key"  # noqa: F405
