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
  "production_pattern": "A2A agent federation: Obs agent → Security agent endpoint (scoped API key)",
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
    "Register Security project agent in Agent Builder",
    "Workflow step: ai.agent → security-fraud-correlator",
    "Open Elastic Security case with Obs deep-link annotations"
  ]
}
EOF

cat >"${STUB_MD}" <<'EOF'
# A2A federation preview (stubbed)

**Aether Games** production architecture correlates Observability metrics with Elastic Security
for account fraud (credential stuffing, multi-account abuse, payment fraud).

This Instruqt sandbox provisions **Observability Serverless only**. The A2A call to Security is
**stubbed** — see `build/a2a-stub/security-fraud-correlation.json` for the canned response.

## Production flow

```
Obs Agent (metrics / auth failures)
        │  A2A
        ▼
Security Agent (alerts / entity analytics / cases)
        │
        ▼
Case + response playbook
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
