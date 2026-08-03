#!/usr/bin/env python3
"""
Aether Games OTLP fleet — emit gaming + HTTP Prom-compatible metrics to local Alloy (:4318).

Metrics align with assets/grafana/*.json PromQL so migrated Kibana panels light up.
Uses Counter / UpDownCounter / Histogram only (broad OTel Python SDK support).
"""
from __future__ import annotations

import logging
import os
import random
import signal
import sys
import time

from opentelemetry import metrics
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [aether-fleet] %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger("aether-fleet")

OTLP_HTTP = os.environ.get("WORKSHOP_LOCAL_OTLP_HTTP", "http://127.0.0.1:4318/v1/metrics")
INTERVAL = float(os.environ.get("AETHER_FLEET_INTERVAL_SEC", "5"))

SERVICES = (
    "session-gateway",
    "auth",
    "matchmaking",
    "store",
    "party",
    "inventory",
    "voice",
    "chat",
    "cdn-edge",
    "presence",
)
REGIONS = ("us-west", "us-east", "eu-west", "apac")
STATUSES = ("200", "200", "200", "200", "200", "201", "400", "401", "500", "503")

_stop = False


def _handle_sig(*_args) -> None:
    global _stop
    _stop = True


def _setup_meter() -> metrics.Meter:
    resource = Resource.create(
        {
            "service.name": "aether-games-fleet",
            "deployment.environment": "workshop",
            "aether.studio": "Aether Games",
        }
    )
    exporter = OTLPMetricExporter(endpoint=OTLP_HTTP)
    reader = PeriodicExportingMetricReader(exporter, export_interval_millis=5000)
    provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(provider)
    return metrics.get_meter("aether.games.workshop", "1.0.0")


def main() -> int:
    signal.signal(signal.SIGTERM, _handle_sig)
    signal.signal(signal.SIGINT, _handle_sig)

    meter = _setup_meter()
    log.info("Exporting OTLP metrics → %s (interval=%ss)", OTLP_HTTP, INTERVAL)

    http_counter = meter.create_counter("http_requests_total", unit="1")
    http_hist = meter.create_histogram("http_request_duration_seconds", unit="s")

    mm_queue = meter.create_up_down_counter("aether_matchmaking_queue_depth", unit="1")
    mm_wait = meter.create_histogram("aether_matchmaking_wait_seconds", unit="s")
    mm_tickets = meter.create_counter("aether_matchmaking_tickets_total", unit="1")
    mm_matches = meter.create_counter("aether_matchmaking_matches_total", unit="1")

    players = meter.create_up_down_counter("aether_concurrent_players", unit="1")
    capacity = meter.create_up_down_counter("aether_region_capacity", unit="1")
    sessions = meter.create_up_down_counter("aether_active_sessions", unit="1")

    auth_logins = meter.create_counter("aether_auth_logins_total", unit="1")
    store_checkouts = meter.create_counter("aether_store_checkouts_total", unit="1")
    store_hist = meter.create_histogram("aether_store_checkout_duration_seconds", unit="s")

    chat_msgs = meter.create_counter("aether_chat_messages_total", unit="1")
    voice_sessions = meter.create_up_down_counter("aether_voice_sessions", unit="1")
    slo_budget = meter.create_histogram("aether_slo_error_budget_remaining", unit="1")

    parties = meter.create_up_down_counter("aether_active_parties", unit="1")
    invites = meter.create_counter("aether_friend_invites_total", unit="1")

    presence_upd = meter.create_counter("aether_presence_updates_total", unit="1")
    presence_online = meter.create_up_down_counter("aether_presence_online_users", unit="1")
    presence_lag = meter.create_histogram("aether_presence_fanout_lag_ms", unit="ms")

    entitlements = meter.create_counter("aether_entitlement_grants_total", unit="1")
    entitlements_hist = meter.create_histogram("aether_entitlement_grant_duration_seconds", unit="s")

    anticheat = meter.create_counter("aether_anticheat_signals_total", unit="1")
    anticheat_flagged = meter.create_up_down_counter("aether_anticheat_flagged_sessions", unit="1")

    cdn_hit = meter.create_histogram("aether_cdn_cache_hit_ratio", unit="1")
    dep_hist = meter.create_histogram("aether_dependency_duration_seconds", unit="s")
    kafka_lag = meter.create_up_down_counter("aether_kafka_consumer_lag", unit="1")

    region_players = {r: random.randint(8000, 40000) for r in REGIONS}
    region_cap = {r: random.randint(50000, 120000) for r in REGIONS}
    for r in REGIONS:
        players.add(region_players[r], {"region": r})
        capacity.add(region_cap[r], {"region": r})

    # Baseline levels for up-down series so dashboards are non-empty
    sessions.add(12000, {"service": "session-gateway"})
    voice_sessions.add(3500, {"service": "voice"})
    parties.add(2200, {"service": "party"})
    presence_online.add(90000, {"service": "presence"})
    anticheat_flagged.add(40, {"service": "anticheat"})
    kafka_lag.add(1500, {"topic": "session-events"})
    for r in REGIONS:
        mm_queue.add(random.randint(50, 400), {"region": r, "service": "matchmaking"})

    tick = 0
    while not _stop:
        tick += 1
        for svc in SERVICES:
            status = random.choice(STATUSES)
            attrs = {"service": svc, "status": status, "http.method": "POST"}
            http_counter.add(random.randint(5, 80), attrs)
            http_hist.record(random.uniform(0.01, 0.8), attrs)

        for r in REGIONS:
            delta = random.randint(-200, 400)
            if region_players[r] + delta > 1000:
                players.add(delta, {"region": r})
                region_players[r] += delta
            mm_queue.add(random.randint(-5, 12), {"region": r, "service": "matchmaking"})
            mm_wait.record(random.uniform(2.0, 45.0), {"region": r})
            mm_tickets.add(random.randint(10, 60), {"region": r})
            mm_matches.add(random.randint(5, 40), {"region": r})
            presence_upd.add(random.randint(50, 200), {"region": r})
            presence_lag.record(random.uniform(5, 80), {"region": r})
            cdn_hit.record(random.uniform(0.82, 0.98), {"region": r})
            store_checkouts.add(random.randint(2, 25), {"region": r, "service": "store"})
            store_hist.record(random.uniform(0.1, 2.5), {"region": r})

        sessions.add(random.randint(-20, 50), {"service": "session-gateway"})
        auth_logins.add(random.randint(40, 120), {"result": "success", "service": "auth"})
        auth_logins.add(random.randint(1, 15), {"result": "failure", "service": "auth"})
        chat_msgs.add(random.randint(80, 300), {"service": "chat"})
        voice_sessions.add(random.randint(-5, 15), {"service": "voice"})
        slo_budget.record(random.uniform(0.55, 0.98), {"slo": "launch-availability"})
        parties.add(random.randint(-10, 30), {"service": "party"})
        invites.add(random.randint(5, 40), {"service": "party"})
        presence_online.add(random.randint(-50, 100), {"service": "presence"})
        entitlements.add(random.randint(3, 30), {"service": "inventory"})
        entitlements_hist.record(random.uniform(0.05, 0.6), {"service": "inventory"})
        anticheat.add(random.randint(1, 8), {"severity": "low"})
        anticheat.add(random.randint(0, 3), {"severity": "high"})
        anticheat_flagged.add(random.randint(-2, 5), {"service": "anticheat"})
        for dep in ("postgres", "redis", "kafka"):
            dep_hist.record(random.uniform(0.001, 0.15), {"dependency": dep})
        kafka_lag.add(random.randint(-100, 200), {"topic": "session-events"})

        if tick % 12 == 0:
            log.info("tick=%s players≈%s", tick, sum(region_players.values()))
        time.sleep(INTERVAL)

    log.info("Shutting down")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
