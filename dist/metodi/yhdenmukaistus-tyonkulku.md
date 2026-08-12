# Työnkulku: yhdenmukaistus (menettelymuutos → olemassa olevat dokumentit)

Tämä työnkulku päivittää jo kirjoitetut dokumentit vastaamaan **nykyisiä
mallipohjia ja konventioita**, kun menettely on muuttunut (uusi mallipohja, uusi
kenttä, uusi rakenne). `/yhdenmukaista-dokumentaatio`-skill ohjaa tänne.

Ero muihin työnkulkuihin:
- `synkronoi-dokumentaatio` reagoi **koodimuutokseen** (git-diff).
- Tämä reagoi **menettelymuutokseen** (`tila/metodi.yaml`:n versio kasvoi).

Invariantti: **vain versionhallinnassa oleva koodi**; ks.
[`konventiot.md`](konventiot.md). Päivitykset tehdään **päivitystilassa** — ks.
[`tyonkulku.md`](tyonkulku.md) osio "Päivitystila". Runko ja **vaihe-tunnisteet
säilytetään**, ei luoda alusta.

---

## Vaihe Y1 — Nykyinen menettelyn versio

Lue [`../tila/metodi.yaml`](../tila/metodi.yaml) → `metodi_versio` ja
`muutokset`-loki.

## Vaihe Y2 — Etsi yhdenmukaistettavat dokumentit

Etsi dokit, joiden frontmatterin `metodi-versio` on **pienempi kuin nykyinen tai
puuttuu** (puuttuva = kirjoitettu ennen version seurantaa):

```
grep -rL "metodi-versio: <nykyinen>" moduulit liiketoimintaprosessit jarjestelmaprosessit datamallit --include='*.md'
```

Jos käyttäjä nimesi moduulin tai dokkityypin, rajaa siihen. Muuten käsittele
kaikki jäljessä olevat — mutta jos määrä on suuri, kerro laajuus ja tee erissä
moduuli kerrallaan.

## Vaihe Y3 — Yhdenmukaista päivitystilassa

Katso `muutokset`-lokista, mitkä versiot dokin ja nykyisen välissä ovat ja mitä
dokkityyppejä ne koskevat (`vaikuttaa`). Sovella vain relevantit muutokset.

Jokaiselle dokille:

1. Vertaa dokin rakennetta **nykyiseen mallipohjaan** ([`mallipohjat/`](mallipohjat/)).
2. **Päivitä paikallaan** puuttuvat osiot/kentät ([`tyonkulku.md`](tyonkulku.md)
   P3): säilytä sisältö ja vaihe-tunnisteet, lisää vain se mitä uusi malli vaatii.
3. Jos uusi malli vaatii lisää koodista johdettua tietoa (esim. datavirtojen
   kenttätason erittely, hallitseva skeema per solmu) → kartoita se koodista
   ([`tyonkulku.md`](tyonkulku.md) vaihe C + [`kartoitus.md`](kartoitus.md)) ja
   täydennä.
4. Jos uusi malli tuo uuden jaetun rakenteen (esim. `datamallit/`) → luo
   puuttuvat datamallit ja **linkitä** dokista niihin.
5. Epävarmat/dynaamiset kohdat: `> TODO:` -merkintä, ei arvausta.

## Vaihe Y4 — Merkitse yhdenmukaistetuksi

Jokaiseen käsiteltyyn dokkiin:

- `metodi-versio: <nykyinen>`
- `paivitetty: <pvm>`
- `git-viite` **säilyy** ennallaan, jos koodia ei luettu uudelleen muuttuneena
  (menettelymuutos ei ole koodimuutos); jos täydensit koodista, käytä nykyistä
  HEADia.

## Vaihe Y5 — Loki

Lisää rivi [`../tila/edistyminen.md`](../tila/edistyminen.md):
`pvm · <moduuli(t)> · yhdenmukaistus · metodi vX→vY, mitä päivittyi · <git-viite>`.

> **Versionhallinta:** älä committaa. Kerro mitkä dokit yhdenmukaistettiin, ja
> jätä commit kehittäjälle ([`konventiot.md`](konventiot.md) kohta 9).

---

## Menettelymuutoksen tekijälle (muistilista)

Kun muutat mallipohjaa/konventiota niin, että vanhat dokit pitää päivittää:

1. Kasvata [`../tila/metodi.yaml`](../tila/metodi.yaml) → `metodi_versio` ja
   lisää `muutokset`-rivi (`vaikuttaa`: mitkä dokkityypit).
2. Päivitä muuttuneiden mallipohjien frontmatterin `metodi-versio` samaan lukuun.
3. Aja `/yhdenmukaista-dokumentaatio`, niin olemassa olevat dokit päivittyvät.

> Jos muutos on **projektikohtainen** (esim. tähän projektiin sopiva lisäosio),
> tee se tähän hakemistoon. Jos se on **yleinen parannus menettelyyn**, viedään
> se myös `vnetcon-docs`-paketin lähteeseen, jotta muut projektit hyötyvät.
