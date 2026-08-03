#!/usr/bin/env python3
"""
Rewrite cloud.region → region in Aether (and optional) Kibana dashboards.

grafana-migrate's OTel profile maps PromQL ``by (region)`` to ECS ``cloud.region``,
but the workshop OTLP fleet emits a top-level ``region`` attribute (Elastic suggests
``region`` when cloud.region is missing). Patch after migrate so region breakdown
panels work without remapping fleet attributes.

Env: KIBANA_URL + KIBANA_API_KEY or ES_API_KEY (or ES_USERNAME/ES_PASSWORD)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import requests

OLD = "cloud.region"
NEW = "region"


def kibana_client() -> tuple[str, dict[str, str], Any]:
    kibana = (os.environ.get("KIBANA_URL") or "").rstrip("/")
    if not kibana:
        print("ERROR: KIBANA_URL is not set", file=sys.stderr)
        sys.exit(1)
    api_key = (os.environ.get("KIBANA_API_KEY") or os.environ.get("ES_API_KEY") or "").strip()
    user = (os.environ.get("ES_USERNAME") or "").strip()
    password = (os.environ.get("ES_PASSWORD") or "").strip()
    headers: dict[str, str] = {"kbn-xsrf": "true", "Content-Type": "application/json"}
    auth: Any = None
    if api_key:
        headers["Authorization"] = f"ApiKey {api_key}"
    elif user and password:
        auth = (user, password)
    else:
        print("ERROR: Set KIBANA_API_KEY or ES_API_KEY", file=sys.stderr)
        sys.exit(1)
    return kibana, headers, auth


def _replace_in_obj(obj: Any) -> tuple[Any, int]:
    raw = json.dumps(obj, separators=(",", ":"))
    count = raw.count(OLD)
    if not count:
        return obj, 0
    return json.loads(raw.replace(OLD, NEW)), count


def find_dashboards(kibana: str, headers: dict[str, str], auth: Any, search: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    page = 1
    per_page = 50
    while True:
        r = requests.get(
            f"{kibana}/api/saved_objects/_find",
            headers=headers,
            auth=auth,
            params={
                "type": "dashboard",
                "search": search,
                "search_fields": "title",
                "per_page": per_page,
                "page": page,
            },
            timeout=60,
        )
        r.raise_for_status()
        body = r.json()
        found.extend(body.get("saved_objects") or [])
        total = int(body.get("total") or 0)
        if page * per_page >= total or not body.get("saved_objects"):
            break
        page += 1
    return found


def patch_dashboard(
    kibana: str,
    headers: dict[str, str],
    auth: Any,
    so_id: str,
) -> tuple[bool, int, str]:
    r = requests.get(
        f"{kibana}/api/saved_objects/dashboard/{so_id}",
        headers=headers,
        auth=auth,
        timeout=60,
    )
    if not r.ok:
        return False, 0, f"GET HTTP {r.status_code}"
    doc = r.json()
    attrs = doc.get("attributes") or {}
    new_attrs, n = _replace_in_obj(attrs)
    if n == 0:
        return True, 0, "no-op"
    # Also patch related lens/visualization refs if embedded in attributes only — panelsJSON holds queries.
    put = requests.put(
        f"{kibana}/api/saved_objects/dashboard/{so_id}",
        headers=headers,
        auth=auth,
        json={"attributes": new_attrs},
        timeout=120,
    )
    if not put.ok:
        return False, n, f"PUT HTTP {put.status_code} {put.text[:300]}"
    return True, n, "patched"


def patch_lens_and_viz(
    kibana: str,
    headers: dict[str, str],
    auth: Any,
    search: str,
) -> tuple[int, int]:
    """Patch lens / visualization saved objects whose title matches (queries often live here)."""
    patched = 0
    replacements = 0
    for so_type in ("lens", "visualization", "map", "query"):
        page = 1
        while True:
            r = requests.get(
                f"{kibana}/api/saved_objects/_find",
                headers=headers,
                auth=auth,
                params={
                    "type": so_type,
                    "search": search,
                    "per_page": 50,
                    "page": page,
                },
                timeout=60,
            )
            if not r.ok:
                break
            body = r.json()
            objs = body.get("saved_objects") or []
            for so in objs:
                so_id = so.get("id")
                if not so_id:
                    continue
                g = requests.get(
                    f"{kibana}/api/saved_objects/{so_type}/{so_id}",
                    headers=headers,
                    auth=auth,
                    timeout=60,
                )
                if not g.ok:
                    continue
                doc = g.json()
                attrs = doc.get("attributes") or {}
                new_attrs, n = _replace_in_obj(attrs)
                if n == 0:
                    continue
                p = requests.put(
                    f"{kibana}/api/saved_objects/{so_type}/{so_id}",
                    headers=headers,
                    auth=auth,
                    json={"attributes": new_attrs},
                    timeout=120,
                )
                if p.ok:
                    patched += 1
                    replacements += n
            total = int(body.get("total") or 0)
            if page * 50 >= total or not objs:
                break
            page += 1
    return patched, replacements


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--search", default="Aether", help="Dashboard title search (default: Aether)")
    args = ap.parse_args()
    kibana, headers, auth = kibana_client()

    dashboards = find_dashboards(kibana, headers, auth, args.search)
    print(f"Found {len(dashboards)} dashboard(s) matching {args.search!r}")
    ok = 0
    changed = 0
    total_repl = 0
    for so in dashboards:
        so_id = str(so.get("id") or "")
        title = ((so.get("attributes") or {}).get("title")) or so_id
        good, n, msg = patch_dashboard(kibana, headers, auth, so_id)
        if good:
            ok += 1
            if n:
                changed += 1
                total_repl += n
                print(f"OK  {title}: replaced {n}× {OLD}→{NEW}")
            else:
                print(f"—   {title}: already clean")
        else:
            print(f"FAIL {title}: {msg}", file=sys.stderr)

    lens_n, lens_repl = patch_lens_and_viz(kibana, headers, auth, args.search)
    if lens_n:
        print(f"Also patched {lens_n} lens/visualization object(s) ({lens_repl} replacements)")
        total_repl += lens_repl

    print(f"Done: {ok}/{len(dashboards)} dashboards ok, {changed} updated, {total_repl} total replacements")
    return 0 if ok == len(dashboards) or not dashboards else 1


if __name__ == "__main__":
    raise SystemExit(main())
