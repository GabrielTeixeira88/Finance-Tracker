"""Audit locked production dependencies; service outages are visible, never clean results."""

import json
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / ".tmp" / "ci"
TRANSIENT = (
    "econnreset",
    "econnrefused",
    "etimedout",
    "eai_again",
    "enotfound",
    "connectionerror",
    "connection error",
    "connection reset",
    "connection refused",
    "connecttimeout",
    "readtimeout",
    "timed out",
    "temporary failure in name resolution",
    "503 service unavailable",
    "502 bad gateway",
    "504 gateway",
    "429 too many requests",
    "max retries exceeded",
)


def classify(kind, report, code):
    """A missing/malformed/incomplete report is not a successful audit."""
    if code not in (0, 1) or not isinstance(report, dict):
        return None
    if kind == "npm":
        if "error" in report:
            return None
        counts = report.get("metadata", {}).get("vulnerabilities", {})
        if not all(isinstance(counts.get(key), int) for key in ("high", "critical", "total")):
            return None
        return "vulnerable" if counts["high"] + counts["critical"] else "passed"
    deps = report.get("dependencies")
    if not isinstance(deps, list) or not deps:
        return None
    if not all(isinstance(dep.get("vulns"), list) for dep in deps):
        return None
    return "vulnerable" if any(dep["vulns"] for dep in deps) else "passed"


def audit(kind, command, cwd):
    target = REPORTS / f"{kind}-audit.json"
    for attempt in range(3):
        # Never mistake a previous invocation's report for a completed audit.
        target.unlink(missing_ok=True)
        try:
            result = subprocess.run(
                command, cwd=cwd, capture_output=True, text=True, timeout=150, check=False
            )
            if kind == "npm":
                target.write_text(result.stdout, encoding="utf-8")
            try:
                report = json.loads(target.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                report = None
            status = classify(kind, report, result.returncode)
            if status:
                return status
            diagnostic = (result.stdout + result.stderr).lower()
            transient = any(marker in diagnostic for marker in TRANSIENT)
            if isinstance(report, dict):
                transient |= str(report.get("error", {}).get("code")) in {
                    "429",
                    "502",
                    "503",
                    "504",
                }
            if not transient:
                print(
                    f"::error::{kind} audit produced no valid complete report. "
                    "Inspect the report/tool configuration."
                )
                return "error"
        except subprocess.TimeoutExpired:
            transient = True
        if attempt < 2:
            time.sleep(5 * (attempt + 1))
    print(
        f"::warning::{kind} advisory service unavailable after three attempts; "
        "audit INCOMPLETE, rerun before release."
    )
    return "unavailable"


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    commands = {
        "npm": (
            [
                "npm.cmd" if os.name == "nt" else "npm",
                "audit",
                "--omit=dev",
                "--audit-level=high",
                "--json",
            ],
            ROOT / "frontend",
        ),
        "python": (
            [
                "uv",
                "tool",
                "run",
                "--from",
                "pip-audit==2.10.1",
                "pip-audit",
                "--requirement",
                str(REPORTS / "python-requirements.txt"),
                "--no-deps",
                "--disable-pip",
                "--require-hashes",
                "--format=json",
                "--progress-spinner=off",
                "--timeout=20",
                "--output",
                str(REPORTS / "python-audit.json"),
            ],
            ROOT,
        ),
    }
    results = {kind: audit(kind, *args) for kind, args in commands.items()}
    (REPORTS / "audit-summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    lines = ["## Production dependency audits", ""]
    for kind, status in results.items():
        lines.append(f"- {kind}: **{status}**")
        print(f"{kind}: {status}")
        if status == "vulnerable":
            print(
                f"::error::{kind} dependencies violate the vulnerability policy; "
                "review the audit artifact."
            )
    lines.append(
        "\nUnavailable means incomplete, not clean. Rerun before release. No automatic fixes."
    )
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(summary).open("a", encoding="utf-8") as stream:
            stream.write("\n".join(lines) + "\n")
    return int(any(status in {"vulnerable", "error"} for status in results.values()))


if __name__ == "__main__":
    raise SystemExit(main())
