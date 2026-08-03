---
slug: lab-02-alerts-and-a2a-stub
id: xlfj91lntriu
type: challenge
title: Lab 2 — Alert drafts + A2A Security stub
teaser: Publish disabled gaming alert rules and preview A2A fraud federation (stubbed).
notes:
- type: text
  contents: |
    ## Alerts + Security federation

    Lab 1 landed **dashboards**. Lab 2:

    1. Publishes **Grafana-derived alert drafts** as Kibana rules (**disabled**)
    2. Runs an **A2A → Security stub** (this sandbox has Observability only)

    <div style="border:1px solid #854d0e;border-radius:12px;padding:14px;background:#1c1917;margin:16px 0;">
    <div style="font-weight:700;color:#fbbf24;">One Serverless project per play</div>
    <div style="font-size:0.9rem;color:#e7e5e4;margin-top:8px;">
    Instruqt provisions <b>Observability</b> only. A2A calls to Elastic Security are
    <b>stubbed</b> here. Open the live Security project from the <b>Aether Games Vercel demo</b>.
    </div>
    </div>
- type: text
  contents: |
    ## Why stub A2A?

    ```
    Obs Serverless (this lab)          Security Serverless (demo only)
            │                                    │
            │   A2A agent call                   │
            └──────────► (stubbed JSON) ─ ─ ─ ─ ►│ fraud cases / entity analytics
    ```

    Production Aether Games correlates auth failures + anti-cheat O11Y signals with
    Security alerts (credential stuffing, multi-account abuse, payment fraud).
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

**Lab goal:** publish alert drafts and run the A2A Security stub.

```bash
# Refresh publisher from a pinned commit (avoids stale GitHub CDN), then run Lab 2.
curl -fsSL https://raw.githubusercontent.com/poulsbopete/011y-gaming/main/tools/publish_grafana_alert_drafts_kibana.py \
  -o /root/workshop/tools/publish_grafana_alert_drafts_kibana.py
# Confirm you see publisher_version=… in the next command's output.
grep -n publisher_version /root/workshop/tools/publish_grafana_alert_drafts_kibana.py | head -3
bash /root/workshop/scripts/publish_alerts_and_a2a_stub.sh
```

## Verify

- **Observability → Rules** — Aether alert drafts present (**disabled**)
- Terminal output shows stub JSON at `build/a2a-stub/security-fraud-correlation.json`
- Optional: Dashboards / saved objects — **A2A federation preview**

## Done

**Check** passes when the A2A stub JSON file exists.
