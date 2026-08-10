#!/usr/bin/env python3
"""
Rewrite broken Prom-histogram ES|QL leftovers in Aether Kibana dashboards.

Older grafana-migrate output / histogram OTel ingest can leave queries that use:
  - ``*_sum`` / ``*_count`` histogram suffixes (missing on Serverless gauge ingest)
  - bare ``value`` (exponential histograms expose ``value_$1``, ``value_$2``, …)

This pass rewrites common patterns to gauge-friendly ``AVG(metric)`` forms after migrate.

Env: KIBANA_URL + ES_API_KEY (or KIBANA_API_KEY)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import requests

# rate(foo_sum)/rate(foo_count) style → AVG(foo)
_SUM_COUNT_DIV = re.compile(
    r"SUM\s*\(\s*`?(?P<base>[a-zA-Z0-9_.]+)_sum`?\s*\)\s*/\s*SUM\s*\(\s*`?(?P=base)_count`?\s*\)",
    re.IGNORECASE,
)
# Only rewrite ``value`` when it is clearly an ES|QL column (not JSON option strings
# like ``"colorMode": "value"``).
_ESQL_VALUE_COL = re.compile(
    r"(?P<prefix>\b(?:AVG|SUM|MAX|MIN|MEDIAN|COUNT)\s*\(\s*`?)"
    r"value"
    r"(?P<suffix>`?\s*\))",
    re.IGNORECASE,
)
_ESQL_VALUE_TICK = re.compile(r"`value`")


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


def rewrite_esql(text: str) -> tuple[str, int]:
    n = 0

    def _sum_count(m: re.Match[str]) -> str:
        nonlocal n
        n += 1
        return f"AVG(`{m.group('base')}`)"

    text2 = _SUM_COUNT_DIV.sub(_sum_count, text)

    # Bare ``value`` fails verification on exponential histograms; prefer ``value_$1``.
    # Do not COALESCE with ``value`` — unknown columns fail ES|QL verify.
    if "value_$" not in text2:

        def _val_fn(m: re.Match[str]) -> str:
            nonlocal n
            n += 1
            return f"{m.group('prefix')}value_$1{m.group('suffix')}"

        text2 = _ESQL_VALUE_COL.sub(_val_fn, text2)
        text2, vn = _ESQL_VALUE_TICK.subn("`value_$1`", text2)
        n += vn
    return text2, n


def _replace_in_obj(obj: Any) -> tuple[Any, int]:
    raw = json.dumps(obj, separators=(",", ":"))
    new_raw, n = rewrite_esql(raw)
    if not n:
        return obj, 0
    return json.loads(new_raw), n


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


def patch_so(
    kibana: str,
    headers: dict[str, str],
    auth: Any,
    so_type: str,
    so_id: str,
) -> tuple[bool, int, str]:
    r = requests.get(
        f"{kibana}/api/saved_objects/{so_type}/{so_id}",
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
    put = requests.put(
        f"{kibana}/api/saved_objects/{so_type}/{so_id}",
        headers=headers,
        auth=auth,
        json={"attributes": new_attrs},
        timeout=120,
    )
    if not put.ok:
        return False, n, f"PUT HTTP {put.status_code} {put.text[:300]}"
    return True, n, "patched"


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
        good, n, msg = patch_so(kibana, headers, auth, "dashboard", so_id)
        if good:
            ok += 1
            if n:
                changed += 1
                total_repl += n
                print(f"OK  {title}: {n} rewrite(s)")
            else:
                print(f"—   {title}: already clean")
        else:
            print(f"FAIL {title}: {msg}", file=sys.stderr)

    # Lens / viz often hold the ES|QL
    for so_type in ("lens", "visualization"):
        page = 1
        while True:
            r = requests.get(
                f"{kibana}/api/saved_objects/_find",
                headers=headers,
                auth=auth,
                params={"type": so_type, "search": args.search, "per_page": 50, "page": page},
                timeout=60,
            )
            if not r.ok:
                break
            body = r.json()
            for so in body.get("saved_objects") or []:
                so_id = so.get("id")
                if not so_id:
                    continue
                good, n, _msg = patch_so(kibana, headers, auth, so_type, so_id)
                if good and n:
                    changed += 1
                    total_repl += n
                    print(f"OK  {so_type}/{so_id}: {n} rewrite(s)")
            total = int(body.get("total") or 0)
            if page * 50 >= total or not body.get("saved_objects"):
                break
            page += 1

    print(f"Done: {ok}/{len(dashboards)} dashboards ok, {changed} objects updated, {total_repl} rewrites")
    return 0 if ok == len(dashboards) or not dashboards else 1


if __name__ == "__main__":
    raise SystemExit(main())
