# Työnkulku: synkronointi (muutokset ilman tikettiä)

Tämä työnkulku pitää dokumentaation ajan tasalla **kaikkien** koodimuutosten
kanssa — riippumatta siitä, tehtiinkö muutos tiketillä, toisen kehittäjän
suoralla commitilla vai päähaarasta tulleella mergellä.
`/synkronoi-dokumentaatio`-skill ohjaa tänne.

Ero tikettiin: tässä ei ole etukäteen annettua tarkoitusta, vaan lähtötietona on
valmis git-diff, josta muutokset **päätellään jälkikäteen**. Siksi tekninen kerros
ja datakerros päivittyvät luotettavasti, mutta liiketoiminnallinen "miksi"
**merkitään ihmisen tarkistettavaksi** (ei arvata).

Invariantti: **vain versionhallinnassa oleva koodi**; ks.
[`konventiot.md`](konventiot.md). Päivitykset tehdään **päivitystilassa** — ks.
[`tyonkulku.md`](tyonkulku.md) osio "Päivitystila" (P1–P3). Tämä työnkulku vain
valitsee mitä päivitetään.

---

## Vaihe S1 — Määritä lähtötaso (baseline)

1. Lue [`../tila/synkronoitu.yaml`](../tila/synkronoitu.yaml) →
   `viimeisin_synkronoitu_commit`.
2. Jos käyttäjä antoi vertailukohdan (commit, tagi tai haara), käytä sitä.
3. Nykytila on `HEAD`: `git -C .. rev-parse --short HEAD`.

## Vaihe S2 — Hae muutosjoukko

```
git -C .. diff --name-status <viimeisin_synkronoitu_commit>..HEAD
```

`--name-status` erottelee: `M` muutettu, `A` lisätty, `D` poistettu,
`R` uudelleennimetty. Huomioi vain versioidut tiedostot.

> Jos baseline == HEAD, ei muutoksia → raportoi "ajan tasalla" ja lopeta.
> Jos muutosjoukko on hyvin suuri (sadoista tiedostoista ylöspäin), ryhmittele
> moduuleittain, kerro käyttäjälle laajuus ja **kysy mistä aloitetaan** — älä
> yritä kaikkea yhdessä ajossa.

## Vaihe S3 — Luokittele ja toimi

Käy muuttuneet polut läpi. Etsi kutakin polkua koskevat dokumentit
frontmatterin `lahteet`-kentästä:

```
grep -rl "<muuttunut/polku>" moduulit liiketoimintaprosessit jarjestelmaprosessit datamallit --include='*.md'
```

Toimi muutostyypin mukaan:

| Tilanne | Toimenpide |
|---------|-----------|
| **M** — muutettu tiedosto on jonkin dokin `lahteet`issä | **Päivitä** kyseiset dokit paikallaan ([`tyonkulku.md`](tyonkulku.md) P3). Tekninen/data-sisältö johdetaan koodista. Liiketoimintakerroksen perustelu, jota diffistä ei voi päätellä → `> TODO: substanssiosaajan vahvistus`. |
| **A** — uusi/muuttunut koodi, jota mikään dokki ei kata | **Aukko.** Jos moduuli on jo dokumentoitu, luo puuttuva dokki (luontitila). Jos moduulin tila on `tekematta`, jätä rekisteriin — se dokumentoidaan omalla vuorollaan. Kirjaa aukko lokiin. |
| **D** — poistettu polku on jonkin dokin `lahteet`issä | **Vanhentunut dokki.** Poista viittaus ja päivitä kuvaus; jos koko kohde poistui, merkitse `tila: vanhentunut` ja kysy käyttäjältä poistetaanko. |
| **R** — uudelleennimetty | Päivitä `lahteet`-polku uuteen nimeen ja käsittele kuten **M**. |
| Muutos koskee vain skeemalähdettä (migraatio, OpenAPI, tyypit) | Päivitä `datamallit/` ([`datamalli-tyonkulku.md`](datamalli-tyonkulku.md)) ja siihen linkittävät datarakenteet. |

Älä arvaa. Epävarmat kohdat `> TODO:`-merkinnällä ja dokki `tila: luonnos`.

### S3b — Rivinumeroviittausten siirto (helposti unohtuva)

Sisällön päivittäminen ei riitä. Jos muutos lisäsi tai poisti rivejä tiedoston
**keskeltä**, kaikki dokumentaation viittaukset sen jälkeisiin riveihin ovat
väärässä — ja ne näyttävät edelleen oikeilta. Tämä on suurin yksittäinen
viittausten rappeutumisen lähde.

1. Selvitä nettosiirtymä ja sen alkukohta muuttuneesta tiedostosta:
   ```
   git -C .. diff <baseline>..HEAD -- <tiedosto> | grep -nE '^@@'
   ```
2. Siirrä vain ne viittaukset, jotka osoittavat **muutoskohdan jälkeisiin**
   riveihin. Aiemmat rivit eivät liiku.
3. **Paljaat viittaukset** (`` `:997` `` ilman tiedostonimeä) ovat vaarallisia:
   kohdetiedosto on pääteltävä lähimmästä edeltävästä tiedostonimestä, ja väärä
   päättely siirtää väärän viittauksen huomaamatta. Kun kohtaat paljaan
   viittauksen, **kirjoita se auki tiedostonimineen** samalla kun siirrät sen
   ([`konventiot.md`](konventiot.md) kohta 6).
4. **Tarkista otos koodia vasten** — osuvatko siirretyt rivinumerot yhä siihen
   funktioon tai määrittelyyn, josta dokumentti puhuu. Jos eivät, siirtymä oli
   väärä.
5. Kirjaa lokiin **montako viittausta siirrettiin**, ei vain montako dokkia
   päivitettiin. Se on eri luku ja kertoo eri asian.

## Vaihe S4 — Päivitä lähtötaso ja loki

1. Aseta `../tila/synkronoitu.yaml`:
   - `viimeisin_synkronoitu_commit: <HEADin lyhyt hash>`
   - `synkronoitu_pvm: <pvm>`
   - lisää rivi `historia`-listaan (mitä muutosjoukko sisälsi, mitä tehtiin)
2. Päivitä muutettujen dokkien frontmatter (`paivitetty`, `git-viite`).
3. Jos moduulien tila muuttui, päivitä `../tila/rekisteri.yaml`.
4. Lisää rivi [`../tila/edistyminen.md`](../tila/edistyminen.md):
   `pvm · <moduuli(t)> · synkronointi · <mitä päivittyi/aukot> · <baseline>..<HEAD>`.
5. Ehdota `/generoi-html`-ajoa, jos selattava versio on käytössä.

> **Versionhallinta:** älä committaa. Kerro mitkä dokit muuttuivat ja mitkä aukot
> jäivät, ja jätä commit kehittäjälle ([`konventiot.md`](konventiot.md) kohta 9).

---

## Erikoistapaus: baseline puuttuu tai on epäluotettava

Jos `synkronoitu.yaml`:ia ei ole tai commit ei löydy (esim. historia
uudelleenkirjoitettu), käytä varalta kunkin dokin omaa `git-viite`-arvoa:
vertaa jokaista dokkia sen omaan lähtötasoon
(`git -C .. diff --name-only <dokin git-viite>..HEAD -- <lahteet-polut>`). Tämä
on hitaampi mutta kestää osittaiset/keskeytyneet päivitykset.

Jos projektissa ei ole versionhallintaa (`projekti.versionhallinta: none`),
synkronointia ei voi tehdä diffin perusteella: käy sen sijaan läpi moduulit,
joiden `paivitetty` on vanhin, ja tarkista ne koodia vasten.
