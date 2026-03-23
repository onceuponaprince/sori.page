# Load the Celery app when Django starts so that @shared_task decorators
# in app modules (e.g. agent/tasks.py) are registered with the broker
# before any task is dispatched.
from sori.celery import app as celery_app

__all__ = ("celery_app",)
