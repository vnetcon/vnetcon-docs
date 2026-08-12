# Agentit: Claude ja Codex, työnjako ja pilvipalvelu

Tämä järjestelmä on **agenttiriippumaton**: menettely on `metodi/`-kansiossa,
eivät agentin sisäiset ominaisuudet. Käytännössä kaksi agenttia tukevat toisiaan.

## Työnjako (oletus)

| Työ | Oletusagentti | Miksi |
|-----|---------------|-------|
| Dokumentointi (`/dokumentoi`, `/dokumentoi-kaikki`, järjestelmäprosessit) | **Claude** | Laaja kartoitus monesta tiedostosta, rinnakkaiset aliagentit, plan mode |
| Tiketin valmistelu (vaiheet 0–3) | **Claude** | Kysely + kontekstin koonti + plan mode -hyväksyntäportti |
| Tiketin toteutus (vaiheet 4–5) | **Codex** | Koodimuutokset ja testiajot |
| Dokumentaation päivitys toteutuksen jälkeen | **Codex** (sama sessio) | Muutokset ovat tuoreessa muistissa |
| Synkronointi / yhdenmukaistus | kumpi vain | Menettely on identtinen |

Muuta oletukset `vnetcon.config.yaml`:n `agentit`-osiosta (`dokumentointi`,
`toteutus`, `paivitys`) tai komennolla `/agentit`. Kumpi tahansa agentti osaa
kaikki työt — työnjako on suositus, ei rajoite.

## Miten agentti löytää ohjeet

| Agentti | Käynnistyshakemisto | Mistä ohjeet |
|---------|--------------------|--------------|
| Claude | `vnetcon-docs/` | `CLAUDE.md` + `.claude/skills/*` (slash-komennot) |
| Codex | projektin juuri **tai** `vnetcon-docs/` | `AGENTS.md` (juuressa viittaus `vnetcon-docs/AGENTS.md`:hen), valinnaiset kehotteet `~/.codex/prompts/` |

Claude näkee projektin koodin, koska `.claude/settings.json` sallii
`additionalDirectories: [".."]`. Jos jokin polku silti estyy, käynnistä
`claude --add-dir ..`.

Codex käynnistetään yleensä projektin juuressa, jolloin se voi muokata koodia
ilman lisäasetuksia ja lukee `vnetcon-docs/`-ohjeet suhteellisella polulla.

## Kädenojennus agenttien välillä

Ainoa siirtomekanismi on **tiedostot** hakemistossa `tiketit/<tunnus>/`. Mitään
ei siirretä keskusteluhistoriana.

```
tiketit/<tunnus>/
  tiketti.md        Vaihe 0: tavoite, hyväksymiskriteerit, reunaehdot
  konteksti.md      Vaihe 1: mihin muutos osuu (linkit dokkeihin ja koodiin)
  suunnitelma.md    Vaihe 2–3: suunnitelma + hyväksyntämerkintä
  codex-kehote.md   Vaihe 3: valmis toteutuskehote seuraavalle agentille
  lopputulos.md     Vaihe 5: mitä tehtiin, testit, päivitetyt dokit
```

### `codex-kehote.md` — mitä siihen kirjoitetaan

Kehotteen pitää olla itsenäisesti riittävä (toinen agentti ei ole nähnyt
keskustelua). Rakenne:

```markdown
# Toteutuskehote: <tunnus> — <otsikko>

Olet projektin juuressa. Menettely: `vnetcon-docs/metodi/tiketti-tyonkulku.md`
vaiheet 4–5. Vaiheet 0–3 on tehty ja **suunnitelma on hyväksytty** —
älä suunnittele uudelleen äläkä laajenna skooppia.

## Lue ensin
- vnetcon-docs/tiketit/<tunnus>/tiketti.md
- vnetcon-docs/tiketit/<tunnus>/konteksti.md
- vnetcon-docs/tiketit/<tunnus>/suunnitelma.md
- vnetcon-docs/metodi/konventiot.md

## Tehtävä
<1–3 lausetta>

## Muutettavat tiedostot
- `path/to/file.ts` — <mitä muutetaan>

## Reunaehdot
- <mitä EI saa muuttua, yhteensopivuus, migraatiot>

## Testaus
- `<testikomento>` — pitää mennä läpi
- <uudet testit, jotka pitää lisätä>

## Lopetus
1. Päivitä dokumentaatio (vaihe 5): etsi dokit, joiden `lahteet` osuu
   muuttuneisiin polkuihin, ja päivitä ne paikallaan.
2. Kirjoita `vnetcon-docs/tiketit/<tunnus>/lopputulos.md`, aseta `tila: valmis`.
3. **Älä committaa** ilman kehittäjän lupaa.
4. Jos suunnitelma ei päde, pysähdy ja kysy — älä improvisoi.
```

Kehote käynnistetään:

```
./tyokalut/vnetcon-ai/vnetcon-ai toteuta <tunnus>
```

joka lukee agentin `vnetcon.config.yaml`:n `agentit.toteutus`-kentästä ja
käynnistää sen projektin juuressa kehotteella. (Käsin:
`cd .. && codex "$(cat vnetcon-docs/tiketit/<tunnus>/codex-kehote.md)"`.)

## Kenen AI-tiliä vasten ajetaan

Koodi on aina asiakkaan versionhallinnassa, ja työasemalla oleva klooni on sama
asia kuin missä tahansa git-pohjaisessa toimeksiannossa. **Ainoa ero tavalliseen
alihankintaan on se, että promptissa lähtee koodia mallin tarjoajalle.** Siksi
tämän luvun kysymys ei ole kuka koodin omistaa vaan **kenen tiliä vasten agentti
ajetaan** — se ratkaisee kuka on tietojenkäsittelijä ja kenen laskulla tokenit
ovat.

Kolme mallia paremmuusjärjestyksessä:

| Malli | Kenen tili | Kenen lasku | Kenelle |
|-------|-----------|-------------|---------|
| **1. Asiakkaan oma tili** (`oma`) | asiakas | asiakas | Oletus. Toimii heti, jos `claude`/`codex` on kirjautunut. Koodi ei kulje kenenkään kolmannen kautta paitsi mallin tarjoajan, jonka asiakas on itse valinnut. |
| **2. Asiakkaan oma pilvitili** (`bedrock`, `vertex`, `anthropic-api`, `openai-api`) | asiakas | asiakas (pilvikulutus) | Suositeltu yritys- ja julkishallintomalli. Liikenne ja avaimet asiakkaan tenantissa; Vnetcon voi operoida siellä tunnisteilla, ja konfiguroinnin sekä seurannan voi ostaa palveluna. |
| **3. Toimittajan oma tili** (`oma`, toimittajan kirjautuminen) | Vnetcon | Vnetcon | Pienet asiakkaat joilla ei ole AI-tiliä eikä lupaa hankkia sitä. Poistaa esteen kokonaan, mutta siirtää käsittelijän vastuun toimittajalle — ks. ehdot alla. |

Mallissa 3 ei ole omaa `tarjoaja`-arvoa: teknisesti se on `oma`, ja ero on vain
siinä kenen kirjautuminen koneella on aktiivinen. Konfiguraatioon ei siis tule
mitään mallikohtaista — vastuu ja paperit ovat sopimuksessa, eivät asetuksissa.

> **Malli 3 vaatii kolme asiaa ennen ensimmäistä ajoa.** (1) Kirjallinen lupa,
> jossa mallin tarjoaja on **nimetty alikäsittelijänä** — koodin luovutus
> toimittajalle ja sen lähettäminen mallin tarjoajalle ovat eri asia, ja lupa
> tarvitaan erikseen jälkimmäiseen. (2) Tili **kaupallisilla ehdoilla**
> (Team/Enterprise/API), ei henkilökohtainen kuluttajatilaus: kuluttajatasolla
> säilytys- ja koulutusasetukset ovat väärä oletus jonkun toisen omistamalle
> lähdekoodille. (3) **Salaisuustarkistus repoon ennen ajoa** — versionhallinnassa
> oleva tunnistetiedosto menee kontekstiin siinä missä muukin koodi.

**Kysy malli ensimmäisessä keskustelussa.** Isoilla organisaatioilla ja
julkishallinnossa on usein lista hyväksytyistä AI-palveluista, jolla toimittajan
omaa tiliä ei ole — silloin malli 3 ei ole valittavissa vaikka toimittaja olisi
valmis. Tunnisteiden saaminen malliin 2 voi kestää viikkoja, joten tämä on
aikatauluriski eikä tekninen riski.

> **Vaiheet 0 ovat riippumattomia tästä.** `vnetcon-ai moduulit` ja
> `vnetcon-ai kalibroi` ovat paikallisia Node-skriptejä ilman tekoälyä, joten
> lähtötilanteen kartoitus ja laajuusarvio onnistuvat ennen kuin tilikysymykseen
> on otettu kantaa.

Periaatteet kaikissa malleissa:

- **Osoitteet** (`base_url`, malli, alue) ovat projektikohtaisessa
  `vnetcon.config.yaml`:ssa — ne eivät ole salaisuuksia.
- **Tunnisteet eivät koskaan ole tässä hakemistossa** vaan tiedostossa
  `~/.vnetcon/credentials.env` (oikeudet `600`). Konfiguraatio viittaa niihin
  muodossa `token_lahde: "~/.vnetcon/credentials.env:MUUTTUJAN_NIMI"`.
- **Käyttäjä ei kirjoita tunnisteita agentin chattiin.** Jos tunniste puuttuu,
  ohjaa käyttäjä kirjoittamaan se itse credentials-tiedostoon.

### Vaihtoehdot

| `tarjoaja` | Claude | Codex |
|-----------|--------|-------|
| `oma` **(oletus)** | Käyttäjän oma kirjautuminen (`claude` / tilaus tai API-avain) | Käyttäjän oma `codex login` |
| `bedrock` / `vertex` | `CLAUDE_CODE_USE_BEDROCK` / `CLAUDE_CODE_USE_VERTEX` + alue (asiakkaan tenant) | — (käytä `openai-api` + Azure-osoite) |
| `anthropic-api` / `openai-api` | Suora API-avain (asiakkaan oma) | Suora API-avain; myös Azure OpenAI `base_url`illa |
| `gateway` | `ANTHROPIC_BASE_URL` = **asiakkaan oman** välityspalvelimen osoite + bearer-tunniste | Codexin `model_provider` = asiakkaan välityspalvelin + tunniste |

`gateway` on olemassa vain sitä varten, että osa yritys- ja
julkishallintoasiakkaista ajaa mallikutsut oman sisäisen välityspalvelimensa
kautta. Se on siis asiakkaan infraa, ja kuuluu malliin 2. **Vnetcon ei tarjoa
välityspalvelinta** eikä sellaista ole tarkoitus rakentaa: jos asiakkaalla ei ole
omaa tiliä, vaihtoehto on malli 3 (toimittajan tili ehtoineen), ei välityspalvelu.

Käytännön asetukset ja ympäristömuuttujat: [`../tyokalut/vnetcon-ai/README.md`](../tyokalut/vnetcon-ai/README.md).
Konfigurointi agentin kanssa: `/agentit`.

### Käynnistys palvelua vasten

```
./tyokalut/vnetcon-ai/vnetcon-ai doctor     # mitä on asennettu, mikä tunniste löytyy
./tyokalut/vnetcon-ai/vnetcon-ai claude     # Claude vnetcon-docs-hakemistossa
./tyokalut/vnetcon-ai/vnetcon-ai codex      # Codex projektin juuressa
```

Claudelle on lisäksi automaattinen polku: kun `/agentit` on kirjoittanut
`.claude/settings.json`:iin `env.ANTHROPIC_BASE_URL`-arvon ja
`apiKeyHelper`-skriptin, pelkkä `claude` tässä hakemistossa käyttää palvelua
ilman käynnistysskriptiä.

## Aliagenttien malli (suurin yksittäinen kuluerä)

`/dokumentoi-kaikki` spawnaa kaksi aliagenttia per moduuli: **dokumentointiagentin**
(lukee koodin, kirjoittaa dokumentit mallipohjista) ja **verifiointiagentin**
(etsii dokumenteista virheitä koodia vasten). Mitatussa ajossa **39 %
kokonaiskulutuksesta oli näissä aliagenteissa.**

Molempien malli on konfiguroitavissa: `vnetcon.config.yaml` →
`agentit.aliagentit.dokumentointi_malli` / `verifiointi_malli`. Tyhjä = peri
pääagentilta.

| Malli | Hinta suhteessa Opus 5:een | Soveltuvuus |
|-------|---------------------------|-------------|
| `claude-opus-5` | 1,0× | Oletus |
| `claude-sonnet-5` | ~0,6× | **Dokumentointiagentille luonteva:** työ on rajattua lukemista ja kirjoittamista mallipohjien mukaan |
| `claude-haiku-4-5` | ~0,2× | Halvin, mutta aito laaturiski — "mitä tämä koodi tekee" on arvostelukykyä |

**Verifiointiagenttia ei kannata alentaa.** Sen tehtävä on olettaa että
dokumentaatiossa on virheitä ja löytää ne — se on juuri sitä arvostelukykyä, jonka
vuoksi kalliimpi malli on olemassa. Halvempi verifiointi tuottaa hyväksyntöjä, ei
löydöksiä, ja silloin koko adversariaalinen vaihe on teatteria.

Hinnat ovat suhteellisia eivätkä absoluuttisia — tarkista voimassa oleva hinnasto
mallin tarjoajalta. **Kustannus on asiakkaan omalla AI-tilillä** (oletus
`tarjoaja: oma`), joten mallin valinta on asiakkaan päätös, ei Vnetconin.

## Laskutus ja käytön seuranta

> ⚠️ **Kulutusta ei kirjata, jos agentti käynnistetään suoraan.** `kaytto_loki`
> täyttyy **vain** kun ajo menee `./tyokalut/vnetcon-ai/vnetcon-ai`-skriptin
> kautta. Pelkkä `claude` tai `codex` — jota README neuvoo käyttämään, koska se
> on yksinkertaisin — ei kirjaa mitään. Jos kulutusta on tarkoitus seurata,
> valitse **toinen** näistä tavoista tietoisesti:
>
> | Tapa | Mitä saa | Vaatii |
> |------|----------|--------|
> | `vnetcon-ai claude` / `vnetcon-ai dokumentoi <moduuli>` | rivi per ajo: aika, komento, agentti, kesto, tulos — **ei tokeneita** | että jokainen ajo muistetaan käynnistää skriptillä |
> | `laskutus.otel_endpoint` | token- ja kustannusdata automaattisesti, riippumatta käynnistystavasta | OTLP-vastaanottimen |
>
> **OTEL on ainoa luotettava tapa**, koska se ei riipu siitä miten agentti
> käynnistettiin. Ilman sitä token­kulutus on olemassa vain agentin omassa
> sessiossa (Claude Codessa `/cost`), ja se katoaa session mukana.

- `laskutus.asiakas` — tunniste, joka kirjataan jokaiseen ajoon.
- `laskutus.kaytto_loki` — `vnetcon-ai` kirjaa rivin per ajo (JSONL: aika,
  projekti, komento, agentti, kesto, tulos). Tiedosto on `.gitignore`ssa.
  **Ei sisällä tokenmääriä** — se on ajopäiväkirja, ei kulutusmittari.
- `laskutus.otel_endpoint` — jos asetettu, Claude Code -ajot lähettävät
  token-käytön OTLP-endpointiin (`CLAUDE_CODE_ENABLE_TELEMETRY=1`). Tämä on
  ainoa käynnistystavasta riippumaton laskutusperuste.

## Erot agenttien välillä (tiedostettavat)

| Asia | Claude | Codex |
|------|--------|-------|
| Slash-komennot | `.claude/skills/` projektikohtaisesti | vain `~/.codex/prompts/` (globaali) |
| Permission-portti gitille | kyllä (`settings.json` `ask`) | ei — ohje on ainoa portti |
| Plan mode | kyllä | ei; hyväksyntä pyydetään viestillä |
| Rinnakkaiset aliagentit | kyllä (`/dokumentoi-kaikki`) | ei — tee erissä |
| Sandbox / kirjoitusoikeudet | permission-moodi | `--sandbox` / hyväksyntätila |

Siksi: laajat dokumentointiajot Claudella, koodimuutokset kumpi vain — ja
Codexissa noudata git-ohjetta erityisen tarkasti, koska harness ei estä.
