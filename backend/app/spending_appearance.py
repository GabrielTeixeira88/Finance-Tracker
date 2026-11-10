"""Persisted classification presentation; never part of financial posting or totals."""

from typing import Annotated
from uuid import UUID

from pydantic import Field
from sqlalchemy import CheckConstraint, ForeignKey, String, select
from sqlalchemy.orm import Mapped, mapped_column

from app.investments import wire
from app.models import Base, Record

Color = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
IconName = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9]{0,47}$")]


class ClassificationAppearance(Record, Base):
    __tablename__ = "classification_appearance"
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), unique=True
    )
    group_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("budget_groups.id", ondelete="CASCADE"), unique=True
    )
    color: Mapped[str | None] = mapped_column(String(7))
    icon: Mapped[str | None] = mapped_column(String(48))
    __table_args__ = (
        CheckConstraint("(category_id IS NULL) <> (group_id IS NULL)", name="one_owner"),
    )


def annotate(session, rows, kind):
    if not rows:
        return rows
    owner = getattr(ClassificationAppearance, kind + "_id")
    styles = {
        getattr(item, kind + "_id"): item
        for item in session.scalars(
            select(ClassificationAppearance).where(owner.in_([row.id for row in rows]))
        )
    }
    return [
        {
            **wire(row),
            "color": styles[row.id].color if row.id in styles else None,
            "icon": styles[row.id].icon if row.id in styles else None,
        }
        for row in rows
    ]


def save(session, identifier, kind, data):
    fields = data.model_fields_set & {"color", "icon"}
    if not fields:
        return
    column = getattr(ClassificationAppearance, kind + "_id")
    row = session.scalar(select(ClassificationAppearance).where(column == identifier))
    if row is None:
        row = ClassificationAppearance(**{kind + "_id": identifier})
        session.add(row)
    for field in fields:
        setattr(row, field, getattr(data, field))
    session.flush()
