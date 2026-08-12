# Työnkulku: käyttöönotto (init)

Tämä on **kertaluontoinen** menettely, joka sovittaa geneerisen
`vnetcon-docs`-paketin tähän projektiin. `/vnetcon-init`-skill ohjaa tänne.

Lopputulos: `vnetcon.config.yaml`, `tila/projekti.yaml`, `tila/rekisteri.yaml`,
`tila/rakenne.yaml`, `metodi/kartoitus.md` ja `johdanto.md` täytettyinä tämän
projektin faktoilla — sekä käyttäjälle selkeä seuraava askel.

**Invariantit tässä työnkulussa:** älä kirjoita mitään `moduulit/`- tai
`liiketoimintaprosessit/`-dokumentteja (se on dokumentointityötä, ei
käyttöönottoa). Älä committaa. Älä arvaa projektin faktoja — lue ne koodista tai
kysy.

---

## Vaihe I0 — Onko käyttöönotto jo tehty?

Jos `vnetcon.config.yaml` on olemassa, tämä on **uudelleenajo**: lue nykyinen
konfiguraatio, kerro käyttäjälle mitä siinä on, ja kysy mitä hän haluaa muuttaa.
Päivitä paikallaan — älä nollaa käyttäjän valintoja eikä `tila/rekisteri.yaml`:n
tiloja.

## Vaihe I1 — Aja koneellinen kalibrointi ensin

Älä aloita käsin. Aja:

```
node tyokalut/kalibroi.mjs
```

Se tuottaa `kalibrointiraportti.md`:n ja `tila/kalibrointi.json`:in: laajuus,
kielet, moduuliehdokkaat, skeemalähteet, testikomennot, CI, olemassa oleva
dokumentaatio, ja **hakujen osumaluvut alueittain**. Tämä on lähtötieto koko
käyttöönotolle — lue se ennen kuin teet omia hakuja.

Erityisen tärkeä on lista alueista, jotka saivat **0 osumaa**. Ne ovat joko
puuttuvia ominaisuuksia tai (useammin) projektikohtaisesti toteutettuja niin,
ettei geneerinen haku näe niitä. **Jokainen niistä on tarkistettava vaiheessa I2.**

Täydennä sitten kuvaa näillä, jos jokin jäi epäselväksi:

```
git -C .. rev-parse --abbrev-ref HEAD          # nykyinen haara
git -C .. rev-parse --short HEAD               # HEAD
git -C .. ls-files | wc -l                     # laajuus
git -C .. ls-files | sed 's|/.*||' | sort | uniq -c | sort -rn | head -40
git -C .. ls-files | grep -oE '\.[a-z0-9]+$' | sort | uniq -c | sort -rn | head -25
```

Jos `git -C .. rev-parse` epäonnistuu, projekti ei ole git-repo →
`projekti.versionhallinta: none` (ja käytä `ls`-listausta koko ajan).

Tunnista:

1. **Kielet ja kehykset** — tiedostopäätteet + manifestit: `package.json`,
   `pom.xml`, `build.gradle*`, `pyproject.toml`/`requirements.txt`, `go.mod`,
   `*.csproj`, `composer.json`, `Cargo.toml`, `Gemfile`. Lue manifestit —
   riippuvuudet paljastavat kehyksen.
2. **Monorepo vai yksi sovellus** — onko useita manifesteja eri hakemistoissa
   (`git -C .. ls-files | grep -E '(package\.json|pom\.xml|pyproject\.toml|go\.mod)$'`)?
   Jos kyllä → jokainen sellainen hakemisto on **moduuliehdokas**. Jos ei →
   moduulit muodostetaan ylimmän tason lähdehakemistoista (esim. `src/<alue>/`)
   tai koko sovellus on yksi moduuli.
3. **Tietokanta ja skeemalähteet** — migraatiot (`**/migrations/*`, `**/*.sql`),
   ORM-skeemat (`schema.prisma`, `models.py`, `*.entity.ts`), rajapintaskeemat
   (`openapi*.y*ml`, `swagger*.json`, `*.proto`, `*.graphql`, `*.avsc`,
   JSON Schema). Nämä ovat `datamallit/`-kansion lähteitä.
4. **Sisääntulopisteet** — HTTP-reitit, viestijonot, ajastetut ajot, CLI:t,
   lambdat/funktiot. Etsi pinokohtaisilla hauilla (vaihe I2).
5. **Testi- ja buildkomennot** — `package.json`:n `scripts`, `Makefile`,
   `*.sh`-ajoskriptit repon juuressa, CI-konfiguraatio (`.github/workflows/*`).
   Näitä käytetään tiketin toteutuksessa (vaihe 4).
6. **Olemassa oleva dokumentaatio** — `README*`, `docs/`, `ADR`-hakemistot.
   Älä duplikoi niitä; linkitä niihin ja kerro käyttäjälle mitä löytyi.

## Vaihe I2 — Valitse pinoprofiili ja kirjoita `metodi/kartoitus.md`

Kansiossa [`pinot/`](pinot/) on kartoitusreseptit per teknologiapino
(hakukomennot: reitit, tietokanta, ulkoiset kutsut, skeemat, konfiguraatio).

1. Valitse osuvat profiilit (voi olla useita, esim. `node-ts` + `python`).
   Aina mukaan [`pinot/yleinen.md`](pinot/yleinen.md).
2. **Käy läpi kalibroinnin 0-osuman alueet.** Kullekin: etsi koodista, onko
   aluetta todella olemassa (`git -C .. grep` projektin omilla termeillä). Jos on,
   olet löytänyt **todellisen katveen** — selvitä projektin oma kaava ja kirjoita
   se hakuna kartoitukseen. Jos ei ole, kirjaa se poissaolo kartoituksen
   "Katvealueet"-osioon, jotta seuraava sessio ei etsi sitä uudelleen.
3. **Kirjoita `metodi/kartoitus.md`** yhdistämällä valitut profiilit ja
   **konkretisoimalla** ne tähän projektiin: oikeat hakemistonimet, oikeat
   tiedostopäätteet, projektissa tosiasiallisesti käytetyt kirjastot. **Testaa
   jokainen kirjoittamasi hakukomento ja varmista, että se tuottaa osumia** —
   nolla osumaa tarkoittaa väärää hakua tai puuttuvaa aluetta, ja kumpikin on
   kirjattava. Tämä tiedosto on se, mitä dokumentointi käyttää joka kerta; huono
   kartoitus tuottaa huonot dokit.
4. Kirjaa profiilit `vnetcon.config.yaml`:n `pino.profiilit`-kenttään.
5. **Aja kalibrointi uudelleen** ja tarkista, että estot ovat poistuneet ja
   katvealueet ovat joko korjattu tai perusteltu.

## Vaihe I3 — Kysy käyttäjältä (vain se mitä ei voi päätellä)

Käytä `AskUserQuestion`ia. Esitä **päättelemäsi vastaus oletusarvona** — älä
kysy asioita, jotka luit koodista. Kysy enintään nämä:

1. **Moduulijako** — esitä löytämäsi moduuliehdokkaat ja pyydä vahvistus tai
   korjaus (mitkä ovat oikeasti erillisiä, mitkä jätetään pois: generoitu koodi,
   arkistot, kokeilut).
2. **Osa-alueet** — ryhmitellään moduulit 2–8 osa-alueeseen (domaineihin)
   navigointia ja vaiheittaista dokumentointia varten. Esitä oma ehdotus.
3. **Sanasto** — mitä moduulia kutsutaan tässä projektissa (moduuli / palvelu /
   sovellus / komponentti / paketti)? Tämä on vain näyttönimi.
4. **Agentit ja pilvipalvelu** — kuka dokumentoi, kuka toteuttaa, ja käytetäänkö
   Vnetconin pilviympäristöä vai omia tilejä. Yksityiskohdat:
   [`agentit.md`](agentit.md). Jos käyttäjä valitsee Vnetconin pilven, ohjaa
   `/agentit`-komentoon (tai seuraa `agentit.md`:n asetusosiota) — älä pyydä
   tunnisteita chattiin.

## Vaihe I4 — Kirjoita konfiguraatio ja tila

1. **`vnetcon.config.yaml`** — pohjana `vnetcon.config.example.yaml`. Täytä
   `projekti`, `dokumentaatio`, `pino`, `agentit`, `html`. Säilytä kommentit.
   Älä kirjoita tunnisteita, vain `token_lahde`-viittaus.
2. **`tila/projekti.yaml`** — projektin faktat, jotka jokainen sessio lukee:
   pino, hakemistokartta, sisääntulopistetyypit, skeemalähteet, testi-/
   buildkomennot, poisrajaukset ja perustelut. Tämä on lyhyt (alle 100 riviä)
   mutta täsmällinen.
3. **`tila/rekisteri.yaml`** — yksi merkintä per moduuli, `tila: tekematta`,
   `kuvaus` 1–2 lauseella. Valitse yksi **pilotti** (pieni mutta edustava
   moduuli) — se dokumentoidaan ensin, jotta menettely voidaan tarkistaa
   halvalla.

   **Moduulin ei tarvitse olla hakemisto.** Jos yksi hakemisto on liian iso
   yhdeksi moduuliksi (esim. 20 000 riviä), jaa se loogisiin moduuleihin, jotka
   jakavat saman `polku`n, ja anna kullekin `tiedostot`-lista. Se ratkaisee
   rajauksen, ja kalibrointi laskee moduulin koodirivit sen mukaan.

   **Kaiken koodin on kuuluttava johonkin.** Aja lopuksi
   `./tyokalut/vnetcon-ai/vnetcon-ai moduulit` ja tarkista, ettei yksikään
   hakemisto jää merkinnällä `ei rekisterissä`. Jos jää, lisää moduuli tai
   merkitse alue `tila: rajattu-pois` ja kirjoita `syy`. Rajaus on valinta,
   joka perustellaan — ei asia, joka jätetään huomaamatta.
4. **`tila/rakenne.yaml`** — osa-alueet ja niihin kuuluvat moduulit.
   `kytkennat` jätetään tyhjäksi (täyttyy järjestelmäprosesseja kuvatessa).
5. **`johdanto.md`** — 1–3 kappaletta siitä mitä projekti tekee ja kenelle tämä
   dokumentaatio on. Näkyy HTML-etusivulla. Johda README:stä, älä keksi.
6. **`metodi/sanasto.md`** — lisää löytämäsi domain-termit, jos niitä tuli
   vastaan (muuten jätä pohja).

## Vaihe I5 — Kytke projektin juuri (agenttien löydettävyys)

Jotta projektin juuressa käynnistetty agentti löytää menettelyn:

1. Jos projektin juuressa **ei ole** `AGENTS.md`, luo se ja laita sinne
   viittaus: *"Dokumentaatio ja tekoälytyön menettelyt: `vnetcon-docs/AGENTS.md`.
   Lue se ennen dokumentointi- tai tikettityötä."* Jos tiedosto on jo olemassa,
   **lisää** tuo viittaus loppuun — älä ylikirjoita.
2. Sama `CLAUDE.md`:lle projektin juuressa (viittaus
   `vnetcon-docs/CLAUDE.md`:hen).
3. Kysy käyttäjältä, lisätäänkö projektin `.gitignore`:en rivit
   `vnetcon-docs/html/` ja `vnetcon-docs/tyokalut/**/node_modules/` — älä muokkaa
   projektin tiedostoja ilman lupaa.

## Vaihe I6 — Riippuvuudet ja tarkistus

1. HTML-generaattori: kerro käyttäjälle, että ensimmäinen HTML-ajo vaatii
   kertaluontoisen `npm install`in (`tyokalut/html-generaattori/`). Älä aja sitä
   itse ilman lupaa (vaatii verkon).
2. Aja `tyokalut/vnetcon-ai/vnetcon-ai doctor` ja näytä tulos — se kertoo mitkä
   agentit ja tunnisteet ovat käytettävissä.
3. **Aja kalibrointi viimeisen kerran** (`node tyokalut/kalibroi.mjs`), jotta
   raportti vastaa käyttöönoton lopputilaa. Estoja ei pitäisi enää olla.
4. Kirjaa rivi `tila/edistyminen.md`:hen (`… · käyttöönotto · …`).

## Vaihe I7 — Kerro seuraava askel

Päätä yhteenvetoon, joka sisältää:

- mitä kirjoitettiin (tiedostolista),
- päätelty pino ja moduulien lukumäärä osa-alueittain,
- **kalibroinnin lopputila:** jäljelle jääneet katvealueet ja laajuusarvio
  (`kalibrointiraportti.md`) — kerro käyttäjälle, että raportti on koodivapaa ja
  lähetettävissä, jos hän haluaa arvion työmäärästä ulkopuolelta,
- **suositeltu seuraava komento**: `/dokumentoi <pilottimoduuli>` (halpa
  tarkistusajo) ja sen jälkeen `/dokumentoi-kaikki <osa-alue>`,
- mitä jäi avoimeksi (`> TODO:`-merkinnät ja käyttäjältä odotettavat
  vahvistukset).

> **Rehellisyys tässä kohdassa on tuotteen tärkein ominaisuus.** Jos kartoitus jäi
> ohuelle — esimerkiksi teknologia on tuntematon tai iso osa alueista jäi
> katveeseen — sano se suoraan äläkä anna ymmärtää, että dokumentointi tuottaa
> valmista jälkeä. Vaillinainen kartoitus tuottaa uskottavan näköistä mutta
> virheellistä dokumentaatiota, ja se on pahempi kuin tyhjä hakemisto.

> **Versionhallinta:** älä committaa. Kerro mitkä tiedostot syntyivät ja jätä
> commit kehittäjälle ([`konventiot.md`](konventiot.md) kohta 9).
