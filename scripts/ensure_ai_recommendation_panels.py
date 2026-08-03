#!/usr/bin/env python3
"""
Ensure Agent Builder–driven metrics-adoption notes on workshop dashboards.

Mirrors the dbmonitoring pattern:
  - library Markdown saved objects (workshop-ai-rec-grafana | workshop-ai-rec-datadog)
  - Elasticsearch index metrics-adoption-recommendations
  - AI Markdown strip on **every** migrated Grafana / Datadog dashboard
  - dedicated overview dashboard **Metrics adoption — AI notes**
  - optional --seed-now via POST /api/agent_builder/converse (instant demo content)

Also removes legacy static **What & why** markdown panels left from older asset builds.

Usage:
  python3 scripts/ensure_ai_recommendation_panels.py
  python3 scripts/ensure_ai_recommendation_panels.py --seed-now
  python3 scripts/ensure_ai_recommendation_panels.py --platform grafana

Env: KIBANA_URL + ES_API_KEY (or KIBANA_API_KEY) + ES_URL for index create.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

KIBANA_URL = os.environ.get("KIBANA_URL", "").rstrip("/")
ES_URL = os.environ.get("ES_URL", "").rstrip("/")
API_KEY = (
    os.environ.get("KIBANA_API_KEY", "")
    or os.environ.get("ES_API_KEY", "")
    or os.environ.get("ELASTICSEARCH_API_KEY", "")
)
ES_USER = os.environ.get("ES_USERNAME", "admin")
ES_PASS = os.environ.get("ES_PASSWORD", "") or os.environ.get("ELASTICSEARCH_PASSWORD", "")

REC_INDEX = "metrics-adoption-recommendations"
REC_MARKDOWN_MAX = 48000
PLATFORMS = ("grafana", "datadog")
OVERVIEW_DASHBOARD_ID = "workshop-metrics-adoption-ai-notes"
OVERVIEW_TITLE = "Metrics adoption — AI notes"

# Every migrated board for the platform (titles must match assets/* generators).
ATTACH_TITLES: dict[str, tuple[str, ...]] = {
    "grafana": (
        "Traffic overview",
        "Request rate by service",
        "Latency p95",
        "Error rate",
        "Operation errors by reason",
        "Top services by traffic",
        "POST /api/v1/orders volume",
        "Latency by path",
        "Status codes",
        "SLO-style availability",
        "Errors by service",
        "Request mix",
        "Throughput by host",
        "Workload mix",
        "GC pause indicator",
        "Downstream latency p90",
        "Queue depth stand-in",
        "Success share (2xx)",
        "Error churn",
        "Endpoint availability",
    ),
    "datadog": (
        "Service overview",
        "Error budget view",
        "Latency p95",
        "Apdex-style satisfaction",
        "Host CPU",
        "Host memory",
        "Disk I/O",
        "Network bytes",
        "Container CPU throttle",
        "Log error spike",
    ),
}

SEED_PROMPTS = {
    "grafana": """You are an Elastic Observability specialist helping existing Elastic customers
adopt metrics on Observability Serverless. Workshop context: OTLP → Alloy → mOTLP into metrics-*/logs-*/traces-*;
Grafana/PromQL boards (Traffic overview, latency, errors) with http_requests_total, service.name, host.name.
Produce concise markdown (max ~35 lines): (1) what to validate first on PromQL-shaped boards,
(2) Discover/ES|QL checks on metrics-*, (3) first alerts to enable from drafts, (4) why reusing PromQL
dashboard IP accelerates metrics adoption. Keep advice generic.""",
    "datadog": """You are an Elastic Observability specialist helping existing Elastic customers
adopt metrics on Observability Serverless. Workshop context: same OTLP path; Datadog-shaped boards
(Service overview, host CPU/memory) via datadog-migrate --field-profile otel; monitors become disabled rule drafts.
Produce concise markdown (max ~35 lines): (1) what to validate first, (2) OTel attrs vs DD tags,
(3) monitor→rule governance, (4) why DD exports accelerate metrics adoption on Elastic. Keep advice generic.""",
}


def _auth_header() -> str:
    if API_KEY:
        return f"ApiKey {API_KEY}"
    if ES_PASS:
        return "Basic " + base64.b64encode(f"{ES_USER}:{ES_PASS}".encode()).decode()
    sys.exit("ERROR: Set ES_API_KEY / KIBANA_API_KEY or ES_PASSWORD")


HEADERS = {
    "Authorization": _auth_header() if KIBANA_URL else "",
    "kbn-xsrf": "true",
    "x-elastic-internal-origin": "kibana",
    "Content-Type": "application/json",
    "Elastic-Api-Version": os.environ.get("KIBANA_ELASTIC_API_VERSION", "2023-10-31"),
    "User-Agent": "elastic-agentic",
}


def gid() -> str:
    return str(uuid.uuid4())


def rec_markdown_so_id(platform: str) -> str:
    return f"workshop-ai-rec-{platform}"


def _request(method: str, url: str, body: dict | None = None, headers: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    hdrs = dict(headers or HEADERS)
    if body is None:
        hdrs.pop("Content-Type", None)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            if not raw:
                return None, r.status
            try:
                return json.loads(raw), r.status
            except json.JSONDecodeError:
                return raw.decode(), r.status
    except urllib.error.HTTPError as e:
        err = e.read().decode() if e.fp else ""
        return {"_http_error": e.code, "_body": err}, e.code


def kbn(method: str, path: str, body: dict | None = None):
    return _request(method, f"{KIBANA_URL}{path}", body)


def es(method: str, path: str, body: dict | None = None):
    if not ES_URL:
        return {"_http_error": 0, "_body": "ES_URL unset"}, 0
    return _request(method, f"{ES_URL}{path}", body, headers={
        "Authorization": HEADERS["Authorization"],
        "Content-Type": "application/json",
    })


def ensure_rec_index() -> bool:
    mappings = {
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "execution_id": {"type": "keyword"},
                "workflow_name": {"type": "keyword"},
                "source": {"type": "keyword"},
                "dashboard_platform": {"type": "keyword"},
                "recommendation": {"type": "text"},
            }
        }
    }
    payload, status = es("PUT", f"/{REC_INDEX}", mappings)
    if status in (200, 201):
        print(f"  ✓ index {REC_INDEX} ready (HTTP {status})")
        return True
    if status == 400 and isinstance(payload, dict) and "resource_already_exists" in str(payload.get("_body", "")):
        print(f"  ✓ index {REC_INDEX} already exists")
        return True
    _, gstatus = es("GET", f"/{REC_INDEX}")
    if gstatus == 200:
        print(f"  ✓ index {REC_INDEX} already exists")
        return True
    print(f"  WARN: ensure index {REC_INDEX} → HTTP {status}: {str(payload)[:300]}", file=sys.stderr)
    return False


def markdown_exists(so_id: str) -> bool:
    qid = urllib.parse.quote(so_id, safe="")
    _, status = kbn("GET", f"/api/saved_objects/markdown/{qid}")
    return status == 200


def post_markdown(so_id: str, title: str, content: str) -> bool:
    qid = urllib.parse.quote(so_id, safe="")
    payload, status = kbn(
        "POST",
        f"/api/saved_objects/markdown/{qid}?overwrite=true",
        {
            "attributes": {
                "title": title,
                "description": "",
                "content": content[:REC_MARKDOWN_MAX],
            }
        },
    )
    if status in (200, 201):
        return True
    print(f"  WARN: markdown {so_id} → HTTP {status}: {str(payload)[:300]}", file=sys.stderr)
    return False


def ensure_markdown_placeholders(platforms: tuple[str, ...]) -> bool:
    placeholder = (
        "### AI metrics adoption notes\n\n"
        "_This panel updates when **Metrics adoption — AI dashboard notes** runs "
        "(every 10 minutes or on manual run in **Management → Workflows**). "
        "Or re-run: `python3 scripts/ensure_ai_recommendation_panels.py --seed-now`._"
    )
    ok = True
    for p in platforms:
        sid = rec_markdown_so_id(p)
        title = f"AI metrics adoption notes — {p}"
        if markdown_exists(sid):
            print(f"  ✓ markdown {sid} exists")
            continue
        if post_markdown(sid, title, placeholder):
            print(f"  ✓ created markdown {sid}")
        else:
            ok = False
    return ok


def ai_panel_title(platform: str) -> str:
    return f"AI metrics adoption notes — {platform}"


def get_markdown_content(so_id: str) -> str:
    qid = urllib.parse.quote(so_id, safe="")
    payload, status = kbn("GET", f"/api/saved_objects/markdown/{qid}")
    if status == 200 and isinstance(payload, dict):
        attrs = payload.get("attributes") or {}
        content = attrs.get("content") or ""
        if content.strip():
            return str(content)[:REC_MARKDOWN_MAX]
    return (
        "### AI metrics adoption notes\n\n"
        "_Waiting for Agent Builder seed / workflow run._"
    )


def markdown_panel(platform: str, box: tuple[int, int, int, int], *, content: str | None = None) -> dict:
    """Prefer by-value markdown (reliable on mig-to-kbn boards); keep ref_id for overview."""
    x, y, w, h = box
    body = content if content is not None else get_markdown_content(rec_markdown_so_id(platform))
    return {
        "type": "markdown",
        "id": gid(),
        "grid": {"x": x, "y": y, "w": w, "h": h},
        "config": {
            "title": ai_panel_title(platform),
            "content": body,
        },
    }


def markdown_panel_library_ref(platform: str, box: tuple[int, int, int, int]) -> dict:
    """Library ref panel — used on the dedicated overview dashboard (workflow-refreshable)."""
    x, y, w, h = box
    return {
        "type": "markdown",
        "id": gid(),
        "grid": {"x": x, "y": y, "w": w, "h": h},
        "config": {"ref_id": rec_markdown_so_id(platform)},
    }


def _add_title_id(out: dict[str, list[str]], title: str, did: str) -> None:
    title = (title or "").strip()
    if not did or not title:
        return
    ids = out.setdefault(title, [])
    if did not in ids:
        ids.append(did)


def list_dashboards_by_title() -> dict[str, list[str]]:
    """Return {title: [id, ...]} from Dashboards API, with saved-objects fallback."""
    out: dict[str, list[str]] = {}

    payload, status = kbn("GET", "/api/dashboards")
    if status == 200 and isinstance(payload, dict):
        for row in payload.get("dashboards") or []:
            if not isinstance(row, dict):
                continue
            data = row.get("data") or {}
            _add_title_id(out, data.get("title") or "", row.get("id") or "")
        if out:
            print(f"  · listed {sum(len(v) for v in out.values())} dashboard(s) via /api/dashboards")
            return out
        print(f"  · /api/dashboards returned 0 titles (HTTP {status}); trying saved objects…")
    else:
        print(
            f"  · /api/dashboards list failed HTTP {status}: {str(payload)[:200]} — trying saved objects…",
            file=sys.stderr,
        )

    page = 1
    per_page = 100
    while page <= 20:
        path_q = f"/api/saved_objects/_find?type=dashboard&per_page={per_page}&page={page}"
        payload, status = kbn("GET", path_q)
        if status != 200 or not isinstance(payload, dict):
            print(
                f"  WARN: saved_objects/_find dashboards → HTTP {status}: {str(payload)[:300]}",
                file=sys.stderr,
            )
            break
        rows = payload.get("saved_objects") or []
        for row in rows:
            if not isinstance(row, dict):
                continue
            attrs = row.get("attributes") or {}
            _add_title_id(out, attrs.get("title") or "", row.get("id") or "")
        total = int(payload.get("total") or 0)
        if page * per_page >= total or not rows:
            break
        page += 1
    print(f"  · listed {sum(len(v) for v in out.values())} dashboard(s) via saved_objects")
    return out


def get_dashboard(dash_id: str) -> dict | None:
    qid = urllib.parse.quote(dash_id, safe="")
    payload, status = kbn("GET", f"/api/dashboards/{qid}")
    if status != 200 or not isinstance(payload, dict):
        return None
    return payload


def put_dashboard(dash_id: str, data: dict) -> bool:
    qid = urllib.parse.quote(dash_id, safe="")
    body = {
        "title": data.get("title"),
        "description": data.get("description") or "",
        "panels": data.get("panels") or [],
    }
    if data.get("time_range"):
        body["time_range"] = data["time_range"]
    payload, status = kbn("PUT", f"/api/dashboards/{qid}", body)
    if status not in (200, 201):
        print(
            f"  · PUT /api/dashboards/{dash_id} → HTTP {status}: {str(payload)[:240]}",
            file=sys.stderr,
        )
        return False
    return True


def post_dashboard(data: dict) -> str | None:
    payload, status = kbn("POST", "/api/dashboards", data)
    if status not in (200, 201) or not isinstance(payload, dict):
        print(f"  WARN: POST dashboard → HTTP {status}: {str(payload)[:400]}", file=sys.stderr)
        return None
    return payload.get("id") or (payload.get("data") or {}).get("id")


def clean_description(desc: str | None) -> str:
    d = (desc or "").strip()
    for junk in (
        " — metrics adoption workshop board (What & why panel at top).",
        " — metrics adoption workshop board (What & why note at top).",
        "(What & why panel at top)",
        "(What & why note at top)",
    ):
        d = d.replace(junk, "")
    d = d.strip(" —")
    if d and "AI notes" not in d:
        return f"{d} — AI notes at bottom."
    return d or "Metrics adoption workshop board — AI notes at bottom."


def ensure_overview_dashboard(platforms: tuple[str, ...]) -> None:
    panels = []
    y = 0
    for p in platforms:
        # Overview keeps library refs so the workflow refresh is visible without re-attach.
        panels.append(markdown_panel_library_ref(p, (0, y, 48, 16)))
        y += 16
    body = {
        "id": OVERVIEW_DASHBOARD_ID,
        "title": OVERVIEW_TITLE,
        "description": (
            "Agent Builder metrics-adoption notes for existing Elastic customers. "
            "Content refreshes from the Metrics adoption — AI dashboard notes workflow."
        ),
        "time_range": {"from": "now-30m", "to": "now"},
        "panels": panels,
    }
    existing = get_dashboard(OVERVIEW_DASHBOARD_ID)
    if existing:
        data = existing.get("data") or existing
        data["panels"] = panels
        data["title"] = OVERVIEW_TITLE
        data["description"] = body["description"]
        if put_dashboard(OVERVIEW_DASHBOARD_ID, data):
            print(f"  ✓ updated dashboard {OVERVIEW_TITLE!r} ({OVERVIEW_DASHBOARD_ID})")
            return
    did = post_dashboard(body)
    if did:
        print(f"  ✓ created dashboard {OVERVIEW_TITLE!r} (id={did})")
        return
    body.pop("id", None)
    did = post_dashboard(body)
    if did:
        print(f"  ✓ created dashboard {OVERVIEW_TITLE!r} (id={did})")


def _panel_blob(panel: dict) -> str:
    return json.dumps(panel, default=str).lower()


def is_ai_notes_panel(panel: dict, platform: str | None = None) -> bool:
    if not isinstance(panel, dict):
        return False
    blob = _panel_blob(panel)
    if "ai metrics adoption notes" in blob:
        if platform and platform not in blob and f"workshop-ai-rec-{platform}" not in blob:
            # Title/content may omit platform; still treat as AI strip to replace.
            return "ai metrics adoption notes" in blob
        return True
    cfg = panel.get("config") or {}
    rid = cfg.get("ref_id") or ""
    if platform and rid == rec_markdown_so_id(platform):
        return True
    if rid.startswith("workshop-ai-rec-"):
        return True
    return False


def is_static_what_why_panel(panel: dict) -> bool:
    if not isinstance(panel, dict):
        return False
    if is_ai_notes_panel(panel):
        return False
    cfg = panel.get("config") or panel.get("embeddableConfig") or {}
    title = str(panel.get("title") or cfg.get("title") or "").lower()
    blob = _panel_blob(panel)
    if "what & why" in title or title == "what and why":
        return True
    if "what this dashboard shows" in blob and "why it matters" in blob:
        return True
    return False


def strip_static_what_why(panels: list) -> tuple[list, int]:
    kept = []
    removed = 0
    for p in panels or []:
        if is_static_what_why_panel(p):
            removed += 1
            continue
        kept.append(p)
    return kept, removed


def upsert_ai_panel(panels: list, platform: str, content: str) -> tuple[list, bool]:
    """Replace existing AI strip or append a by-value markdown panel."""
    out = []
    replaced = False
    for p in panels or []:
        if is_ai_notes_panel(p, platform):
            if not replaced:
                out.append(markdown_panel(platform, (0, _max_panel_y(out) + 1, 48, 14), content=content))
                replaced = True
            continue
        out.append(p)
    if not replaced:
        out.append(markdown_panel(platform, (0, _max_panel_y(out) + 1, 48, 14), content=content))
    return out, True


def _max_panel_y(panels: list) -> int:
    max_y = 0
    for p in panels:
        if not isinstance(p, dict):
            continue
        g = p.get("grid") or p.get("gridData") or {}
        max_y = max(max_y, int(g.get("y", 0)) + int(g.get("h", 0)))
    return max_y


def attach_via_saved_object(platform: str, title: str, dash_id: str, content: str) -> bool:
    """Patch classic Lens/saved-object dashboards (mig-to-kbn upload path)."""
    qid = urllib.parse.quote(dash_id, safe="")
    payload, status = kbn("GET", f"/api/saved_objects/dashboard/{qid}")
    if status != 200 or not isinstance(payload, dict):
        print(f"  · SO GET dashboard {title!r} → HTTP {status}: {str(payload)[:200]}", file=sys.stderr)
        return False
    attrs = dict(payload.get("attributes") or {})
    try:
        panels = json.loads(attrs.get("panelsJSON") or "[]")
    except json.JSONDecodeError:
        panels = []
    if not isinstance(panels, list):
        panels = []
    refs = list(payload.get("references") or [])
    panels, removed = strip_static_what_why(panels)

    # Drop prior AI library refs; we embed by-value for reliability.
    new_panels = []
    for p in panels:
        if is_ai_notes_panel(p, platform):
            continue
        new_panels.append(p)
    panels = new_panels
    keep_ref_names = {
        p.get("panelRefName") for p in panels if isinstance(p, dict) and p.get("panelRefName")
    }
    refs = [
        r
        for r in refs
        if not isinstance(r, dict)
        or (
            r.get("name") in keep_ref_names
            and not (r.get("type") == "markdown" and str(r.get("id", "")).startswith("workshop-ai-rec-"))
        )
    ]

    panel_id = gid()
    panels.append(
        {
            "type": "markdown",
            "gridData": {
                "x": 0,
                "y": _max_panel_y(panels) + 1,
                "w": 48,
                "h": 14,
                "i": panel_id,
            },
            "panelIndex": panel_id,
            "embeddableConfig": {
                "enhancements": {},
                "hideTitle": False,
                "title": ai_panel_title(platform),
                "content": content,
            },
            "title": ai_panel_title(platform),
        }
    )

    attrs["panelsJSON"] = json.dumps(panels)
    attrs["description"] = clean_description(attrs.get("description"))
    body = {"attributes": attrs, "references": refs}
    ver = payload.get("version")
    path_u = f"/api/saved_objects/dashboard/{qid}"
    if ver:
        path_u = f"{path_u}?version={urllib.parse.quote(str(ver), safe='')}"
    result, status = kbn("PUT", path_u, body)
    if status not in (200, 201):
        print(f"  WARN: SO PUT {title!r} → HTTP {status}: {str(result)[:300]}", file=sys.stderr)
        return False
    bits = [f"attached by-value AI notes ({platform})"]
    if removed:
        bits.append(f"removed {removed} static What/why")
    bits.append("via saved_objects")
    print(f"  ✓ {title!r}: " + ", ".join(bits))
    return True


def attach_ai_to_dashboard(platform: str, title: str, dash_id: str, content: str) -> None:
    payload = get_dashboard(dash_id)
    if payload:
        data = payload.get("data") or payload
        panels = list(data.get("panels") or [])
        panels, removed = strip_static_what_why(panels)
        panels, _ = upsert_ai_panel(panels, platform, content)
        data["panels"] = panels
        data["description"] = clean_description(data.get("description"))
        if put_dashboard(dash_id, data):
            bits = [f"attached by-value AI notes ({platform})"]
            if removed:
                bits.append(f"removed {removed} static What/why")
            print(f"  ✓ {title!r}: " + ", ".join(bits))
            return
        print(f"  · Dashboards API PUT failed for {title!r}; trying saved_objects…", file=sys.stderr)

    if not attach_via_saved_object(platform, title, dash_id, content):
        print(f"  WARN: could not attach AI panel to {title!r} ({dash_id})", file=sys.stderr)


def attach_to_migrated_dashboards(platform: str) -> None:
    titles = ATTACH_TITLES.get(platform) or ()
    by_title = list_dashboards_by_title()
    content = get_markdown_content(rec_markdown_so_id(platform))
    attached = 0
    missing = 0
    for title in titles:
        ids = by_title.get(title) or []
        if not ids:
            # Case-insensitive fallback
            lower = {k.lower(): v for k, v in by_title.items()}
            ids = lower.get(title.lower()) or []
        if not ids:
            missing += 1
            print(f"  · skip — dashboard {title!r} not found yet (run migrate first)")
            continue
        for dash_id in ids:
            attach_ai_to_dashboard(platform, title, dash_id, content)
            attached += 1
    if attached:
        print(f"  → processed {attached} {platform} dashboard(s)")
    if missing:
        print(f"  · {missing} {platform} title(s) not found")
    if missing and attached == 0:
        sample = sorted(by_title.keys())[:12]
        print(f"  · known dashboard titles sample: {sample}", file=sys.stderr)


def seed_via_agent_builder(platforms: tuple[str, ...]) -> None:
    for p in platforms:
        prompt = SEED_PROMPTS[p]
        print(f"  → Agent Builder converse ({p})...")
        payload, status = kbn(
            "POST",
            "/api/agent_builder/converse",
            {"input": prompt},
        )
        if status not in (200, 201) or not isinstance(payload, dict):
            print(f"  WARN: converse {p} → HTTP {status}: {str(payload)[:400]}", file=sys.stderr)
            continue
        msg = (
            ((payload.get("response") or {}).get("message"))
            or payload.get("message")
            or ""
        )
        if not msg and isinstance(payload.get("output"), dict):
            msg = (payload["output"].get("response") or {}).get("message") or ""
        if not msg:
            msg = json.dumps(payload)[:2000]
            print(f"  WARN: unexpected converse shape for {p}; writing raw excerpt", file=sys.stderr)
        title = ai_panel_title(p)
        if post_markdown(rec_markdown_so_id(p), title, str(msg)):
            print(f"  ✓ seeded markdown {rec_markdown_so_id(p)}")
        es(
            "POST",
            f"/{REC_INDEX}/_doc",
            {
                "@timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "execution_id": f"seed-{gid()}",
                "workflow_name": "ensure_ai_recommendation_panels.py",
                "source": "agent_builder_seed",
                "dashboard_platform": p,
                "recommendation": str(msg)[:REC_MARKDOWN_MAX],
            },
        )



def main() -> int:
    if not KIBANA_URL:
        sys.exit("ERROR: KIBANA_URL not set")

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed-now", action="store_true", help="Call Agent Builder now to fill markdown")
    ap.add_argument(
        "--platform",
        choices=PLATFORMS,
        action="append",
        help="Limit to one platform (repeatable). Default: both.",
    )
    ap.add_argument("--skip-attach", action="store_true", help="Do not append panels to migrated dashboards")
    args = ap.parse_args()
    platforms = tuple(args.platform) if args.platform else PLATFORMS

    print("==> Metrics adoption AI recommendation panels")
    ensure_rec_index()
    ensure_markdown_placeholders(platforms)
    if args.seed_now:
        seed_via_agent_builder(platforms)
    ensure_overview_dashboard(platforms)
    if not args.skip_attach:
        for p in platforms:
            attach_to_migrated_dashboards(p)
    print("==> Done. Open any migrated dashboard — AI notes strip at the bottom (dbmonitoring pattern).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
