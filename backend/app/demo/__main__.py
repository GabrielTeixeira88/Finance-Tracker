"""Run `python -m app.demo`; never accepts a user-selected demo database path."""

import argparse

import uvicorn

from app.config import get_settings
from app.demo.runtime import DEFAULT_ROOT, DemoStore


def main():
    parser = argparse.ArgumentParser(description="Isolated fictional Finance Tracker demo")
    parser.add_argument(
        "--prepare", action="store_true", help="Initialize and validate without serving"
    )
    parser.add_argument(
        "--scenario",
        choices=[
            "unified",
            "real-market-br",
            "etf-showcase",
            "income-showcase",
            "income-portfolio",
        ],
        default="unified",
        help="Deprecated older names also open the complete unified demo",
    )
    args = parser.parse_args()
    # Preserve old launch commands without exposing separate, incomplete demos.
    args.scenario = "unified"
    normal = get_settings().resolved_database_path
    if args.prepare:
        from app.demo.real_market_snapshot import scenario_root
        from app.demo.unified import scenario_root as unified_root

        store = DemoStore(
            unified_root(DEFAULT_ROOT),
            normal,
            "unified",
            household_root=scenario_root(DEFAULT_ROOT),
        ).initialize()
        print("Fictional demo prepared; normal financial data untouched.")
        store.close()
    else:
        from app.demo.app import create_demo_app

        print(
            "Fictional local demo: http://127.0.0.1:8001 (build frontend first). "
            "No external integrations."
        )
        uvicorn.run(
            create_demo_app(normal, scenario=args.scenario),
            host="127.0.0.1",
            port=8001,
            workers=1,
            access_log=False,
        )


if __name__ == "__main__":
    main()
