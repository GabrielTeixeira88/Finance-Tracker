"""One local polling worker, explicitly paused until setup is completed."""

from datetime import UTC, datetime
from threading import Event, Thread

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.gmail_models import GmailConnection
from app.gmail_provider import GmailError
from app.gmail_service import busy


def tick(service):
    with Session(service.engine) as session:
        row = session.get(GmailConnection, 1)
        if (
            not row
            or row.paused
            or row.status != "CONNECTED"
            or not row.polling_minutes
            or busy(row)
        ):
            return
        if (
            row.last_attempt
            and (datetime.now(UTC) - row.last_attempt).total_seconds() < row.polling_minutes * 60
        ):
            return
    service.start_sync()


def start_worker():
    from app.gmail_routes import get_service

    stop = Event()

    def run():
        while not stop.wait(30):
            try:
                tick(get_service())
            except (GmailError, SQLAlchemyError):
                pass  # Safe operational error is persisted by sync; never log payloads.

    thread = Thread(target=run, name="gmail-polling", daemon=True)
    thread.start()
    return stop, thread
