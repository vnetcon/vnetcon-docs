#!/usr/bin/env sh
# Savutesti — käynnistin. Toteutus on testaa.mjs (Node).
#
#   tyokalut/testaa.sh [--pida]

set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "testaa: node puuttuu — tarvitaan Node 18+. Asenna: https://nodejs.org" >&2
  exit 1
fi

exec node "$DIR/testaa.mjs" "$@"
