#!/usr/bin/env bash
# Build a Soft Silver Linux tarball for GitHub Releases.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
VERSION="${1:?version e.g. 0.1.9}"
OUT_DIR="${2:-$ROOT/dist}"
mkdir -p "$OUT_DIR"
export PATH="/usr/local/go/bin:${PATH:-}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
NAME="DogSC-${VERSION}-linux-amd64-soft-silver"
DEST="$STAGE/$NAME"
mkdir -p "$DEST/bin" "$DEST/linux"

# MyGo Soft Silver host
(
  cd "$ROOT/linux/native/mygo"
  CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$DEST/bin/dogsc-mygo-soft-silver" .
)

# Python Soft Silver bridge (sources; run with python3 -m)
# Prefer a portable copy that does not require rsync on minimal images.
(
  cd "$ROOT/linux"
  find . -type f \
    ! -path '*/__pycache__/*' \
    ! -name '*.pyc' \
    ! -path '*/.pytest_cache/*' \
    ! -path '*/native/qt6/build/*' \
    -print0 |
    tar --null -T - -cf - |
    tar -C "$DEST/linux" -xf -
)

cat > "$DEST/README.md" <<EOF
# DogSC Soft Silver (Linux) ${VERSION}

- \`bin/dogsc-mygo-soft-silver\` — MyGo Soft Silver shell (Go ≥ 1.27 to rebuild)
- \`linux/\` — Python Soft Silver sidecar + Web UI + Qt6 sources

## Run

\`\`\`bash
# terminal 1: sidecar
cd linux && PYTHONPATH=. python3 -m dogsc edit --port 47321

# terminal 2: MyGo host
./bin/dogsc-mygo-soft-silver -sidecar http://127.0.0.1:47321
\`\`\`

Or open the Web Soft Silver UI at http://127.0.0.1:47321/
EOF

TAR="$OUT_DIR/${NAME}.tar.gz"
tar -C "$STAGE" -czf "$TAR" "$NAME"
echo "$TAR"
sha256sum "$TAR" | tee "$TAR.sha256"
