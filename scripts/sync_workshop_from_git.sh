#!/usr/bin/env bash
# Refresh /root/workshop from GitHub (Instruqt clones often track an old main).
# Usage:
#   cd /root/workshop && source ~/.bashrc && ./scripts/sync_workshop_from_git.sh
#   WORKSHOP_GIT_REF=main ./scripts/sync_workshop_from_git.sh
set -euo pipefail
ROOT="$(readlink -f /root/workshop 2>/dev/null || echo /root/workshop)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: $ROOT is not a git repo. Re-provision the sandbox or push the latest track." >&2
  exit 1
fi

_desired_url="${WORKSHOP_GIT_URL:-https://github.com/poulsbopete/011y-gaming.git}"
_cur="$(git remote get-url origin 2>/dev/null || true)"
if [[ -n "$_cur" && "$_cur" != *"011y-gaming"* && "$_cur" != *"o11y-gaming"* ]]; then
  echo "Updating origin remote → ${_desired_url}"
  git remote set-url origin "$_desired_url"
fi

REF="${WORKSHOP_GIT_REF:-main}"
echo "Updating from origin ($REF)..."
if ! git fetch --depth 1 origin "$REF"; then
  echo "WARN: fetch $REF failed; trying main..."
  REF=main
  git fetch --depth 1 origin "$REF"
fi

if ! git rev-parse --verify "FETCH_HEAD" >/dev/null 2>&1 && ! git rev-parse --verify "origin/$REF" >/dev/null 2>&1; then
  echo "ERROR: could not fetch origin/$REF" >&2
  exit 1
fi

git reset --hard "origin/$REF" 2>/dev/null || git reset --hard FETCH_HEAD

chmod +x scripts/*.sh scripts/*.py 2>/dev/null || true
echo "OK: $(git log -1 --oneline)"
echo "OTLP: ./scripts/check_workshop_otel_pipeline.sh  OR  ./scripts/start_workshop_otel.sh"
echo "A2A stub: ./scripts/demo_a2a_security_stub.sh"
if [ -d mig-to-kbn/.git ]; then
  echo "      Standalone mig-to-kbn clone: ./scripts/update_mig_to_kbn.sh && bash scripts/install_workshop_mig_to_kbn.sh"
fi
