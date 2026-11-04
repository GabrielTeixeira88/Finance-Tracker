"""Explicit, bounded official-source verification; never writes a database/cache.

Invoke only from the setup CLI. Replay and normal API reads never call this.
Historical corrections require review; this verifier cannot overwrite the snapshot.
"""

import csv
import io
import json
from datetime import datetime
from urllib.request import Request, build_opener

from app.demo.real_market_snapshot import END, START, load_official
from app.historical_cdi import parse_sgs
from app.market_providers import NoRedirect

TREASURY_URL = (
    "https://www.tesourotransparente.gov.br/ckan/dataset/"
    "df56aa42-484a-4a59-8184-7676580c81e3/resource/"
    "796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv"
)


def download(url):
    request = Request(
        url, headers={"User-Agent": "FinanceTracker historical snapshot verification"}
    )
    with build_opener(NoRedirect()).open(request, timeout=30) as response:
        data = response.read(25_000_001)
    if len(data) > 25_000_000:
        raise ValueError("Official source exceeded the snapshot size budget")
    return data


def treasury_rows(payload):
    rows = []
    for row in csv.DictReader(io.StringIO(payload.decode("utf-8-sig")), delimiter=";"):
        if row["Tipo Titulo"] != "Tesouro Selic" or row["Data Vencimento"] != "01/03/2029":
            continue
        day = datetime.strptime(row["Data Base"], "%d/%m/%Y").date()
        if START <= day <= END:
            rows.append(
                {
                    "date": day.isoformat(),
                    **{
                        name: row[column].replace(",", ".")
                        for name, column in (
                            ("purchase", "PU Compra Manha"),
                            ("sale", "PU Venda Manha"),
                            ("base", "PU Base Manha"),
                        )
                    },
                }
            )
    return sorted(rows, key=lambda r: r["date"])


def verify(fetch=download):
    snapshot, _ = load_official()
    for series, name, annual in [(12, "cdi", False), (4389, "cdi_annual", True)]:
        url = (
            f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series}/dados?"
            "formato=json&dataInicial=01/10/2024&dataFinal=30/09/2026"
        )
        actual = parse_sgs(fetch(url), annual=annual)
        expected = parse_sgs(json.dumps(snapshot[name]).encode(), annual=annual)
        if actual != expected:
            raise ValueError(
                "Official CDI history differs; review corrections, keep the frozen replay"
            )
    if treasury_rows(fetch(TREASURY_URL)) != snapshot["treasury"]:
        raise ValueError(
            "Official Treasury history differs; review corrections, keep the frozen replay"
        )
    return True
