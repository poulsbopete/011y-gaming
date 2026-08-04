#!/usr/bin/env python3
"""
Seed canned Loki LogQL stub logs into Observability ES and create Kibana dashboards.

Mirrors the lines in workflows/aether-loki-a2a-stub.yaml so POV demos can show
"Loki log information" in Kibana without a live Loki.

Usage:
  python3 scripts/seed_loki_stub_dashboards.py

Env: ES_URL + ES_API_KEY (or KIBANA_API_KEY), KIBANA_URL
"""
from __future__ import annotations

import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

ES_URL = os.environ.get("ES_URL", "").rstrip("/")
KIBANA_URL = os.environ.get("KIBANA_URL", "").rstrip("/")
API_KEY = os.environ.get("ES_API_KEY", "") or os.environ.get("KIBANA_API_KEY", "")

INDEX = "aether-loki-stub-logs"
DASH_AUTH_ID = "aether-loki-stub-auth-logs"
DASH_LAUNCH_ID = "aether-loki-stub-launch-window"

if not ES_URL or not KIBANA_URL:
    sys.exit("ERROR: ES_URL and KIBANA_URL required")
if not API_KEY:
    sys.exit("ERROR: ES_API_KEY or KIBANA_API_KEY required")

AUTH = {
    "Authorization": f"ApiKey {API_KEY}",
    "Content-Type": "application/json",
    "kbn-xsrf": "true",
    "x-elastic-internal-origin": "kibana",
}
API_HEADERS = {"Elastic-Api-Version": "2023-10-31"}


def http(method: str, url: str, body=None, extra_headers=None):
    headers = dict(AUTH)
    if extra_headers:
        headers.update(extra_headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return (json.loads(raw) if raw else None), r.status
    except urllib.error.HTTPError as e:
        err = e.read().decode() if e.fp else ""
        return {"_http_error": e.code, "_body": err}, e.code


# --- Stub corpus (same entities as aether-loki-a2a-stub.yaml) ---
USERS = [
    "aether-user-88421",
    "aether-user-99102",
    "aether-user-12044",
    "aether-user-55110",
    "aether-user-77301",
]
AUTH_IP = "203.0.113.44"
GW_IP = "198.51.100.17"
REASONS = ["bad_password", "bad_password", "bad_password", "mfa_timeout", "account_locked"]


def build_docs(n: int = 90) -> list[dict]:
    now = datetime.now(timezone.utc)
    docs = []
    # Always include the five canned stub lines first (near "now")
    canned = [
        {
            "offset_m": 2,
            "service.name": "auth",
            "event.action": "login_failed",
            "source.ip": AUTH_IP,
            "user.name": "aether-user-88421",
            "event.reason": "bad_password",
            "message": f"{AUTH_IP} auth login_failed user=aether-user-88421 region=us-west reason=bad_password",
        },
        {
            "offset_m": 3,
            "service.name": "auth",
            "event.action": "login_failed",
            "source.ip": AUTH_IP,
            "user.name": "aether-user-99102",
            "event.reason": "bad_password",
            "message": f"{AUTH_IP} auth login_failed user=aether-user-99102 region=us-west reason=bad_password",
        },
        {
            "offset_m": 4,
            "service.name": "auth",
            "event.action": "login_failed",
            "source.ip": AUTH_IP,
            "user.name": "aether-user-12044",
            "event.reason": "mfa_timeout",
            "message": f"{AUTH_IP} auth login_failed user=aether-user-12044 region=us-west reason=mfa_timeout",
        },
        {
            "offset_m": 5,
            "service.name": "gateway",
            "event.action": "rate_limit_exceeded",
            "source.ip": GW_IP,
            "user.name": None,
            "event.reason": "rate_limit",
            "http.route": "/v1/login",
            "message": f"{GW_IP} gateway rate_limit_exceeded route=/v1/login studio=aether",
        },
        {
            "offset_m": 6,
            "service.name": "anticheat",
            "event.action": "anticheat_signal",
            "source.ip": AUTH_IP,
            "user.name": "aether-user-88421",
            "event.reason": "high_severity",
            "event.severity": "high",
            "device.id": "fp-9c2a",
            "message": "anticheat signal severity=high player=aether-user-88421 device=fp-9c2a",
        },
    ]
    for c in canned:
        ts = now - timedelta(minutes=c["offset_m"])
        docs.append(_doc(ts, c))

    rng = random.Random(42)
    for i in range(n - len(canned)):
        kind = rng.choices(["auth", "gateway", "anticheat"], weights=[0.7, 0.2, 0.1])[0]
        ts = now - timedelta(minutes=rng.randint(7, 360))
        if kind == "auth":
            user = rng.choice(USERS)
            reason = rng.choice(REASONS)
            docs.append(
                _doc(
                    ts,
                    {
                        "service.name": "auth",
                        "event.action": "login_failed",
                        "source.ip": AUTH_IP if rng.random() < 0.75 else f"203.0.113.{rng.randint(40, 80)}",
                        "user.name": user,
                        "event.reason": reason,
                        "message": f"auth login_failed user={user} region=us-west reason={reason}",
                    },
                )
            )
        elif kind == "gateway":
            docs.append(
                _doc(
                    ts,
                    {
                        "service.name": "gateway",
                        "event.action": "rate_limit_exceeded",
                        "source.ip": GW_IP,
                        "event.reason": "rate_limit",
                        "http.route": "/v1/login",
                        "message": f"{GW_IP} gateway rate_limit_exceeded route=/v1/login studio=aether",
                    },
                )
            )
        else:
            user = rng.choice(USERS[:3])
            sev = rng.choice(["high", "medium", "high"])
            docs.append(
                _doc(
                    ts,
                    {
                        "service.name": "anticheat",
                        "event.action": "anticheat_signal",
                        "source.ip": AUTH_IP,
                        "user.name": user,
                        "event.reason": f"{sev}_severity",
                        "event.severity": sev,
                        "device.id": "fp-9c2a",
                        "message": f"anticheat signal severity={sev} player={user} device=fp-9c2a",
                    },
                )
            )
    return docs


def _doc(ts: datetime, fields: dict) -> dict:
    d = {
        "@timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_stream": {
            "type": "logs",
            "dataset": "aether.loki_stub",
            "namespace": "default",
        },
        "labels": {
            "studio": "aether",
            "source": "loki_a2a_stub",
            "region": "us-west",
            "logql": '{service_name="auth", studio="aether"} |= "login_failed"',
        },
        "log": {"level": "warn" if fields.get("event.action") != "anticheat_signal" else "error"},
        "event": {
            "dataset": "aether.loki_stub",
            "module": "loki_stub",
            "action": fields.get("event.action"),
            "reason": fields.get("event.reason"),
            "severity": fields.get("event.severity") or "medium",
        },
        "service": {"name": fields.get("service.name"), "environment": "prod"},
        "source": {"ip": fields.get("source.ip")},
        "message": fields["message"],
        "observer": {"vendor": "Grafana Loki", "type": "a2a_stub"},
    }
    if fields.get("user.name"):
        d["user"] = {"name": fields["user.name"]}
    if fields.get("http.route"):
        d["url"] = {"path": fields["http.route"]}
    if fields.get("device.id"):
        d["device"] = {"id": fields["device.id"]}
    return d


def seed_docs(docs: list[dict]) -> None:
    # Regular index (not logs-* data stream) so demos can overwrite by id.
    http(
        "PUT",
        f"{ES_URL}/{INDEX}",
        {
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "message": {"type": "match_only_text"},
                    "labels": {
                        "properties": {
                            "studio": {"type": "keyword"},
                            "source": {"type": "keyword"},
                            "region": {"type": "keyword"},
                            "logql": {"type": "keyword"},
                        }
                    },
                    "event": {
                        "properties": {
                            "action": {"type": "keyword"},
                            "reason": {"type": "keyword"},
                            "severity": {"type": "keyword"},
                            "dataset": {"type": "keyword"},
                            "module": {"type": "keyword"},
                        }
                    },
                    "service": {
                        "properties": {
                            "name": {"type": "keyword"},
                            "environment": {"type": "keyword"},
                        }
                    },
                    "source": {"properties": {"ip": {"type": "ip"}}},
                    "user": {"properties": {"name": {"type": "keyword"}}},
                    "device": {"properties": {"id": {"type": "keyword"}}},
                    "url": {"properties": {"path": {"type": "keyword"}}},
                    "log": {"properties": {"level": {"type": "keyword"}}},
                    "observer": {
                        "properties": {
                            "vendor": {"type": "keyword"},
                            "type": {"type": "keyword"},
                        }
                    },
                }
            }
        },
    )
    http(
        "POST",
        f"{ES_URL}/{INDEX}/_delete_by_query?conflicts=proceed",
        {"query": {"term": {"labels.source": "loki_a2a_stub"}}},
    )
    lines = []
    for i, doc in enumerate(docs):
        lines.append(json.dumps({"index": {"_index": INDEX, "_id": f"loki-stub-{i}"}}))
        lines.append(json.dumps(doc))
    bulk = ("\n".join(lines) + "\n").encode()
    req = urllib.request.Request(
        f"{ES_URL}/_bulk?refresh=true",
        data=bulk,
        headers={**AUTH, "Content-Type": "application/x-ndjson"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        result = json.loads(r.read())
    if result.get("errors"):
        first = next((x for x in result.get("items", []) if x.get("index", {}).get("error")), None)
        print(f"  WARN: bulk had errors: {first}")
    else:
        print(f"  ✓ indexed {len(docs)} docs → {INDEX}")



def _md(content: str, *, y: int, h: int = 5, title: str = " ") -> dict:
    return {
        "type": "markdown",
        "grid": {"x": 0, "y": y, "w": 48, "h": h},
        "config": {"content": content, "title": title},
    }


def _metric(title: str, query: str, col: str, *, x: int, y: int, w: int = 12, h: int = 7) -> dict:
    return {
        "type": "vis",
        "grid": {"x": x, "y": y, "w": w, "h": h},
        "config": {
            "title": title,
            "type": "metric",
            "data_source": {"type": "esql", "query": query},
            "metrics": [{"type": "primary", "column": col}],
        },
    }


def _gauge(title: str, query: str, col: str, *, x: int, y: int, w: int = 12, h: int = 8) -> dict:
    return {
        "type": "vis",
        "grid": {"x": x, "y": y, "w": w, "h": h},
        "config": {
            "title": title,
            "type": "gauge",
            "data_source": {"type": "esql", "query": query},
            "metric": {"column": col},
        },
    }


def _xy(
    title: str,
    query: str,
    *,
    x_col: str,
    y_col: str,
    layer: str = "bar",
    breakdown: str | None = None,
    x: int,
    y: int,
    w: int = 24,
    h: int = 12,
) -> dict:
    layer_cfg: dict = {
        "type": layer,
        "data_source": {"type": "esql", "query": query},
        "x": {"column": x_col},
        "y": [{"column": y_col}],
    }
    if breakdown:
        layer_cfg["breakdown_by"] = {"column": breakdown}
    return {
        "type": "vis",
        "grid": {"x": x, "y": y, "w": w, "h": h},
        "config": {"title": title, "type": "xy", "layers": [layer_cfg]},
    }


def _log_detail(title: str, esql: str, *, y: int, h: int = 16) -> dict:
    """ES|QL field-stats log detail (Serverless Dashboards API)."""
    return {
        "type": "field_stats_table",
        "grid": {"x": 0, "y": y, "w": 48, "h": h},
        "config": {
            "title": title,
            "view_type": "esql",
            "query": {"esql": esql},
            "show_distributions": True,
        },
    }


def fetch_recent_log_lines(limit: int = 12) -> list[str]:
    q = (
        f'FROM {INDEX} | WHERE labels.source == "loki_a2a_stub" AND event.action == "login_failed" '
        f"| SORT @timestamp DESC | KEEP @timestamp, source.ip, user.name, event.reason, message | LIMIT {limit}"
    )
    payload, code = http("POST", f"{ES_URL}/_query", {"query": q})
    if code != 200 or not isinstance(payload, dict):
        return []
    cols = [c.get("name") for c in (payload.get("columns") or [])]
    lines = []
    for row in payload.get("values") or []:
        d = dict(zip(cols, row))
        ts = str(d.get("@timestamp") or "")[:19]
        lines.append(
            f"{ts}  {d.get('source.ip', '—')}  user={d.get('user.name', '—')}  "
            f"reason={d.get('event.reason', '—')}  | {d.get('message', '')}"
        )
    return lines


def ensure_data_view() -> None:
    payload, code = http(
        "POST",
        f"{KIBANA_URL}/api/data_views/data_view",
        {
            "data_view": {
                "id": INDEX,
                "title": INDEX,
                "name": "Aether Loki stub logs",
                "timeFieldName": "@timestamp",
            },
            "override": True,
        },
        extra_headers=API_HEADERS,
    )
    if code in (200, 201):
        print(f"  ✓ data view {INDEX}")
    else:
        print(f"  · data view HTTP {code}: {str(payload)[:160]}")


def create_dashboard(dash_id: str, title: str, description: str, panels: list) -> None:
    body = {"title": title[:255], "description": description, "panels": panels}
    payload, code = http(
        "PUT",
        f"{KIBANA_URL}/api/dashboards/{dash_id}",
        body,
        extra_headers=API_HEADERS,
    )
    if code not in (200, 201):
        payload, code = http(
            "POST",
            f"{KIBANA_URL}/api/dashboards",
            body,
            extra_headers=API_HEADERS,
        )
    if code in (200, 201):
        wid = (payload or {}).get("id") or dash_id
        print(f"  ✓ dashboard {title}")
        print(f"    {KIBANA_URL}/app/dashboards#/view/{wid}")
        return
    print(f"  WARN: dashboard {dash_id} failed HTTP {code}: {str(payload)[:500]}")


def dashboards() -> None:
    ensure_data_view()
    idx = INDEX
    src = 'labels.source == "loki_a2a_stub"'
    auth = f'{src} AND event.action == "login_failed"'
    recent = fetch_recent_log_lines(14)
    recent_block = "\n".join(recent) if recent else "(no rows — re-run seed)"

    intro_auth = f"""# Loki → Kibana · auth login failures

**A2A coexistence stub** — LogQL-shaped hits from `aether-loki-a2a-stub`, indexed so analysts stay in Kibana.

`{{service_name="auth", studio="aether"}} |= "login_failed"` → **`{idx}`**
"""

    stream_auth = f"""## Live log stream (seeded)

```
{recent_block}
```

Hot entities: `203.0.113.44` · `aether-user-88421` · reasons `bad_password` / `mfa_timeout`
"""

    create_dashboard(
        DASH_AUTH_ID,
        "Aether — Loki stub · Auth login failures",
        "Loki-shaped auth login_failed logs with metrics, timeline, and log detail (A2A stub)",
        [
            _md(intro_auth, y=0, h=5, title="Overview"),
            _metric(
                "Login failures",
                f"FROM {idx} | WHERE {auth} | STATS failures = COUNT(*)",
                "failures",
                x=0, y=5, w=9,
            ),
            _metric(
                "Distinct users",
                f"FROM {idx} | WHERE {auth} | STATS users = COUNT_DISTINCT(user.name)",
                "users",
                x=9, y=5, w=9,
            ),
            _metric(
                "Attacker IP hits",
                f'FROM {idx} | WHERE {src} AND source.ip == "203.0.113.44" | STATS hits = COUNT(*)',
                "hits",
                x=18, y=5, w=9,
            ),
            _metric(
                "bad_password",
                f'FROM {idx} | WHERE {auth} AND event.reason == "bad_password" | STATS n = COUNT(*)',
                "n",
                x=27, y=5, w=9,
            ),
            _gauge(
                "Failure volume",
                f"FROM {idx} | WHERE {auth} | STATS failures = COUNT(*)",
                "failures",
                x=36, y=5, w=12, h=7,
            ),
            _xy(
                "Failures over time by reason",
                f"FROM {idx} | WHERE {auth} "
                "| STATS failures = COUNT(*) BY bucket = BUCKET(@timestamp, 30 minutes), event.reason | SORT bucket",
                x_col="bucket",
                y_col="failures",
                layer="area_stacked",
                breakdown="event.reason",
                x=0, y=12, w=30, h=14,
            ),
            _xy(
                "Top failing users",
                f"FROM {idx} | WHERE {auth} | STATS failures = COUNT(*) BY user.name | SORT failures DESC | LIMIT 8",
                x_col="user.name",
                y_col="failures",
                layer="bar_horizontal",
                x=30, y=12, w=18, h=14,
            ),
            _xy(
                "Source IPs",
                f"FROM {idx} | WHERE {auth} | STATS failures = COUNT(*) BY source.ip | SORT failures DESC | LIMIT 8",
                x_col="source.ip",
                y_col="failures",
                layer="bar",
                x=0, y=26, w=24, h=12,
            ),
            _xy(
                "Failure reasons",
                f"FROM {idx} | WHERE {auth} | STATS failures = COUNT(*) BY event.reason | SORT failures DESC",
                x_col="event.reason",
                y_col="failures",
                layer="bar_horizontal",
                x=24, y=26, w=24, h=12,
            ),
            _log_detail(
                "Log detail — auth login_failed (Loki stub)",
                f"FROM {idx} | WHERE {auth} | SORT @timestamp DESC "
                "| KEEP @timestamp, source.ip, user.name, event.reason, message | LIMIT 50",
                y=38, h=18,
            ),
            _md(stream_auth, y=56, h=12, title="Log stream"),
        ],
    )

    intro_launch = f"""# Loki → Kibana · launch window

Auth + gateway rate limits + anticheat — same A2A stub corpus as the workflow.

Entities: `203.0.113.44` · `aether-user-88421` · gateway `198.51.100.17` · device `fp-9c2a`
"""

    create_dashboard(
        DASH_LAUNCH_ID,
        "Aether — Loki stub · Launch window (auth + gateway + anticheat)",
        "Full Loki A2A stub corpus with service breakdown and log detail",
        [
            _md(intro_launch, y=0, h=5, title="Overview"),
            _metric(
                "Stub log lines",
                f"FROM {idx} | WHERE {src} | STATS lines = COUNT(*)",
                "lines",
                x=0, y=5, w=12,
            ),
            _metric(
                "Auth failures",
                f"FROM {idx} | WHERE {auth} | STATS n = COUNT(*)",
                "n",
                x=12, y=5, w=12,
            ),
            _metric(
                "Anticheat signals",
                f'FROM {idx} | WHERE {src} AND event.action == "anticheat_signal" | STATS n = COUNT(*)',
                "n",
                x=24, y=5, w=12,
            ),
            _gauge(
                "Gateway rate limits",
                f'FROM {idx} | WHERE {src} AND event.action == "rate_limit_exceeded" | STATS n = COUNT(*)',
                "n",
                x=36, y=5, w=12, h=7,
            ),
            _xy(
                "Volume by service",
                f"FROM {idx} | WHERE {src} | STATS lines = COUNT(*) BY service.name | SORT lines DESC",
                x_col="service.name",
                y_col="lines",
                x=0, y=12, w=24, h=12,
            ),
            _xy(
                "By event.action",
                f"FROM {idx} | WHERE {src} | STATS lines = COUNT(*) BY event.action | SORT lines DESC",
                x_col="event.action",
                y_col="lines",
                layer="bar_horizontal",
                x=24, y=12, w=24, h=12,
            ),
            _xy(
                "Launch window timeline",
                f"FROM {idx} | WHERE {src} "
                "| STATS lines = COUNT(*) BY bucket = BUCKET(@timestamp, 30 minutes), event.action | SORT bucket",
                x_col="bucket",
                y_col="lines",
                layer="area_stacked",
                breakdown="event.action",
                x=0, y=24, w=48, h=14,
            ),
            _log_detail(
                "Log detail — launch window (all stub actions)",
                f"FROM {idx} | WHERE {src} | SORT @timestamp DESC "
                "| KEEP @timestamp, service.name, event.action, source.ip, user.name, message | LIMIT 50",
                y=38, h=18,
            ),
            _md(
                "## Workflow stub lines\n\n```\n"
                "203.0.113.44 auth login_failed user=aether-user-88421 reason=bad_password\n"
                "198.51.100.17 gateway rate_limit_exceeded route=/v1/login studio=aether\n"
                "anticheat signal severity=high player=aether-user-88421 device=fp-9c2a\n"
                "```\n",
                y=56, h=8, title="Stub lines",
            ),
        ],
    )


def main() -> int:
    print("==> Seed Loki A2A stub logs + dashboards")
    print(f"    ES={ES_URL}")
    print(f"    Kibana={KIBANA_URL}")
    docs = build_docs(90)
    seed_docs(docs)
    dashboards()
    print("==> Done")
    print(f"    Auth:   {KIBANA_URL}/app/dashboards#/view/{DASH_AUTH_ID}")
    print(f"    Launch: {KIBANA_URL}/app/dashboards#/view/{DASH_LAUNCH_ID}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
