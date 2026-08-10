# Gaming index templates (Aether) + custom ML plays

Shareable assets for Ade / Peter Titov–style **custom ML** workshops on gaming data.

## What you get

| Artifact | Purpose |
| --- | --- |
| `assets/elasticsearch/templates/aether-gaming-component-template.json` | Field mappings for auth, region, service, anticheat, players |
| `assets/elasticsearch/templates/aether-gaming-index-template.json` | Data-stream index template |
| `assets/elasticsearch/templates/aether-gaming-default-pipeline.json` | Optional ingest: normalize `region` / `service.name` for ML influencers |
| `scripts/apply_aether_gaming_index_templates.py` | Apply all three to a cluster |

**Index patterns covered**

- `aether-gaming-metrics-*` / `metrics-aether.*`
- `aether-gaming-logs-*` / `logs-aether.*`

These are **customer-controlled** gaming streams. Workshop OTel still lands on managed **`metrics-*`** via mOTLP; the ML job `aether-auth-failure-anomaly` can read either `metrics-*` (Instruqt fleet) or a dedicated `aether-gaming-metrics-*` stream if you point the datafeed there.

## Apply

```bash
export ES_URL=https://<project>.es.<region>.aws.elastic.cloud
export ES_API_KEY=...
python3 scripts/apply_aether_gaming_index_templates.py
```

Dry-run:

```bash
python3 scripts/apply_aether_gaming_index_templates.py --dry-run
```

## Custom ML play (auth failures)

```bash
# 1) Templates (this doc)
python3 scripts/apply_aether_gaming_index_templates.py

# 2) Metrics flowing (Instruqt fleet, Alloy, or seed)
# 3) ML job + optional CPS workflow
python3 scripts/create_aether_ml_anomaly_job.py --start
python3 scripts/deploy_workshop_workflows.py aether-ml-anomaly-cps-security.yaml
```

Kibana: **Machine Learning → Anomaly Detection → `aether-auth-failure-anomaly`**.

Detectors / influencers:

| | |
| --- | --- |
| Function | `high_count` on auth-failure–shaped metric docs |
| Bucket | `5m` |
| Influencers | `service.name`, `region`, `attributes.result` |

See [`docs/ml-anomaly-cps-security.md`](ml-anomaly-cps-security.md).

## Instruqt

Track: [aether-games-metrics-adoption](https://play.instruqt.com/elastic/tracks/aether-games-metrics-adoption)  
Invite: https://play.instruqt.com/elastic/invite/6fjbsdobn1wy

- **Lab 1** — migrate 14 gaming Grafana/PromQL boards  
- **Lab 2** — alert drafts + A2A stub + **ML auth anomaly job**

Lab 2 command:

```bash
bash /root/workshop/scripts/publish_alerts_and_a2a_stub.sh
```

That script now also applies gaming templates (best-effort) and starts `aether-auth-failure-anomaly`.

## Suggested Slack reply

> Yes — we have gaming index templates + an Instruqt with ML.
>
> **Repo:** https://github.com/poulsbopete/011y-gaming  
> **Templates:** `assets/elasticsearch/templates/` + `python3 scripts/apply_aether_gaming_index_templates.py`  
> **Docs:** `docs/gaming-index-templates.md`  
> **Instruqt:** https://play.instruqt.com/elastic/invite/6fjbsdobn1wy (Lab 1 migrate → Lab 2 alerts + **ML auth anomaly**)  
> **ML job:** `aether-auth-failure-anomaly` (`scripts/create_aether_ml_anomaly_job.py --start`)
>
> Happy to walk through with Peter Titov for the custom ML play — same auth-failure / anticheat fields the Aether fleet emits.
