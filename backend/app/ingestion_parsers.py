"""Bounded file adapters. No database access, postings, or financial payload logging."""

import base64
import binascii
import csv
import hashlib
import io
import logging
import re
from datetime import datetime
from decimal import Decimal
from pathlib import PureWindowsPath
from xml.etree import ElementTree

from fastapi import HTTPException
from ofxtools.Parser import OFXTree
from pydantic import ValidationError

from app.ingestion_schemas import MAX_BYTES, MAX_ROWS, Candidate

# The library's debug messages can include source values. Never enable those loggers.
logging.getLogger("ofxtools").disabled = True
for name in ("ofxtools.Parser", "ofxtools.header", "ofxtools.Types"):
    logging.getLogger(name).disabled = True


def decode_upload(data):
    filename = PureWindowsPath(data.filename.replace("/", "\\")).name
    if not filename.lower().endswith("." + data.source_type.lower()):
        raise HTTPException(422, "Choose a .csv or .ofx file matching the selected format")
    try:
        content = base64.b64decode(data.content_base64, validate=True)
    except (ValueError, binascii.Error) as error:
        raise HTTPException(422, "Invalid file encoding") from error
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(422, "Choose a nonempty file of at most 2 MiB")
    if b"\x00" in content:
        raise HTTPException(
            422, "Binary/UTF-16 files are unsupported; export UTF-8 or Windows-1252"
        )
    return filename, content


def amount(text, decimal=".", thousands=""):
    value = text.strip()
    value = re.sub(r"^(R\$|US\$|\$|€|£)\s*", "", value)
    # Grouping is validated before removal, so a wrong locale cannot silently scale money.
    integer = r"\d+" if not thousands else rf"(?:\d+|\d{{1,3}}(?:{re.escape(thousands)}\d{{3}})+)"
    if not re.fullmatch(rf"[+-]?{integer}(?:{re.escape(decimal)}\d{{1,6}})?", value):
        raise ValueError("Invalid amount for the selected decimal/thousands convention")
    if thousands:
        value = value.replace(thousands, "")
    return Decimal(value.replace(decimal, "."))


def csv_rows(content, config):
    try:
        text = content.decode(config.encoding)
        rows = []
        for row in csv.reader(
            io.StringIO(text, newline=""), delimiter=config.delimiter, strict=True
        ):
            if any(cell.strip() for cell in row):
                rows.append(row)
            if len(rows) > MAX_ROWS + int(config.has_header):
                raise HTTPException(422, "CSV must contain at most 2000 data rows")
    except (UnicodeError, csv.Error) as error:
        raise HTTPException(422, "Malformed CSV or wrong encoding/delimiter") from error
    rows = [row for row in rows if any(cell.strip() for cell in row)]
    if not rows or len(rows) > MAX_ROWS + int(config.has_header):
        raise HTTPException(422, "CSV must contain 1–2000 data rows")
    if any(len(row) > 100 or any(len(cell) > 2000 for cell in row) for row in rows):
        raise HTTPException(422, "CSV exceeds 100 columns or 2000 characters per field")
    headers = rows.pop(0) if config.has_header else [f"Column {i + 1}" for i in range(len(rows[0]))]
    if not rows:
        raise HTTPException(422, "CSV has no data rows")
    return headers, rows


def normalize(raw, currency, date_format, decimal=".", thousands="", mode="signed"):
    errors = []
    try:
        posted = datetime.strptime(raw.get("date", ""), date_format).date()
        if mode == "debit_credit":
            debit = amount(raw["debit"], decimal, thousands) if raw["debit"].strip() else Decimal(0)
            credit = (
                amount(raw["credit"], decimal, thousands) if raw["credit"].strip() else Decimal(0)
            )
            if debit < 0 or credit < 0 or bool(debit) == bool(credit):
                raise ValueError("Exactly one nonnegative debit/credit column must be nonzero")
            signed = credit - debit
        else:
            signed = amount(raw.get("amount", ""), decimal, thousands)
            if mode == "reversed":
                signed = -signed
            if mode == "type":
                kind = raw.get("type", "").upper()
                if kind not in {"CREDIT", "DEBIT", "INCOME", "EXPENSE", "C", "D"} or signed < 0:
                    raise ValueError(
                        "Type mode needs positive amounts and CREDIT/DEBIT, INCOME/EXPENSE or C/D"
                    )
                signed *= -1 if kind in {"DEBIT", "EXPENSE", "D"} else 1
        kind = raw.get("type", "").upper()
        description = raw.get("description", "")
        for field in ("amount", "debit", "credit"):
            for symbol, code in (("R$", "BRL"), ("US$", "USD"), ("€", "EUR"), ("£", "GBP")):
                if raw.get(field, "").strip().startswith(symbol) and code != (
                    raw.get("currency") or currency
                ):
                    raise ValueError("Currency symbol conflicts with the selected currency")
        ambiguous = bool(
            re.search(
                r"transfer|\bpix\b|\bted\b|\bdoc\b|payment|pagamento|fatura|refund|estorno|reembolso|invest|aplica[çc]|resgate",
                description,
                re.I,
            )
        ) or kind in {"XFER", "TRANSFER", "PAYMENT", "REFUND", "OTHER"}
        if kind and kind not in {
            "CREDIT",
            "DEBIT",
            "INCOME",
            "EXPENSE",
            "C",
            "D",
            "POS",
            "ATM",
            "CHECK",
            "FEE",
            "SRVCHG",
            "INT",
            "DEP",
            "DIRECTDEP",
            "DIRECTDEBIT",
            "REPEATPMT",
            "CASH",
            "XFER",
            "TRANSFER",
            "PAYMENT",
            "REFUND",
            "OTHER",
        }:
            raise ValueError("Unsupported transaction type; skip this row and review the source")
        result = Candidate(
            transaction_date=posted,
            description=description,
            amount=abs(signed),
            currency=raw.get("currency") or currency,
            transaction_type="INCOME" if signed > 0 else "EXPENSE",
            ambiguity=(
                "May be a transfer, payment, refund or contribution. "
                "Link an existing posting or explicitly confirm ordinary income/expense."
            )
            if ambiguous
            else None,
        )
        if result.currency != currency:
            raise ValueError(
                "Source currency differs from the selected account; conversion is unsupported"
            )
        if len(raw.get("external_id", "")) > 255:
            raise ValueError("External identifier exceeds 255 characters")
        return result.model_dump(mode="json"), errors
    except ValidationError as error:
        errors = [
            f"Invalid {'.'.join(map(str, e['loc']))}: {e['msg']}"
            for e in error.errors(include_input=False)
        ]
    except (ValueError, KeyError):
        errors = [
            "Invalid date, amount, currency, type or required field. "
            "Check the selected mapping and source values."
        ]
    return {}, errors


def parse_csv(content, config, currency):
    headers, rows = csv_rows(content, config)
    if max(config.columns.values()) >= len(headers):
        raise HTTPException(422, "A mapped column is outside this file")
    output = []
    for row in rows:
        raw = {
            field: row[index] if index < len(row) else "" for field, index in config.columns.items()
        }
        normalized, errors = normalize(
            raw,
            currency,
            config.date_format,
            config.decimal_separator,
            config.thousands_separator,
            config.amount_mode,
        )
        if len(row) != len(headers):
            errors.append("Row column count differs from the mapping")
        output.append((raw, normalized, errors))
    return output, {"namespace": config.source_namespace, "warnings": []}


def parse_ofx(content, currency):
    upper = content.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise HTTPException(422, "OFX document types and entities are not supported")
    try:
        tree = OFXTree()
        tree.parse(io.BytesIO(content))
        if tree.getroot().tag != "OFX" or not content.rstrip().endswith(b"</OFX>"):
            raise ValueError("Incomplete OFX document")
        # XML requires actual well-formed markup, not SGML's optional leaf endings.
        if content.lstrip().startswith(b"<?xml"):
            tree = ElementTree.ElementTree(ElementTree.fromstring(content))
    except Exception as error:
        raise HTTPException(
            422, "Malformed or unsupported OFX header/markup; export a bank or card statement"
        ) from error
    statements = tree.findall(".//STMTRS") + tree.findall(".//CCSTMTRS")
    if len(statements) != 1 or tree.find(".//INVSTMTRS") is not None:
        raise HTTPException(
            422,
            "Select a single bank or card statement; "
            "multiple accounts and investment statements are unsupported",
        )
    statement = statements[0]
    identifier = statement.findtext(".//ACCTID", "").strip()
    bank = statement.findtext(".//BANKID", "").strip()
    institution = tree.findtext(".//FI/ORG", "").strip()
    context = {
        "namespace": hashlib.sha256(
            f"{bank}|{institution}|{identifier}|{statement.tag}".encode()
        ).hexdigest()
        if identifier
        else "",
        "account_hint": "••••" + identifier[-4:] if identifier else "Not supplied",
        "institution": institution[:120],
        "card": statement.tag == "CCSTMTRS",
        "warnings": [
            "Confirm the masked statement account belongs to the selected local account. "
            "Local accounts do not store bank account numbers."
        ],
    }
    rows = statement.findall(".//STMTTRN")
    if any(n.text not in {"0", None} for n in tree.findall(".//STATUS/CODE")):
        raise HTTPException(422, "The OFX response contains an unsuccessful statement status")
    if not 1 <= len(rows) <= MAX_ROWS:
        raise HTTPException(422, "OFX must contain 1–2000 bank transaction rows")
    output = []
    for row in rows:
        raw = {
            field: row.findtext(tag, "").strip()
            for field, tag in {
                "date": "DTPOSTED",
                "amount": "TRNAMT",
                "external_id": "FITID",
                "name": "NAME",
                "memo": "MEMO",
                "type": "TRNTYPE",
            }.items()
        }
        raw["description"] = " · ".join(x for x in [raw["name"], raw["memo"]] if x)
        raw["currency"] = statement.findtext("CURDEF", "").strip()
        if any(len(value) > 2000 for value in raw.values()):
            raise HTTPException(422, "OFX field exceeds the supported length")
        converted = {**raw, "date": raw["date"][:8]}
        normalized, errors = normalize(converted, currency, "%Y%m%d")
        if not re.fullmatch(r"\d{8}(?:\d{6}(?:\.\d+)?(?:\[[^\]\r\n]{1,30}\])?)?", raw["date"]):
            errors.append("Invalid OFX posted date/timestamp")
        if not raw["currency"]:
            errors.append("OFX statement currency is required")
        if (
            row.find("CORRECTFITID") is not None
            or row.find("CURRENCY") is not None
            or row.find("ORIGCURRENCY") is not None
        ):
            errors.append("OFX corrections and currency conversions require manual handling")
        output.append((raw, normalized, errors))
    return output, context
