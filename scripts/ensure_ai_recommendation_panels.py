#!/usr/bin/env python3
"""
Ensure Agent Builder–driven dashboard analysis on Aether Games workshop boards.

Same pattern as dashboard-alert-migration / dbmonitoring:
  - library Markdown saved objects (workshop-ai-rec-grafana)
  - Elasticsearch index metrics-adoption-recommendations (+ aether-dashboard-briefs)
  - AI Markdown strip on **every** migrated Aether Grafana dashboard
  - dedicated overview dashboard **Aether — AI notes**
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
BRIEFS_INDEX = "aether-dashboard-briefs"
BRIEFS_MARKDOWN_ID = "workshop-aether-dashboard-briefs"
REC_MARKDOWN_MAX = 48000
# This track migrates Grafana → Kibana only; datadog kept for optional re-use.
PLATFORMS = ("grafana",)
OVERVIEW_DASHBOARD_ID = "workshop-aether-ai-notes"
OVERVIEW_TITLE = "Aether — AI notes"

# Titles must match scripts/generate_gaming_grafana_dashboards.py / assets/grafana/*.json.
ATTACH_TITLES: dict[str, tuple[str, ...]] = {
    "grafana": (
        "Aether — Platform overview",
        "Aether — Matchmaking",
        "Aether — Session gateway",
        "Aether — Region capacity",
        "Aether — Auth & login",
        "Aether — Store checkout",
        "Aether — Voice & chat",
        "Aether — Launch window SLO",
        "Aether — Party & social",
        "Aether — Presence service",
        "Aether — Inventory & entitlements",
        "Aether — Anti-cheat signals (O11Y)",
        "Aether — CDN & edge delivery",
        "Aether — Dependency latency",
    ),
    "datadog": (),
}

AETHER_DASHBOARD_CATALOG = """
1. Aether — Platform overview — RPS, error rate, latency, concurrent players, request rate by service
2. Aether — Matchmaking — queue depth, wait time, tickets/sec, matches, region breakdowns
3. Aether — Session gateway — gateway RPS, 5xx, active sessions, connect latency
4. Aether — Region capacity — concurrent players vs capacity by region
5. Aether — Auth & login — login success/failure, auth latency
6. Aether — Store checkout — checkout volume and duration
7. Aether — Voice & chat — voice sessions and chat message rate
8. Aether — Launch window SLO — error-budget style launch availability signal
9. Aether — Party & social — parties, invites, party latency
10. Aether — Presence service — presence updates/s, online users, fan-out lag, by region
11. Aether — Inventory & entitlements — entitlement grants and grant latency
12. Aether — Anti-cheat signals (O11Y) — signal volume and flagged sessions
13. Aether — CDN & edge delivery — cache hit ratio and edge latency
14. Aether — Dependency latency — postgres / redis / kafka dependency timings
""".strip()

SEED_PROMPTS = {
    "grafana": f"""You are an Elastic Observability SRE coach for the fictional AAA studio **Aether Games**.

Telemetry path: OpenTelemetry → Grafana Alloy → Elastic managed OTLP (mOTLP).
Indices: **metrics-***, **logs-***, **traces-***. Region attributes are usually top-level **region**.
Latency series are **gauges** (avg(...)); Kafka lag and counters are plain numeric fields.

Dashboard catalog (one section each):
{AETHER_DASHBOARD_CATALOG}

Produce markdown (max ~80 lines) with **one H3 section per dashboard** in catalog order.
For each dashboard include exactly:
- **Shows** — 1–2 sentences on what operators use the board for
- **Read** — 2–4 bullets on golden signals (RPS, errors, latency, queue, players, etc.)
- **Issues & resolve** — If healthy: "No acute issue — continue monitoring."
  Otherwise prefer these workshop failure modes when relevant:
  1. **verification_exception Unknown column *_sum / *_count / value** → remigrate with
     WORKSHOP_FORCE_OTEL_RESTART=1 bash scripts/migrate_grafana_dashboards_to_serverless.sh
     (fleet emits gauges; Lab 1 patches leftover histogram ES|QL).
  2. **Unknown column cloud.region** → run
     python3 tools/patch_aether_dashboard_region_fields.py --search Aether
  3. **High 5xx / auth failure spike** → Discover status=~5..; check Auth + Session gateway;
     review disabled alert drafts; Security correlation is A2A/CCS stub in Lab 2.
  4. **Empty charts** → restart fleet, wait 1–2 minutes, confirm metrics-* in Discover.

End with a short **Ops checklist** (5 bullets): seed → Platform overview → Matchmaking → Auth →
enable alert drafts only after review.

Do not invent cluster hostnames. Keep language actionable for Instruqt + Kibana.""",
    "datadog": """You are an Elastic Observability specialist. This Aether Games track does not
migrate Datadog boards; reply with a one-line note that Grafana/Aether AI notes apply instead.""",
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
                "brief": {"type": "text"},
                "dashboard_count": {"type": "integer"},
            }
        }
    }
    ok = True
    for index in (REC_INDEX, BRIEFS_INDEX):
        payload, status = es("PUT", f"/{index}", mappings)
        if status in (200, 201):
            print(f"  ✓ index {index} ready (HTTP {status})")
            continue
        if status == 400 and isinstance(payload, dict) and "resource_already_exists" in str(
            payload.get("_body", "")
        ):
            print(f"  ✓ index {index} already exists")
            continue
        _, gstatus = es("GET", f"/{index}")
        if gstatus == 200:
            print(f"  ✓ index {index} already exists")
            continue
        print(f"  WARN: ensure index {index} → HTTP {status}: {str(payload)[:300]}", file=sys.stderr)
        ok = False
    return ok


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
        "### Aether AI dashboard analysis\n\n"
        "_This panel updates when **Aether — dashboard briefs (Agent Builder)** or "
        "**Metrics adoption — AI dashboard notes** runs "
        "(Management → Workflows), or re-run: "
        "`python3 scripts/ensure_ai_recommendation_panels.py --seed-now`._"
    )
    ok = True
    for p in platforms:
        sid = rec_markdown_so_id(p)
        title = ai_panel_title(p)
        if markdown_exists(sid):
            print(f"  ✓ markdown {sid} exists")
        elif post_markdown(sid, title, placeholder):
            print(f"  ✓ created markdown {sid}")
        else:
            ok = False
    if markdown_exists(BRIEFS_MARKDOWN_ID):
        print(f"  ✓ markdown {BRIEFS_MARKDOWN_ID} exists")
    elif post_markdown(BRIEFS_MARKDOWN_ID, "Aether — AI dashboard briefs", placeholder):
        print(f"  ✓ created markdown {BRIEFS_MARKDOWN_ID}")
    else:
        ok = False
    return ok


def ai_panel_title(platform: str) -> str:
    if platform == "grafana":
        return "AI Aether dashboard analysis"
    return f"AI Aether notes — {platform}"


def get_markdown_content(so_id: str) -> str:
    qid = urllib.parse.quote(so_id, safe="")
    payload, status = kbn("GET", f"/api/saved_objects/markdown/{qid}")
    if status == 200 and isinstance(payload, dict):
        attrs = payload.get("attributes") or {}
        content = attrs.get("content") or ""
        if content.strip():
            return str(content)[:REC_MARKDOWN_MAX]
    return (
        "### Aether AI dashboard analysis\n\n"
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
    if d and "AI notes" not in d and "AI analysis" not in d:
        return f"{d} — Agent Builder analysis at bottom."
    return d or "Aether Games workshop board — Agent Builder analysis at bottom."


def ensure_overview_dashboard(platforms: tuple[str, ...]) -> None:
    panels = []
    y = 0
    for p in platforms:
        # Overview keeps library refs so the workflow refresh is visible without re-attach.
        panels.append(markdown_panel_library_ref(p, (0, y, 48, 16)))
        y += 16
    # Also surface the dedicated briefs library markdown.
    panels.append(
        {
            "type": "markdown",
            "id": gid(),
            "grid": {"x": 0, "y": y, "w": 48, "h": 16},
            "config": {"ref_id": BRIEFS_MARKDOWN_ID},
        }
    )
    body = {
        "id": OVERVIEW_DASHBOARD_ID,
        "title": OVERVIEW_TITLE,
        "description": (
            "Agent Builder analysis for Aether Games dashboards (PromQL → Kibana). "
            "Content refreshes from **Aether — dashboard briefs** and "
            "**Metrics adoption — AI dashboard notes** workflows."
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
    markers = (
        "ai metrics adoption notes",
        "ai aether dashboard analysis",
        "ai aether notes",
        "ai aether ops notes",
    )
    if any(m in blob for m in markers):
        return True
    cfg = panel.get("config") or {}
    rid = cfg.get("ref_id") or ""
    if platform and rid == rec_markdown_so_id(platform):
        return True
    if rid.startswith("workshop-ai-rec-") or rid == BRIEFS_MARKDOWN_ID:
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
        if p == "grafana" and post_markdown(BRIEFS_MARKDOWN_ID, "Aether — AI dashboard briefs", str(msg)):
            print(f"  ✓ seeded markdown {BRIEFS_MARKDOWN_ID}")
        ts = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
        es(
            "POST",
            f"/{REC_INDEX}/_doc",
            {
                "@timestamp": ts,
                "execution_id": f"seed-{gid()}",
                "workflow_name": "ensure_ai_recommendation_panels.py",
                "source": "agent_builder_seed",
                "dashboard_platform": p,
                "recommendation": str(msg)[:REC_MARKDOWN_MAX],
            },
        )
        if p == "grafana":
            es(
                "POST",
                f"/{BRIEFS_INDEX}/_doc",
                {
                    "@timestamp": ts,
                    "execution_id": f"seed-{gid()}",
                    "workflow_name": "ensure_ai_recommendation_panels.py",
                    "source": "agent_builder_seed",
                    "dashboard_count": len(ATTACH_TITLES.get("grafana") or ()),
                    "brief": str(msg)[:REC_MARKDOWN_MAX],
                },
            )


def main() -> int:
    if not KIBANA_URL:
        sys.exit("ERROR: KIBANA_URL not set")

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed-now", action="store_true", help="Call Agent Builder now to fill markdown")
    ap.add_argument(
        "--platform",
        choices=("grafana", "datadog"),
        action="append",
        help="Limit to one platform (repeatable). Default: grafana.",
    )
    ap.add_argument("--skip-attach", action="store_true", help="Do not append panels to migrated dashboards")
    args = ap.parse_args()
    platforms = tuple(args.platform) if args.platform else PLATFORMS

    print("==> Aether Agent Builder dashboard analysis panels")
    ensure_rec_index()
    ensure_markdown_placeholders(platforms)
    if args.seed_now:
        seed_via_agent_builder(platforms)
    ensure_overview_dashboard(platforms)
    if not args.skip_attach:
        for p in platforms:
            attach_to_migrated_dashboards(p)
    print(
        "==> Done. Open any Aether — * dashboard — AI analysis strip at the bottom "
        f"(overview: {OVERVIEW_TITLE!r})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
