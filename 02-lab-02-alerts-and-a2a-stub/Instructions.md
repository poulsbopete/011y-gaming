# Lab 2 — Facilitator notes

**Message:** Draft-first alerts; Security is a **separate** Serverless project. Instruqt cannot run both — write an A2A-shaped stub and point to the Vercel demo for live Security deep links (`my-security-project-ac9463`). Lab 2 also installs **gaming index templates** and starts ML job **`aether-auth-failure-anomaly`**.

**Production correlation:**
- **CPS** — Elastic Observability Serverless ↔ Elastic Security Serverless
- **A2A** — Elastic ↔ non-Elastic solutions (Grafana, Loki, Datadog, custom SIEM, studio tooling)

**Custom ML play (Ade / Titov):** share [`docs/gaming-index-templates.md`](../docs/gaming-index-templates.md) + Instruqt invite. Templates live under `assets/elasticsearch/templates/`.

**Do not** claim the sandbox has live fraud detections. Show the stub JSON and the CPS vs A2A split on the Vercel **A2A** page. For ML, open **Anomaly explorer** once the fleet has been emitting for a few buckets.
