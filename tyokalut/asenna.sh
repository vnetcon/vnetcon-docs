#!/usr/bin/env bash
# Asentaa vnetcon-docs-paketin kohdeprojektin juureen.
#
#   tyokalut/asenna.sh <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]
#
# Oletus: luo <kohde>/vnetcon-docs. Jos hakemisto on jo olemassa, komento
# keskeytyy ellei anneta --paivita, joka päivittää vain MOOTTORIN ja jättää
# projektin oman sisällön koskematta.
#
# --paivita säilyttää aina:
#   vnetcon.config.yaml, tila/, johdanto.md, moduulit/, liiketoimintaprosessit/,
#   jarjestelmaprosessit/, datamallit/, tiketit/, html/,
#   metodi/kartoitus.md, metodi/sanasto.md, .claude/settings.json
# ja päivittää: metodi/** (muut), tyokalut/**, .claude/skills|workflows (paketin
#   omat), CLAUDE.md, AGENTS.md, README.md, vnetcon.config.example.yaml, .gitignore

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$REPO/dist"
VERSIO="$(cat "$REPO/VERSIO" 2>/dev/null || echo 'tuntematon')"

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_OK=$'\033[32m'; C_VAR=$'\033[33m'; C_VIRHE=$'\033[31m'; C_HIM=$'\033[2m'; C_0=$'\033[0m'
else C_OK=''; C_VAR=''; C_VIRHE=''; C_HIM=''; C_0=''; fi
ok()    { printf '%s✓%s %s\n' "$C_OK" "$C_0" "$*"; }
varo()  { printf '%s!%s %s\n' "$C_VAR" "$C_0" "$*"; }
him()   { printf '%s%s%s\n' "$C_HIM" "$*" "$C_0"; }
kuole() { printf '%s✗%s %s\n' "$C_VIRHE" "$C_0" "$*" >&2; exit 1; }

KOHDE=""; PAIVITA=0; NIMI="vnetcon-docs"
while [ $# -gt 0 ]; do
  case "$1" in
    --paivita) PAIVITA=1; shift ;;
    --nimi)    NIMI="${2:?--nimi vaatii arvon}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) kuole "Tuntematon lippu: $1" ;;
    *)  [ -z "$KOHDE" ] || kuole "Anna vain yksi kohdepolku."; KOHDE="$1"; shift ;;
  esac
done

[ -n "$KOHDE" ] || kuole "Käyttö: asenna.sh <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]"
[ -d "$DIST" ]  || kuole "dist/ puuttuu repossa: $DIST"
[ -d "$KOHDE" ] || kuole "Kohdehakemistoa ei ole: $KOHDE"
KOHDE="$(cd "$KOHDE" && pwd)"
MAALI="$KOHDE/$NIMI"

[ "$KOHDE" = "$REPO" ] && kuole "Kohde on tämä repo itse — asenna johonkin toiseen projektiin."

suorituskelpoiset() {
  chmod +x "$MAALI/tyokalut/vnetcon-ai/vnetcon-ai" "$MAALI/tyokalut/vnetcon-ai/hae-token.sh" 2>/dev/null || true
}

# --- Uusi asennus ---------------------------------------------------------

if [ ! -d "$MAALI" ]; then
  mkdir -p "$MAALI"
  ( cd "$DIST" && tar cf - . ) | ( cd "$MAALI" && tar xf - )
  printf '%s\n' "$VERSIO" > "$MAALI/.vnetcon-docs-versio"
  suorituskelpoiset
  ok "Asennettiin vnetcon-docs $VERSIO → $MAALI"
  echo
  him "Seuraavat askeleet:"
  cat <<EOF
  1) cd "$MAALI"
  2) claude                       # tai: ./tyokalut/vnetcon-ai/vnetcon-ai claude
  3) Clauden syötekenttään:  /vnetcon-init

Tarkistus ilman agenttia:  cd "$MAALI" && ./tyokalut/vnetcon-ai/vnetcon-ai doctor
Käyttöohje:                $MAALI/README.md
EOF
  exit 0
fi

# --- Moottorin päivitys ---------------------------------------------------

[ "$PAIVITA" = 1 ] || kuole "$MAALI on jo olemassa. Päivitä moottori: asenna.sh \"$KOHDE\" --paivita"
VANHA="$(cat "$MAALI/.vnetcon-docs-versio" 2>/dev/null || echo 'tuntematon')"
him "Päivitetään moottori: $VANHA → $VERSIO  ($MAALI)"

# Projektin omat tiedostot, joita paketti EI koskaan ylikirjoita.
SUOJATUT=(metodi/kartoitus.md metodi/sanasto.md .claude/settings.json)

TALLE="$(mktemp -d)"
trap 'rm -rf "$TALLE"' EXIT
for p in "${SUOJATUT[@]}"; do
  if [ -f "$MAALI/$p" ]; then
    mkdir -p "$TALLE/$(dirname "$p")"
    cp "$MAALI/$p" "$TALLE/$p"
  fi
done

# Kopioi paketin omat tiedostot päälle (ei poisteta projektin lisäyksiä).
paalle() {   # $1 = dist-relatiivinen hakemisto tai tiedosto
  local src="$DIST/$1"
  [ -e "$src" ] || return 0
  if [ -d "$src" ]; then
    ( cd "$DIST" && find "$1" -type f -print0 ) | while IFS= read -r -d '' f; do
      mkdir -p "$MAALI/$(dirname "$f")"
      cp "$DIST/$f" "$MAALI/$f"
    done
  else
    mkdir -p "$MAALI/$(dirname "$1")"
    cp "$src" "$MAALI/$1"
  fi
}

for p in metodi tyokalut .claude/skills .claude/workflows \
         CLAUDE.md AGENTS.md README.md vnetcon.config.example.yaml .gitignore; do
  paalle "$p"
done

# Palauta suojatut tiedostot. metodi/kartoitus.md ja metodi/sanasto.md ovat
# projektin sisältöä (paketin versio on pelkkä pohja) → palautetaan hiljaisesti.
# .claude/settings.json voi sisältää sekä paketin sääntöjä että projektin
# pilviasetuksia → paketin uusi versio jätetään viereen yhdistettäväksi.
for p in "${SUOJATUT[@]}"; do
  [ -f "$TALLE/$p" ] || continue
  if [ "$p" = ".claude/settings.json" ] && [ -f "$MAALI/$p" ] && ! cmp -s "$TALLE/$p" "$MAALI/$p"; then
    cp "$MAALI/$p" "$MAALI/$p.uusi"
    varo "$p: säilytettiin projektin versio; paketin uusi on $p.uusi — yhdistä tai aja /agentit"
  fi
  cp "$TALLE/$p" "$MAALI/$p"
done
# Jos suojattua tiedostoa ei ollut lainkaan, paketin versio jäi paikalleen — ok.
if [ ! -f "$MAALI/.claude/settings.json" ]; then paalle .claude/settings.json; fi

printf '%s\n' "$VERSIO" > "$MAALI/.vnetcon-docs-versio"
suorituskelpoiset

ok "Moottori päivitetty versioon $VERSIO"
him "Säilytettiin: ${SUOJATUT[*]} + kaikki projektin dokumentit, tila/ ja konfiguraatio."
him "Jos menettelyn versio kasvoi (tila/metodi.yaml), aja Claudessa /yhdenmukaista-dokumentaatio."
him "Tarkista muutokset: git -C \"$KOHDE\" status"
