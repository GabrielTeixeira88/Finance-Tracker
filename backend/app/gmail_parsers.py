"""Untrusted MIME to typed candidates. No network, storage or ledger mutations."""

import base64
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from email.utils import parseaddr
from html.parser import HTMLParser
from typing import Protocol

from app.gmail_provider import GmailError
from app.ingestion_schemas import Candidate

MAX_TEXT = 256 * 1024


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.blocked = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "head"}:
            self.blocked += 1
        if tag in {"br", "p", "div", "tr", "li"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "head"}:
            self.blocked = max(0, self.blocked - 1)
        if tag in {"p", "div", "tr", "li"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.parts.append(data)


@dataclass(frozen=True)
class Message:
    id: str
    thread_id: str
    sender: str
    subject: str
    received_at: str
    date_header: str
    text: str


def normalize_message(data):
    payload = data.get("payload", {})
    headers = payload.get("headers", [])
    if len(headers) > 100:
        raise GmailError("MIME_LIMIT")
    headers = {h["name"].lower(): h.get("value", "")[:1000] for h in headers}
    plain, html, size, count = [], [], 0, 0

    def walk(part, depth=0):
        nonlocal size, count
        count += 1
        if depth > 10 or count > 100:
            raise GmailError("MIME_LIMIT")
        if part.get("filename"):
            return  # Never fetch/download attachments or follow MIME URLs.
        kind = part.get("mimeType", "")
        encoded = part.get("body", {}).get("data", "")
        if kind in {"text/plain", "text/html"} and encoded:
            if len(encoded) > MAX_TEXT * 2:
                raise GmailError("MIME_LIMIT")
            try:
                raw = base64.b64decode(
                    encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True
                )
                size += len(raw)
                if size > MAX_TEXT:
                    raise GmailError("MIME_LIMIT")
                text = raw.decode("utf-8")
            except (ValueError, UnicodeError):
                raise GmailError("UNSUPPORTED_MIME_ENCODING") from None
            (plain if kind == "text/plain" else html).append(text)
        for child in part.get("parts", []):
            walk(child, depth + 1)

    walk(payload)
    if plain:
        text = "\n".join(plain)
    else:
        parser = TextOnly()
        parser.feed("\n".join(html))
        text = "".join(parser.parts)
    try:
        timestamp = int(data["internalDate"])
        # Integer epoch milliseconds; never use a floating timestamp conversion.
        received = datetime.fromtimestamp(timestamp // 1000, UTC).isoformat()
    except (ValueError, KeyError, OverflowError, OSError):
        raise GmailError("INVALID_MESSAGE_DATE") from None
    return Message(
        data["id"],
        data.get("threadId", ""),
        parseaddr(headers.get("from", ""))[1].lower(),
        headers.get("subject", "")[:200],
        received,
        headers.get("date", "")[:100],
        text,
    )


class BankEmailParser(Protocol):
    id: str
    version: str

    def recognizes(self, message: Message) -> bool: ...
    def parse(self, message: Message) -> tuple[Candidate, dict]: ...


class SyntheticBankParser:
    id, version = "synthetic-bank", "1"

    def recognizes(self, message):
        return (
            message.sender == "notifications@synthetic-bank.example"
            and message.subject == "[SYNTHETIC BANK] Transaction v1"
        )

    def parse(self, message):
        lines = [s.strip() for s in message.text.splitlines() if s.strip()]
        if not lines or lines[0] != "SYNTHETIC BANK DEMO v1":
            raise GmailError("MALFORMED_SUPPORTED_MESSAGE")
        fields = {}
        for line in lines[1:]:
            key, separator, value = line.partition(":")
            if (
                not separator
                or key in fields
                or key
                not in {"Date", "Amount", "Currency", "Kind", "Description", "Merchant", "Account"}
            ):
                raise GmailError("MALFORMED_SUPPORTED_MESSAGE")
            fields[key] = value.strip()
        kind = fields.get("Kind", "")
        directions = {
            "DEBIT_PURCHASE": "EXPENSE",
            "CREDIT_PURCHASE": "EXPENSE",
            "INCOME": "INCOME",
            "PIX_IN": "INCOME",
            "PIX_OUT": "EXPENSE",
            "TRANSFER_IN": "INCOME",
            "TRANSFER_OUT": "EXPENSE",
            "REFUND": "INCOME",
            "CARD_PAYMENT": "EXPENSE",
        }
        if kind not in directions:
            raise GmailError("CANCELLATION_OR_UNKNOWN_TYPE")
        amount = fields.get("Amount", "")
        if not re.fullmatch(r"(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}", amount):
            raise GmailError("INVALID_AMOUNT")
        try:
            day = datetime.strptime(fields["Date"], "%d/%m/%Y").date()
            special = kind in {"TRANSFER_IN", "TRANSFER_OUT", "REFUND", "CARD_PAYMENT"}
            candidate = Candidate(
                transaction_date=day,
                description=fields["Description"],
                amount=Decimal(amount.replace(".", "").replace(",", ".")),
                currency=fields["Currency"],
                transaction_type=directions[kind],
                ambiguity="Link an existing transfer/refund/payment or skip; not ordinary spending."
                if special
                else "Confirm the economic meaning of PIX before posting."
                if kind.startswith("PIX")
                else None,
            )
        except (ValueError, KeyError):
            raise GmailError("MALFORMED_SUPPORTED_MESSAGE") from None
        return candidate, {
            "name": fields.get("Merchant", "")[:120],
            "account_hint": fields.get("Account", "")[:80],
            "kind": kind,
            "link_only": "yes" if special else "no",
        }


PARSERS: tuple[BankEmailParser, ...] = (SyntheticBankParser(),)


def parse_message(message):
    parser = next((p for p in PARSERS if p.recognizes(message)), None)
    if parser is None:
        return (
            {},
            {"parser": "unsupported", "parser_version": ""},
            ["UNSUPPORTED_NOTIFICATION_FORMAT"],
        )
    metadata = {"parser": parser.id, "parser_version": parser.version}
    try:
        candidate, details = parser.parse(message)
        return candidate.model_dump(mode="json"), {**metadata, **details}, []
    except GmailError as error:
        return {}, metadata, [error.code]
