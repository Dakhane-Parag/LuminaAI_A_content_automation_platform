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
import ssl
from dotenv import load_dotenv

# Load environment variables before Celery initializes
load_dotenv()

from celery import Celery
from celery.utils.log import get_task_logger
from kombu import Queue

# ---------------------------------------------------------------------------
# Redis broker URL
# ---------------------------------------------------------------------------
# REDIS_URL env var takes priority (Upstash uses rediss:// with TLS).
# Falls back to constructing from host/port for local Redis.
_REDIS_URL_ENV = os.getenv("REDIS_URL", "")
_REDIS_HOST    = os.getenv("REDIS_HOST", "localhost")
_REDIS_PORT    = os.getenv("REDIS_PORT", "6379")
_REDIS_DB      = os.getenv("REDIS_DB", "0")

REDIS_URL = _REDIS_URL_ENV if _REDIS_URL_ENV else f"redis://{_REDIS_HOST}:{_REDIS_PORT}/{_REDIS_DB}"

# Detect if TLS is required (Upstash rediss://)
_USE_SSL = REDIS_URL.startswith("rediss://")
_SSL_OPTS = {"ssl_cert_reqs": ssl.CERT_NONE} if _USE_SSL else None

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

# Apply SSL settings if using Upstash / rediss://
if _SSL_OPTS:
    celery_app.conf.update(
        broker_use_ssl=_SSL_OPTS,
        redis_backend_use_ssl=_SSL_OPTS,
    )

logger = get_task_logger(__name__)
logger.info(f"Celery worker initialised. Broker: {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}")
