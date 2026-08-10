# Lab 1 — Facilitator notes (Aether Games)

**Framing:** Existing Elastic customers (or metrics POV) consolidating Prometheus/Grafana for a AAA gaming platform. Do **not** name real publishers.

**Learner action:** one migrate command. Emphasize OTLP → mOTLP path and draft governance for alerts (Lab 2).

**If panels empty:** wait ~1–2 minutes after migrate; confirm Alloy + `otel_gaming_fleet.py` with `bash scripts/check_workshop_otel_pipeline.sh`.

**Agent Builder analysis:** Lab 1 migrate seeds and attaches an AI strip to every `Aether — *` board (same pattern as dashboard-alert-migration). Overview: **Aether — AI notes**. Re-seed:

```bash
python3 /root/workshop/scripts/ensure_ai_recommendation_panels.py --platform grafana --seed-now
```

**If panels show `verification_exception` / Unknown column (`_sum`, `_count`, or `value`):** latency metrics must be gauges. Re-run with a fleet restart so migrate rewrites ES|QL:

```bash
WORKSHOP_FORCE_OTEL_RESTART=1 bash scripts/migrate_grafana_dashboards_to_serverless.sh
```

**Security / fraud:** out of scope for Lab 1 — preview only in Lab 2 stub + Vercel demo.
