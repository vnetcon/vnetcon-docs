# multiproject-mcp — käyttöohje

> 🇬🇧 [English](README.en.md) · [Repon pääohje](../README.md) ·
> [Arkkitehtuuri- ja toteutusspeksi](../multiproject-mcp.md)

`multiproject-mcp` julkaisee useiden Git-projektien ja niiden eri haarojen
dokumentaation hallittuina snapshotteina ja tarjoaa ne MCP-asiakkaille. Palvelu
voidaan ajaa paikallisena stdio-prosessina tai jaettuna Streamable HTTP
-palvelimena.

## Toteutettu kokonaisuus

- Jokaisella `project_id` + Git-refi -parilla on oma checkout ja
  dokumentaatiotyötila.
- `repository`-mallissa kyseisen haaran `vnetcon-docs` julkaistaan sellaisenaan.
- `managed`-mallissa dokumentaatio elää julkaisupuolen kloonissa; työkalu ei
  commitoi eikä pushaa sitä lähderepositoryyn.
- Julkaisu sitoo yhteen täsmälliset commitit ja dokumentaatiorevisiot.
- MCP-haku vaatii aina yhden `project_id`:n. Projektien sisältöä ei yhdistetä
  yhdeksi hakukorpukseksi.
- Yksi MCP-yhteys lukittuu avaamishetken bundleen. Uusi julkaisu näkyy vasta
  uusille yhteyksille.
- Projektien väliset yhteydet tulevat vain eksplisiittisistä
  `interfaces/`-tietueista.
- HTTP-palvelu tukee avointa, bearer-token-, basic- ja OIDC-autentikointia sekä
  kanava- ja projektikohtaisia käyttöoikeuksia.
- Git-muutokset voidaan havaita käsin, pollingilla tai suojatulla webhookilla;
  debounce-jono ei käynnistä AI-ajoa tai julkaisua automaattisesti.

Tiedostopohjainen tallennus, manuaalinen/poll/webhook-päivityskierto, stdio,
Streamable HTTP ja OIDC-resurssipalvelin ovat valmiit. Pilvitallennus, natiivien
Git-palvelupayloadien adapterit ja hallintakäyttöliittymä eivät vielä kuulu
tähän versioon.

## Esivaatimukset

- Git
- Node.js 18 tai uudempi
- npm ensiasennukseen
- AI-agentti vain, jos `managed`-dokumentaatiota generoidaan

## Nopea aloitus

Aja tämän lähderepositoryn juuressa:

```bash
npm install --prefix multiproject-mcp
node tyokalut/multiproject-mcp.mjs init ../oma-dokumentaatiopalvelu
cd ../oma-dokumentaatiopalvelu
./multiproject-mcp help
```

Windowsilla käytä generoitua `multiproject-mcp.cmd`-käynnistintä.

### 1. Lisää projektit

Tutki ensin repository:

```bash
./multiproject-mcp inspect-project --path /polku/projektiin
```

Kun dokumentaatio on projektin omassa repositoryssa:

```bash
./multiproject-mcp add-project \
  --id laskutus \
  --path /polku/laskutus-repoon \
  --refs main,development \
  --docs-mode repository
```

Kun dokumentaatio ylläpidetään vain julkaisupuolella:

```bash
./multiproject-mcp add-project \
  --id asiakkuudet \
  --path /polku/asiakkuudet-repoon \
  --refs main,development \
  --docs-mode managed
```

`--url` voidaan antaa `--path`-valitsimen sijasta. Komento `discover --root
<hakemisto>` löytää hakemiston välittömät Git-repositoryt konfigurointia varten.

### 2. Muodosta julkaisukanava

Kanava valitsee jokaisesta projektista täsmälleen yhden refin:

```bash
./multiproject-mcp channel create local
./multiproject-mcp channel set-ref local laskutus main
./multiproject-mcp channel set-ref local asiakkuudet development
./multiproject-mcp channel show local
```

### 3. Alusta, dokumentoi ja julkaise

```bash
./multiproject-mcp config validate
./multiproject-mcp doctor
./multiproject-mcp plan refresh --all
./multiproject-mcp bootstrap --all
```

`repository`-mallissa kyseisen refin dokumentit ovat tämän jälkeen valmiit
julkaistaviksi. `managed`-mallissa dokumentoi ja hyväksy jokainen refi:

```bash
./multiproject-mcp document --project asiakkuudet --ref development
./multiproject-mcp review --project asiakkuudet --ref development
./multiproject-mcp approve --project asiakkuudet --ref development
```

Julkaise vasta tarkistuksen jälkeen:

```bash
./multiproject-mcp publish --channel local
./multiproject-mcp smoke-test --channel local
```

## Valitse palvelutapa

Paikallisen stdio-yhteyden voi käynnistää suoraan:

```bash
./multiproject-mcp serve --transport stdio --channel local
```

HTTP-palvelimen turvallinen paikallinen aloitus:

```bash
./multiproject-mcp server configure-http --listen 127.0.0.1:8793 --channel local
./multiproject-mcp auth set-mode none
./multiproject-mcp doctor --http
./multiproject-mcp serve
```

MCP-osoite on tällöin `http://127.0.0.1:8793/mcp`. Lähiverkkoon tai
palvelimelle vietäessä käytä autentikointia ja TLS:ää; palvelu ei hyväksy
autentikoimatonta ei-loopback-kuuntelua ilman erillistä tietoista sallintaa.

Yksityiskohtaiset ohjeet:

- [HTTP-palvelin ja käyttöönotto](docs/http-palvelin.md)
- [Autentikointi ja käyttöoikeudet](docs/autentikointi.md)
- [Git-muutosten havaitseminen ja virkistys](docs/virkistys.md)
- [AI-clienttien yhteensopivuus](docs/asiakkaat.md)

## Päivityskierros Git-muutoksen jälkeen

```bash
./multiproject-mcp plan refresh --all
./multiproject-mcp refresh --all
# managed-projekteille: document, review ja approve
./multiproject-mcp publish --channel local
./multiproject-mcp smoke-test --channel local
```

Uusi julkaisu ei ylikirjoita vanhaa snapshotia. Kanavan osoitin siirtyy uuteen
bundleen vasta onnistuneella `publish`-komennolla. Jo avoimet MCP-yhteydet
jatkavat vanhalla bundlella, joten saman keskustelun aineisto ei vaihdu kesken
käytön.

## Projektien ja haarojen eristys

```text
project_id + ref
  -> oma checkout ja dokumentaatiotyötila
  -> lähdecommit + dokumentaatiorevisio
  -> muuttumaton projektijulkaisu
  -> kanavan valitsema bundle
  -> yhteyskohtainen bundle-lukitus
  -> MCP-haku yhdestä project_id:stä
```

`main` ja `development` eivät jaa checkoutia tai dokumentaatiota. Jokainen
hakutulos sisältää projektin, refin, lähdecommitin ja julkaisutunnisteen.
Projektien välisiä riippuvuuksia ei päätellä samankaltaisesta tekstistä.

Managed-dokumentaatio sijaitsee oletuksena polussa:

```text
.multiproject/workspaces/<project_id>/<ref>/source/vnetcon-docs/
```

Hakemisto suljetaan pois kloonin omalla `.git/info/exclude`-tiedostolla.
Paikalliset dokumenttimuutokset säilyvät refin päivityksessä, eikä niitä
commitoida tai pushata lähderepositoryyn.

## Keskeiset komennot

| Komento | Tarkoitus |
|---------|-----------|
| `init <hakemisto>` | Luo hallintatyötilan ja käynnistimet |
| `discover` / `inspect-project` | Auttaa projektikonfiguraation muodostamisessa |
| `add-project` / `project ...` | Hallitsee projekteja, refejä ja dokumentaatiomallia |
| `channel create/set-ref/show` | Hallitsee julkaisukanavan projektiversioita |
| `doctor` / `config validate` | Tarkistaa ympäristön ja konfiguraation |
| `bootstrap` / `refresh` | Luo tai päivittää refikohtaiset työtilat |
| `document` / `review` / `approve` | Hallitsee managed-dokumentaatiota |
| `publish` / `smoke-test` | Julkaisee ja tarkistaa snapshot-bundlen |
| `server configure-http` | Muodostaa HTTP-konfiguraation |
| `server set-transport` | Valitsee oletukseksi stdio- tai HTTP-siirtotavan |
| `auth set-mode` / `auth configure-oidc` | Valitsee ja konfiguroi tunnistustavan |
| `auth token ...` / `auth user ...` | Hallitsee tunnuksia ja rajauksia |
| `refresh configure-poll/configure-webhook` | Konfiguroi automaattisen muutosten havaitsemisen |
| `refresh detect/queue/run/watch` | Hallitsee debounce-jonoa ja refresh-controlleria |
| `tunnel prepare openai` | Tulostaa Secure MCP Tunnelin käynnistyskomennot |
| `serve` | Käynnistää valitun MCP-palvelun |

Kaikki komentomuodot näkee komennolla `./multiproject-mcp help`.

## MCP-työkalut

| Työkalu | Rajaus |
|---------|--------|
| `list_projects` | Kanavan sallitut projektit ja täsmälliset versiot |
| `get_project_version` | Yhden projektin refi, commit ja julkaisutunnisteet |
| `search` | Haku täsmälleen yhdestä `project_id`:stä |
| `fetch` | Yhden hakutuloksen dokumentti samasta projektista |
| `list_interfaces` | Erikseen ylläpidetyt projektien väliset rajapinnat |
| `get_interface` | Yksi eksplisiittinen rajapintatietue |

## Hallintatyötilan rakenne

```text
multiproject-mcp.yaml                 Jaettu peruskonfiguraatio
multiproject-mcp.local.yaml           Paikallinen profiili
multiproject-mcp.server.example.yaml  Palvelinprofiilin pohja
interfaces/                           Projektien väliset rajapintatietueet
.multiproject/workspaces/             Refikohtaiset checkoutit ja dokumentaatio
.multiproject/publications/           Muuttumattomat julkaisut ja bundlet
.multiproject/secrets/auth.json       Hashatut HTTP-tunnisteet, ei versionhallintaan
.multiproject/state/                  Paikallinen työtilatila
multiproject-mcp[.cmd]                Generoitu käynnistin
```

## Kehitys ja testaus

```bash
npm test --prefix multiproject-mcp
node tyokalut/testaa.mjs
```

Ensimmäinen komento ajaa komponentin testit, mukaan lukien aidon Streamable
HTTP -asiakasyhteyden ja autentikointitilat. Jälkimmäinen ajaa koko repositoryn
savutestin.
