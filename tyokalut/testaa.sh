#!/usr/bin/env bash
# Savutesti — tarkistaa, että koneelliset työkalut antavat oikeat vastaukset.
#
#   tyokalut/testaa.sh [--pida]
#
# Rakentaa tilapäisiä projekteja, asentaa paketin niihin ja väittää tuloksista.
# --pida jättää tilapäishakemistot paikalleen tutkittavaksi.
#
# Kattaa ne tapaukset, jotka ovat kertaalleen olleet rikki. Jos jokin näistä
# hajoaa uudelleen, se hajoaa hiljaa ja näkyy vasta asiakkaan koodipohjassa:
#   1. moduuliehdokkaat löytyvät myös src/:n ulkopuolelta (shared/, web/, scripts/)
#   2. dokumentaatio- ja esimerkkikansiot EIVÄT kelpaa ehdokkaiksi
#   3. moduuli ei ole hakemisto: `tiedostot`-lista ratkaisee rivimäärät, ja saman
#      hakemiston jakavat moduulit eivät vie toistensa rivejä
#   4. rekisterin kattama ehdokas ei tuota haamuriviä
#   5. rekisterin ulkopuolinen koodi raportoidaan (`vain koodi`)
#   6. rekisterin kuollut polku tuottaa löydöksen
#   7. `syy`-kenttä ei katkea ensimmäiseen pilkkuun

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDA=0
[ "${1:-}" = "--pida" ] && PIDA=1

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_OK=$'\033[32m'; C_VIRHE=$'\033[31m'; C_HIM=$'\033[2m'; C_0=$'\033[0m'
else C_OK=''; C_VIRHE=''; C_HIM=''; C_0=''; fi
VIRHEITA=0
ok()    { printf '%s✓%s %s\n' "$C_OK" "$C_0" "$*"; }
virhe() { printf '%s✗%s %s\n' "$C_VIRHE" "$C_0" "$*" >&2; VIRHEITA=$((VIRHEITA + 1)); }
him()   { printf '%s%s%s\n' "$C_HIM" "$*" "$C_0"; }

command -v node >/dev/null 2>&1 || { virhe "node puuttuu — savutesti vaatii Noden."; exit 1; }

TYO="$(mktemp -d)"
siivoa() { [ "$PIDA" = 1 ] && him "Tilapäishakemistot jätettiin: $TYO" || rm -rf "$TYO"; }
trap siivoa EXIT

# --- Apurit ----------------------------------------------------------------

mk() {  # mk <tiedosto> <rivit>
  mkdir -p "$(dirname "$1")"
  local i=1
  while [ "$i" -le "$2" ]; do echo "const x$i = $i;" >> "$1"; i=$((i + 1)); done
}

kentta() {  # kentta <json> <moduuli> <kenttä> → arvo tai PUUTTUU
  node -e '
    const fs = require("fs");
    const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const m = (j.moduulit || []).find((x) => x.nimi === process.argv[2]);
    process.stdout.write(m ? String(m[process.argv[3]]) : "PUUTTUU");
  ' "$1" "$2" "$3"
}

on_sama() {  # on_sama <kuvaus> <odotettu> <saatu>
  if [ "$2" = "$3" ]; then ok "$1"; else virhe "$1 — odotettiin '$2', saatiin '$3'"; fi
}

on_valilla() {  # on_valilla <kuvaus> <min> <max> <saatu>
  case "$4" in
    ''|*[!0-9]*) virhe "$1 — ei lukua: '$4'"; return ;;
  esac
  if [ "$4" -ge "$2" ] && [ "$4" -le "$3" ]; then ok "$1 ($4)"
  else virhe "$1 — odotettiin $2–$3, saatiin $4"; fi
}

sisaltaa() {  # sisaltaa <kuvaus> <merkkijono> <tiedosto>
  if grep -qF -- "$2" "$3"; then ok "$1"; else virhe "$1 — ei löytynyt: '$2'"; fi
}

# --- Syntaksitarkistukset --------------------------------------------------

him "Syntaksi"
for f in "$REPO"/dist/tyokalut/*.mjs "$REPO"/dist/tyokalut/html-generaattori/generoi.mjs; do
  node --check "$f" 2>/dev/null && ok "node --check $(basename "$f")" || virhe "node --check $(basename "$f")"
done
for f in "$REPO"/tyokalut/*.sh "$REPO"/dist/tyokalut/vnetcon-ai/vnetcon-ai "$REPO"/dist/tyokalut/vnetcon-ai/hae-token.sh; do
  bash -n "$f" 2>/dev/null && ok "bash -n $(basename "$f")" || virhe "bash -n $(basename "$f")"
done
# Workflow-skriptit ajetaan async-kontekstissa ja saavat käyttää top-level
# returnia, joten `node --check` hylkäisi ne sellaisenaan. Kääritään ja
# poistetaan export-avainsana, jotta syntaksin voi silti tarkistaa — muuten
# kirjoitusvirhe workflow'ssa paljastuu vasta asiakkaan /dokumentoi-kaikki-ajossa.
for f in "$REPO"/dist/.claude/workflows/*.mjs; do
  [ -e "$f" ] || continue
  { printf '(async () => {\n'; sed 's/^export const /const /' "$f"; printf '\n})()\n'; } > "$TYO/wf.mjs"
  node --check "$TYO/wf.mjs" 2>/dev/null && ok "syntaksi $(basename "$f")" || virhe "syntaksi $(basename "$f")"
done

# --- Tapaus 1: ei rekisteriä, moduulit päätellään koodin sijainnista -------

echo; him "Tapaus 1 — moduuliehdokkaat ilman rekisteriä"
P1="$TYO/ilman-rekisteria"
mkdir -p "$P1"
mk "$P1/src/maksut/reitit.ts" 40
mk "$P1/src/maksut/laskuri.ts" 30
mk "$P1/shared/api/skeema.ts" 25
mk "$P1/shared/api/asiakas.ts" 15
mk "$P1/web/ui/nappi.tsx" 20
mk "$P1/web/ui/lomake.tsx" 20
mk "$P1/scripts/aja.sh" 10
mk "$P1/scripts/siivoa.sh" 10
mk "$P1/scripts/vie.sh" 10
mk "$P1/docs/esimerkki.sh" 5
( cd "$P1" && git init -q . && git add -A \
  && git -c user.email=t@t -c user.name=t commit -qm alku ) || virhe "git init epäonnistui"
"$REPO/tyokalut/asenna.sh" "$P1" >/dev/null || virhe "asenna.sh epäonnistui"

J1="$TYO/moduulit1.json"
node "$P1/vnetcon-docs/tyokalut/moduulit.mjs" --json > "$J1" 2>/dev/null || virhe "moduulit --json epäonnistui"

on_valilla "src/maksut löytyy"       70 74 "$(kentta "$J1" maksut loc)"
on_valilla "shared/api löytyy"       40 44 "$(kentta "$J1" shared-api loc)"
on_valilla "web/ui löytyy"           40 44 "$(kentta "$J1" ui loc)"
on_valilla "scripts löytyy"          31 35 "$(kentta "$J1" scripts loc)"
on_sama    "docs/ ei ole ehdokas"    PUUTTUU "$(kentta "$J1" docs loc)"

# --- Tapaus 2: rekisteri, jossa moduuli ei ole hakemisto -------------------

echo; him "Tapaus 2 — moduuli ei ole hakemisto (tiedostot-lista ratkaisee)"
P2="$TYO/rekisteri"
mkdir -p "$P2"
mk "$P2/src/maksut/reitit.ts" 40
mk "$P2/src/maksut/laskuri.ts" 30
mk "$P2/backend/palvelut/tilaus.py" 100
mk "$P2/backend/palvelut/laskutus.py" 60
mk "$P2/backend/palvelut/hyvitys.py" 40
# Kaksi tiedostoa: lähdejuurten (src, app, lib…) ulkopuolella ehdokkaaksi
# vaaditaan kaksi koodi­tiedostoa, jottei yksittäinen skripti tuota moduulia.
mk "$P2/web/ui/nappi.tsx" 20
mk "$P2/web/ui/lomake.tsx" 20
( cd "$P2" && git init -q . && git add -A \
  && git -c user.email=t@t -c user.name=t commit -qm alku ) || virhe "git init epäonnistui"
"$REPO/tyokalut/asenna.sh" "$P2" >/dev/null || virhe "asenna.sh epäonnistui"

cat > "$P2/vnetcon-docs/tila/rekisteri.yaml" <<'YAML'
paivitetty: 2026-01-01

moduulit:
  - nimi: tilaukset
    polku: backend/palvelut
    tyyppi: python
    tila: tekematta
    pilotti: true
    kuvaus: "Tilausten vastaanotto. Jakaa hakemiston laskutuksen kanssa."
    tiedostot:
      - backend/palvelut/tilaus.py

  - nimi: laskutus
    polku: backend/palvelut
    tyyppi: python
    tila: kesken
    kuvaus: "Laskujen muodostus ja hyvitykset."
    tiedostot:
      - backend/palvelut/laskutus.py
      - backend/palvelut/hyvitys.py

  - nimi: maksut
    polku: src/maksut
    tyyppi: node-ts
    tila: valmis

  - { nimi: puuttuva, polku: backend/ei-ole-olemassa, tila: tekematta }

  - { nimi: vanha-sdk, polku: shared/ei-ole, tila: rajattu-pois, syy: "Generoitu koodi, ei ylläpidetä käsin, korvautuu uudella rajapinnalla" }
YAML

J2="$TYO/moduulit2.json"
node "$P2/vnetcon-docs/tyokalut/moduulit.mjs" --json > "$J2" 2>/dev/null || virhe "moduulit --json epäonnistui"

# Bugi, joka tämän testin on tarkoitus estää: kumpikin sai 0 tai 203 riviä,
# koska tiedostot-lista jäi jäsentymättä ja polku ratkaisi rajauksen.
on_valilla "tilaukset saa omat rivinsä"  95 105 "$(kentta "$J2" tilaukset loc)"
on_valilla "laskutus saa omat rivinsä"   95 105 "$(kentta "$J2" laskutus loc)"
on_sama    "ei haamuriviä hakemistosta"  PUUTTUU "$(kentta "$J2" palvelut loc)"
on_sama    "rekisterin ulkopuolinen koodi merkitään" "vain koodi" "$(kentta "$J2" ui lahde)"
sisaltaa   "syy ei katkea pilkkuun" "korvautuu uudella rajapinnalla" "$J2"

R2="$P2/vnetcon-docs/kalibrointiraportti.md"
node "$P2/vnetcon-docs/tyokalut/kalibroi.mjs" >/dev/null 2>&1 || virhe "kalibroi epäonnistui"
sisaltaa "kuollut rekisterin polku löydetään" "Rekisterin polut" "$R2"
sisaltaa "rekisterin ulkopuolinen koodi raportoidaan" "Rekisterin ulkopuolinen koodi" "$R2"
sisaltaa "moduulitaulu tulee rekisteristä" "## Moduulit (rekisteri)" "$R2"

# --- Paketin omat linkit ---------------------------------------------------

echo; him "Dokumentaation linkit"
if node "$REPO/dist/tyokalut/tarkista-linkit.mjs" 2>&1 | grep -q "(0 rikki)"; then
  ok "dist: ei rikkinäisiä linkkejä"
else
  virhe "dist: rikkinäisiä linkkejä"
  node "$REPO/dist/tyokalut/tarkista-linkit.mjs" 2>&1 | tail -5
fi

# --- Yhteenveto -----------------------------------------------------------

echo
if [ "$VIRHEITA" -eq 0 ]; then
  ok "Savutesti läpi."
  exit 0
else
  virhe "Savutesti epäonnistui: $VIRHEITA virhettä."
  exit 1
fi
