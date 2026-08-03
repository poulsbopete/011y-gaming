#!/usr/bin/env bash
# Stub A2A call from Observability → Security (one Serverless project per Instruqt play).
# Writes canned fraud-correlation JSON and a Kibana markdown saved object when possible.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1090
[[ -f /root/.bashrc ]] && source /root/.bashrc

mkdir -p "${ROOT}/build/a2a-stub"
STUB_JSON="${ROOT}/build/a2a-stub/security-fraud-correlation.json"
STUB_MD="${ROOT}/build/a2a-stub/a2a-federation-preview.md"

cat >"${STUB_JSON}" <<'EOF'
{
  "stub": true,
  "reason": "Instruqt stands up one Observability Serverless project per play; Security is not provisioned here.",
  "production_pattern_elastic": "CCS between Observability Serverless and Security Serverless",
  "production_pattern_non_elastic": "A2A agent federation to non-Elastic solutions (scoped agent endpoints)",
  "lab_stub_shape": "A2A-shaped payload for teaching federation without a second Serverless project",
  "security_project_demo": "https://my-security-project-ac9463.kb.us-central1.gcp.elastic.cloud",
  "correlation": {
    "trigger": "auth_login_failure_spike + anticheat_high_severity",
    "o11y_signals": [
      "aether_auth_logins_total{result=failure}",
      "aether_anticheat_signals_total{severity=high}"
    ],
    "security_findings_stub": [
      {
        "rule": "Credential stuffing — Aether account platform",
        "severity": "high",
        "entities": ["player:aether-user-88421", "ip:203.0.113.44"],
        "case_title": "Suspected account takeover during launch window"
      },
      {
        "rule": "Multi-account abuse — payment shared device",
        "severity": "medium",
        "entities": ["device:fp-9c2a", "payment:tok_stub"],
        "case_title": "Shared device across 12 new accounts"
      }
    ]
  },
  "next_steps_production": [
    "Configure CCS between Observability and Security Serverless projects",
    "Use A2A when federating to non-Elastic agents (Grafana, Datadog, studio tooling)",
    "Open Elastic Security case with Obs deep-link annotations"
  ]
}
EOF

cat >"${STUB_MD}" <<'EOF'
# Federation preview (stubbed)

**Aether Games** keeps Observability and Security as separate Serverless projects.

| Boundary | Production pattern |
| --- | --- |
| Elastic Serverless ↔ Elastic Serverless | **CCS** |
| Elastic ↔ non-Elastic (Grafana, Datadog, custom SIEM) | **A2A** (scoped agent endpoints) |

This Instruqt sandbox provisions **Observability Serverless only**. Lab 2 writes an
**A2A-shaped stub** — see `build/a2a-stub/security-fraud-correlation.json`.

## Production Elastic flow (CCS)

```
Obs Serverless (metrics / auth failures)
        │  CCS
        ▼
Security Serverless (alerts / entity analytics / cases)
        │
        ▼
Case + response playbook
```

## Non-Elastic flow (A2A)

```
Elastic agent / workflow
        │  A2A
        ▼
External agent (Grafana, Datadog, studio tooling)
```

Open the live Security project from the **Aether Games Vercel demo** (not from this sandbox).
EOF

echo "Wrote ${STUB_JSON}"
echo "Wrote ${STUB_MD}"

# Best-effort: create/update a markdown saved object in Kibana for facilitators.
if [ -n "${KIBANA_URL:-}" ] && { [ -n "${ES_API_KEY:-}" ] || [ -n "${KIBANA_API_KEY:-}" ]; }; then
  KEY="${KIBANA_API_KEY:-${ES_API_KEY}}"
  BODY=$(python3 - <<'PY'
import json
from pathlib import Path
md = Path("build/a2a-stub/a2a-federation-preview.md").read_text()
print(json.dumps({
  "attributes": {
    "title": "Aether Games — A2A federation preview (stub)",
    "body": md
  }
}))
PY
)
  code=$(curl -sS -o /tmp/a2a-so.json -w "%{http_code}" \
    -X POST "${KIBANA_URL}/api/saved_objects/markdown/aether-a2a-federation-preview?overwrite=true" \
    -H "Authorization: ApiKey ${KEY}" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -H "elastic-api-version: 1" \
    -d "${BODY}" || echo "000")
  echo "Kibana markdown saved object HTTP ${code} (see /tmp/a2a-so.json)"
else
  echo "KIBANA_URL/ES_API_KEY unset — stub files only (no Kibana write)."
fi

# Deploy stub workflow definition if deployer is present (may no-op without LLM).
if [ -f "${ROOT}/scripts/deploy_workshop_workflows.py" ] && [ -n "${KIBANA_URL:-}" ]; then
  PY="${WORKSHOP_PYTHON:-python3}"
  [ -x /opt/workshop-venv/bin/python3 ] && PY=/opt/workshop-venv/bin/python3
  set +e
  "$PY" "${ROOT}/scripts/deploy_workshop_workflows.py" a2a-security-fraud-stub.yaml \
    | tee /tmp/a2a-workflow-deploy.log
  set -e
fi

echo "OK: A2A Security stub complete."
