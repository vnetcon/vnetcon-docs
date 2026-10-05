# multiproject-mcp — käyttöohje

> 🇬🇧 [English](README.en.md) · [vnetcon-docsin pääohje](../../README.md) ·
> [Arkkitehtuuri- ja toteutusspeksi](docs/arkkitehtuuri.md)

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
- `separate`-mallissa dokumentaatio on omassa repositoryssaan, esimerkiksi
  `vnetcon-docs`-hakemiston paikallisessa repossa, jota ei pushata. Koodi luetaan
  lähderepositorysta, ja julkaisu sitoo kummankin commitin.
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
Streamable HTTP, OIDC-resurssipalvelin, hallintakäyttöliittymä (`/ui`)
OIDC-selainkirjautumisineen, agenttiajot, muokkaukset, poistot ja roskakori sekä
julkaisujen säilytys ovat valmiit. Pilvitallennus ja natiivien
Git-palvelupayloadien adapterit eivät vielä kuulu tähän versioon.
OIDC-selainkirjautuminen on testattu palvelimen osalta, mutta ei vielä oikeaa
tunnistuspalvelua vasten.

## Esivaatimukset

- Git
- Node.js 18 tai uudempi
- npm ensiasennukseen
- AI-agentti vain, jos `managed`-dokumentaatiota generoidaan

## Nopea aloitus

MCP kulkee `vnetcon-docs`-hakemiston mukana polussa `tyokalut/mcp/`, ja sitä
käytetään `vnetcon-ai mcp` -komennolla. Riippuvuudet asennetaan kerran, vasta kun
MCP otetaan käyttöön. Aja komennot `vnetcon-docs`-hakemistossa.

bash (macOS, Linux, WSL, Git Bash):

```bash
npm ci --prefix tyokalut/mcp
./tyokalut/vnetcon-ai/vnetcon-ai mcp init
```

PowerShell (Windows):

```powershell
npm ci --prefix tyokalut\mcp
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp init
```

`init` luo työtilan hakemistoon `vnetcon-docs/mcp-tyotila/`. Jos `vnetcon-docs` on
asennettu Git-projektin juureen, `init` ehdottaa tätä **emoprojektia**
ensimmäiseksi projektiksi: se lisätään nykyisellä haaralla `repository`-mallilla,
tai `separate`-mallilla, jos `vnetcon-docs`-hakemistolla on oma git-repo, ja kanava
`local` luodaan valmiiksi. Ilman kysymystä: `--emoprojekti` lisää ja
`--ilman-emoprojektia` jättää lisäämättä. Ei-interaktiivisessa ajossa emoprojekti
lisätään oletussijainnin työtilaan, mutta muualle luotuun työtilaan vain
valitsimella `--emoprojekti`.

Emoprojektin rinnalle, tai sen sijaan, lisätään 1–N muuta projektia
`add-project`-komennolla (vaihe 1 alla). MCP julkaisee vain commitoidun
dokumentaation, myös emoprojektista.

**Ilman emoprojektia.** `vnetcon-docs` voi olla myös erillinen hakemisto, jolla ei
ole emoprojektia, esimerkiksi paketti purettuna omaan kansioonsa palvelinta varten.
Silloin `init` ei ehdota mitään, ja kaikki 1–N projektia lisätään
`add-project`-komennolla.

**Gitin ulkopuolelle jätetty `vnetcon-docs`.** Jos emoprojektin `vnetcon-docs` on
`.gitignore`- tai `.git/info/exclude`-tiedostossa ja sillä on oma paikallinen
git-repo, `init` lisää emoprojektin `separate`-mallilla: koodi emoprojektin
reposta, dokumentaatio `vnetcon-docs`-hakemiston reposta. Ilman omaa repoa
dokumentaatiota ei ole commitoitu mihinkään, joten `init` jättää emoprojektin
lisäämättä ja kertoo, miten repo luodaan. Ohje on `vnetcon-docs`in
[pääohjeessa](../../README.md#vnetcon-docs-gitin-ulkopuolelle).

Kun ajat komennot `vnetcon-ai mcp` -muodossa, ne kohdistuvat automaattisesti
työtilaan `mcp-tyotila/`. Työtilan omat käynnistimet `mcp-tyotila/multiproject-mcp`
ja `multiproject-mcp.cmd` toimivat mistä tahansa hakemistosta. Alla olevissa
esimerkeissä käytetään käynnistintä `./multiproject-mcp` työtilan hakemistossa.

**Työtilan versiointi.** `mcp-tyotila/`-hakemiston konfiguraatio
(`multiproject-mcp*.yaml`, `interfaces/`, käynnistimet) kannattaa commitoida
emoprojektiin. Projektien polut ja käynnistimet ovat suhteellisia, joten
työtila toimii myös kloonissa. Kloonit, työtilat ja julkaisut (`.multiproject/`)
ja palvelinprofiili jäävät gitin ulkopuolelle työtilan omalla `.gitignore`-tiedostolla.

Työtilan voi luoda myös muualle: `vnetcon-ai mcp init <hakemisto>`.

`managed`-malli kopioi menetelmän tästä `vnetcon-docs`-hakemistosta ja
projektikohtaiset tiedostot koskemattomasta asennuspohjasta
(`metodi/mallipohjat/asennuspohja/`). Emoprojektin tila ja dokumentit eivät siis
päädy ulkopuolisten projektien työtiloihin.

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

Kun dokumentaatio on omassa repositoryssaan (esimerkiksi emoprojektin gitin
ulkopuolelle jätetty `vnetcon-docs`, jolla on oma paikallinen repo):

```bash
./multiproject-mcp add-project \
  --id laskutus \
  --path /polku/laskutus-repoon \
  --refs main \
  --docs-mode separate \
  --docs-repo /polku/laskutus-repoon/vnetcon-docs
```

Dokumentaation haara on oletuksena dokumentaatiorepon nykyinen haara, ja sen voi
antaa valitsimella `--docs-ref`. Myös pelkkä dokumentaatiorepon commit
havaitaan muutokseksi (`plan refresh`, `refresh detect`).

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

`repository`- ja `separate`-mallissa kyseisen refin dokumentit ovat tämän jälkeen
valmiit julkaistaviksi. `managed`-mallissa dokumentoi ja hyväksy jokainen refi:

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
- [ChatGPT-yhteys vaihe vaiheelta](docs/chatgpt.md)

## Hallintakäyttöliittymä

Kaiken voi tehdä joko hallintakäyttöliittymässä tai komentorivillä. Jokainen
käyttöliittymän toiminto ajaa yhden `vnetcon-ai mcp` -komennon, ja sama komento
näkyy toiminnon kohdassa **Komentorivillä** bashille ja PowerShellille.
Käyttöliittymä on samassa HTTP-palvelimessa kuin MCP, osoitteessa `/ui`.

### Käynnistys

Tuplaklikkaa hakemistossa `tyokalut/mcp/kaynnista/`: `MCP-kayttoliittyma.command`
(macOS), `MCP-kayttoliittyma.cmd` (Windows) tai `mcp-kayttoliittyma.sh` (Linux).
Käynnistin asentaa tarvittaessa riippuvuudet, käynnistää palvelimen ja avaa selaimen.
Päätteessä sama, `vnetcon-docs`-hakemistossa:

bash (macOS, Linux, WSL, Git Bash):

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp ui
```

PowerShell (Windows):

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp ui
```

Ilman HTTP-asetuksia osoite on `http://127.0.0.1:8799/ui/` (MCP:
`http://127.0.0.1:8799/mcp`); toisen osoitteen saa valitsimella `--listen <host:port>`.
Jos MCP-työtilaa ei vielä ole, käyttöliittymä tarjoaa sen luonnin (emoprojektin
kanssa tai ilman) ja vaihtuu sen jälkeen täyteen tilaan samassa osoitteessa.
`serve`-komennolla käynnistetty HTTP-palvelin tarjoaa käyttöliittymän samassa
osoitteessa; sen voi poistaa asetuksella `runtime.http.ui.enabled: false`.

### Välilehdet

| Välilehti | Mitä siellä tehdään | Komentorivillä |
|---|---|---|
| Prosessi | Missä kukin projekti on, mitä on jäljellä ja miten se tehdään | `process` |
| Projektit | Lisäys, muokkaus, poisto; dokumentaation muutokset ja commit | `add-project`, `project set`, `remove-project`, `docs diff`, `docs commit` |
| Kanavat ja julkaisu | Kanavat, haarat, oletuskanava, julkaisu | `channel …`, `publish`, `smoke-test` |
| Agenttiajot | Käyttöönotto, dokumentointi, synkronointi, katselmointi ja integraatiot agentilla | `agent run`, `agent answer`, `agent cancel` |
| Yhteinen ohjaus, Integraatiot | Yhteinen ohjaus ja sanasto, integraatiotietueet | `guidance …`, `interface …` |
| Haku | Sama haku kuin AI-clienteilla | (MCP-työkalut `search`, `fetch`) |
| Yhteys | MCP-osoite, clienttien asetukset, ChatGPT:n tunneli | `tunnel prepare openai` |
| Asetukset | Tunnistus, tokenit ja käyttäjät, HTTP, automaattinen haku, julkaisujen säilytys | `auth …`, `server configure-http`, `refresh configure-…`, `publications prune` |
| Roskakori | Poistettujen palautus | `trash list`, `trash restore`, `trash empty` |
| Ohjeet | Prosessikuvaus, ohjeet ja kaikki komennot | `help` |

### Muokkaus, poisto ja palautus

Poisto näyttää ensin suunnitelman; `--confirm` toteuttaa sen. Poistettu projekti,
kanava, integraatiotietue tai ohjaustiedosto siirtyy roskakoriin
(`.multiproject/roskakori/`), josta `trash restore` palauttaa sen sellaisenaan,
projektin kanavahaarat mukaan lukien. `--purge` poistaa pysyvästi eikä jätä
palautettavaa; projektilta se poistaa myös työtilat ja julkaisut. Käyttöliittymä
pyytää poistoon kirjoitetun vahvistuksen.

### Agenttiajot

`agent run` ajaa dokumentoivan agentin ilman vuorovaikutusta koneelle tai
palvelimelle asennetulla agentilla ja sen tilillä (`vnetcon-ai`, asetukset
`/agentit`). Menetelmän hyväksyntäportit säilyvät:

1. Agentti noudattaa työnkulkua. Kun se tarvitsee päätöksen, se kirjaa kysymyksensä
   ehdotuksineen ja lopettaa (tila *odottaa vastauksia*).
2. Ihminen vastaa (`agent answer`), ja ajo jatkuu vastausten pohjalta.
3. Agentti ei commitoi. Muutokset tarkistetaan (`docs diff`) ja commitoidaan
   (`docs commit`); managed-dokumentaatio hyväksytään (`approve`).

Ajo onnistuu, kun dokumentaatio on muokattavissa paikallisesti: repository-malli
paikallisella repolla, separate-malli paikallisella dokumentaatiorepolla tai
managed-malli. Etärepositorioon MCP ei kirjoita. Projektilla voi olla kerrallaan
yksi ajo. Käyttöliittymä ajaa ajot taustalla ja näyttää lokin.

### Tunnistus

Sama kuin MCP:llä. Lukeminen vaatii kirjautumisen ja muutokset **admin-oikeuden**:

| Tunnistustila | Admin-oikeus |
|---|---|
| `none` | Kun palvelin kuuntelee vain omaa konetta. Verkossa ilman tunnistusta vain luku. |
| `bearer` | `auth token create --name <nimi> --admin` |
| `basic` | `auth user add --username <nimi> --password-stdin --admin` |
| `oidc` | `auth oidc-rule add … --admin` (esim. ryhmäväitteen perusteella) |

OIDC-tilassa käyttöliittymä kirjautuu tunnistuspalveluun selaimessa
(authorization code + PKCE), kun sille on rekisteröity julkinen client:
`auth configure-oidc … --ui-client-id <id> [--ui-scopes "openid api://…/.default"]`.
Tunnistuspalveluun rekisteröidään uudelleenohjausosoitteeksi käyttöliittymän
osoite (esim. `https://mcp.example/ui/`), ja tokenin audience on sama kuin MCP:n.
Ilman clientia kirjautumisessa liitetään voimassa oleva access token.

### Julkaisujen säilytys

`publications prune --keep <n>` poistaa vanhat paketit ja julkaisut. Kanavien
nykyiset julkaisut, `n` uusinta pakettia ja projektien haarakohtaiset viimeisimmät
julkaisut säilytetään. Avoin MCP-yhteys lukee oman pakettinsa julkaisuja, joten
`n` kannattaa pitää vähintään oletuksessa 3.

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
| `ui` | Käynnistää HTTP-palvelimen ja hallintakäyttöliittymän (`/ui`) |
| `process` | Prosessin vaiheet: mitä on tehty, mitä jäljellä ja millä komennolla |
| `project set` / `remove-project` / `trash …` | Projektin muokkaus, poisto roskakoriin tai pysyvästi (`--purge`) ja palautus |
| `channel unset-ref/set-default/remove` | Kanavan muokkaus ja poisto |
| `agent run/answer/cancel/list/show` | Dokumentoivat agenttiajot kysymyksineen ja vastauksineen |
| `docs diff` / `docs commit` | Dokumentaation muutokset ja commit (repository- ja separate-malli) |
| `guidance …` / `interface …` | Yhteinen ohjaus ja integraatiotietueet |
| `publications prune` | Vanhojen julkaisujen poisto säilytyskäytännön mukaan |

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
| `get_shared_guidance` | Kaikkia projekteja koskeva yhteinen ohjaus ja sanasto (`yhteiset/`) |

Rajapintatietueet ja yhteinen ohjaus ovat ihmisen ylläpitämiä. Tietueita, joiden
tila on `draft`, ei näytetä AI-clienteille; ne luonnostellaan
`/kuvaa-integraatio`-työnkululla ja hyväksytään muuttamalla tilaksi `active`.
Molemmat luetaan suoraan työtilasta, joten muutos näkyy heti ilman `publish`-komentoa.

## Hallintatyötilan rakenne

```text
multiproject-mcp.yaml                 Jaettu peruskonfiguraatio
multiproject-mcp.local.yaml           Paikallinen profiili
multiproject-mcp.server.example.yaml  Palvelinprofiilin pohja
interfaces/                           Projektien väliset rajapintatietueet
yhteiset/                             Yhteinen ohjaus ja sanasto (ohjaus.md, sanasto.md)
.multiproject/workspaces/             Refikohtaiset checkoutit ja dokumentaatio
.multiproject/publications/           Muuttumattomat julkaisut ja bundlet
.multiproject/secrets/auth.json       Hashatut HTTP-tunnisteet, ei versionhallintaan
.multiproject/state/                  Paikallinen työtilatila
multiproject-mcp[.cmd]                Generoitu käynnistin
```

## Kehitys ja testaus

```bash
npm test --prefix tyokalut/mcp
```

Komento ajetaan `vnetcon-docs`-hakemistossa. Se ajaa komponentin testit, mukaan
lukien aidon Streamable HTTP -asiakasyhteyden ja autentikointitilat. vnetcon-docsin
lähderepossa koko savutesti ajetaan komennolla `node tyokalut/testaa.mjs`.
