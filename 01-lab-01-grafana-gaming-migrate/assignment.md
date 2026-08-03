---
slug: lab-01-grafana-gaming-migrate
id: aetherlab01grafana
type: challenge
title: Lab 1 — Migrate Aether Games PromQL boards
teaser: One command brings 14 gaming Grafana/PromQL dashboards onto Kibana.
notes:
- type: text
  contents: |
    ## Aether Games — metrics on Elastic

    **Audience:** platform / SRE teams consolidating Prometheus + Grafana into Elastic Observability.

    **Live workshop metrics** flow like this:

    ```
                      ┌────────────────────────────────┐
                      │  Aether Games OTLP fleet       │
                      │  (matchmaking, sessions, auth) │
                      └──────────────┬─────────────────┘
                                     │ OTLP
                          Grafana Alloy (:4317 / :4318)
                                     │
                          OTLP/HTTP + Authorization
                                     ▼
                        Elastic managed OTLP (mOTLP)
                                     ▼
                        Observability Serverless project
                                     ▼
                           Kibana (proxied :8080)
    ```
- type: text
  contents: |
    ## Why bring Prom/Grafana into Elastic?

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0;">
    <div style="border:1px solid #334155;border-radius:12px;padding:14px;background:#0f172a;">
    <div style="font-size:1.75rem;font-weight:800;color:#22d3ee;">1 plane</div>
    <div style="font-size:0.85rem;margin-top:6px;color:#e2e8f0;"><b>One ops UI</b><br/>Metrics beside logs and traces for launch-night incidents.</div>
    </div>
    <div style="border:1px solid #334155;border-radius:12px;padding:14px;background:#0f172a;">
    <div style="font-size:1.75rem;font-weight:800;color:#22d3ee;">IP</div>
    <div style="font-size:0.85rem;margin-top:6px;color:#e2e8f0;"><b>Keep PromQL assets</b><br/>Migrate dashboards — don’t redraw every board.</div>
    </div>
    <div style="border:1px solid #334155;border-radius:12px;padding:14px;background:#0f172a;">
    <div style="font-size:1.75rem;font-weight:800;color:#fbbf24;">$</div>
    <div style="font-size:0.85rem;margin-top:6px;color:#e2e8f0;"><b>Better price point</b><br/>Serverless consumption vs peak-provisioned Prom stacks.</div>
    </div>
    <div style="border:1px solid #334155;border-radius:12px;padding:14px;background:#0f172a;">
    <div style="font-size:1.75rem;font-weight:800;color:#22d3ee;">Gov</div>
    <div style="font-size:0.85rem;margin-top:6px;color:#e2e8f0;"><b>Draft → approve</b><br/>Alerts land disabled until platform owners enable them.</div>
    </div>
    </div>
- type: text
  contents: |
    ## This lab

    Migrate **14** Aether Games Grafana-shaped / PromQL boards (matchmaking, sessions, auth, store, SLO, …)
    with **`grafana-migrate`** onto live **`metrics-*`**.

    Run **one command** in **Terminal** when the sandbox is ready.
- type: text
  contents: |
    ## While you wait — **O11Y Survivors**

    [Open full screen](https://poulsbopete.github.io/Vampire-Clone/) if the embed is cramped.

    <div style="width:100%;max-width:100%;height:min(82vh,920px);min-height:520px;margin:0 auto;">
    <iframe src="https://poulsbopete.github.io/Vampire-Clone/" title="O11Y Survivors" width="100%" height="100%" style="border:0;border-radius:10px;background:#0a0a0a;display:block;" allow="fullscreen" loading="lazy"></iframe>
    </div>
tabs:
- id: aetherlab01term
  title: Terminal
  type: terminal
  hostname: es3-api
  workdir: /root
- id: aetherlab01kbn
  title: Elastic Serverless
  type: service
  hostname: es3-api
  path: /app/dashboards#/list?_g=(filters:!(),refreshInterval:(pause:!f,value:30000),time:(from:now-30m,to:now))
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

**Lab goal:** adopt **14** Aether Games PromQL/Grafana dashboards onto Elastic Observability Serverless.

```bash
bash /root/workshop/scripts/migrate_grafana_dashboards_to_serverless.sh
```

## Verify

In **Elastic Serverless**:

- **Dashboards** — boards titled `Aether — …` on **`metrics-*`**
- Optional: scroll for **AI notes** if enabled

## Done

**Check** passes when **`build/mig-grafana/`** has **14** `*.yaml` dashboard files.
