"""Install a private, authorized raw ETF export without touching any database.

Usage: python -m app.demo.prepare_real_market --etf-export <local-json-file>
See docs/REAL_MARKET_DEMO.md for the intentionally explicit evidence contract.
"""

import argparse
import os
from pathlib import Path
from uuid import uuid4

from app.demo.real_market_snapshot import LOCAL_ETF, load_etfs, load_official


def install_export(path: Path):
    load_etfs(path)
    raw = path.read_bytes()
    for parent in [LOCAL_ETF, *LOCAL_ETF.parents]:
        if parent.is_symlink() or parent.is_junction():
            raise ValueError("Snapshot storage cannot use links or junctions")
    LOCAL_ETF.parent.mkdir(parents=True, exist_ok=True)
    # No overwrites: different snapshots must be explicitly archived by the owner.
    # This command never accepts a database path or changes an existing demo.
    if LOCAL_ETF.exists():
        if LOCAL_ETF.read_bytes() != raw:
            raise ValueError(
                "A different ETF snapshot exists. Archive it locally before installing another"
            )
        return False
    staging = LOCAL_ETF.with_name(f"prepare-{uuid4().hex}.json")
    try:
        with staging.open("xb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        # Windows rename refuses a concurrent destination. On other platforms
        # hard-link publication has the same no-clobber property.
        if os.name == "nt":
            staging.rename(LOCAL_ETF)
        else:
            os.link(staging, LOCAL_ETF)
    finally:
        staging.unlink(missing_ok=True)
    return True


def main():
    parser = argparse.ArgumentParser(description="Prepare the optional private ETF replay snapshot")
    parser.add_argument("--etf-export", type=Path)
    parser.add_argument(
        "--verify-official",
        action="store_true",
        help="Explicit network verification; never updates the frozen replay",
    )
    args = parser.parse_args()
    official, _ = load_official()
    if args.verify_official:
        from app.demo.verify_real_market import verify

        verify()
        print("Downloaded official history matches the frozen observations.")
    if args.etf_export:
        install_export(args.etf_export)
    etfs = load_etfs()
    print("Official CDI and Tesouro Selic snapshot validated through", official["end"])
    print(
        "ETF history:",
        "authorized local snapshot prepared" if etfs else "unavailable; fixed-income-only scenario",
    )
    print("No user database or existing demo was changed.")


if __name__ == "__main__":
    main()
