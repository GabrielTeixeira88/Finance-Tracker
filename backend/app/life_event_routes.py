from datetime import date
from uuid import UUID

from fastapi import APIRouter, Response
from sqlalchemy import select

from app import ledger, life_events
from app.investments import wire
from app.life_event_models import LifeEvent, LifeEventLink
from app.routes import DB

router = APIRouter(prefix="/api/life-events", tags=["Life Events"])


@router.get("")
def list_events(db: DB, as_of: date | None = None):
    return [
        life_events.detail(db, event, as_of or date.today())
        for event in db.scalars(select(LifeEvent).order_by(LifeEvent.start_date, LifeEvent.id))
    ]


@router.post("", status_code=201)
def create(data: life_events.EventInput, db: DB):
    return wire(life_events.save(db, data))


@router.get("/{event_id}")
def detail(event_id: UUID, db: DB, as_of: date | None = None):
    return life_events.detail(db, ledger.require(db, LifeEvent, event_id), as_of or date.today())


@router.patch("/{event_id}")
def edit(event_id: UUID, data: life_events.EventInput, db: DB):
    return wire(life_events.save(db, data, ledger.require(db, LifeEvent, event_id)))


@router.delete("/{event_id}", status_code=204)
def remove(event_id: UUID, db: DB):
    life_events.remove(db, ledger.require(db, LifeEvent, event_id))
    return Response(status_code=204)


@router.post("/{event_id}/transactions")
def link(event_id: UUID, data: life_events.LinkInput, db: DB):
    life_events.link(db, ledger.require(db, LifeEvent, event_id), data.transaction_ids)
    return {"linked": len(set(data.transaction_ids))}


@router.delete("/{event_id}/transactions/{transaction_id}", status_code=204)
def unlink(event_id: UUID, transaction_id: UUID, db: DB):
    ledger.require(db, LifeEvent, event_id)
    row = db.scalar(
        select(LifeEventLink).where(
            LifeEventLink.event_id == event_id, LifeEventLink.transaction_id == transaction_id
        )
    )
    if row:
        db.delete(row)
        db.flush()
    return Response(status_code=204)
