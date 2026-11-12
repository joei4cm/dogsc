#!/usr/bin/env bash
# Compile-only smoke for the MyGo Soft Silver host.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="${GOTOOLCHAIN:-}/usr/local/go/bin:${PATH:-}"
cd "$ROOT"
go version
go test ./...
CGO_ENABLED=0 go build -o /tmp/dogsc-mygo-soft-silver .
echo "ok: /tmp/dogsc-mygo-soft-silver"
