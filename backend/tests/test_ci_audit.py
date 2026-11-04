"""Audit policy cannot mistake vulnerabilities or invalid reports for service outages."""

import importlib.util
import json
import subprocess
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "ci_audit", Path(__file__).resolve().parents[2] / "scripts/ci_audit.py"
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def test_npm_policy_blocks_high_and_critical_but_retains_lower_advisories():
    report = {"metadata": {"vulnerabilities": {"high": 0, "critical": 0, "total": 2}}}
    assert audit.classify("npm", report, 0) == "passed"
    report["metadata"]["vulnerabilities"]["high"] = 1
    assert audit.classify("npm", report, 1) == "vulnerable"
    assert audit.classify("npm", {"error": {"code": "EAUDIT"}}, 1) is None


def test_python_policy_blocks_any_advisory_and_rejects_skipped_packages():
    assert audit.classify("python", {"dependencies": [{"vulns": []}]}, 0) == "passed"
    assert (
        audit.classify("python", {"dependencies": [{"vulns": [{"id": "synthetic"}]}]}, 1)
        == "vulnerable"
    )
    assert audit.classify("python", {"dependencies": [{"skip_reason": "unknown"}]}, 0) is None
    assert audit.classify("python", {"dependencies": []}, 0) is None
    assert audit.classify("python", {}, 2) is None


def test_transient_outage_is_retried_and_reported_incomplete(tmp_path, monkeypatch):
    monkeypatch.setattr(audit, "REPORTS", tmp_path)
    monkeypatch.setattr(audit.time, "sleep", lambda _: None)
    calls = []

    def unavailable(*args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 1, '{"error":{"code":"503"}}', "")

    monkeypatch.setattr(audit.subprocess, "run", unavailable)
    assert audit.audit("npm", ["synthetic"], tmp_path) == "unavailable"
    assert len(calls) == 3


def test_configuration_error_is_not_downgraded_or_retried(tmp_path, monkeypatch):
    monkeypatch.setattr(audit, "REPORTS", tmp_path)
    (tmp_path / "npm-audit.json").write_text(
        json.dumps({"metadata": {"vulnerabilities": {"high": 0, "critical": 0, "total": 0}}})
    )
    monkeypatch.setattr(
        audit.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(a, 1, "", "bad option")
    )
    assert audit.audit("npm", ["synthetic"], tmp_path) == "error"
