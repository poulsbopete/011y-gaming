# Dashboard sprawl and broken widgets

Punchline: **migrate off Grafana and Datadog, then fix blank widgets in Elastic.**

Aether Games cutovers launch-week boards into Observability Serverless. Relabel, dropped labels, or a renamed duration metric still blanks panels in Kibana — SREs get paged for “the dashboard is broken,” not a missing index.

Elastic inventories those **migrated** dashboards → the indexes they query, watches widget fields, alerts when a schema change would break a widget (`FROM index | KEEP \`field\` | LIMIT 1`), and remaps the broken queries so widgets go live again.

## Live POV (otel-demo)

| Surface | URL |
| --- | --- |
| Dashboard **Horizon — Dashboard sprawl** | https://otel-demo-a5630c.kb.us-east-1.aws.elastic.cloud/app/dashboards#/view/horizon-dashboard-sprawl |
| Workflow **Dashboard schema drift check** | https://otel-demo-a5630c.kb.us-east-1.aws.elastic.cloud/app/workflows/dashboard-schema-drift-check |
| Alert **Dashboard schema drift** | https://otel-demo-a5630c.kb.us-east-1.aws.elastic.cloud/app/management/insightsAndAlerting/triggersActions/rule/dashboard-schema-drift |

Indexes: `dashboard-index-usage`, `dashboard-widget-fields`, `dashboard-schema-drift`. Inventory is from **live dashboard definitions** (no `.elastic-audit-*` on Serverless).

Do **not** use `{{ execution.startedAt }}` as a date in the workflow — it is a JS Date string Elasticsearch will reject. The ingest pipeline `dashboard-schema-drift-timestamp` sets `@timestamp` with `override: false`.

## Workshop

After Lab 1 `grafana-migrate`, `scripts/deploy_dashboard_sprawl.py` runs (skip with `WORKSHOP_SKIP_SPRAWL=1`).

```bash
export SPRAWL_COMPETITOR=grafana
export SPRAWL_WITH_WORKFLOW=1
python3 scripts/deploy_dashboard_sprawl.py
```

Open **Dashboards → Horizon — Dashboard sprawl** on the play’s Kibana (`:8080`).

## Vercel demo

Module **Broken widgets** deep-links the otel-demo board, workflow, and alert.
