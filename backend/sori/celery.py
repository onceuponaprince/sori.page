"""
Celery application configuration for sori.page.

WHY CELERY?
───────────
The Multiverse Scene Tester runs two Claude 3.5 Sonnet instances
(Agent-A and Agent-B) that simulate character dialogue. Each agent
call takes 2-8 seconds, and a full simulation round involves 4-6
back-and-forth turns — that's 16-48 seconds of blocking I/O.

Running this synchronously in a Django request would:
1. Time out the HTTP connection
2. Block the web worker from serving other requests
3. Make it impossible to stream partial results to the frontend

Celery solves all three:
- Simulation runs as a background task
- The frontend polls a task-status endpoint (or uses WebSocket later)
- Partial results can be stored in Redis for incremental display

BROKER SETUP
────────────
We use Redis as both the message broker and the result backend.
Redis is already a declared dependency (requirements.txt) and will
be added as a Docker Compose service.

TASK DISCOVERY
──────────────
Celery's `autodiscover_tasks()` scans every INSTALLED_APP for a
`tasks.py` module. The simulation tasks live in `agent/tasks.py`.
"""

import os

from celery import Celery

# Make sure Django settings are loaded before Celery initializes.
# This must happen before the Celery app object is created so that
# task modules can import Django models without AppRegistryNotReady.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sori.settings")

# Create the Celery application instance.
# The 'sori' string is the name that appears in logs and the Redis
# key prefix (e.g. celery-task-meta-sori-...).
app = Celery("sori")

# Load any Celery-specific settings from Django settings.py.
# The 'CELERY_' namespace means Django settings like CELERY_BROKER_URL
# map to Celery's broker_url config key.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Scan all INSTALLED_APPS for tasks.py modules.
# This finds agent/tasks.py automatically.
app.autodiscover_tasks()
