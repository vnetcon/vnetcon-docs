# vnetcon-docs — projektin dokumentaatio ja tikettityö tekoälyllä

Tämä hakemisto on **itseohjautuva dokumentaatiojärjestelmä** ympäröivälle
projektille (`../`). Se tuottaa ja ylläpitää kuvauksia siitä, *mitä projekti
tekee* (liiketoimintaprosessit), *miten se sen teknisesti tekee*
(järjestelmä- ja moduuliprosessit) ja *millä datalla* (datavirrat,
datarakenteet, datamallit).

Sama dokumentaatio toimii **kontekstipohjana**, kun tikettejä (rajattuja
koodimuutoksia) toteutetaan tekoälyavusteisesti — kehittäjän ei tarvitse itse
koota tietoja eikä muistaa menettelyä. Ohjeet ovat tiedostoissa, eivät promptissa.

> **Uusi projekti?** Aja `/vnetcon-init` (ks. alla). Se kartoittaa projektin ja
> konfiguroi tämän hakemiston sen mukaan. Ilman sitä muut komennot eivät tiedä,
> mistä projektista on kysymys.

---

## Aloittaminen (lue tämä ensin)

Tämä työkalu toimii **tekoälyagentin** sisällä — käytössä on **Claude Code**
ja/tai **Codex**. Kummatkin ovat päätteessä (terminaalissa) toimivia ohjelmia.
Alla olevat kauttaviivalla alkavat komennot (`/vnetcon-init`, `/dokumentoi`, …)
**eivät** ole pääte- tai git-komentoja — ne kirjoitetaan **agentin omaan
syötekenttään** sen jälkeen kun agentti on käynnistetty.

### Esivaatimukset

| Mitä | Tarvitaan | Miksi |
|------|-----------|-------|
| **Pääte** | aina | macOS/Linux: mikä tahansa. **Windowsilla PowerShell riittää** — Claude Code ja Codex toimivat siinä natiivisti, samoin Node-työkalut (`kalibroi`, `moduulit`, `linkit`, HTML-generointi). WSL2 käy myös; jos valitset sen, aja koko työ sen sisällä, myös `git`. |
| **bash** | vain `tyokalut/vnetcon-ai/…` | Paketissa on kaksi bash-skriptiä (`vnetcon-ai`, `hae-token.sh`); kaikki muu on Nodea tai ajetaan agentin sisällä. Windowsilla riittää **Git Bash** (tulee Git for Windowsin mukana) tai WSL2 — myös PowerShellista käsin: `bash tyokalut/vnetcon-ai/vnetcon-ai doctor`. Näitä tarvitaan vasta kun `tarjoaja ≠ oma`; oletuksella agentti käynnistetään pelkällä `claude`- tai `codex`-komennolla. |
| **`claude` ja/tai `codex`** | aina | `/`-komennot ajetaan agentin sisällä. Yksi agentti riittää alkuun; oletustyönjako on dokumentointi Claudella, toteutus Codexilla. |
| **Kirjautuminen agenttiin** | aina | Oletuksena oma tili (`claude`, `codex login`) — mitään ei tarvitse konfiguroida. Muut tarjoajat: ks. [Kenen AI-tiliä vasten ajetaan](#kenen-ai-tiliä-vasten-ajetaan). |
| **Node.js 18+** (suositus 20 LTS) | aina käytännössä | `kalibroi`, `moduulit`, `linkit` ja HTML-generointi ajetaan Nodella. Claude Code vaatii sen joka tapauksessa. |
| **git** | vahvasti suositeltu | Dokumentoinnin skooppi on `git ls-files`, ja `/synkronoi-dokumentaatio` perustuu commit-diffiin. Ilman gitiä aseta `projekti.versionhallinta: none` — silloin päivitykset tehdään käsin. |
| **`npm install`** html-generaattorissa | vain `/generoi-html` | Kertaluontoinen, vaatii verkon. Ilman sitä HTML syntyy, mutta haku ja Mermaid-kaaviot eivät toimi. |
| **`~/.vnetcon/credentials.env`** | vain pilvitarjoajilla | Tunnisteet, kun agentti osoitetaan omaan pilvitiliin, suoraan API-avaimeen tai organisaation omaan välityspalvelimeen. |

Pythonia, Dockeria, tietokantaa tai web-palvelinta ei tarvita. Tarkistus yhdellä
komennolla: `./tyokalut/vnetcon-ai/vnetcon-ai doctor`.

### Vaiheet

1. **Avaa pääte** (macOS/Linux: *Terminal*. Windows: PowerShell, Git Bash tai
   WSL2 — ks. [Esivaatimukset](#esivaatimukset) alla).
2. **Siirry tähän hakemistoon:**
   ```
   cd <polku-projektiin>/vnetcon-docs
   ```
3. **Käynnistä agentti:**
   ```
   claude
   ```
   Odota, että näet syötekentän.
   > Jos `claude`-komentoa ei löydy tai kirjautuminen puuttuu, aja
   > `./tyokalut/vnetcon-ai/vnetcon-ai doctor` — se kertoo mitä puuttuu.
   > (PowerShellissa: `bash tyokalut/vnetcon-ai/vnetcon-ai doctor`.)
   > Jos agentti on osoitettu omaan pilvitiliin tai API-avaimeen, käynnistä
   > `./tyokalut/vnetcon-ai/vnetcon-ai claude` (asettaa palvelun osoitteen
   > ja tunnisteen puolestasi).
4. **Kirjoita komento syötekenttään**, esim.:
   ```
   /vnetcon-init
   ```
5. **Vastaa agentin kysymyksiin** normaalisti kirjoittamalla.

**Tärkeää**

- Agentti käynnistetään **tässä hakemistossa** (`vnetcon-docs`), ei projektin
  juuressa. Vain täältä komennot löytyvät. Agentti näkee silti koko projektin
  (`..` on sallittu lukusuunta, ks. `.claude/settings.json`).
- Jos komennot eivät ilmesty `/`-merkillä, sulje agentti ja käynnistä uudelleen —
  komennot luetaan vain käynnistyksessä.
- Komentoja ei ole pakko muistaa: voit kirjoittaa tavallista suomea, esim.
  *"dokumentoi moduuli maksupalvelu vnetcon-docs-ohjeiden mukaan"*.
- **Dokumentaation kieli on konfiguroitavissa:** `vnetcon.config.yaml` →
  `dokumentaatio.kieli` (oletus `fi`). Arvolla `en` dokumentit ja generoitu HTML
  syntyvät englanniksi. Nämä menettelyohjeet (`metodi/`) ovat aina suomeksi — ne
  ovat agentin ohjeita, eivät osa tuotosta.

## Komennot

| Kun kirjoitat… | Agentti tekee näin |
|----------------|--------------------|
| `/vnetcon-init` | **Käyttöönotto.** Kartoittaa projektin (kieli, kehys, moduulit, testikomennot), kysyy muutaman asian ja kirjoittaa `vnetcon.config.yaml`, `tila/projekti.yaml`, `tila/rekisteri.yaml`, `tila/rakenne.yaml` sekä pinokohtaisen `metodi/kartoitus.md`:n. Aja tämä ensin. |
| `/kalibroi` | **Lähtötilanne ja laatu.** Kertoo kuinka hyvin geneerinen pohja osuu tähän projektiin, mikä jää katveeseen, paljonko työtä on jäljellä ja mitä kannattaa korjata ensin. Halpa ja nopea — aja milloin tahansa. |
| `/dokumentoi [moduuli]` | Valitsee seuraavan tekemättömän moduulin (tai nimeämäsi), kartoittaa koodin ja kirjoittaa/päivittää dokumentit. |
| `/dokumentoi-kaikki [osa-alue]` | **Orkestroija:** rakentaa kattavan dokumentaation oikeassa järjestyksessä (datamallit → moduulit rinnakkain → end-to-end → liiketoiminta → HTML). Iso operaatio — suositus: osa-alue kerrallaan. |
| `/dokumentoi-jarjestelmaprosessi [aihe]` | Kuvaa **end-to-end** -kulun moduulirajojen yli: mitä moduuleja läpäisee, missä järjestyksessä ja mikä data siirtyy. |
| `/generoi-datamallit` | Kuvaa projektin jaetut skeemat (OpenAPI / JSON Schema / SQL / EDN / tyypit) kertaalleen `datamallit/`-kansioon, johon muut dokit linkittävät. |
| `/generoi-html` | Muodostaa `.md`-dokumenteista selattavan **HTML-version** hakemistoon `html/` (navigaatio, Mermaid-kaaviot, koko tekstin haku; toimii ilman verkkoa). |
| `/valmistele-tiketti` | **Claude:** ottaa tiketin vastaan, kokoaa kontekstin dokumentaatiosta, suunnittelee ja iteroi kanssasi — ja kirjoittaa valmiin toteutuskehotteen Codexille. Ei koske koodiin. |
| `/toteuta-tiketti` | Toteuttaa rajatun koodimuutoksen dokumentaatio kontekstipohjana ja päivittää lopuksi dokit. Käytettävissä sekä Claudessa että Codexissa. |
| `/synkronoi-dokumentaatio` | Päivittää dokumentaation vastaamaan koodimuutoksia, jotka tehtiin **ilman** tikettiprosessia (suorat commitit, merget). |
| `/yhdenmukaista-dokumentaatio` | Päivittää vanhat dokit nykyisten mallipohjien mukaisiksi, kun **menettely** on muuttunut. |
| `/agentit` | Konfiguroi kumpi agentti tekee mitä ja kenen AI-tiliä vasten ne ajetaan (oma kirjautuminen, oma pilvitili tai organisaation välityspalvelin). |

Kunkin täydellinen menettely on kansiossa [`metodi/`](metodi/).

### Komennot ilman agenttia

Nämä ovat **pääte**komentoja (eivät `/`-komentoja): ne eivät käytä tekoälyä eikä
tilejä, ja toimivat myös ennen käyttöönottoa. Ajetaan tässä hakemistossa.

```bash
./tyokalut/vnetcon-ai/vnetcon-ai moduulit          # moduulit, tila ja mikä seuraavaksi
./tyokalut/vnetcon-ai/vnetcon-ai kalibroi          # lähtötilanne, katveet, laajuusarvio
./tyokalut/vnetcon-ai/vnetcon-ai linkit --lahteet  # rikkinäiset linkit ja lähdepolut
./tyokalut/vnetcon-ai/vnetcon-ai doctor            # mitä on asennettu ja konfiguroitu
```

`moduulit` on nopein tapa nähdä tilanne — ks. [Rakenne](#rakenne) alla.

## Työnjako: Claude ja Codex

Oletus (muutettavissa `/agentit`-komennolla tai `vnetcon.config.yaml`:sta):

- **Dokumentointi → Claude.** Laaja kartoitus ja kirjoittaminen.
- **Toteutus → Codex.** Tiketin koodimuutos.
- **Dokumentaation päivitys toteutuksen jälkeen → Codex** (sama sessio jatkaa)
  tai Claude erikseen `/synkronoi-dokumentaatio`lla.

Kädenojennus agenttien välillä tapahtuu tiedostojen kautta: Claude kirjoittaa
`tiketit/<tunnus>/` (tiketti, konteksti, suunnitelma, `codex-kehote.md`), ja
Codex käynnistetään sillä kehotteella:

```
./tyokalut/vnetcon-ai/vnetcon-ai toteuta <tunnus>
```

**Molemmat vaiheet ovat interaktiivisia.** Codex ei aloita koodaamista
kehotteesta vaan käy ensin vaiheen 3b vastaanottoportin: tarkistaa suunnitelman
koodia vasten, kertoo mistä on eri mieltä ja odottaa kehittäjän luvan
(`vastaanotto.md`). Suunnitteleva agentti ei siis voi sitoa toteuttavaa agenttia
ratkaisuun, jota tämä pitää virheellisenä — kahden agentin arvo on juuri siinä,
että ne ovat eri mieltä ennen kuin koodi muuttuu.

**Erimielisyys ratkotaan samassa sessiossa toteuttavan agentin kanssa**, eikä se
yleensä maksa paluuta Claudelle: kerrot 3b:ssä miten asia tehdään tai hyväksyt
Codexin ehdotuksen, muutos kirjataan `vastaanotto.md`:hen ja toteutus jatkuu sen
mukaan. Vaiheeseen 2 palataan vain, jos suunnitelman perusratkaisu ei päde.

Ks. [`metodi/agentit.md`](metodi/agentit.md).

## Kenen AI-tiliä vasten ajetaan

**Oletus: oma tili.** Jos `claude` tai `codex` on koneellasi kirjautunut, mitään
ei tarvitse konfiguroida — koodi ei kulje kenenkään kolmannen osapuolen
infrastruktuurin läpi.

Muut vaihtoehdot (`/agentit` konfiguroi ne):

| Malli | Kuka omistaa tilin | Kenelle |
|-------|--------------------|---------|
| **Oma tili** (oletus) | sinä | Toimii heti |
| **Oma pilvitili** (Bedrock, Vertex, Azure OpenAI, suora API-avain) | sinä | Yritys-/julkishallintokäyttö: avaimet ja liikenne pysyvät omassa tenantissa, kustannus on omaa pilvikulutusta |
| **Toimittajan tili** | toimittaja | Vain jos omaa tiliä ei ole eikä sitä voi hankkia. Promptissa on koodia, joten tämä tekee toimittajasta käsittelijän ja mallin tarjoajasta alikäsittelijän: vaatii kirjallisen luvan ja kaupallisilla ehdoilla olevan tilin |

Tunnisteet **eivät koskaan ole tässä hakemistossa** vaan tiedostossa
`~/.vnetcon/credentials.env`. Ks.
[`tyokalut/vnetcon-ai/README.md`](tyokalut/vnetcon-ai/README.md) ja
[`metodi/agentit.md`](metodi/agentit.md).

```
./tyokalut/vnetcon-ai/vnetcon-ai doctor        # mitä on asennettu ja konfiguroitu
```

## Rakenne

```
metodi/                 Moottori: miten dokumentoidaan (ohjeet + mallipohjat)  ← ei projektikohtainen
tila/                   Projektin faktat, rekisteri (mitä tehty/tekemättä), sessioloki
liiketoimintaprosessit/ Ei-tekninen kerros; voi ylittää moduulirajat; sisääntulo
jarjestelmaprosessit/   End-to-end -kulut moduulirajojen yli (tekninen)
moduulit/<moduuli>/     Tekninen tuotos: yleiskuvaus, prosessit, datavirrat, datarakenteet
datamallit/             Jaetut skeemat, joihin moduulit linkittävät
tiketit/<tunnus>/       Tikettityön jälki (vaiheet 0–5) — myös agenttien kädenojennus
tyokalut/               html-generaattori, vnetcon-ai (agenttien käynnistys), tarkista-linkit.mjs
html/                   Generoitu selattava HTML (johdettu md:stä; ei versioida)
```

Kunnon voi tarkistaa milloin tahansa **ilman agenttia ja ilman riippuvuuksia** —
ks. [Komennot ilman agenttia](#komennot-ilman-agenttia) yllä.

`moduulit` on nopein tapa nähdä tilanne: se listaa moduulit osa-alueittain,
näyttää tilan (`tekematta` / `kesken` / `valmis` / `rajattu-pois`), koodirivit ja
dokumenttimäärän — ja ehdottaa mitä kannattaa dokumentoida seuraavaksi. Liput:
`--tekematta`, `--osa-alue <tunnus>`, `--json`, `--nopea`.

Lista rakentuu kolmesta lähteestä: `tila/rekisteri.yaml` on **virallinen** jako,
`tila/rakenne.yaml` antaa osa-alueryhmittelyn ja koodista päätelty
`tila/kalibrointi.json` tuo rivimäärät ja puuttuvat ehdokkaat.

> **Ennen käyttöönottoa lista on vain ehdotus.** Ilman `tila/rekisteri.yaml`:ia
> moduulit päätellään koodin sijainnista: ehdokkaaksi kelpaa hakemisto, jossa on
> koodia (dokumentaatio-, testi- ja esimerkkikansiot on rajattu pois). Tilat on
> silloin päätelty dokumenttien olemassaolosta (`valmis?`), eivät rekisteristä.
> `/vnetcon-init` vahvistaa oikean jaon.

**Moduuli ei aina ole hakemisto.** Jos yhdessä hakemistossa on kymmeniä tuhansia
rivejä, se jaetaan rekisterissä loogisiin moduuleihin, jotka jakavat saman
`polku`n; silloin moduulin `tiedostot`-lista ratkaisee rajauksen ja koodirivit
lasketaan sen mukaan. Listaus merkitsee `ei rekisterissä` jokaisen
koodihakemiston, joka ei kuulu yhteenkään moduuliin — **se on koodia, joka jäisi
muuten hiljaisesti dokumentoimatta.** Sama tieto on kalibrointiraportissa
otsikolla *Rekisterin ulkopuolelle jäävä koodi*.

`kalibroi` kirjoittaa `kalibrointiraportti.md`:n: kuinka hyvin geneerinen pohja
osuu tähän projektiin, mitkä alueet jäivät katveeseen, kuinka paljon työtä on
jäljellä ja mitkä ovat esteet. **Raportti ei sisällä koodia**, joten se on
lähetettävissä eteenpäin, jos haluat arvion työmäärästä ulkopuolelta.

Projektikohtaiset korjaukset kuuluvat aina **laajennuspisteisiin** — ks.
[`metodi/laajennuspisteet.md`](metodi/laajennuspisteet.md). Näin paketin
päivitys ei ylikirjoita niitä.

## Ajantasaisuus

Jokaisessa dokumentissa on frontmatterissa `lahteet:` (mistä koodista johdettu),
`paivitetty:` ja `git-viite:`. Kun lähdekoodi muuttuu, dokumentti **päivitetään
paikallaan** — sitä ei luoda uudelleen alusta.

## Versionhallinta

Kaikki `git add`/`commit`/`push` **hyväksytetään aina kehittäjältä** — tätä
varten tässä hakemistossa on `ask`-permission-säännöt
(`.claude/settings.json`). Ks. [`metodi/konventiot.md`](metodi/konventiot.md)
kohta 8.

| Committoidaan | Ei committoida |
|---------------|----------------|
| `vnetcon-docs/**` paitsi alla olevat | `html/`, `node_modules/`, `**/settings.local.json`, `.paikallinen/` |
