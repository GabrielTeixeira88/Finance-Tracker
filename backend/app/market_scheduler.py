"""Opt-in in-process worker; no startup HTTP and no jobs while the API is closed."""

from threading import Event, Thread

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_engine
from app.market_sync import sync
from app.market_valuation import preferences


def start_worker():
    stop = Event()

    def run():
        # Poll only local preferences; startup remains usable offline/unmigrated.
        elapsed = get_settings().market_sync_interval_minutes * 60
        while not stop.wait(60):
            elapsed += 60
            try:
                with Session(get_engine()) as session:
                    enabled = preferences(session)["automatic"]
                if enabled and elapsed >= get_settings().market_sync_interval_minutes * 60:
                    sync(get_engine(), cancel=stop)
                    elapsed = 0
            except (SQLAlchemyError, HTTPException):
                # Provider details are persisted by sync, never log credentials/payloads.
                elapsed = 0

    thread = Thread(target=run, name="market-data", daemon=True)
    thread.start()
    return stop, thread
