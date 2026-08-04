# Aether ML anomalies → Security via CPS

## Goal

Detect anomalous **auth login failures** on Observability Serverless with an ML
anomaly detection job, then run a Kibana workflow that correlates those findings
with Elastic Security alerts using **cross-project search (CPS)**.

| Piece | Where |
| --- | --- |
| ML job `aether-auth-failure-anomaly` | Observability (origin) |
| Workflow `Aether — ML anomaly → Security via CPS` | Observability Workflows |
| Fraud / SIEM alerts | Security Serverless (linked via CPS) |

> On Elastic Cloud Serverless, Elastic↔Elastic correlation uses **CPS** (not CCS).
> **A2A** remains for non-Elastic agents.

## Prerequisites

1. OTLP metrics flowing into O11Y (`metrics-*`) — workshop fleet or Vercel **Seed live metrics**
2. Cloud Console: **link** Security project `my-security-project-ac9463` to the O11Y origin for CPS
3. Optional: seed Security alerts from the Vercel Fraud lab (**Default** space)

## Create + start the ML job

```bash
source ~/.bashrc   # Instruqt / local with ES_URL + ES_API_KEY + KIBANA_URL
python3 scripts/create_aether_ml_anomaly_job.py --start
```

Override the CPS alias if your linked project alias differs:

```bash
SECURITY_CPS_ALIAS=my-security-project-ac9463 \
  python3 scripts/create_aether_ml_anomaly_job.py --start
```

In Kibana: **Machine Learning → Anomaly Detection → aether-auth-failure-anomaly**.

## Deploy + run the workflow

```bash
python3 scripts/deploy_workshop_workflows.py aether-ml-anomaly-cps-security.yaml
```

Then **Management → Workflows → Aether — ML anomaly → Security via CPS → Run**.

The workflow:

1. ES|QL on `.ml-anomalies-*` (O11Y origin)
2. CPS ES|QL: `FROM my-security-project-ac9463:.alerts-security.alerts-default`
3. Agent Builder brief → index `aether-ml-cps-correlations` + Markdown `workshop-aether-ml-cps-correlation`

If the Security alerts step is empty, confirm CPS linking and that alerts exist in Security **Default** space. Some builds exclude `.alerts-*` from CPS; the ML brief still ships with remediation steps.

## Alert wiring (optional)

The create script best-effort creates rule **Aether — auth failure ML anomaly**
(`xpack.ml.anomaly_detection_alert`). Tag it `aether-games` / `ml` / `cps` so the
workflow’s `alert` trigger can fire. You can also keep the 15m schedule + manual run.
