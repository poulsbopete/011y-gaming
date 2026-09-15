# Dashboard sprawl and broken widgets

Punchline: **developers change schema; Elastic detects it; AI remaps the widgets.**

Schema changes are not planned — game and platform engineers rename metrics and drop labels anyway. After Grafana/Datadog boards live on Observability Serverless, that silently blanks panels in Kibana.

Elastic inventories those **migrated** dashboards → the indexes they query, KEEP-probes widget fields (`FROM index | KEEP \`field\` | LIMIT 1`), and Agent Builder maps old fields to what is actually in the index so widgets go live again.

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

Module **Broken widgets** deep-links Horizon and the schema-drift workflow/alert. **Aether — AI notes** is created in the Instruqt play by `ensure_ai_recommendation_panels.py`, not on the fixed otel-demo project.
