"""Storage adapters keep exact money and UTC timestamps out of provider-specific domain code."""

from datetime import UTC
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.types import TypeDecorator


class ExactMoney(TypeDecorator):
    impl = String(24)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(
            Numeric(24, 6) if dialect.name == "postgresql" else String(24)
        )

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, Decimal) or not value.is_finite():
            raise ValueError("Money must be a finite Decimal")
        if value < 0 or value >= Decimal("1e18") or value != value.quantize(Decimal("0.000001")):
            raise ValueError("Money must have at most 18 whole and 6 fractional digits")
        if dialect.name == "postgresql":
            return value
        # 24 decimal digits of millionths; TEXT affinity prevents any REAL conversion.
        return str(int(value * 1_000_000)).zfill(24)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return Decimal(value) if dialect.name == "postgresql" else Decimal(value).scaleb(-6)


class UTCDateTime(TypeDecorator):
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("Timestamp must include a timezone")
            return value.astimezone(UTC)
        return value

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value
