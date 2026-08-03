#!/usr/bin/env python3
"""Generate Aether Games Grafana dashboard JSON (PromQL) for the workshop."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets" / "grafana"

DATASOURCE = {
    "name": "datasource",
    "type": "datasource",
    "query": "prometheus",
    "current": {"selected": True, "text": "Prometheus", "value": "Prometheus"},
}


def panel_stat(title: str, expr: str, x: int, y: int, w: int = 6, h: int = 6, unit: str = "short") -> dict:
    return {
        "type": "stat",
        "title": title,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": {"type": "prometheus", "uid": "${datasource}"},
        "targets": [{"expr": expr, "legendFormat": "", "refId": "A"}],
        "fieldConfig": {"defaults": {"unit": unit, "decimals": 2}, "overrides": []},
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": "auto",
            "textMode": "auto",
            "colorMode": "value",
            "graphMode": "area",
        },
    }


def panel_ts(title: str, expr: str, x: int, y: int, w: int = 12, h: int = 8, legend: str = "{{service}}") -> dict:
    return {
        "type": "timeseries",
        "title": title,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "datasource": {"type": "prometheus", "uid": "${datasource}"},
        "targets": [{"expr": expr, "legendFormat": legend, "refId": "A"}],
        "fieldConfig": {"defaults": {"unit": "short", "custom": {"drawStyle": "line", "fillOpacity": 10}}, "overrides": []},
        "options": {"legend": {"displayMode": "list", "placement": "bottom"}, "tooltip": {"mode": "multi"}},
    }


def dashboard(uid: str, title: str, description: str, panels: list[dict]) -> dict:
    return {
        "uid": uid,
        "title": title,
        "description": description,
        "timezone": "browser",
        "schemaVersion": 39,
        "version": 1,
        "refresh": "10s",
        "time": {"from": "now-1h", "to": "now"},
        "templating": {"list": [DATASOURCE]},
        "panels": panels,
        "tags": ["aether-games", "workshop", "prometheus"],
    }


BOARDS: list[tuple[str, str, str, list[dict]]] = [
    (
        "01-platform-overview",
        "Aether — Platform overview",
        "Global request rate and error overview across Aether Games platform services.",
        [
            panel_stat("RPS (all services)", "sum(rate(http_requests_total[5m]))", 0, 0),
            panel_stat("Error rate", 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))', 6, 0, unit="percentunit"),
            panel_stat("p95 latency", "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))", 12, 0, unit="s"),
            panel_stat("Concurrent players", "sum(aether_concurrent_players)", 18, 0),
            panel_ts("Request rate by service", "sum(rate(http_requests_total[5m])) by (service)", 0, 6, w=24),
        ],
    ),
    (
        "02-matchmaking",
        "Aether — Matchmaking",
        "Queue depth, wait time, and ticket success for competitive matchmaking.",
        [
            panel_stat("Queue depth", "sum(aether_matchmaking_queue_depth)", 0, 0),
            panel_stat("Avg wait (s)", "avg(aether_matchmaking_wait_seconds)", 6, 0, unit="s"),
            panel_stat("Tickets/sec", "sum(rate(aether_matchmaking_tickets_total[5m]))", 12, 0),
            panel_stat("Match found rate", "sum(rate(aether_matchmaking_matches_total[5m]))", 18, 0),
            panel_ts("Queue depth by region", "sum(aether_matchmaking_queue_depth) by (region)", 0, 6, w=12, legend="{{region}}"),
            panel_ts("Wait time by region", "avg(aether_matchmaking_wait_seconds) by (region)", 12, 6, w=12, legend="{{region}}"),
        ],
    ),
    (
        "03-session-gateway",
        "Aether — Session gateway",
        "Session gateway RPS, errors, and latency for live game sessions.",
        [
            panel_stat("Gateway RPS", 'sum(rate(http_requests_total{service="session-gateway"}[5m]))', 0, 0),
            panel_stat("5xx rate", 'sum(rate(http_requests_total{service="session-gateway",status=~"5.."}[5m]))', 6, 0),
            panel_stat("Active sessions", "sum(aether_active_sessions)", 12, 0),
            panel_stat("p95 connect", 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="session-gateway"}[5m])) by (le))', 18, 0, unit="s"),
            panel_ts("Gateway throughput", 'sum(rate(http_requests_total{service="session-gateway"}[5m])) by (status)', 0, 6, w=24, legend="{{status}}"),
        ],
    ),
    (
        "04-region-capacity",
        "Aether — Region capacity",
        "Concurrent players and capacity headroom by region for launch windows.",
        [
            panel_stat("Players (global)", "sum(aether_concurrent_players)", 0, 0),
            panel_stat("Capacity used", "sum(aether_concurrent_players) / sum(aether_region_capacity)", 6, 0, unit="percentunit"),
            panel_ts("Players by region", "sum(aether_concurrent_players) by (region)", 0, 6, w=12, legend="{{region}}"),
            panel_ts("Capacity by region", "sum(aether_region_capacity) by (region)", 12, 6, w=12, legend="{{region}}"),
        ],
    ),
    (
        "05-auth-login",
        "Aether — Auth & login",
        "Login success/failure rates and auth service latency.",
        [
            panel_stat("Login success/s", 'sum(rate(aether_auth_logins_total{result="success"}[5m]))', 0, 0),
            panel_stat("Login failure/s", 'sum(rate(aether_auth_logins_total{result="failure"}[5m]))', 6, 0),
            panel_stat("Failure ratio", 'sum(rate(aether_auth_logins_total{result="failure"}[5m])) / sum(rate(aether_auth_logins_total[5m]))', 12, 0, unit="percentunit"),
            panel_stat("Auth p95", 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="auth"}[5m])) by (le))', 18, 0, unit="s"),
            panel_ts("Logins by result", "sum(rate(aether_auth_logins_total[5m])) by (result)", 0, 6, w=24, legend="{{result}}"),
        ],
    ),
    (
        "06-store-checkout",
        "Aether — Store checkout",
        "Digital store checkout latency and purchase volume.",
        [
            panel_stat("Checkouts/s", "sum(rate(aether_store_checkouts_total[5m]))", 0, 0),
            panel_stat("Checkout p95", "histogram_quantile(0.95, sum(rate(aether_store_checkout_duration_seconds_bucket[5m])) by (le))", 6, 0, unit="s"),
            panel_stat("Store errors/s", 'sum(rate(http_requests_total{service="store",status=~"5.."}[5m]))', 12, 0),
            panel_ts("Checkout volume", "sum(rate(aether_store_checkouts_total[5m])) by (region)", 0, 6, w=24, legend="{{region}}"),
        ],
    ),
    (
        "07-voice-chat",
        "Aether — Voice & chat",
        "Voice and chat service errors and message throughput.",
        [
            panel_stat("Chat msgs/s", "sum(rate(aether_chat_messages_total[5m]))", 0, 0),
            panel_stat("Voice sessions", "sum(aether_voice_sessions)", 6, 0),
            panel_stat("Voice/chat errors", 'sum(rate(http_requests_total{service=~"voice|chat",status=~"5.."}[5m]))', 12, 0),
            panel_ts("Chat throughput", "sum(rate(aether_chat_messages_total[5m])) by (service)", 0, 6, w=24),
        ],
    ),
    (
        "08-launch-slo",
        "Aether — Launch window SLO",
        "SLO burn and error budget for title launch windows.",
        [
            panel_stat("Availability (1h)", '1 - (sum(rate(http_requests_total{status=~"5.."}[1h])) / sum(rate(http_requests_total[1h])))', 0, 0, unit="percentunit"),
            panel_stat("Burn rate (5m)", 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) / 0.001', 6, 0),
            panel_stat("Error budget remaining", "aether_slo_error_budget_remaining", 12, 0, unit="percentunit"),
            panel_ts("5xx rate", 'sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)', 0, 6, w=24),
        ],
    ),
    (
        "09-party-social",
        "Aether — Party & social",
        "Party formation and social graph API health.",
        [
            panel_stat("Active parties", "sum(aether_active_parties)", 0, 0),
            panel_stat("Party API RPS", 'sum(rate(http_requests_total{service="party"}[5m]))', 6, 0),
            panel_stat("Friend invites/s", "sum(rate(aether_friend_invites_total[5m]))", 12, 0),
            panel_ts("Party service latency p95", 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="party"}[5m])) by (le))', 0, 6, w=24, legend="p95"),
        ],
    ),
    (
        "10-presence",
        "Aether — Presence service",
        "Online presence updates and fan-out lag.",
        [
            panel_stat("Presence updates/s", "sum(rate(aether_presence_updates_total[5m]))", 0, 0),
            panel_stat("Online users", "sum(aether_presence_online_users)", 6, 0),
            panel_stat("Fan-out lag (ms)", "avg(aether_presence_fanout_lag_ms)", 12, 0, unit="ms"),
            panel_ts("Presence updates by region", "sum(rate(aether_presence_updates_total[5m])) by (region)", 0, 6, w=24, legend="{{region}}"),
        ],
    ),
    (
        "11-inventory",
        "Aether — Inventory & entitlements",
        "Inventory service throughput and entitlement grant latency.",
        [
            panel_stat("Inventory RPS", 'sum(rate(http_requests_total{service="inventory"}[5m]))', 0, 0),
            panel_stat("Entitlement grants/s", "sum(rate(aether_entitlement_grants_total[5m]))", 6, 0),
            panel_stat("Grant p95", "histogram_quantile(0.95, sum(rate(aether_entitlement_grant_duration_seconds_bucket[5m])) by (le))", 12, 0, unit="s"),
            panel_ts("Inventory errors", 'sum(rate(http_requests_total{service="inventory",status=~"5.."}[5m]))', 0, 6, w=24, legend="5xx"),
        ],
    ),
    (
        "12-anti-cheat-signals",
        "Aether — Anti-cheat signals (O11Y)",
        "Platform-side anti-cheat signal volume (O11Y metrics only — fraud cases live in Security).",
        [
            panel_stat("Signals/s", "sum(rate(aether_anticheat_signals_total[5m]))", 0, 0),
            panel_stat("High severity", 'sum(rate(aether_anticheat_signals_total{severity="high"}[5m]))', 6, 0),
            panel_stat("Flagged sessions", "sum(aether_anticheat_flagged_sessions)", 12, 0),
            panel_ts("Signals by severity", "sum(rate(aether_anticheat_signals_total[5m])) by (severity)", 0, 6, w=24, legend="{{severity}}"),
        ],
    ),
    (
        "13-cdn-edge",
        "Aether — CDN & edge delivery",
        "Patch and asset delivery edge latency and cache hit ratio.",
        [
            panel_stat("Edge RPS", 'sum(rate(http_requests_total{service="cdn-edge"}[5m]))', 0, 0),
            panel_stat("Cache hit ratio", "avg(aether_cdn_cache_hit_ratio)", 6, 0, unit="percentunit"),
            panel_stat("Edge p95", 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="cdn-edge"}[5m])) by (le))', 12, 0, unit="s"),
            panel_ts("Cache hit by region", "avg(aether_cdn_cache_hit_ratio) by (region)", 0, 6, w=24, legend="{{region}}"),
        ],
    ),
    (
        "14-deps-latency",
        "Aether — Dependency latency",
        "Downstream dependency latency for platform services.",
        [
            panel_stat("DB p95", 'histogram_quantile(0.95, sum(rate(aether_dependency_duration_seconds_bucket{dependency="postgres"}[5m])) by (le))', 0, 0, unit="s"),
            panel_stat("Redis p95", 'histogram_quantile(0.95, sum(rate(aether_dependency_duration_seconds_bucket{dependency="redis"}[5m])) by (le))', 6, 0, unit="s"),
            panel_stat("Kafka lag", "sum(aether_kafka_consumer_lag)", 12, 0),
            panel_ts("Dependency latency", "histogram_quantile(0.95, sum(rate(aether_dependency_duration_seconds_bucket[5m])) by (le, dependency))", 0, 6, w=24, legend="{{dependency}}"),
        ],
    ),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for uid, title, desc, panels in BOARDS:
        path = OUT / f"{uid}.json"
        path.write_text(json.dumps(dashboard(uid, title, desc, panels), indent=2) + "\n")
        print(f"wrote {path.name}")
    print(f"OK: {len(BOARDS)} dashboards → {OUT}")


if __name__ == "__main__":
    main()
