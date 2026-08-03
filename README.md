# Aether Games — metrics adoption workshop + Vercel demo

**GitHub:** [poulsbopete/011y-gaming](https://github.com/poulsbopete/011y-gaming)

Dual deliverable for gaming platform POV conversations:

| Surface | Role |
| --- | --- |
| **Instruqt track** (`aether-games-metrics-adoption`) | Hands-on PromQL/Grafana → Observability Serverless |
| **Vercel demo** (`demo/`) | Sales front door with deep links into fixed O11Y + Security projects |

**Brand:** **Aether Games** — fictional AAA publisher. Do **not** name real studios in materials.

## Value narrative

- Consolidate Prometheus/Grafana dashboards, alerts, and Prom metrics into Elastic at a better price point
- Account / platform fraud lives in Elastic Security; correlated via **A2A** when both projects exist
- Instruqt stands up **one** Observability Serverless project per play → Security A2A is **stubbed** in Lab 2

## Fixed demo endpoints

| Project | Kibana |
| --- | --- |
| Observability | `https://otel-demo-a5630c.kb.us-east-1.aws.elastic.cloud` |
| Security | `https://my-security-project-ac9463.kb.us-central1.gcp.elastic.cloud` |

## Instruqt track

### Labs

1. **Lab 1** — migrate **14** gaming Grafana boards:  
   `bash /root/workshop/scripts/migrate_grafana_dashboards_to_serverless.sh`
2. **Lab 2** — alert drafts + A2A Security stub:  
   `bash /root/workshop/scripts/publish_alerts_and_a2a_stub.sh`

### Bootstrap

- Image: `elastic/es3-api-v2` · Observability Serverless · Kibana proxy `:8080`
- Secrets: `ESS_CLOUD_API_KEY`, `LLM_PROXY_PROD`
- Migration engine: clones [`elastic/observability-migration-platform`](https://github.com/elastic/observability-migration-platform) into `mig-to-kbn/` at install time (not vendored in git). Pin: `mig-to-kbn-upstream.lock`
- Telemetry: Alloy + `tools/otel_gaming_fleet.py` → mOTLP

### Laptop migrate

```bash
cp serverless_creds.env.example serverless_creds.env   # fill ES_URL, KIBANA_URL, ES_API_KEY
source serverless_creds.env
bash scripts/ensure_workshop_mig_to_kbn_sources.sh
bash scripts/install_workshop_mig_to_kbn.sh
# Optional OTLP against your project:
# export WORKSHOP_OTLP_ENDPOINT=... WORKSHOP_OTLP_AUTH_HEADER="ApiKey ..."
bash scripts/migrate_grafana_dashboards_to_serverless.sh
```

### Push track

```bash
# from repo root after instruqt CLI login
instruqt track validate
instruqt track push
```

## Vercel demo (`demo/`)

**Live:** https://aether-games-demo.vercel.app

```bash
cd demo
cp .env.example .env
npm install
npm run dev
```

Deploy: set root directory to `demo/` on Vercel (or `vercel --cwd demo`). Env vars from `.env.example`. Set `VITE_INSTRUQT_INVITE_URL` when the track invite exists.

## Docs

- [`docs/workshop-design.md`](docs/workshop-design.md)
- [`docs/invite.md`](docs/invite.md)
- [`docs/a2a-security-stub.md`](docs/a2a-security-stub.md)

## Layout

```
track.yml / config.yml
track_scripts/
01-lab-01-grafana-gaming-migrate/
02-lab-02-alerts-and-a2a-stub/
assets/grafana/          # 14 PromQL boards + alerts
assets/alloy/
scripts/                 # migrate, OTLP, A2A stub
tools/otel_gaming_fleet.py
workflows/
demo/                    # Vite + React
docs/
```
