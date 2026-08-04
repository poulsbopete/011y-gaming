#!/usr/bin/env python3
"""
Deploy Kibana Workflow YAML from workflows/ (Agent Builder recommendations, etc.).

Usage:
  python3 scripts/deploy_workshop_workflows.py
  python3 scripts/deploy_workshop_workflows.py metrics-adoption-recommendations.yaml

Env: KIBANA_URL + ES_API_KEY or KIBANA_API_KEY (or ES_USERNAME + ES_PASSWORD)
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request

KIBANA_URL = os.environ.get("KIBANA_URL", "").rstrip("/")
API_KEY = os.environ.get("ES_API_KEY", "") or os.environ.get("KIBANA_API_KEY", "")
ES_USER = os.environ.get("ES_USERNAME", "admin")
ES_PASS = os.environ.get("ES_PASSWORD", "")

if not KIBANA_URL:
    sys.exit("ERROR: KIBANA_URL not set")
if not API_KEY and not ES_PASS:
    sys.exit("ERROR: ES_API_KEY or ES_PASSWORD not set")

HEADERS = {
    "Authorization": (
        f"ApiKey {API_KEY}"
        if API_KEY
        else "Basic " + base64.b64encode(f"{ES_USER}:{ES_PASS}".encode()).decode()
    ),
    "kbn-xsrf": "true",
    "x-elastic-internal-origin": "kibana",
    "Content-Type": "application/json",
    # Required for public Workflows REST APIs on Serverless / recent Kibana.
    "Elastic-Api-Version": os.environ.get("KIBANA_ELASTIC_API_VERSION", "2023-10-31"),
}

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKFLOWS_DIR = os.path.join(ROOT, "workflows")
DEFAULT_FILES = (
    "metrics-adoption-recommendations.yaml",
    "aether-dashboard-briefs.yaml",
    "aether-ml-anomaly-cps-security.yaml",
)


def _http_json(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{KIBANA_URL}{path}", data=data, headers=HEADERS, method=method
    )
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            if not raw:
                return None, r.status
            return json.loads(raw), r.status
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        return {"_http_error": e.code, "_body": err_body}, e.code


def _workflow_items(payload):
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("data", "workflows", "items", "results", "saved_objects"):
        block = payload.get(key)
        if isinstance(block, list):
            return block
    return []


def list_workflows():
    payload, status = _http_json("GET", "/api/workflows")
    if isinstance(payload, dict) and payload.get("_http_error"):
        return []
    return _workflow_items(payload)


def _parse_workflow_name_from_yaml(yaml_content: str):
    for line in yaml_content.splitlines():
        s = line.strip()
        if s.startswith("name:"):
            val = s[5:].strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                return val[1:-1]
            return val
    return None


def _find_workflow_id_by_name(workflow_name: str):
    if not workflow_name:
        return None
    for w in list_workflows():
        if not isinstance(w, dict):
            continue
        if (w.get("name") or "").strip() == workflow_name.strip():
            return w.get("id")
    return None


def enable_workflows_ui() -> None:
    """Best-effort: enable workflows:ui via saved_objects config (Serverless)."""
    status_payload, _ = _http_json("GET", "/api/status")
    version = "9.4.0"
    if isinstance(status_payload, dict):
        version = (status_payload.get("version") or {}).get("number") or version
    payload, code = _http_json(
        "PUT",
        f"/api/saved_objects/config/{version}",
        {"attributes": {"workflows:ui:enabled": True}},
    )
    if code in (200, 201):
        print(f"  ✓ workflows:ui:enabled (config {version})")
    else:
        print(f"  · workflows:ui setting HTTP {code} (may already be on): {str(payload)[:160]}")


def deploy_workflow(filename: str):
    yaml_path = os.path.join(WORKFLOWS_DIR, filename)
    if not os.path.exists(yaml_path):
        print(f"  WARN: {filename} not found, skipping")
        return None
    yaml_content = open(yaml_path, encoding="utf-8").read()
    wname = _parse_workflow_name_from_yaml(yaml_content)
    existing_id = _find_workflow_id_by_name(wname) if wname else None
    if existing_id:
        entry = {"id": existing_id, "yaml": yaml_content}
        action = "update"
    else:
        entry = {"yaml": yaml_content}
        action = "create"

    # Prefer bulk create (dbmonitoring / older Serverless), then single-create endpoint.
    result, status = _http_json("POST", "/api/workflows", {"workflows": [entry]})
    if status not in (200, 201) or not isinstance(result, dict) or result.get("_http_error"):
        print(
            f"  · bulk POST /api/workflows → HTTP {status}: {str(result)[:240]}; "
            "trying POST /api/workflows/workflow ..."
        )
        single_body = {"yaml": yaml_content}
        if existing_id:
            single_body["id"] = existing_id
        result, status = _http_json("POST", "/api/workflows/workflow", single_body)
        if status in (200, 201) and isinstance(result, dict) and not result.get("_http_error"):
            wid = result.get("id") or existing_id
            print(f"  ✓ {filename}: {action} via /api/workflows/workflow (id={wid})")
            if wid:
                print(f"    {KIBANA_URL}/app/management/insightsAndAlerting/workflows/{wid}")
            return wid
        print(f"  WARN: {filename} deploy failed HTTP {status}: {str(result)[:500]}")
        return None

    failed = result.get("failed") or []
    if failed:
        print(f"  WARN: {filename}: API failure: {failed[0]!s}"[:400])
        return None
    created = result.get("created") or []
    updated = result.get("updated") or []
    row = (created[0] if created else None) or (updated[0] if updated else None)
    if row and row.get("id"):
        wid = row["id"]
        print(f"  ✓ {filename}: {action} {row.get('name', '?')} (id={wid})")
        print(f"    {KIBANA_URL}/app/management/insightsAndAlerting/workflows/{wid}")
        return wid
    if existing_id:
        print(f"  ✓ {filename}: {action} (id={existing_id})")
        return existing_id
    # Some builds return the workflow object directly (not wrapped in created/updated).
    if result.get("id"):
        wid = result["id"]
        print(f"  ✓ {filename}: {action} (id={wid})")
        print(f"    {KIBANA_URL}/app/management/insightsAndAlerting/workflows/{wid}")
        return wid
    print(f"  WARN: {filename}: unexpected response keys={list(result.keys())} body={str(result)[:300]}")
    return None


def main() -> int:
    files = sys.argv[1:] or list(DEFAULT_FILES)
    print("==> Deploy workshop Kibana workflows")
    enable_workflows_ui()
    ok = True
    for f in files:
        if deploy_workflow(f) is None:
            ok = False
    print("==> Done. Manual run: Management → Workflows →")
    print("    • Metrics adoption — AI dashboard notes")
    print("    • Aether — dashboard briefs (Agent Builder)")
    print("    • Aether — ML anomaly → Security via CPS")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
