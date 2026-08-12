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

## Mitä AI-tiliä käytetään

**Oletus ja suositus: asiakkaan oma tili** (`tarjoaja: oma`). Silloin koodi ei
kulje kenenkään kolmannen osapuolen infrastruktuurin läpi, tietosuojasopimuksia
ei tarvita ylimääräisesti, eikä kustannus ole kenenkään välikäden hinnoittelun
varassa.

Kolme mallia paremmuusjärjestyksessä:

| Malli | Kuka omistaa tilin | Kulkeeko koodi kolmannen läpi | Kenelle |
|-------|--------------------|-------------------------------|---------|
| **1. Oma tili, oma hallinta** (`oma`) | asiakas | ei | Oletus. Toimii heti, jos `claude`/`codex` on kirjautunut. |
| **2. Oma pilvitili, ulkoistettu hallinta** (`bedrock`, `vertex`, `anthropic-api`, `openai-api`) | asiakas | ei — avaimet ja liikenne asiakkaan tenantissa | Suositeltu yritys-/julkishallintomalli: kustannus on asiakkaan omaa pilvikulutusta, konfiguroinnin ja seurannan voi ostaa palveluna. |
| **3. Vnetconin pilvi** (`vnetcon-pilvi`) | Vnetcon | **kyllä** | Vain pilotti- ja kokeiluvaiheeseen, kun oma hankinta kestäisi kuukausia. Rajattu, katollinen, väliaikainen. |

> **Malli 3 ei ole kevyt oikotie.** Promptissa on koodia, joten välittäjä on
> tietosuoja-asetuksen mukainen käsittelijä: tarvitaan sopimus, lokituskäytännöt
> ja tietoturva-arvio — käytännössä sama arviointi kuin koodin luovutuksessa.
> Käytä sitä siksi vain rajatusti ja siirry malliin 1 tai 2 heti kun mahdollista.

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
| `vnetcon-pilvi` | `ANTHROPIC_BASE_URL` = gateway + tunniste | Codexin `model_provider` = gateway + tunniste |

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

## Laskutus ja käytön seuranta

- `laskutus.asiakas` — tunniste, joka kirjataan jokaiseen ajoon.
- `laskutus.kaytto_loki` — `vnetcon-ai` kirjaa rivin per ajo (JSONL: aika,
  projekti, komento, agentti, kesto, tulos). Tiedosto on `.gitignore`ssa.
- `laskutus.otel_endpoint` — jos asetettu, Claude Code -ajot lähettävät
  token-käytön OTLP-endpointiin (`CLAUDE_CODE_ENABLE_TELEMETRY=1`). Tämä on
  tarkin laskutusperuste; paikallinen loki on varmistus.

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
