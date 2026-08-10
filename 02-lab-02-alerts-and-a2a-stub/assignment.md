---
slug: lab-02-alerts-and-a2a-stub
id: xlfj91lntriu
type: challenge
title: Lab 2 — Alerts, A2A stub + ML auth anomaly
teaser: Publish disabled gaming alerts, stub A2A Security, and start an ML auth-failure job.
notes:
- type: text
  contents: |
    ## Alerts + Security federation + ML

    Lab 1 landed **dashboards**. Lab 2:

    1. Publishes **Grafana-derived alert drafts** as Kibana rules (**disabled**)
    2. Runs an **A2A → Security stub** (this sandbox has Observability only)
    3. Applies **gaming index templates** and starts ML job **`aether-auth-failure-anomaly`**

    <div style="border:1px solid #854d0e;border-radius:12px;padding:14px;background:#1c1917;margin:16px 0;">
    <div style="font-weight:700;color:#fbbf24;">One Serverless project per play</div>
    <div style="font-size:0.9rem;color:#e7e5e4;margin-top:8px;">
    Instruqt provisions <b>Observability</b> only. Live Elastic↔Elastic correlation uses
    <b>CPS</b> (cross-project search); <b>A2A</b> is for non-Elastic systems. Lab 2 writes an A2A-shaped stub.
    Open the live Security project from the <b>Aether Games Vercel demo</b>.
    </div>
    </div>
- type: text
  contents: |
    ## Why stub federation?

    ```
    Obs Serverless (this lab)          Security Serverless (demo only)
            │                                    │
            │   production: CPS                  │
            │   this lab: A2A-shaped stub        │
            └──────────► (stubbed JSON) ─ ─ ─ ─ ►│ fraud cases / entity analytics
    ```

    Production Aether Games:
    - **CPS** between Elastic Observability and Security Serverless projects
    - **A2A** when correlating with non-Elastic solutions (Grafana, Loki, Datadog, custom SIEM)

    Auth failures + anti-cheat O11Y signals join Security alerts (credential stuffing,
    multi-account abuse, payment fraud).

    **ML:** `high_count` on auth-failure–shaped metrics → Anomaly explorer
    (`aether-auth-failure-anomaly`). Optional workflow correlates via CPS when a Security
    project is linked.
tabs:
- id: tod44opksqxs
  title: Terminal
  type: terminal
  hostname: es3-api
  workdir: /root
- id: mcyva3weyflb
  title: Elastic Serverless
  type: service
  hostname: es3-api
  path: /app/observability/alerts/rules
  port: 8080
  custom_request_headers:
  - key: Content-Security-Policy
    value: 'script-src ''self'' https://kibana.estccdn.com; worker-src blob: ''self'';
      style-src ''unsafe-inline'' ''self'' https://kibana.estccdn.com; style-src-elem
      ''unsafe-inline'' ''self'' https://kibana.estccdn.com'
  custom_response_headers:
  - key: Content-Security-Policy
    value: 'script-src ''self'' https://kibana.estccdn.com; worker-src blob: ''self'';
      style-src ''unsafe-inline'' ''self'' https://kibana.estccdn.com; style-src-elem
      ''unsafe-inline'' ''self'' https://kibana.estccdn.com'
difficulty: ""
enhanced_loading: null
---

**Lab goal:** publish alert drafts, run the A2A Security stub, and start the auth ML anomaly job.

```bash
# Refresh publisher from a pinned commit (avoids stale GitHub CDN), then run Lab 2.
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/tools/publish_grafana_alert_drafts_kibana.py \
  -o /root/workshop/tools/publish_grafana_alert_drafts_kibana.py
# Confirm you see publisher_version=… in the next command's output.
grep -n publisher_version /root/workshop/tools/publish_grafana_alert_drafts_kibana.py | head -3
# Optional: pull latest Lab 2 script (templates + ML) if the sandbox image is older than main.
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/scripts/publish_alerts_and_a2a_stub.sh \
  -o /root/workshop/scripts/publish_alerts_and_a2a_stub.sh
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/scripts/apply_aether_gaming_index_templates.py \
  -o /root/workshop/scripts/apply_aether_gaming_index_templates.py
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/scripts/create_aether_ml_anomaly_job.py \
  -o /root/workshop/scripts/create_aether_ml_anomaly_job.py
mkdir -p /root/workshop/assets/elasticsearch/templates
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/assets/elasticsearch/templates/aether-gaming-component-template.json \
  -o /root/workshop/assets/elasticsearch/templates/aether-gaming-component-template.json
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/assets/elasticsearch/templates/aether-gaming-index-template.json \
  -o /root/workshop/assets/elasticsearch/templates/aether-gaming-index-template.json
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/assets/elasticsearch/templates/aether-gaming-default-pipeline.json \
  -o /root/workshop/assets/elasticsearch/templates/aether-gaming-default-pipeline.json
chmod +x /root/workshop/scripts/publish_alerts_and_a2a_stub.sh
bash /root/workshop/scripts/publish_alerts_and_a2a_stub.sh
```

## Verify

- **Observability → Rules** — Aether alert drafts present (**disabled**)
- Terminal output shows stub JSON at `build/a2a-stub/security-fraud-correlation.json`
- **Machine Learning → Anomaly Detection** — job **`aether-auth-failure-anomaly`** (opened / datafeed started)
- Optional: Dashboards / saved objects — **A2A federation preview**

## Done

**Check** passes when the A2A stub JSON file exists.
