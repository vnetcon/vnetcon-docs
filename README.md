# vnetcon-docs — geneerinen AI-dokumentaatio- ja tikettiympäristö

> 🇬🇧 In English: [`README.en.md`](README.en.md)

Tämä repo on **työkalun lähde**. Se tuottaa hakemiston `dist/`, joka kopioidaan
minkä tahansa projektin juureen nimellä `vnetcon-docs/`. Sen jälkeen projektiin
saadaan yhdellä komennolla (`/vnetcon-init`) itseohjautuva dokumentaatio­järjestelmä
ja tikettien toteutusympäristö. Menettely on kehitetty suurissa
tuotantokoodipohjissa ja yleistetty tässä projektiriippumattomaksi.

## Arvioi oma koodipohjasi ilmaiseksi

**Jos tulit tänne arvioimaan omaa projektiasi, aloita tästä.** Kolme ensimmäistä
komentoa ovat paikallisia Node-skriptejä: **ei tekoälyä, ei verkkoyhteyttä, ei
tilejä, ei käyttöoikeuksia kenellekään.** Koodisi ei liiku mihinkään.

Esivaatimukset: `git`, **Node 18+** ja `bash` (alla olevat skriptit ovat
bash-skriptejä; itse työkalut ovat Nodea). **Windowsilla asenna Git for
Windows** — se tuo yhdellä kertaa sekä `git`in että `bash`in. WSL2 käy myös.
Komennot voi ajaa PowerShellistakin kirjoittamalla eteen `bash`, esim.
`bash vnetcon-docs/tyokalut/asenna.sh …`.

```bash
git clone https://github.com/vnetcon/vnetcon-docs.git
vnetcon-docs/tyokalut/asenna.sh /polku/projektiisi
cd /polku/projektiisi/vnetcon-docs
```

Sen jälkeen:

| Komento | Mitä se kertoo |
|---------|----------------|
| `./tyokalut/vnetcon-ai/vnetcon-ai moduulit` | Mitä moduuleja koodipohjassa on, kuinka isoja ne ovat ja mikä kannattaisi dokumentoida ensin. Toimii ennen käyttöönottoa |
| `./tyokalut/vnetcon-ai/vnetcon-ai kalibroi` | Kirjoittaa `kalibrointiraportti.md`:n: laajuusarvio tunteina ja AI-kustannuksena, katvealueet, dokumentaation tila. **Koodivapaa** — voit lähettää sen eteenpäin |
| `./tyokalut/vnetcon-ai/vnetcon-ai doctor` | Mitä on asennettu ja konfiguroitu. Aja tämä jos jokin ei toimi |

### Mitä odottaa ensimmäisellä ajolla

Raportti sanoo **”3 estoa: käyttöönotto kesken”**. Se on odotettu ensimmäinen
tila, ei virhe — se tarkoittaa, ettei moduulijakoa ole vielä vahvistettu, joten
kartoitus käyttää vain geneerisiä hakuja. Laajuusarvio, moduulikoot ja
katvealueet ovat silti käytettävissä.

Raportti kertoo myös ne kysymykset, joihin se **ei itse pysty vastaamaan**:
nolla osumaa jollakin hakualueella tarkoittaa joko sitä, ettei aluetta ole, tai
sitä että se on toteutettu tavalla jota geneerinen haku ei tunnista. Jälkimmäinen
on se tapaus, joka tuottaa vaillinaista dokumentaatiota huomaamatta — ja se
ratkaistaan lukemalla koodia, ei ajamalla työkalua uudelleen.

### Seuraava askel vaatii AI-tilin

Kun haluat oikean moduulijaon geneeristen ehdokkaiden sijaan, käynnistä agentti
tässä hakemistossa ja aja `/vnetcon-init` (ks. [Käyttöönotto](#käyttöönotto-kohdeprojektissa)).
Se on mitatusti noin **$16 omalla AI-tililläsi** 60 000 rivin projektissa.

Selattava näyte siitä, miltä valmis dokumentaatio näyttää:
[vnetcon.com/nayte](https://vnetcon.com/nayte/).

---

Kokonaisuus tukee **kahta agenttia**: dokumentointi ajetaan tyypillisesti
Claudella ja tikettien toteutus Codexilla, mutta kumpi tahansa osaa kummankin.
Kädenojennus agentilta toiselle on **interaktiivinen molemmista päistä**:
toteuttava agentti ei aloita koodaamista valmiista kehotteesta vaan tarkistaa
suunnitelman koodia vasten, kertoo mistä on eri mieltä ja odottaa kehittäjän
luvan (vaihe 3b, [`dist/metodi/tiketti-tyonkulku.md`](dist/metodi/tiketti-tyonkulku.md)).
Kahden agentin arvo on juuri siinä, että ne ovat eri mieltä ennen kuin koodi
muuttuu — ja erimielisyys ratkotaan samassa sessiossa toteuttavan agentin
kanssa, joten se ei yleensä maksa paluuta suunnitteluvaiheeseen.
Oletuksena käytetään **asiakkaan omaa AI-tiliä** — koodi ei kulje kolmannen
osapuolen läpi. Muut tarjoajat (oma pilvitili, suora API-avain tai organisaation
oma välityspalvelin) ovat konfiguroitavissa; ks.
[`dist/metodi/agentit.md`](dist/metodi/agentit.md).

## Käyttömalli

Asiakas asentaa paketin ja **ajaa ensimmäiset ajot itse** — koodia ei tarvitse
luovuttaa kenellekään. `kalibroi` kertoo koneellisesti, kuinka hyvin geneerinen
pohja osuu juuri tähän projektiin ja **mikä jää katveeseen**. Katve on
rakenteellinen ja odotettu: geneeriset haut eivät tunne projektin omia kaavoja.

Kalibrointiraportti on **koodivapaa**, joten se voidaan lähettää eteenpäin
arviointia varten. Korjaukset kohdistuvat aina laajennuspisteisiin
([`dist/metodi/laajennuspisteet.md`](dist/metodi/laajennuspisteet.md)), joten
paketin päivitys ei koskaan ylikirjoita niitä.

---

## Mitä se tekee

| Vaihe | Komento | Agentti | Tulos |
|-------|---------|---------|-------|
| Käyttöönotto | `/vnetcon-init` | Claude | Projektin kartoitus, `vnetcon.config.yaml`, `tila/`-rekisteri, pinokohtainen `metodi/kartoitus.md` |
| Moduulilista | `vnetcon-ai moduulit` | — | Moduulit osa-alueittain, tila, koodirivit, dokkien määrä + ehdotus seuraavasta. Toimii ennen käyttöönottoa |
| Lähtötilanne | `/kalibroi` tai `vnetcon-ai kalibroi` | — | `kalibrointiraportti.md`: katvealueet, kattavuus, laatu ja laajuusarvio. Koodivapaa, lähetettävissä |
| Dokumentointi | `/dokumentoi <moduuli>` | Claude | `moduulit/<moduuli>/` — yleiskuvaus, prosessit, datavirrat, datarakenteet |
| Kattava ajo | `/dokumentoi-kaikki [osa-alue]` | Claude | Koko osa-alue rinnakkain (moniagenttinen workflow) |
| End-to-end | `/dokumentoi-jarjestelmaprosessi` | Claude | `jarjestelmaprosessit/` — moduulirajat ylittävät kulut |
| Selattava versio | `/generoi-html` | kumpi vain | `html/` — staattinen sivusto, haku + Mermaid, toimii `file://` |
| Tiketin valmistelu | `/valmistele-tiketti` | Claude | `tiketit/<tunnus>/` konteksti + suunnitelma + valmis Codex-kehote |
| Tiketin toteutus | `/toteuta-tiketti` | Codex | Vaihe 3b: tarkistaa suunnitelman koodia vasten ja esittää eriävät näkemyksensä → luvan jälkeen koodimuutos + dokumentaation päivitys |
| Ylläpito | `/synkronoi-dokumentaatio`, `/yhdenmukaista-dokumentaatio` | kumpi vain | Dokit ajan tasalle koodi-/metodimuutosten kanssa |
| Tarkistus | `vnetcon-ai linkit --lahteet` | — | Rikkinäiset linkit ja `lahteet`-polut (ei vaadi agenttia eikä riippuvuuksia) |
| Agenttien konfigurointi | `/agentit` | Claude | Työnjako + kenen tiliä vasten ajetaan: oma kirjautuminen, oma pilvitili tai organisaation välityspalvelin |

## Käyttöönotto kohdeprojektissa

```bash
# 1. hae tämä repo (kertaluontoinen)
git clone https://github.com/vnetcon/vnetcon-docs.git
cd vnetcon-docs

# 2. kopioi paketti kohdeprojektin juureen
tyokalut/asenna.sh /polku/kohdeprojektiin

# 3. käynnistä agentti pakettihakemistossa
cd /polku/kohdeprojektiin/vnetcon-docs
claude
```

ja Clauden syötekenttään:

```
/vnetcon-init
```

**Esivaatimukset kohdekoneella:** `claude` ja/tai `codex` kirjautuneena, Node.js
18+ ja mieluiten git. Agentit ja Node-työkalut toimivat Windowsilla natiivisti
(PowerShell käy); `bash` tarvitaan vain `tyokalut/vnetcon-ai/`-skripteihin —
Windowsilla Git Bash tai WSL2. Täydellinen lista ja perustelut:
[`dist/README.md` → Esivaatimukset](dist/README.md#esivaatimukset). Tarkistus
kohteessa: `./tyokalut/vnetcon-ai/vnetcon-ai doctor`.

Loppukäyttäjän ohje on [`dist/README.md`](dist/README.md) (se kopioituu mukana
nimellä `vnetcon-docs/README.md`).

## Jakelumalli — paketti kopioidaan, sitä ei linkitetä

Tämä poikkeaa siitä, mihin kehittäjä on tottunut, joten se on syytä sanoa ääneen:
`asenna.sh` **kopioi** `dist/`-hakemiston kohdeprojektiin nimellä
`vnetcon-docs/`. Se ei ole submodule, npm-riippuvuus eikä symlink.

Näin siksi, että paketti on itsenäinen: se toimii ilman verkkoa, ilman
`npm install`ia (paitsi HTML-generointi) ja ilman että asiakkaan build-putkeen
tulee uusi riippuvuus. Hinta on se, että **päivitys on aktiivinen toimenpide**:

```bash
cd /polku/tahan/repoon && git pull
tyokalut/asenna.sh /polku/kohdeprojektiin --paivita
```

Kohdeprojektiin kirjoitetaan `.vnetcon-docs-versio`, josta näkee mikä versio on
käytössä.

> **Zip on ensiasennukseen, ei päivitykseen.** Sen sisältö on sama kuin
> `dist/`:n, mutta *vaikutus* ei ole sama: `--paivita` kopioi vain moottorin,
> kun taas zipin purku olemassa olevan asennuksen päälle ylikirjoittaa myös
> projektin oman sisällön pohjilla — `tila/projekti.yaml`, `tila/rekisteri.yaml`
> (mitä on dokumentoitu), `tila/rakenne.yaml`, `tila/edistyminen.md`,
> `tila/synkronoitu.yaml`, `johdanto.md`, `metodi/kartoitus.md`,
> `metodi/sanasto.md` ja `.claude/settings.json`. Pohjatiedostot eivät voi
> puuttua zipistä, koska ensiasennus tarvitsee ne.
>
> **Verkottomassa ympäristössä päivitys tehdään käsin:** pura zip väliaikaiseen
> hakemistoon ja kopioi sieltä vain nämä olemassa olevan asennuksen päälle:
> `metodi/` (paitsi `kartoitus.md` ja `sanasto.md`), `tyokalut/`,
> `.claude/skills/`, `.claude/workflows/`, `tila/metodi.yaml`, `CLAUDE.md`,
> `AGENTS.md`, `README.md`, `vnetcon.config.example.yaml`, `.gitignore`.
> Sama lista kuin `asenna.sh --paivita`:lla. Jos `vnetcon-docs/` on asiakkaan
> versionhallinnassa (oletus — sitä ei ole gitignoroitu), vahinko näkyy
> `git diff`issä ja on peruttavissa.

## Repon rakenne

```
dist/                  Paketti, joka kopioidaan projektiin nimellä vnetcon-docs/
tyokalut/asenna.sh     Kopioi dist/ → <kohdeprojekti>/vnetcon-docs (idempotentti, päivittää moottorin)
tyokalut/paketoi.sh    Tekee jaeltavan vnetcon-docs-<versio>.zip
tyokalut/testaa.sh     Savutesti: rakentaa tilapäisprojektit ja väittää tuloksista
VERSIO                 Paketin versio (asenna.sh kirjoittaa sen kohteeseen)
LICENSE                Apache-2.0
```

## Kielet

| Kerros | Kieli | Konfiguroitavissa |
|--------|-------|-------------------|
| Työkalun **tuottama** dokumentaatio | `vnetcon.config.yaml` → `dokumentaatio.kieli` (oletus `fi`) | **kyllä** — arvolla `en` tuotos ja generoitu HTML ovat englanniksi |
| Menettelydokumentit (`dist/metodi/**`) ja skillit | suomi | ei |
| Tämän repon README | suomi + englanti ([`README.en.md`](README.en.md)) | — |

Menettelydokumentit pidetään tarkoituksella **yksikielisinä**. Ne ovat promptia,
jota agentti noudattaa, eivät ihmiselle kirjoitettua proosaa: kahden kieliversion
pitäisi pysyä identtisinä *käyttäytymisen* tasolla, ja pienin ajautuminen niiden
välillä tuottaisi samasta koodista erilaisen dokumentaation. Se rikkoisi juuri sen
johdonmukaisuuden, jonka vuoksi työkalu on olemassa — eikä pariteettia voi
varmistaa savutestillä.

Jos menettely itse tarvitaan englanniksi (esim. asiakkaan on auditoitava se ennen
käyttöönottoa), se on oma projekti: **termistö on lukittava ensin**, koska
`katve`, `kartoitus`, `laajennuspiste` ja `lähteet` eriytyisivät muuten
käsitteellisesti eivätkä vain kielellisesti.

## Kehittäminen

`dist/` on totuuden lähde. Muutokset tehdään sinne ja jaellaan `asenna.sh`illa.

`--paivita` päivittää vain **moottorin** (`metodi/**`, `tyokalut/**`,
`.claude/skills|workflows`, `CLAUDE.md`, `AGENTS.md`, `README.md`,
`vnetcon.config.example.yaml`, `.gitignore`) ja säilyttää aina projektin oman
sisällön: `vnetcon.config.yaml`, `tila/`, `johdanto.md`, dokumenttikansiot,
`metodi/kartoitus.md`, `metodi/sanasto.md`, `.claude/settings.json` sekä
projektin itse lisäämät skillit. Poistettuja paketin tiedostoja ei siivota —
ne jäävät kohteeseen, joten tarkista `git status` päivityksen jälkeen.

Jos menettely muuttuu niin, että jo kirjoitetut dokumentit pitää päivittää,
kasvata `dist/tila/metodi.yaml` → `metodi_versio` ja lisää `muutokset`-rivi;
kohdeprojekteissa ajetaan sen jälkeen `/yhdenmukaista-dokumentaatio`.

### Savutesti

**Aja tämä ennen jokaista julkaisua.** Se rakentaa kaksi tilapäistä projektia,
asentaa paketin niihin ja väittää tuloksista — mukaan lukien ne tapaukset, jotka
ovat kertaalleen olleet rikki (moduuli ei ole hakemisto, `tiedostot`-listan
rivikohdistus, haamurivit, katveen rajaus):

```bash
tyokalut/testaa.sh           # exit 0 = läpi
tyokalut/testaa.sh --pida    # jättää tilapäishakemistot tutkittavaksi
```

Sen lisäksi kannattaa testata **oikeaa isoa koodipohjaa** vasten: asenna paketti
sinne ja aja `kalibroi`. Se on lukuoperaatio, joten se ei muuta kohdeprojektia.
Tarkista, että 0-osuman alueet ovat aitoja katveita eivätkä hakukaavan bugeja.

HTML-generointi vaatii verkon kertaalleen, eikä se ole savutestissä:

```bash
(cd dist/tyokalut/html-generaattori && npm install && node generoi.mjs)
```

## Julkaisu

```bash
tyokalut/testaa.sh                       # pakollinen
# kasvata VERSIO
tyokalut/paketoi.sh                      # → vnetcon-docs-<versio>.zip
git commit -am "vX.Y.Z: <mitä muuttui>"
git tag vX.Y.Z && git push --tags
```

Liitä zip GitHubin releaseen: eristetyissä ympäristöissä se on ainoa
toimitustapa, ja se on samalla auditointiartefakti siitä, mikä versio
toimitettiin. Zip syntyy `paketoi.sh`:lla eikä sitä ylläpidetä erikseen.

## Lisenssi

Apache-2.0, ks. [`LICENSE`](LICENSE). Menetelmä on julkinen tarkoituksella:
paketti kopioituu kokonaisuudessaan asiakkaan repoon, joten sen tarkastettavuus
on ostoperuste eikä riski.
