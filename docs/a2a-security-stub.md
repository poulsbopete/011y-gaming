# A2A Security stub (Instruqt)

## Why stub?

Instruqt `config.yml` creates a single **Observability** Serverless project (`PROJECT_TYPE: observability`). A second Security project cannot be stood up in the same play with the current workshop spine.

Production **Aether Games** architecture still separates concerns:

- **Observability** — platform metrics, auth failure rates, anti-cheat signal volume
- **Security** — credential stuffing, multi-account abuse, payment fraud cases

**How correlation works in production:**

| Boundary | Pattern |
| --- | --- |
| Elastic Serverless ↔ Elastic Serverless (O11Y ↔ Security) | **CCS** (cross-cluster search) |
| Elastic ↔ non-Elastic (Grafana, Datadog, custom SIEM, studio backends) | **A2A** (scoped agent endpoints / workflows) |

Lab 2 still writes an **A2A-shaped stub** so learners see a federation payload without a second Serverless project in Instruqt. The Vercel A2A page shows the live projects and the CCS vs A2A split.

## What Lab 2 does

`scripts/demo_a2a_security_stub.sh` (via `publish_alerts_and_a2a_stub.sh`):

1. Writes `build/a2a-stub/security-fraud-correlation.json` — canned fraud correlation payload
2. Writes `build/a2a-stub/a2a-federation-preview.md`
3. Best-effort creates a Kibana markdown saved object
4. Attempts to deploy `workflows/a2a-security-fraud-stub.yaml` (documentation artifact; may be disabled)

## Where to show real Security

Use the **Vercel demo** deep links to:

`https://my-security-project-ac9463.kb.us-central1.gcp.elastic.cloud`

Sections: overview, alerts, cases, rules, entity analytics, attack discovery.
