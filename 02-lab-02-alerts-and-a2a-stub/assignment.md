---
slug: lab-02-alerts-and-a2a-stub
id: xlfj91lntriu
type: challenge
title: Lab 2 — Alerts, A2A stub + ML auth anomaly
teaser: Publish disabled gaming alerts, stub A2A Security, and start an ML auth-failure
  job.
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

**Lab goal:** publish alert drafts, run the A2A Security stub, and ensure the auth ML anomaly job exists on **this** sandbox.

```bash
# Lab 2 setup already refreshed scripts + created the ML job on this play's ES.
# Re-run the publisher if you need alert drafts / A2A stub again:
bash /root/workshop/scripts/publish_alerts_and_a2a_stub.sh
```

## Verify

- **Observability → Rules** — Aether alert drafts present (**disabled**)
- Terminal output shows stub JSON at `build/a2a-stub/security-fraud-correlation.json`
- **Machine Learning → Manage jobs** — **`aether-auth-failure-anomaly`** (opened / datafeed started)
- Optional: Dashboards / saved objects — **A2A federation preview**
- Optional: **Horizon — Dashboard sprawl** (deployed at end of Lab 1 migrate) — boards → indexes + schema-drift

## Done

**Check** passes when the A2A stub JSON file exists.
