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
    args = parser.parse_args()
    normal = get_settings().resolved_database_path
    if args.prepare:
        store = DemoStore(DEFAULT_ROOT, normal).initialize()
        print("Fictional demo prepared; normal financial data untouched.")
        store.close()
    else:
        from app.demo.app import create_demo_app

        print(
            "Fictional local demo: http://127.0.0.1:8001 (build frontend first). "
            "No external integrations."
        )
        uvicorn.run(
            create_demo_app(normal), host="127.0.0.1", port=8001, workers=1, access_log=False
        )


if __name__ == "__main__":
    main()
