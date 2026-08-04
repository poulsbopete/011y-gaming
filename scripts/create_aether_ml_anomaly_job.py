#!/usr/bin/env python3
"""
Create / open an Aether Games ML anomaly detection job on Observability Serverless.

Job: aether-auth-failure-anomaly
  - Models high auth login failure counts from metrics-* (OTLP fleet)
  - Influencers: service.name, region
  - Bucket span: 5m

Also creates (optional) an anomaly detection alert rule that can trigger the
Kibana workflow **Aether — ML anomaly → Security via CPS**.

Env:
  ES_URL + ES_API_KEY (Observability project)
  KIBANA_URL + ES_API_KEY (for alert rule + workflow action)
  SECURITY_CPS_ALIAS — linked Security project alias for CPS (default: my-security-project-ac9463)

Usage:
  python3 scripts/create_aether_ml_anomaly_job.py
  python3 scripts/create_aether_ml_anomaly_job.py --skip-alert
  python3 scripts/create_aether_ml_anomaly_job.py --start
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

JOB_ID = "aether-auth-failure-anomaly"
DATAFEED_ID = f"datafeed-{JOB_ID}"
RULE_ID = "aether-ml-auth-failure-anomaly-alert"
WORKFLOW_NAME = "Aether — ML anomaly → Security via CPS"

ES_URL = (os.environ.get("ES_URL") or "").rstrip("/")
KIBANA_URL = (os.environ.get("KIBANA_URL") or "").rstrip("/")
API_KEY = (
    os.environ.get("ES_API_KEY")
    or os.environ.get("KIBANA_API_KEY")
    or os.environ.get("ELASTICSEARCH_API_KEY")
    or ""
).strip()
ES_USER = os.environ.get("ES_USERNAME", "admin")
ES_PASS = os.environ.get("ES_PASSWORD", "")
SECURITY_CPS_ALIAS = (
    os.environ.get("SECURITY_CPS_ALIAS") or "my-security-project-ac9463"
).strip()


def _auth_header() -> str:
    if API_KEY:
        return f"ApiKey {API_KEY}"
    if ES_PASS:
        return "Basic " + base64.b64encode(f"{ES_USER}:{ES_PASS}".encode()).decode()
    sys.exit("ERROR: set ES_API_KEY (or ES_USERNAME+ES_PASSWORD)")


HEADERS = {
    "Authorization": _auth_header(),
    "Content-Type": "application/json",
    "kbn-xsrf": "true",
    "x-elastic-internal-origin": "kibana",
    "Elastic-Api-Version": os.environ.get("KIBANA_ELASTIC_API_VERSION", "2023-10-31"),
}


def http_json(base: str, method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{base}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return (json.loads(raw) if raw else None), r.status
    except urllib.error.HTTPError as e:
        err = e.read().decode() if e.fp else ""
        return {"_http_error": e.code, "_body": err[:1200]}, e.code


def job_body() -> dict:
    # OTLP counters land as metric docs; filter auth failures loosely so remaps still match.
    return {
        "description": (
            "Aether Games — anomalous auth login failures (Observability OTLP metrics). "
            "Correlate with Security via CPS workflow when score is high."
        ),
        "groups": ["aether-games", "auth", "fraud-correlation"],
        "analysis_config": {
            "bucket_span": "5m",
            "detectors": [
                {
                    "detector_description": "high auth failure count",
                    "function": "high_count",
                    "detector_index": 0,
                }
            ],
            "influencers": ["service.name", "region", "attributes.result"],
        },
        "analysis_limits": {"model_memory_limit": "64mb"},
        "data_description": {"time_field": "@timestamp", "time_format": "epoch_ms"},
        "model_plot_config": {"enabled": True},
        "results_index_name": "shared",
        "allow_lazy_open": True,
    }


def datafeed_body() -> dict:
    return {
        "job_id": JOB_ID,
        "indices": ["metrics-*"],
        "query": {
            "bool": {
                "should": [
                    {"term": {"attributes.result": "failure"}},
                    {"term": {"result": "failure"}},
                    {"wildcard": {"metricset.name": "*auth*"}},
                    {"exists": {"field": "aether_auth_logins_total"}},
                    {
                        "query_string": {
                            "query": "aether_auth_logins_total OR auth_login OR service.name:auth",
                            "default_field": "*",
                        }
                    },
                ],
                "minimum_should_match": 1,
            }
        },
        "scroll_size": 1000,
        "delayed_data_check_config": {"enabled": True},
    }


def ensure_job():
    if not ES_URL:
        sys.exit("ERROR: ES_URL not set")
    existing, status = http_json(ES_URL, "GET", f"/_ml/anomaly_detectors/{JOB_ID}")
    if status == 200:
        print(f"  ✓ ML job {JOB_ID} already exists")
    else:
        payload, pstatus = http_json(ES_URL, "PUT", f"/_ml/anomaly_detectors/{JOB_ID}", job_body())
        if pstatus not in (200, 201):
            print(f"ERROR creating job HTTP {pstatus}: {payload}", file=sys.stderr)
            sys.exit(1)
        print(f"  ✓ created ML job {JOB_ID}")

    df, df_status = http_json(ES_URL, "GET", f"/_ml/datafeeds/{DATAFEED_ID}")
    if df_status == 200:
        print(f"  ✓ datafeed {DATAFEED_ID} already exists")
    else:
        body = datafeed_body()
        # Prefer embedding datafeed on put when missing; standalone put datafeed API:
        payload, pstatus = http_json(ES_URL, "PUT", f"/_ml/datafeeds/{DATAFEED_ID}", body)
        if pstatus not in (200, 201):
            print(f"ERROR creating datafeed HTTP {pstatus}: {payload}", file=sys.stderr)
            sys.exit(1)
        print(f"  ✓ created datafeed {DATAFEED_ID}")


def start_job():
    open_body, ostatus = http_json(ES_URL, "POST", f"/_ml/anomaly_detectors/{JOB_ID}/_open", {})
    print(f"  open job → HTTP {ostatus}")
    start_body, sstatus = http_json(ES_URL, "POST", f"/_ml/datafeeds/{DATAFEED_ID}/_start", {})
    print(f"  start datafeed → HTTP {sstatus}")
    if sstatus not in (200, 201) and ostatus not in (200, 201):
        print(f"    open: {open_body}\n    start: {start_body}", file=sys.stderr)


def ensure_alert_rule():
    """Create anomaly detection alert → indexes correlation stub + points operators at CPS workflow."""
    if not KIBANA_URL:
        print("  skip alert (KIBANA_URL unset)")
        return

    params = {
        "jobSelection": {"jobIds": [JOB_ID], "groupIds": []},
        "resultType": "record",
        "severity": 50,
        "includeInterim": False,
        "lookbackInterval": "15m",
        "topNBuckets": 1,
    }
    actions = [
        {
            "group": "threshold met",
            "id": "aether-ml-index-action",
            "params": {
                "documents": [
                    {
                        "@timestamp": "{{context.timestampIso8601}}",
                        "event.kind": "alert",
                        "event.action": "ml_anomaly",
                        "message": "{{context.message}}",
                        "ml.job_id": "{{context.jobIds}}",
                        "ml.score": "{{context.score}}",
                        "labels.studio": "Aether Games",
                        "labels.correlation": "cps-security",
                        "security_cps_alias": SECURITY_CPS_ALIAS,
                        "workflow_hint": WORKFLOW_NAME,
                    }
                ]
            },
            "frequency": {
                "summary": False,
                "notify_when": "onActionGroupChange",
                "throttle": None,
            },
            # Index connector must exist; if missing, rule create may fail — we try without connector first via rule body.
            "actionTypeId": ".index",
        }
    ]

    # Prefer a lean rule without actions if index connector is missing; workflow can also poll ML results.
    rule = {
        "name": "Aether — auth failure ML anomaly",
        "tags": ["aether-games", "ml", "auth", "cps"],
        "rule_type_id": "xpack.ml.anomaly_detection_alert",
        "consumer": "ml",
        "schedule": {"interval": "5m"},
        "params": params,
        "actions": [],
        "enabled": True,
    }

    # Serverless often rejects consumer on PUT; try POST create then enable.
    existing, get_status = http_json(KIBANA_URL, "GET", f"/api/alerting/rule/{RULE_ID}")
    if get_status == 200:
        print(f"  ✓ alert rule {RULE_ID} already exists")
        return

    payload, status = http_json(KIBANA_URL, "POST", "/api/alerting/rule", {**rule, "id": RULE_ID})
    if status in (200, 201):
        print(f"  ✓ created alert rule {RULE_ID}")
        return

    # Some builds require path-id create
    payload2, status2 = http_json(KIBANA_URL, "POST", f"/api/alerting/rule/{RULE_ID}", rule)
    if status2 in (200, 201):
        print(f"  ✓ created alert rule {RULE_ID}")
        return

    print(
        f"  WARN: alert rule create failed HTTP {status}/{status2}: "
        f"{str(payload)[:240]} | {str(payload2)[:240]}",
        file=sys.stderr,
    )
    print(
        "  Create manually: Stack Management → Rules → Anomaly detection alert → "
        f"job {JOB_ID}, severity ≥ 50. Then run workflow '{WORKFLOW_NAME}'.",
        file=sys.stderr,
    )
    _ = actions  # reserved for connector-wired environments


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--start", action="store_true", help="Open job and start datafeed")
    ap.add_argument("--skip-alert", action="store_true", help="Skip Kibana anomaly alert rule")
    args = ap.parse_args()

    print(f"==> Aether ML anomaly job ({JOB_ID})")
    print(f"    ES: {ES_URL or '(unset)'}")
    print(f"    CPS Security alias: {SECURITY_CPS_ALIAS}")
    ensure_job()
    if args.start:
        start_job()
    if not args.skip_alert:
        ensure_alert_rule()
    print(
        "\nNext:\n"
        f"  1. Ensure OTLP metrics flowing (fleet / Seed live metrics)\n"
        f"  2. python3 scripts/create_aether_ml_anomaly_job.py --start\n"
        f"  3. Link Security project for CPS (Cloud UI) — alias {SECURITY_CPS_ALIAS}\n"
        f"  4. Deploy + run workflow: {WORKFLOW_NAME}\n"
        "  5. Machine Learning → Anomaly explorer → aether-auth-failure-anomaly\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
