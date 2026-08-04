# Loki LogQL via A2A (stub)

Customer POV: **call Loki from Elastic so teams can use Kibana** during a Grafana LGTM
migration — without ripping out Loki on day one.

## What ships

| Artifact | Role |
| --- | --- |
| `workflows/aether-loki-a2a-stub.yaml` | Runnable Kibana workflow (manual). Console stubs the Loki `query_range` call; Agent Builder writes a brief; Markdown `workshop-aether-loki-a2a-stub`. |
| Deploy | `python3 scripts/deploy_workshop_workflows.py aether-loki-a2a-stub.yaml` |

## Why stub?

This workshop / demo project has **no live Loki**. The workflow shows the shape:

```
O11Y alert / manual run
        │
        ▼
Kibana workflow  ──A2A / HTTP──►  Loki query_range (LogQL)
        │
        ▼
Agent Builder brief (Kibana)  +  optional Security CPS correlation
```

Kibana’s [Grafana connector](https://www.elastic.co/docs/reference/kibana/connectors-kibana/grafana-action-type)
covers alerts, rules, silences, and dashboards — **not** Loki LogQL. Log context from
Loki is an HTTP / A2A workflow step (or a thin bridge).

## Production swap

1. Set `consts.loki_url` to Grafana Cloud Logs or self-hosted Loki.
2. Replace the `stub_loki_query` console step with a real HTTP GET to
   `/loki/api/v1/query_range` (Bearer / basic auth).
3. Pass the response into the existing `ai.agent` brief step.

## Boundary reminder

| Boundary | Pattern |
| --- | --- |
| Elastic Serverless ↔ Elastic Serverless | **CPS** |
| Elastic ↔ Loki / Grafana / Datadog / studio | **A2A** (workflow HTTP / scoped agents) |
