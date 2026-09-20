#!/usr/bin/env bash
# Paketoi dist/ jaeltavaksi zipiksi (vnetcon-docs-<versio>.zip).
#
#   tyokalut/paketoi.sh [--ulos <hakemisto>]
#
# Paketin sisältö puretaan projektin juureen nimellä vnetcon-docs/:
#   unzip vnetcon-docs-<versio>.zip -d <projektin-juuri>

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO/dist"
VERSIO="$(cat "$REPO/VERSIO" 2>/dev/null || echo '0.0.0')"
ULOS="$REPO"

while [ $# -gt 0 ]; do
  case "$1" in
    --ulos) ULOS="${2:?--ulos vaatii arvon}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Tuntematon argumentti: $1" >&2; exit 1 ;;
  esac
done

command -v zip >/dev/null 2>&1 || { echo "zip-komento puuttuu" >&2; exit 1; }
[ -d "$DIST" ] || { echo "dist/ puuttuu: $DIST" >&2; exit 1; }
mkdir -p "$ULOS"
ULOS="$(cd "$ULOS" && pwd)"

TYO="$(mktemp -d)"
trap 'rm -rf "$TYO"' EXIT
mkdir -p "$TYO/vnetcon-docs"
( cd "$DIST" && tar cf - . ) | ( cd "$TYO/vnetcon-docs" && tar xf - )
printf '%s\n' "$VERSIO" > "$TYO/vnetcon-docs/.vnetcon-docs-versio"

# Ei viedä pakettiin: riippuvuudet, generoitu HTML, paikallinen tila.
rm -rf "$TYO/vnetcon-docs/tyokalut/html-generaattori/node_modules" \
       "$TYO/vnetcon-docs/html" "$TYO/vnetcon-docs/html.zip" \
       "$TYO/vnetcon-docs/.claude/settings.local.json" \
       "$TYO/vnetcon-docs/vnetcon.config.yaml"
find "$TYO" -name '.DS_Store' -delete 2>/dev/null || true
chmod +x "$TYO/vnetcon-docs/tyokalut/vnetcon-ai/vnetcon-ai" \
         "$TYO/vnetcon-docs/tyokalut/vnetcon-ai/vnetcon-ai.mjs" \
         "$TYO/vnetcon-docs/tyokalut/vnetcon-ai/hae-token.sh" \
         "$TYO/vnetcon-docs/tyokalut/vnetcon-ai/hae-token.mjs" 2>/dev/null || true

PAKETTI="$ULOS/vnetcon-docs-$VERSIO.zip"
rm -f "$PAKETTI"
( cd "$TYO" && zip -rq "$PAKETTI" vnetcon-docs )

echo "Valmis: $PAKETTI"
echo "Purku kohdeprojektin juuressa:  unzip \"$PAKETTI\""
