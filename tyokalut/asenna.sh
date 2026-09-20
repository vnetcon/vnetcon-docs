#!/usr/bin/env sh
# Asentaa vnetcon-docs-paketin kohdeprojektin juureen.
#
#   tyokalut/asenna.sh <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]
#
# Tämä tiedosto on käynnistin; toteutus on asenna.mjs (Node), jotta sama
# asennus toimii myös Windowsilla ilman bashia:
#
#   node tyokalut\asenna.mjs <polku> [--paivita]
#   tyokalut\asenna.cmd <polku> [--paivita]

set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "asenna: node puuttuu — tarvitaan Node 18+. Asenna: https://nodejs.org" >&2
  exit 1
fi

exec node "$DIR/asenna.mjs" "$@"
