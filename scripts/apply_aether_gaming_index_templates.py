#!/usr/bin/env python3
"""
Apply Aether Games / gaming platform Elasticsearch index templates.

Installs:
  1. Ingest pipeline ``aether-gaming-default`` (optional attribute normalization)
  2. Component template ``aether-gaming-mappings``
  3. Index template ``aether-gaming`` → data streams
     ``aether-gaming-metrics-*``, ``metrics-aether.*``,
     ``aether-gaming-logs-*``, ``logs-aether.*``

Designed for custom ML plays (auth failure anomalies, anticheat spikes) where
you control the index/data-stream naming — complementary to OTel ``metrics-*``.

Usage:
  python3 scripts/apply_aether_gaming_index_templates.py
  python3 scripts/apply_aether_gaming_index_templates.py --dry-run

Env: ES_URL + ES_API_KEY (or ES_USERNAME + ES_PASSWORD)
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TDIR = os.path.join(ROOT, "assets", "elasticsearch", "templates")

ES_URL = (os.environ.get("ES_URL") or "").rstrip("/")
API_KEY = (
    os.environ.get("ES_API_KEY")
    or os.environ.get("KIBANA_API_KEY")
    or os.environ.get("ELASTICSEARCH_API_KEY")
    or ""
).strip()
ES_USER = os.environ.get("ES_USERNAME", "admin")
ES_PASS = os.environ.get("ES_PASSWORD", "")


def _auth() -> str:
    if API_KEY:
        return f"ApiKey {API_KEY}"
    if ES_PASS:
        return "Basic " + base64.b64encode(f"{ES_USER}:{ES_PASS}".encode()).decode()
    sys.exit("ERROR: set ES_API_KEY (or ES_USERNAME+ES_PASSWORD)")


HEADERS = {
    "Authorization": _auth(),
    "Content-Type": "application/json",
}


def http(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{ES_URL}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return (json.loads(raw) if raw else None), r.status
    except urllib.error.HTTPError as e:
        err = e.read().decode() if e.fp else ""
        return {"_http_error": e.code, "_body": err[:1500]}, e.code


def load_json(name: str) -> dict:
    path = os.path.join(TDIR, name)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not ES_URL:
        sys.exit("ERROR: ES_URL not set")

    pipeline = load_json("aether-gaming-default-pipeline.json")
    component = load_json("aether-gaming-component-template.json")
    index_tpl = load_json("aether-gaming-index-template.json")

    # Serverless: drop shard/replica knobs that self-managed templates often include.
    settings = (component.get("template") or {}).get("settings") or {}
    idx = settings.get("index") or settings
    for k in ("number_of_shards", "number_of_replicas"):
        if isinstance(idx, dict):
            idx.pop(k, None)

    print("==> Aether gaming index templates")
    print(f"    ES={ES_URL}")

    steps = [
        ("PUT", "/_ingest/pipeline/aether-gaming-default", pipeline, "ingest pipeline aether-gaming-default"),
        (
            "PUT",
            "/_component_template/aether-gaming-mappings",
            component,
            "component template aether-gaming-mappings",
        ),
        ("PUT", "/_index_template/aether-gaming", index_tpl, "index template aether-gaming"),
    ]

    if args.dry_run:
        for method, path, body, label in steps:
            print(f"  · dry-run {method} {path} ({label})")
            print(f"    keys={list(body.keys())}")
        return 0

    ok = True
    for method, path, body, label in steps:
        payload, code = http(method, path, body)
        if code in (200, 201):
            print(f"  ✓ {label}")
        else:
            ok = False
            print(f"  WARN: {label} HTTP {code}: {payload}", file=sys.stderr)

    # Smoke: create empty data stream (ignore if already exists / not allowed).
    for ds in ("aether-gaming-metrics-default", "aether-gaming-logs-default"):
        payload, code = http("PUT", f"/_data_stream/{ds}")
        if code in (200, 201):
            print(f"  ✓ data stream {ds}")
        elif code == 400 and "already exists" in str(payload).lower():
            print(f"  · data stream {ds} already exists")
        else:
            print(f"  · data stream {ds} skipped HTTP {code}")

    print("==> Done")
    print("    Patterns: aether-gaming-metrics-*, metrics-aether.*, aether-gaming-logs-*, logs-aether.*")
    print("    ML next: python3 scripts/create_aether_ml_anomaly_job.py --start")
    print("    Docs: docs/gaming-index-templates.md")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
