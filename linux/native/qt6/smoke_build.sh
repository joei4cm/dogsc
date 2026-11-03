#!/usr/bin/env bash
# Build + offscreen smoke for the Soft Silver Qt6 host.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="${ROOT}/build"
cmake -S "${ROOT}" -B "${BUILD}" -DCMAKE_BUILD_TYPE=Release
cmake --build "${BUILD}" -j"$(nproc)"
BIN="${BUILD}/dogsc_soft_silver_host"
test -x "${BIN}"

# Prefer software / offscreen so headless agents still exercise QML load.
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export QSG_RHI_BACKEND="${QSG_RHI_BACKEND:-software}"
export QT_LOGGING_RULES="${QT_LOGGING_RULES:-qt.qml.binding.removal.info=false}"

# Load the shell briefly; exit 0 if the process starts and the binary links.
timeout 5s "${BIN}" >/tmp/dogsc-qt6-smoke.log 2>&1 || status=$?
status="${status:-0}"
# timeout returns 124 on success (still running); treat that as pass.
if [[ "${status}" -eq 0 || "${status}" -eq 124 ]]; then
  echo "smoke ok: ${BIN}"
  exit 0
fi
echo "smoke failed (exit ${status}); log:" >&2
cat /tmp/dogsc-qt6-smoke.log >&2 || true
exit "${status}"
