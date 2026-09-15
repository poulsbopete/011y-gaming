#!/usr/bin/env python3
"""Inventory Kibana dashboards → indexes, deploy sprawl board, optional drift workflow.

Aether Games workshop copy of the metric-enablement-series deployer. Run AFTER
grafana-migrate so Aether — * boards exist. Inventory is from live dashboard
definitions (no .elastic-audit-* on Serverless).

Env:
  KIBANA_URL + ES_API_KEY (or KIBANA_API_KEY)
  ES_URL (optional; derived from KIBANA_URL)
  SPRAWL_COMPETITOR = grafana | datadog | both  (markdown framing; default grafana)
  SPRAWL_WITH_WORKFLOW = 1  (create 15m schema-drift workflow + email alert)
  SPRAWL_ALERT_EMAIL  (default pete@poulsbopete.com when workflow is enabled)
  SPRAWL_FIELD_LIMIT  (widget fields to probe; default 80)
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

KIBANA_URL = os.environ.get("KIBANA_URL", "").rstrip("/")
ES_URL = (
    os.environ.get("ES_URL", "").rstrip("/")
    or KIBANA_URL.replace(".kb.", ".es.")
)
API_KEY = (
    os.environ.get("KIBANA_API_KEY", "")
    or os.environ.get("ES_API_KEY", "")
    or os.environ.get("ELASTIC_API_KEY", "")
)
COMPETITOR = (os.environ.get("SPRAWL_COMPETITOR") or "grafana").strip().lower()
WITH_WORKFLOW = os.environ.get("SPRAWL_WITH_WORKFLOW", "").strip() in ("1", "true", "yes")
ALERT_EMAIL = os.environ.get("SPRAWL_ALERT_EMAIL", "pete@poulsbopete.com").strip()
FIELD_LIMIT = int(os.environ.get("SPRAWL_FIELD_LIMIT", "80"))

DASHBOARD_ID = "horizon-dashboard-sprawl"
DASHBOARD_TITLE = "Horizon — Dashboard sprawl"
USAGE_INDEX = "dashboard-index-usage"
FIELDS_INDEX = "dashboard-widget-fields"
DRIFT_INDEX = "dashboard-schema-drift"
SKIP_TITLES = {DASHBOARD_TITLE, "Dashboard & index usage"}
SKIP_INDEX_PREFIXES = (".kibana", ".security", ".tasks", ".slo-", ".internal")
FROM_RE = re.compile(r"(?i)\bFROM\s+(`[^`]+`|[A-Za-z0-9_.*?-]+)")
FIELD_RE = re.compile(r"`([^`]+)`")

HEADERS_KBN = {
    "Authorization": f"ApiKey {API_KEY}" if API_KEY else "",
    "kbn-xsrf": "true",
    "x-elastic-internal-origin": "kibana",
    "Content-Type": "application/json",
    "Elastic-Api-Version": os.environ.get("KIBANA_ELASTIC_API_VERSION", "2023-10-31"),
}
HEADERS_ES = {
    "Authorization": f"ApiKey {API_KEY}" if API_KEY else "",
    "Content-Type": "application/json",
}


def gid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def http(url: str, method: str = "GET", body: dict | None = None, headers: dict | None = None, timeout: int = 120):
    data = None if body is None else json.dumps(body).encode()
    hdrs = dict(headers or {})
    if body is None:
        hdrs.pop("Content-Type", None)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return (json.loads(raw) if raw else None), r.status
    except urllib.error.HTTPError as e:
        return {"_body": e.read().decode()[:1200]}, e.code
    except Exception as e:  # noqa: BLE001
        return {"_body": str(e)[:800]}, 0


def kbn(method: str, path: str, body: dict | None = None, api_version: str | None = "2023-10-31"):
    hdrs = dict(HEADERS_KBN)
    if api_version:
        hdrs["Elastic-Api-Version"] = api_version
    else:
        hdrs.pop("Elastic-Api-Version", None)
    return http(f"{KIBANA_URL}{path}", method, body, hdrs)


def es(method: str, path: str, body: dict | None = None):
    return http(f"{ES_URL}{path}", method, body, HEADERS_ES)


def walk(obj, fn) -> None:
    fn(obj)
    if isinstance(obj, dict):
        for v in obj.values():
            walk(v, fn)
    elif isinstance(obj, list):
        for v in obj:
            walk(v, fn)


def looks_like_index(name: str) -> bool:
    n = (name or "").strip("`").strip()
    if not n or n.startswith(SKIP_INDEX_PREFIXES):
        return False
    if n in {USAGE_INDEX, FIELDS_INDEX, DRIFT_INDEX}:
        return False
    if n.lower() in {"null", "true", "false", "docs", "count"}:
        return False
    return True


def extract_from_dashboard(title: str, dash_id: str, blob) -> tuple[set[str], set[tuple[str, str]]]:
    indexes: set[str] = set()
    fields: set[tuple[str, str]] = set()

    def visit(node) -> None:
        if isinstance(node, dict):
            if node.get("type") == "index-pattern" and node.get("id"):
                idx = str(node["id"])
                if looks_like_index(idx):
                    indexes.add(idx)
            for key in ("index", "index_pattern", "dataViewId", "data_view"):
                val = node.get(key)
                if isinstance(val, str) and looks_like_index(val):
                    indexes.add(val.strip("`"))
            sf = node.get("sourceField") or node.get("field")
            if isinstance(sf, str) and "." in sf and not sf.startswith("kibana"):
                for idx in list(indexes) or ["(unknown)"]:
                    fields.add((idx, sf))
        if isinstance(node, str) and "FROM" in node.upper():
            for m in FROM_RE.finditer(node):
                idx = m.group(1).strip("`")
                if looks_like_index(idx):
                    indexes.add(idx)
                    for fm in FIELD_RE.findall(node):
                        if fm not in idx and not fm.startswith("@"):
                            fields.add((idx, fm))

    walk(blob, visit)
    return indexes, fields


def list_dashboards() -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        payload, status = kbn(
            "GET",
            f"/api/saved_objects/_find?type=dashboard&per_page=100&page={page}",
            api_version=None,
        )
        if status != 200 or not isinstance(payload, dict):
            print(f"WARN: dashboard find HTTP {status}: {payload}", file=sys.stderr)
            break
        rows = payload.get("saved_objects") or []
        out.extend(rows)
        total = int(payload.get("total") or 0)
        if len(out) >= total or not rows:
            break
        page += 1
    return out


def index_doc_counts() -> dict[str, int]:
    payload, status = es("GET", "/_cat/indices?format=json&h=index,docs.count")
    counts: dict[str, int] = {}
    if status != 200 or not isinstance(payload, list):
        return counts
    for row in payload:
        name = row.get("index") or ""
        try:
            counts[name] = int(row.get("docs.count") or 0)
        except (TypeError, ValueError):
            counts[name] = 0
    return counts


def resolve_count(pattern: str, counts: dict[str, int]) -> int:
    if pattern in counts:
        return counts[pattern]
    if "*" in pattern:
        prefix = pattern.split("*", 1)[0]
        return sum(c for n, c in counts.items() if n.startswith(prefix) or prefix in n)
    # data streams often stored as .ds-<name>-...
    return sum(c for n, c in counts.items() if pattern in n)


def ensure_indexes() -> None:
    mappings = {
        USAGE_INDEX: {
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "resource_type": {"type": "keyword"},
                    "resource_name": {"type": "keyword"},
                    "dashboard_id": {"type": "keyword"},
                    "dashboard_title": {"type": "keyword"},
                    "index_name": {"type": "keyword"},
                    "doc_count": {"type": "long"},
                    "panel_count": {"type": "integer"},
                }
            }
        },
        FIELDS_INDEX: {
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "dashboard_id": {"type": "keyword"},
                    "dashboard_title": {"type": "keyword"},
                    "index_name": {"type": "keyword"},
                    "field_name": {"type": "keyword"},
                    "source": {"type": "keyword"},
                }
            }
        },
        DRIFT_INDEX: {
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "dashboard_id": {"type": "keyword"},
                    "dashboard_title": {"type": "keyword"},
                    "index_name": {"type": "keyword"},
                    "field_name": {"type": "keyword"},
                    "reason": {"type": "keyword"},
                    "status": {"type": "keyword"},
                    "source": {"type": "keyword"},
                }
            }
        },
    }
    for name, body in mappings.items():
        payload, status = es("PUT", f"/{name}", body)
        if status not in (200, 400):
            print(f"WARN: create {name} HTTP {status}: {payload}", file=sys.stderr)
    es(
        "PUT",
        "/_ingest/pipeline/dashboard-schema-drift-timestamp",
        {
            "description": "Set @timestamp on first write of a schema-drift event",
            "processors": [
                {"set": {"field": "@timestamp", "value": "{{_ingest.timestamp}}", "override": False}}
            ],
        },
    )
    es("PUT", f"/{DRIFT_INDEX}/_settings", {"index": {"default_pipeline": "dashboard-schema-drift-timestamp"}})


def bulk_index(index: str, docs: list[dict]) -> None:
    if not docs:
        es("POST", f"/{index}/_delete_by_query?refresh=true", {"query": {"match_all": {}}})
        return
    es("POST", f"/{index}/_delete_by_query?refresh=true", {"query": {"match_all": {}}})
    lines: list[str] = []
    for doc in docs:
        lines.append(json.dumps({"index": {"_index": index}}))
        lines.append(json.dumps(doc))
    data = ("\n".join(lines) + "\n").encode()
    req = urllib.request.Request(
        f"{ES_URL}/_bulk?refresh=true",
        data=data,
        headers={**HEADERS_ES, "Content-Type": "application/x-ndjson"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        body = json.loads(r.read().decode())
    if body.get("errors"):
        print(f"WARN: bulk {index} had errors", file=sys.stderr)


def seed_inventory() -> tuple[int, int, int]:
    dashes = list_dashboards()
    counts = index_doc_counts()
    usage: list[dict] = []
    field_docs: list[dict] = []
    index_seen: dict[str, int] = {}
    ts = now_iso()

    for so in dashes:
        title = (so.get("attributes") or {}).get("title") or so.get("id") or ""
        dash_id = so.get("id") or ""
        if title in SKIP_TITLES or dash_id == DASHBOARD_ID:
            continue
        attrs = so.get("attributes") or {}
        blob: dict = {"attributes": attrs, "references": so.get("references") or []}
        if isinstance(attrs.get("panelsJSON"), str):
            try:
                blob["panels"] = json.loads(attrs["panelsJSON"])
            except json.JSONDecodeError:
                blob["panels"] = attrs["panelsJSON"]
        indexes, fields = extract_from_dashboard(title, dash_id, blob)
        usage.append(
            {
                "@timestamp": ts,
                "resource_type": "dashboard",
                "resource_name": title,
                "dashboard_id": dash_id,
                "dashboard_title": title,
                "index_name": ",".join(sorted(indexes)) if indexes else "(none extracted)",
                "panel_count": len(indexes),
            }
        )
        for idx in indexes:
            index_seen[idx] = index_seen.get(idx, 0) + 1
            usage.append(
                {
                    "@timestamp": ts,
                    "resource_type": "index",
                    "resource_name": idx,
                    "dashboard_id": dash_id,
                    "dashboard_title": title,
                    "index_name": idx,
                    "doc_count": resolve_count(idx, counts),
                }
            )
        for idx, field in sorted(fields):
            field_docs.append(
                {
                    "@timestamp": ts,
                    "dashboard_id": dash_id,
                    "dashboard_title": title,
                    "index_name": idx,
                    "field_name": field,
                    "source": "dashboard-definition",
                }
            )

    for idx, n_boards in index_seen.items():
        usage.append(
            {
                "@timestamp": ts,
                "resource_type": "index_stats",
                "resource_name": idx,
                "index_name": idx,
                "doc_count": resolve_count(idx, counts),
                "panel_count": n_boards,
            }
        )

    # Keep workflow bounded
    field_docs = field_docs[:FIELD_LIMIT]
    bulk_index(USAGE_INDEX, usage)
    bulk_index(FIELDS_INDEX, field_docs)
    print(f"Inventory: {len(dashes)} dashboards, {len(usage)} usage docs, {len(field_docs)} widget fields")
    return len(dashes), len(usage), len(field_docs)


NARRATIVES = {
    "grafana": """### Launch-week Grafana boards, now in Elastic

**Aether Games** ships a Grafana folder every launch: matchmaking wait, session gateway, auth, store. After those boards live in Kibana, a relabel, dropped `region`, or renamed duration metric still **blanks widgets**. SRE gets paged for “the dashboard is broken,” not a missing index.

Grafana will not tell you which boards still query which jobs.

**This board** is the Elastic answer: dashboards → indexes they query, plus widget fields watched for schema drift.

| Grafana pain | On Elastic Serverless |
|--------------|------------------------|
| Folder sprawl of launch-week boards | One inventory of Aether boards and the indexes behind them |
| Silent blanks after relabel / Prom upgrade | 15m workflow probes widget fields; alert if `KEEP` fails |
| Series billed whether a board still uses them | Keep the boards you still read |
""",
    "datadog": """### Launch-week Grafana boards, now in Elastic

Grafana folders of launch-week boards nobody owns. After migrate into Kibana, a relabel or renamed duration metric still blanks widgets.

**This board** inventories dashboards → indexes, lists widget fields, and a 15-minute workflow alerts when a schema change would break a widget (`FROM index \\| KEEP field`).
""",
    "both": """### Launch-week Grafana boards, now in Elastic

Grafana folders of launch-week boards nobody owns. Relabel or a Prom upgrade silently blanks matchmaking / session / auth panels. After cutover those boards live in Kibana — Elastic inventories dashboards → indexes, lists widget fields, and a 15-minute workflow alerts when a schema change would break a widget (`FROM index \\| KEEP field`).
""",
}


def markdown_panel(x: int, y: int, w: int, h: int, content: str) -> dict:
    return {
        "id": gid(),
        "type": "markdown",
        "grid": {"x": x, "y": y, "w": w, "h": h},
        "config": {"content": content, "settings": {"open_links_in_new_tab": True}},
    }


def vis_panel(x: int, y: int, w: int, h: int, config: dict) -> dict:
    return {"id": gid(), "type": "vis", "grid": {"x": x, "y": y, "w": w, "h": h}, "config": config}


def metric_panel(title: str, esql: str, column: str) -> dict:
    return {
        "type": "metric",
        "title": title,
        "data_source": {"type": "esql", "query": esql},
        "metrics": [{"type": "primary", "column": column}],
    }


def xy_panel(title: str, esql: str, x_col: str, y_col: str) -> dict:
    return {
        "type": "xy",
        "title": title,
        "axis": {"x": {"title": {"visible": False}}, "y": {"title": {"visible": False}}},
        "layers": [
            {
                "type": "bar_horizontal",
                "data_source": {"type": "esql", "query": esql},
                "x": {"column": x_col},
                "y": [{"column": y_col}],
            }
        ],
    }


def _col(name: str, *, metric: bool = False) -> dict:
    col = {
        "column": name,
        "visible": True,
        "alignment": "right" if metric else "left",
        "color": {"type": "auto"},
    }
    if not metric:
        col["click_filter"] = False
    return col


def table_panel(title: str, esql: str, row_cols: list[str], metric_cols: list[str] | None = None) -> dict:
    metric_cols = metric_cols or []
    return {
        "type": "data_table",
        "title": title,
        "data_source": {"type": "esql", "query": esql},
        "rows": [_col(c) for c in row_cols],
        "metrics": [_col(c, metric=True) for c in metric_cols],
    }


ESQL = {
    "n_dash": f"FROM {USAGE_INDEX}\n| WHERE resource_type == \"dashboard\"\n| STATS dashboards = COUNT_DISTINCT(dashboard_title)",
    "n_idx": f"FROM {USAGE_INDEX}\n| WHERE resource_type == \"index\"\n| STATS indexes = COUNT_DISTINCT(index_name)",
    "n_fields": f"FROM {FIELDS_INDEX}\n| STATS fields = COUNT(*)",
    "n_drift": f"FROM {DRIFT_INDEX}\n| WHERE @timestamp > NOW() - 24 hours\n| STATS drift = COUNT(*)",
    "by_index": f"FROM {USAGE_INDEX}\n| WHERE resource_type == \"index\"\n| STATS boards = COUNT_DISTINCT(dashboard_title) BY index_name\n| SORT boards DESC\n| LIMIT 12",
    "by_docs": f"FROM {USAGE_INDEX}\n| WHERE resource_type == \"index_stats\"\n| STATS docs = MAX(doc_count) BY index_name\n| SORT docs DESC\n| LIMIT 12",
    "dash_table": f"FROM {USAGE_INDEX}\n| WHERE resource_type == \"dashboard\"\n| KEEP dashboard_title, index_name, panel_count\n| SORT dashboard_title\n| LIMIT 50",
    "usage_table": f"FROM {USAGE_INDEX}\n| WHERE resource_type == \"index\"\n| KEEP dashboard_title, index_name, doc_count\n| SORT dashboard_title\n| LIMIT 50",
    "fields_table": f"FROM {FIELDS_INDEX}\n| STATS n = COUNT(*) BY dashboard_title, index_name, field_name\n| SORT dashboard_title\n| LIMIT 50",
    "drift_table": f"FROM {DRIFT_INDEX}\n| WHERE @timestamp > NOW() - 7 days\n| STATS n = COUNT(*) BY dashboard_title, index_name, field_name, status\n| SORT n DESC\n| LIMIT 50",
}


def build_panels(*, include_markdown: bool) -> list:
    narrative = NARRATIVES.get(COMPETITOR, NARRATIVES["grafana"])
    panels: list = []
    y0 = 0
    if include_markdown:
        panels.append(markdown_panel(0, 0, 48, 10, narrative))
        y0 = 10
    panels.extend(
        [
            vis_panel(0, y0, 12, 6, metric_panel("Dashboards inventoried", ESQL["n_dash"], "dashboards")),
            vis_panel(12, y0, 12, 6, metric_panel("Indexes referenced", ESQL["n_idx"], "indexes")),
            vis_panel(24, y0, 12, 6, metric_panel("Widget fields watched", ESQL["n_fields"], "fields")),
            vis_panel(36, y0, 12, 6, metric_panel("Schema drift (24h)", ESQL["n_drift"], "drift")),
            vis_panel(0, y0 + 6, 24, 12, xy_panel("Indexes referenced by dashboards", ESQL["by_index"], "index_name", "boards")),
            vis_panel(24, y0 + 6, 24, 12, xy_panel("Largest user indexes", ESQL["by_docs"], "index_name", "docs")),
            vis_panel(
                0,
                y0 + 18,
                48,
                10,
                table_panel(
                    "Dashboards and indexes they query",
                    ESQL["dash_table"],
                    ["dashboard_title", "index_name"],
                    ["panel_count"],
                ),
            ),
            vis_panel(
                0,
                y0 + 28,
                48,
                10,
                table_panel(
                    "Dashboard to index usage",
                    ESQL["usage_table"],
                    ["dashboard_title", "index_name"],
                    ["doc_count"],
                ),
            ),
            vis_panel(
                0,
                y0 + 38,
                24,
                12,
                table_panel(
                    "Widget fields watched for schema drift",
                    ESQL["fields_table"],
                    ["dashboard_title", "index_name", "field_name"],
                    ["n"],
                ),
            ),
            vis_panel(
                24,
                y0 + 38,
                24,
                12,
                table_panel(
                    "Schema drift events",
                    ESQL["drift_table"],
                    ["dashboard_title", "index_name", "field_name", "status"],
                    ["n"],
                ),
            ),
        ]
    )
    return panels


def delete_by_title(title: str) -> None:
    payload, status = kbn("GET", "/api/dashboards")
    if status != 200 or not isinstance(payload, dict):
        return
    for row in payload.get("dashboards") or payload.get("data") or []:
        data = row.get("data") or row
        if (data.get("title") or "") == title and row.get("id"):
            qid = urllib.parse.quote(row["id"], safe="")
            kbn("DELETE", f"/api/dashboards/{qid}")


def deploy_dashboard() -> bool:
    delete_by_title(DASHBOARD_TITLE)
    qid = urllib.parse.quote(DASHBOARD_ID, safe="")
    desc = (
        "Dashboards and the indexes they query, plus widget fields watched for schema drift. "
        "Inventory is rebuilt from live dashboard definitions. When cluster audit logging is enabled, "
        "point the usage table at FROM .elastic-audit-*."
    )
    last = None
    for include_md in (True, False):
        body = {
            "title": DASHBOARD_TITLE,
            "description": desc,
            "time_range": {"from": "now-24h", "to": "now"},
            "panels": build_panels(include_markdown=include_md),
        }
        payload, status = kbn("PUT", f"/api/dashboards/{qid}", body)
        how = "PUT"
        if status not in (200, 201):
            payload, status = kbn("POST", "/api/dashboards", body)
            how = "POST"
        last = (status, payload, how, include_md)
        if status in (200, 201):
            did = (payload or {}).get("id") or DASHBOARD_ID
            label = "full (markdown+charts)" if include_md else "charts only"
            print(f"OK: {DASHBOARD_TITLE!r} ({label} via {how}, id={did})")
            print(f"    Open: {KIBANA_URL}/app/dashboards#/view/{did}")
            return True
        print(f"WARN: markdown={include_md} HTTP {status}: {payload}", file=sys.stderr)
    print(f"ERROR: dashboard deploy failed: {last}", file=sys.stderr)
    return False


WORKFLOW_YAML = r'''version: "1"
name: Dashboard schema drift check
description: Every 15 minutes, probe fields used by Kibana dashboard widgets. If a field is missing or the ES|QL probe fails, write a dashboard-schema-drift event and continue checking the rest.
enabled: true
tags:
  - dashboards
  - schema-drift
triggers:
  - type: scheduled
    with:
      every: 15m
  - type: manual
settings:
  timeout: 10m
steps:
  - name: load_widget_fields
    type: elasticsearch.search
    with:
      index: dashboard-widget-fields
      size: 100
      query:
        match_all: {}

  - name: check_each_field
    type: foreach
    foreach: "{{ steps.load_widget_fields.output.hits.hits }}"
    steps:
      - name: probe_field
        type: elasticsearch.esql.query
        with:
          format: json
          query: |
            FROM {{ foreach.item._source.index_name }}
            | KEEP `{{ foreach.item._source.field_name }}`
            | LIMIT 1
        on-failure:
          continue: true
          fallback:
            - name: record_drift
              type: elasticsearch.index
              with:
                index: dashboard-schema-drift
                id: "{{ foreach.item._source.dashboard_id }}__{{ foreach.item._source.index_name }}__{{ foreach.item._source.field_name }}"
                refresh: wait_for
                document:
                  dashboard_id: "{{ foreach.item._source.dashboard_id }}"
                  dashboard_title: "{{ foreach.item._source.dashboard_title }}"
                  index_name: "{{ foreach.item._source.index_name }}"
                  field_name: "{{ foreach.item._source.field_name }}"
                  reason: missing_or_incompatible_field
                  status: critical
                  source: schema-drift-workflow

  - name: summarize
    type: elasticsearch.esql.query
    with:
      format: json
      query: |
        FROM dashboard-schema-drift
        | WHERE @timestamp > NOW() - 20 minutes
        | STATS drift_events = COUNT(*), indexes = COUNT_DISTINCT(index_name), fields = COUNT_DISTINCT(field_name)

  - name: log_summary
    type: console
    with:
      message: |
        Schema drift check complete. Recent events {{ steps.summarize.output.values[0][0] }}, indexes {{ steps.summarize.output.values[0][1] }}, fields {{ steps.summarize.output.values[0][2] }}.
'''


def deploy_workflow() -> bool:
    payload, status = kbn(
        "POST",
        "/api/workflows?overwrite=true",
        {"workflows": [{"id": "dashboard-schema-drift-check", "yaml": WORKFLOW_YAML, "enabled": True}]},
    )
    if status not in (200, 201):
        print(f"WARN: workflow create HTTP {status}: {payload}", file=sys.stderr)
        return False
    created = (payload or {}).get("created") or []
    ok = bool(created) and created[0].get("valid") is not False
    print(f"Workflow dashboard-schema-drift-check valid={created[0].get('valid') if created else None}")
    if ok:
        print(f"    Open: {KIBANA_URL}/app/workflows/dashboard-schema-drift-check")
    return ok


def deploy_alert() -> bool:
    rule = {
        "name": "Dashboard schema drift impacting widgets",
        "rule_type_id": ".es-query",
        "consumer": "alerts",
        "schedule": {"interval": "5m"},
        "enabled": True,
        "tags": ["dashboards", "schema-drift"],
        "params": {
            "searchType": "esQuery",
            "esQuery": json.dumps(
                {
                    "query": {
                        "bool": {
                            "filter": [
                                {"range": {"@timestamp": {"gte": "now-20m"}}},
                                {"term": {"status": "critical"}},
                            ]
                        }
                    }
                }
            ),
            "index": [DRIFT_INDEX],
            "timeField": "@timestamp",
            "threshold": [0],
            "thresholdComparator": ">",
            "size": 50,
            "timeWindowSize": 20,
            "timeWindowUnit": "m",
            "excludeHitsFromPreviousRun": True,
            "aggType": "count",
            "groupBy": "all",
        },
        "actions": [
            {
                "group": "query matched",
                "id": "Elastic-Cloud-SMTP",
                "params": {
                    "to": [ALERT_EMAIL],
                    "subject": "Schema drift impacting Kibana dashboards",
                    "message": (
                        f"Rule {{{{rule.name}}}} matched. Open "
                        f"{KIBANA_URL}/app/dashboards#/view/{DASHBOARD_ID}"
                    ),
                },
                "frequency": {
                    "summary": False,
                    "notify_when": "onThrottleInterval",
                    "throttle": "1h",
                },
            }
        ],
    }
    payload, status = kbn("POST", "/api/alerting/rule/dashboard-schema-drift", rule)
    if status in (200, 201):
        print(f"Alert OK id=dashboard-schema-drift → {ALERT_EMAIL}")
        print(f"    Open: {KIBANA_URL}/app/management/insightsAndAlerting/triggersActions/rule/dashboard-schema-drift")
        return True
    if status in (409, 400):
        payload, status = kbn("PUT", "/api/alerting/rule/dashboard-schema-drift", {
            "name": rule["name"],
            "tags": rule["tags"],
            "schedule": rule["schedule"],
            "params": rule["params"],
            "actions": rule["actions"],
        })
        print(f"Alert update HTTP {status}")
        return status in (200, 201)
    print(f"WARN: alert HTTP {status}: {payload}", file=sys.stderr)
    return False


def main() -> int:
    if not KIBANA_URL or not API_KEY:
        print("ERROR: KIBANA_URL and ES_API_KEY required", file=sys.stderr)
        return 1
    print(f"Dashboard sprawl → {KIBANA_URL} (competitor={COMPETITOR}, workflow={WITH_WORKFLOW})")
    ensure_indexes()
    seed_inventory()
    if not deploy_dashboard():
        return 1
    if WITH_WORKFLOW:
        wf_ok = deploy_workflow()
        al_ok = deploy_alert()
        if not wf_ok:
            print("WARN: workflow not created (plugin missing or YAML invalid) — dashboard still deployed")
        if not al_ok:
            print("WARN: alert not created — dashboard still deployed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
