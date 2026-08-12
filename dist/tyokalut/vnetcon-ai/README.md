# vnetcon-ai

Käynnistää tekoälyagentit (Claude Code / Codex) tälle projektille oikeilla
asetuksilla ja tarjoaa kevyet tarkistuskomennot (`doctor`, `kalibroi`, `linkit`).

**Oletus on käyttäjän oma AI-tili** (`tarjoaja: oma`) — silloin tätä skriptiä ei
tarvitse käyttää agentin käynnistämiseen lainkaan, pelkkä `claude` tai `codex`
riittää. Skripti on tarpeen vasta kun agentti osoitetaan johonkin muuhun
tarjoajaan (oma pilvitili tai poikkeustapauksena Vnetconin gateway).

```bash
./vnetcon-ai doctor              # mitä on asennettu, mikä konfiguroitu, löytyykö tunniste
./vnetcon-ai moduulit            # mitä moduuleja on, mikä tehty, mikä seuraavaksi
./vnetcon-ai kalibroi            # lähtötilanne, katveet, laajuusarvio (ei tokeneita)
./vnetcon-ai linkit --lahteet    # rikkinäiset linkit ja lähdepolut
./vnetcon-ai html --zip          # selattava HTML + jaeltava paketti
./vnetcon-ai claude              # Claude vnetcon-docs-hakemistossa
./vnetcon-ai codex               # Codex projektin juuressa
./vnetcon-ai dokumentoi maksut   # dokumentointiagentti moduulille
./vnetcon-ai toteuta TIK-123     # toteutusagentti tiketin valmiilla kehotteella
```

Neljä ensimmäistä eivät käytä tekoälyä lainkaan — ne ovat paikallisia
tarkistuksia ja toimivat ilman tilejä ja ilman `npm install`ia.

`moduulit` päivittää kalibrointidatan automaattisesti ennen listausta (n. 1 s
isossa monorepossa). `--nopea` käyttää edellistä dataa, jos haluat välittömän
vastauksen.

Kaikki komennot: `./vnetcon-ai --help`.

## Kaksi kerrosta: osoitteet ja tunnisteet

| | Missä | Versionhallinnassa |
|-|-------|--------------------|
| **Osoitteet, mallit, työnjako** | `vnetcon-docs/vnetcon.config.yaml` (`agentit`, `laskutus`) | kyllä — eivät ole salaisuuksia |
| **Tunnisteet** | `~/.vnetcon/credentials.env` (oikeudet `600`) | **ei koskaan** |

Konfiguraatio viittaa tunnisteeseen nimellä:

```yaml
agentit:
  claude:
    tarjoaja: vnetcon-pilvi
    base_url: "https://<vnetconin-gateway>/anthropic"
    token_lahde: "~/.vnetcon/credentials.env:VNETCON_ANTHROPIC_TOKEN"
```

Luo tunnistetiedosto ja täytä arvot itse:

```bash
./vnetcon-ai tunnisteet --alusta     # luo ~/.vnetcon/credentials.env (600)
$EDITOR ~/.vnetcon/credentials.env
./vnetcon-ai doctor                  # varmista että tunniste löytyy
```

Ympäristömuuttuja voittaa tiedoston, joten CI:ssä riittää asettaa sama muuttuja.

## Mitä `tarjoaja`-arvot tekevät

Suositusjärjestys on `oma` → oma pilvitili → `vnetcon-pilvi` (vain pilotti).
Perustelut: [`../../metodi/agentit.md`](../../metodi/agentit.md).

**Claude** (`agentit.claude.tarjoaja`)

| Arvo | Mitä asetetaan |
|------|----------------|
| `oma` **(oletus)** | ei mitään — käyttäjän oma kirjautuminen/tilaus |
| `vnetcon-pilvi` | `ANTHROPIC_BASE_URL` = `base_url`, `ANTHROPIC_AUTH_TOKEN` = tunniste |
| `anthropic-api` | `ANTHROPIC_API_KEY` = tunniste (+ `ANTHROPIC_BASE_URL` jos annettu) |
| `bedrock` | `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION` = `alue` |
| `vertex` | `CLAUDE_CODE_USE_VERTEX=1`, `CLOUD_ML_REGION` = `alue`, `ANTHROPIC_VERTEX_PROJECT_ID` = `projekti_id` |

`malli` → `ANTHROPIC_MODEL`. `laskutus.otel_endpoint` → `CLAUDE_CODE_ENABLE_TELEMETRY=1`
+ OTLP-asetukset (token-käytön keräys laskutukseen).

**Codex** (`agentit.codex.tarjoaja`)

| Arvo | Mitä tehdään |
|------|--------------|
| `oma` | ei mitään — käyttäjän oma `codex login` |
| `vnetcon-pilvi` / `openai-api` | tunniste viedään ympäristöön ja tarjoaja annetaan `-c`-parametreina |

Codexille annetaan käynnistyksessä:

```
-c model_provider=<tarjoajan_tunnus>
-c model_providers.<tunnus>.base_url=<base_url>
-c model_providers.<tunnus>.env_key=<tunnisteen muuttujanimi>
-c model_providers.<tunnus>.wire_api=<chat|responses>
```

Näin **käyttäjän `~/.codex/config.toml` pysyy koskemattomana** — asetus on
projektikohtainen ja voimassa vain tämän skriptin käynnistämissä ajoissa.
Jos gateway käyttää Responses-API:a, aseta `agentit.codex.wire_api: responses`.

## Claude ilman käynnistysskriptiä

`/agentit`-komento voi kirjoittaa `vnetcon-docs/.claude/settings.json`:iin:

```json
{
  "env": { "ANTHROPIC_BASE_URL": "https://<gateway>/anthropic" },
  "apiKeyHelper": "./tyokalut/vnetcon-ai/hae-token.sh"
}
```

Tämän jälkeen pelkkä `claude` tässä hakemistossa käyttää palvelua.
`hae-token.sh` hakee tunnisteen samasta paikasta kuin tämä skripti.

## Laskutus ja käytön seuranta

- `laskutus.asiakas` — tunniste, joka kirjataan jokaiseen ajoon.
- `laskutus.kaytto_loki` (oletus `tila/kaytto.jsonl`, `.gitignore`ssa) — rivi per
  ajo: aika, asiakas, projekti, komento, agentti, kesto, tulos. Tämä on
  paikallinen varmistus, ei tarkka tokenlaskuri.
- `laskutus.otel_endpoint` — tarkka token-/kustannusdata Claude Code -ajoista
  OTLP:llä. Tämä on suositeltu laskutusperuste.

## Rajoitukset

- Konfiguraation luku olettaa **2 välilyönnin sisennyksen**
  `vnetcon.config.yaml`:ssa (kuten `vnetcon.config.example.yaml`:ssa). Älä käytä
  tabeja äläkä moniriviarvoja `agentit`-/`laskutus`-osioissa.
- `asenna-kehotteet` kirjoittaa `~/.codex/prompts/`-hakemistoon, joka on
  **globaali**: kehotteet sisältävät tämän projektin polun. Useassa projektissa
  aja se siinä projektissa, jota käytät eniten — tai jätä käyttämättä ja pyydä
  Codexilta samat asiat suomeksi (`AGENTS.md` ohjaa oikeisiin ohjeisiin).
- Skripti ei asenna agentteja eikä kirjaudu niihin puolestasi; `doctor` kertoo
  mitä puuttuu.
