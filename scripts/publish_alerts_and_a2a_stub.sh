#!/usr/bin/env bash
# Publish gaming Grafana alert drafts as disabled Kibana rules + run A2A Security stub.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1090
[[ -f /root/.bashrc ]] && source /root/.bashrc

if [ -z "${KIBANA_URL:-}" ] || { [ -z "${ES_API_KEY:-}" ] && [ -z "${KIBANA_API_KEY:-}" ]; }; then
  echo "ERROR: source ~/.bashrc (need KIBANA_URL and ES_API_KEY)." >&2
  exit 1
fi

PY="${WORKSHOP_PYTHON:-}"
if [ -z "$PY" ]; then
  if [ -x /opt/workshop-venv/bin/python3 ]; then
    PY=/opt/workshop-venv/bin/python3
  else
    PY=python3
  fi
fi

echo "==> [1/3] Publishing Grafana alert drafts (disabled rules)..."
ALERT_COMPARISON=""
for cand in \
  "${ROOT}/build/mig-grafana/alerts/alert_comparison_results.json" \
  "${ROOT}/build/mig-grafana/alert_comparison_results.json"; do
  if [ -f "$cand" ]; then
    ALERT_COMPARISON="$cand"
    break
  fi
done

if [ -n "$ALERT_COMPARISON" ]; then
  "$PY" "${ROOT}/tools/publish_grafana_alert_drafts_kibana.py" --comparison "${ALERT_COMPARISON}"
else
  echo "    WARN: no alert_comparison_results.json yet — run Lab 1 migrate first (or continuing with A2A stub only)."
fi

echo "==> [2/3] A2A Security federation stub..."
bash "${ROOT}/scripts/demo_a2a_security_stub.sh"

echo "==> [3/3] Deploy Agent Builder workflows (AI notes + Aether dashboard briefs)..."
if [ "${WORKSHOP_SKIP_AI_NOTES:-0}" = "1" ]; then
  echo "    skip (WORKSHOP_SKIP_AI_NOTES=1)"
else
  "$PY" "${ROOT}/scripts/deploy_workshop_workflows.py" || echo "    WARN: workflow deploy failed (Agent Builder connector may be unavailable)."
fi

echo ""
echo "Lab 2 complete."
echo "  • Alert drafts: Observability → Rules (disabled)"
echo "  • A2A stub markdown: Dashboards → search 'A2A federation preview'"
echo "  • Workflows: Management → Workflows → 'Aether — dashboard briefs (Agent Builder)' (Run)"
echo "  • Real Security project is demonstrated in the Vercel Aether Games demo (not in this sandbox)."
