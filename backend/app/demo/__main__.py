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
    parser.add_argument("--scenario", choices=["real-market-br"], default="real-market-br")
    args = parser.parse_args()
    normal = get_settings().resolved_database_path
    if args.prepare:
        from app.demo.real_market_snapshot import scenario_root

        root = scenario_root(DEFAULT_ROOT) if args.scenario == "real-market-br" else DEFAULT_ROOT
        store = DemoStore(root, normal, args.scenario).initialize()
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
