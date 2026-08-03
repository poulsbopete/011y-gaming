#!/usr/bin/env bash
# Confirm mig-to-kbn/ is an unmodified copy of elastic/observability-migration-platform (default: main).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG="${MIG_TO_KBN_DIR:-${ROOT}/mig-to-kbn}"
REF="${MIG_TO_KBN_REF:-main}"
URL="${MIG_TO_KBN_GIT_URL:-https://github.com/elastic/observability-migration-platform.git}"

if [ ! -f "${MIG}/pyproject.toml" ]; then
  echo "ERROR: ${MIG}/pyproject.toml not found." >&2
  exit 1
fi

TDIR="$(mktemp -d)"
trap 'rm -rf "${TDIR}"' EXIT

echo "==> Comparing ${MIG} to ${URL} (${REF}) ..."
if ! git clone --depth 1 --branch "${REF}" "${URL}" "${TDIR}/upstream" 2>/dev/null; then
  git clone --depth 1 "${URL}" "${TDIR}/upstream"
  git -C "${TDIR}/upstream" checkout "${REF}" 2>/dev/null || true
fi

UPSTREAM_COMMIT="$(git -C "${TDIR}/upstream" rev-parse HEAD)"
echo "    Upstream HEAD: ${UPSTREAM_COMMIT} — $(git -C "${TDIR}/upstream" log -1 --oneline)"

COMPARE="${TDIR}/upstream"
if [ -x "${ROOT}/scripts/apply_workshop_mig_patches.sh" ] && compgen -G "${ROOT}/scripts/patches/*.patch" >/dev/null; then
  cp -a "${TDIR}/upstream" "${TDIR}/upstream-patched"
  MIG_TO_KBN_DIR="${TDIR}/upstream-patched" bash "${ROOT}/scripts/apply_workshop_mig_patches.sh"
  COMPARE="${TDIR}/upstream-patched"
  echo "    Comparing against upstream + workshop patches (scripts/patches/*.patch)"
fi

DIFF_OUT="$(mktemp)"
diff -rq "${COMPARE}" "${MIG}" >"${DIFF_OUT}" 2>&1 || true
DIFF_LINES="$(grep -v 'Only in .*/upstream-patched: \.git$' "${DIFF_OUT}" | grep -v 'Only in .*/upstream: \.git$' || true)"
if [ -z "${DIFF_LINES}" ]; then
  echo "OK: mig-to-kbn/ matches upstream ${REF} (${UPSTREAM_COMMIT:0:12})."
  if [ -f "${ROOT}/mig-to-kbn-upstream.lock" ]; then
    LOCK_COMMIT="$(grep '^commit=' "${ROOT}/mig-to-kbn-upstream.lock" | cut -d= -f2- || true)"
    if [ -n "${LOCK_COMMIT}" ] && [ "${LOCK_COMMIT}" != "${UPSTREAM_COMMIT}" ]; then
      echo "WARN: mig-to-kbn-upstream.lock commit (${LOCK_COMMIT:0:12}) differs from upstream HEAD — run ./scripts/update_mig_to_kbn.sh" >&2
      exit 1
    fi
  fi
  exit 0
fi

echo "ERROR: mig-to-kbn/ differs from upstream ${REF}:" >&2
grep -v 'Only in.*\.git' "${DIFF_OUT}" >&2 || cat "${DIFF_OUT}" >&2
echo "Fix: ./scripts/update_mig_to_kbn.sh && git add mig-to-kbn mig-to-kbn-upstream.lock" >&2
exit 1
