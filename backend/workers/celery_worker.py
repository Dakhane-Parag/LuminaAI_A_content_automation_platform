"""
Brandflow AI - Celery Worker Application
==========================================
Central Celery application instance.

This module initialises the Celery app, connects it to Redis as the
message broker, and registers all task modules via autodiscovery.

Architecture:
    FastAPI process        — creates delayed tasks via .apply_async(eta=...)
    Redis                  — stores the serialised task queue messages
    Celery worker process  — picks up messages and executes tasks

Usage — Start the worker in a SEPARATE terminal:
    cd backend
    .\\venv\\Scripts\\Activate.ps1
    celery -A workers.celery_worker worker --loglevel=info -P solo

The `-P solo` flag is needed on Windows (avoids multiprocessing issues).
On Linux/macOS use:
    celery -A workers.celery_worker worker --loglevel=info

Monitoring (optional — install flower first):
    celery -A workers.celery_worker flower --port=5555
"""

import os
from dotenv import load_dotenv

# Load environment variables before Celery initializes
load_dotenv()

from celery import Celery
from celery.utils.log import get_task_logger
from kombu import Queue

# ---------------------------------------------------------------------------
# Redis broker URL
# ---------------------------------------------------------------------------
# Read from environment — falls back to local Redis defaults
_REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
_REDIS_PORT = os.getenv("REDIS_PORT", "6379")
_REDIS_DB   = os.getenv("REDIS_DB", "0")
REDIS_URL   = f"redis://{_REDIS_HOST}:{_REDIS_PORT}/{_REDIS_DB}"

# ---------------------------------------------------------------------------
# Celery application
# ---------------------------------------------------------------------------
celery_app = Celery(
    "brandflow_ai",          # application name
    broker=REDIS_URL,        # Redis as the message broker
    backend=REDIS_URL,       # Redis as the result store
    include=[
        "workers.tasks.scheduler_tasks",   # auto-register scheduling tasks
        "workers.tasks.instagram_tasks",   # auto-register Instagram publishing tasks
    ],
)

# ---------------------------------------------------------------------------
# Celery configuration
# ---------------------------------------------------------------------------
celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone — always UTC for scheduling reliability
    timezone="UTC",
    enable_utc=True,

    # Task routing — all scheduled tasks go to the "scheduled" queue
    task_queues=(
        Queue("default"),
        Queue("scheduled"),
    ),
    task_default_queue="default",

    # Retry behaviour for failed tasks
    task_acks_late=True,                   # Acknowledge only after task completes
    task_reject_on_worker_lost=True,       # Re-queue if worker crashes mid-task
    task_max_retries=3,                    # Maximum retry attempts

    # Result expiry — keep results for 24 hours
    result_expires=86400,

    # Worker concurrency — 1 on Windows (solo pool), auto on Linux
    worker_prefetch_multiplier=1,

    # Heartbeat
    broker_heartbeat=10,
    broker_connection_retry_on_startup=True,
)

logger = get_task_logger(__name__)
logger.info(f"Celery worker initialised. Broker: redis://{_REDIS_HOST}:{_REDIS_PORT}/{_REDIS_DB}")
