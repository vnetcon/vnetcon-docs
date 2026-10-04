# ChatGPT: dokumentaatio MCP:n kautta

> [Takaisin MCP:n pääohjeeseen](../README.md) · [AI-clienttien yhteensopivuus](asiakkaat.md)

Tämä ohje vie emoprojektista ChatGPT:hen asti. Emoprojekti on Git-projekti, jonka
juureen `vnetcon-docs` on asennettu. Dokumentaatio julkaistaan
moniprojekti-MCP:lle, palvelin ajetaan omalla koneella ja ChatGPT yhdistetään
siihen OpenAI Secure MCP Tunnelin kautta. Kaikki tarvittava on
`vnetcon-docs`-hakemistossa: dokumentointi, tiketit ja MCP (`tyokalut/mcp/`).

> **Tarkista ensin, saako dokumentaatiota käsitellä ChatGPT:ssä.** ChatGPT:lle
> palautetut dokumentaatio-otteet kulkevat OpenAI:n kautta. Asiakkaan koodista
> tuotettua dokumentaatiota ei liitetä ChatGPT:hen ennen kuin organisaation
> AI-linjaus sallii sen.

## Esivaatimukset

- Git
- Node.js 18 tai uudempi ja npm
- Emoprojekti Git-repositoriona
- vnetcon-docs-paketti (`vnetcon-docs-<versio>.zip`)
- ChatGPT Business-, Enterprise- tai Edu-workspace, jossa omat MCP-yhteydet on
  sallittu. Free, Plus ja Pro eivät riitä.
- OpenAI Platform -organisaatio, jossa sinulla on Tunnels-hallintaoikeus
  tunnelin luontiin
- AI-agentti (Claude Code tai Codex) dokumentaation tuottamiseen

## Hakemistorakenne

```text
emoprojekti/             dokumentoitava Git-repository
  vnetcon-docs/          paketti purettuna; dokumentointi, tiketit ja MCP
    mcp-tyotila/         MCP-työtila, luodaan vaiheessa 3
```

Kaikki komennot ajetaan `vnetcon-docs`-hakemistossa muodossa `vnetcon-ai mcp …`.
Ne kohdistuvat automaattisesti työtilaan `mcp-tyotila/`.

## Vaihe 1: pura paketti emoprojektiin ja asenna MCP:n riippuvuudet

bash (macOS, Linux, WSL, Git Bash):

```bash
cd ~/emoprojekti
unzip ~/Downloads/vnetcon-docs-<versio>.zip
cd vnetcon-docs
npm ci --prefix tyokalut/mcp
npm test --prefix tyokalut/mcp
```

PowerShell (Windows):

```powershell
cd ~\emoprojekti
Expand-Archive ~\Downloads\vnetcon-docs-<versio>.zip -DestinationPath .
cd vnetcon-docs
npm ci --prefix tyokalut\mcp
npm test --prefix tyokalut\mcp
```

Testien pitäisi päättyä riviin `pass 4`. Riippuvuudet (`node_modules`) jäävät
gitin ulkopuolelle `vnetcon-docs/.gitignore`-tiedoston ansiosta.

## Vaihe 2: dokumentoi ja commitoi

Käynnistä agentti `vnetcon-docs`-hakemistossa (`claude` tai `codex`) ja aja
`/vnetcon-init` ja sen jälkeen `/dokumentoi <moduuli>` vähintään yhdelle
moduulille. Jos emoprojektissa on jo valmis `vnetcon-docs`, tämä vaihe on tehty.

MCP julkaisee vain commitoidun dokumentaation. Valitse toinen tapa:

- **Emoprojektin repoon:** commitoi `vnetcon-docs/` emoprojektiin.
- **Emoprojektin repon ulkopuolelle** (todennäköinen valinta alkuun): jätä
  `vnetcon-docs` emoprojektin gitin ulkopuolelle ja anna sille oma paikallinen
  repo, jota ei pushata. Emoprojektin repositoryyn ei tule mitään muutosta.

bash, emoprojektin repon ulkopuolelle:

```bash
cd ~/emoprojekti
echo '/vnetcon-docs/' >> .git/info/exclude
cd vnetcon-docs
git init -b main
git add -A
git commit -m "vnetcon-docs: lähtötila"
```

PowerShell, emoprojektin repon ulkopuolelle:

```powershell
cd ~\emoprojekti
Add-Content -Path .git\info\exclude -Value '/vnetcon-docs/'
cd vnetcon-docs
git init -b main
git add -A
git commit -m "vnetcon-docs: lähtötila"
```

Jatkossa dokumentaation muutokset commitoidaan `vnetcon-docs`-hakemiston omaan
repoon. Ohje: `vnetcon-docs`in [pääohje](../../../README.md#vnetcon-docs-gitin-ulkopuolelle).

## Vaihe 3: MCP-työtila ja julkaisu

Vaiheet 3 ja 4 voi tehdä myös selaimessa. Aja ensin `vnetcon-ai mcp init` ja sitten
`vnetcon-ai mcp ui`, avaa `http://127.0.0.1:8799/ui/` ja käytä painikkeita *Päivitä
kaikki projektit* ja *Julkaise*. Yhteys-välilehti näyttää MCP-osoitteen ja
tunnelikomennot. Alla sama päätteessä.

bash:

```bash
cd ~/emoprojekti/vnetcon-docs
./tyokalut/vnetcon-ai/vnetcon-ai mcp init
./tyokalut/vnetcon-ai/vnetcon-ai mcp bootstrap --all
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
./tyokalut/vnetcon-ai/vnetcon-ai mcp smoke-test --channel local
```

PowerShell:

```powershell
cd ~\emoprojekti\vnetcon-docs
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp init
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp bootstrap --all
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp smoke-test --channel local
```

`init` kysyy: *Lisätäänkö emoprojekti <nimi> … ensimmäiseksi projektiksi?*
Vastaa `K` (oletus). Emoprojekti lisätään nykyisellä haaralla: `repository`-mallilla,
jos `vnetcon-docs` on commitoitu emoprojektiin, tai `separate`-mallilla, jos sillä on
oma repo. Kanava `local` luodaan valmiiksi. Onnistunut tulos:
`OK: local, bundle <tunniste>, projekteja 1`.

**Valinnainen: muita projekteja emoprojektin rinnalle.** Ulkopuolinen projekti,
jossa ei ole `vnetcon-docs`-hakemistoa, lisätään `managed`-mallilla. Projektin
repoon ei kirjoiteta mitään.

bash:

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp add-project --id toinen --path ../../toinen-projekti --refs main --docs-mode managed
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel set-ref local toinen main
./tyokalut/vnetcon-ai/vnetcon-ai mcp bootstrap --all
./tyokalut/vnetcon-ai/vnetcon-ai mcp document --project toinen --ref main
./tyokalut/vnetcon-ai/vnetcon-ai mcp approve --project toinen --ref main
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
```

PowerShell:

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp add-project --id toinen --path ..\..\toinen-projekti --refs main --docs-mode managed
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel set-ref local toinen main
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp bootstrap --all
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp document --project toinen --ref main
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp approve --project toinen --ref main
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
```

**Ilman emoprojektia** (`vnetcon-docs` purettuna erilliseen hakemistoon, tai
emoprojektin `vnetcon-docs` gitin ulkopuolella ilman omaa repoa): `init` ei lisää
projektia, ja
kanava luodaan itse. Lisää projektit yllä olevilla `add-project`-komennoilla ja
aja ensin `mcp channel create local`.

**Työtilan konfiguraation voi commitoida** emoprojektiin
(`vnetcon-docs/mcp-tyotila/`). Kloonit ja julkaisut (`.multiproject/`) jäävät
gitin ulkopuolelle automaattisesti.

## Vaihe 4: HTTP-palvelin omalle koneelle

Palvelin kuuntelee vain osoitteessa `127.0.0.1`, joten tunnistusta ei tarvita
paikallisessa testissä. Portti 8793 on oletus, mutta se voi olla toisen
MCP-palvelimen käytössä. Tässä käytetään porttia 8799.

bash:

```bash
cd ~/emoprojekti/vnetcon-docs
lsof -nP -iTCP:8799 -sTCP:LISTEN      # ei tulostetta = portti vapaa
./tyokalut/vnetcon-ai/vnetcon-ai mcp server configure-http --listen 127.0.0.1:8799 --channel local
./tyokalut/vnetcon-ai/vnetcon-ai mcp auth set-mode none
./tyokalut/vnetcon-ai/vnetcon-ai mcp doctor --http
./tyokalut/vnetcon-ai/vnetcon-ai mcp serve
```

PowerShell:

```powershell
cd ~\emoprojekti\vnetcon-docs
Get-NetTCPConnection -LocalPort 8799 -State Listen -ErrorAction SilentlyContinue   # ei tulostetta = portti vapaa
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp server configure-http --listen 127.0.0.1:8799 --channel local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp auth set-mode none
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp doctor --http
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp serve
```

Palvelin tulostaa `multiproject-mcp HTTP: http://127.0.0.1:8799/mcp channel=local auth=none`.
`doctor --http` varoittaa, ettei palvelin tunnista käyttäjiä. Kun palvelin
kuuntelee vain omaa konetta, varoitus on odotettu. Jätä palvelin käyntiin omaan ikkunaansa.

**Valinnainen esitesti ennen ChatGPT:tä:** lisää sama osoite Claude Codeen,
Codexiin, Cursoriin tai VS Codeen Streamable HTTP -palvelimena. Jos työkalut
`list_projects`, `search` ja `fetch` näkyvät ja haku palauttaa dokumentteja,
palvelin toimii.

## Vaihe 5: ChatGPT Secure MCP Tunnelin kautta

ChatGPT ei tavoita `127.0.0.1`-osoitetta suoraan. Tunneliasiakas avaa koneeltasi
vain lähtevän HTTPS-yhteyden OpenAI:hin, joten palvelinta ei avata internetiin.

1. **Luo tunneli** OpenAI Platformissa:
   `https://platform.openai.com/settings/organization/tunnels`.
   Kirjaa tunnelin tunniste (`tunnel_…`).
2. **Luo ajonaikainen avain**:
   `https://platform.openai.com/settings/organization/api-keys`.
   Valitse *Restricted* ja anna Tunnels-oikeudeksi *Read + Use*.
3. **Asenna `tunnel-client`** omalle alustallesi:
   `https://github.com/openai/tunnel-client/releases/latest`.
4. **Tulosta komennot** `vnetcon-docs`-hakemistossa ja aja ne uudessa ikkunassa.

bash:

```bash
cd ~/emoprojekti/vnetcon-docs
./tyokalut/vnetcon-ai/vnetcon-ai mcp tunnel prepare openai --tunnel-id tunnel_XXXXXXXX
export CONTROL_PLANE_API_KEY="sk-..."
tunnel-client init --profile vnetcon-docs --tunnel-id tunnel_XXXXXXXX --mcp-server-url http://127.0.0.1:8799/mcp
tunnel-client doctor --profile vnetcon-docs --explain
tunnel-client run --profile vnetcon-docs
```

PowerShell:

```powershell
cd ~\emoprojekti\vnetcon-docs
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp tunnel prepare openai --tunnel-id tunnel_XXXXXXXX
$env:CONTROL_PLANE_API_KEY = "sk-..."
tunnel-client init --profile vnetcon-docs --tunnel-id tunnel_XXXXXXXX --mcp-server-url http://127.0.0.1:8799/mcp
tunnel-client doctor --profile vnetcon-docs --explain
tunnel-client run --profile vnetcon-docs
```

5. **Lisää yhteys ChatGPT:hen:** avaa `https://chatgpt.com/#settings/Connectors`,
   valitse *Connection: Tunnel* ja valitse tai liitä tunnelin tunniste. Pidä
   `tunnel-client run` käynnissä koko ajan. Workspacen ylläpitäjän pitää olla
   sallinut omat MCP-yhteydet, ja yhteyden lisääminen voi vaatia Developer
   modea tai ylläpitäjän hyväksynnän.

`--mcp-server-url` tulee `tunnel prepare` -komennosta. OpenAI:n oma ohje näyttää
esimerkkinä stdio-palvelimen `--sample`- ja `--mcp-command`-valitsimilla. Jos
`tunnel-client init` ei hyväksy `--mcp-server-url`-valitsinta, tarkista oikea
muoto komennolla `tunnel-client init --help`.

## Vaihe 6: kokeile

Avaa ChatGPT:ssä uusi keskustelu, ota yhteys käyttöön työkaluvalikosta ja kysy:

- *Mitä projekteja dokumentaatiossa on?*
- *Miten laskutus toimii projektissa <emoprojektin nimi>?*
- *Mistä moduuleista <emoprojektin nimi> koostuu?*

ChatGPT valitsee ensin projektin `list_projects`-työkalulla ja hakee sitten
`search`- ja `fetch`-työkaluilla. Haku tehdään aina yhdestä projektista kerrallaan.

## Dokumentaation päivitys

Kun emoprojektin koodi tai dokumentaatio muuttuu ja muutos on commitoitu:

bash:

```bash
cd ~/emoprojekti/vnetcon-docs
./tyokalut/vnetcon-ai/vnetcon-ai mcp plan refresh --all
./tyokalut/vnetcon-ai/vnetcon-ai mcp refresh --all
# managed-projekteille: document, review ja approve
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
./tyokalut/vnetcon-ai/vnetcon-ai mcp smoke-test --channel local
```

PowerShell:

```powershell
cd ~\emoprojekti\vnetcon-docs
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp plan refresh --all
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp refresh --all
# managed-projekteille: document, review ja approve
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp smoke-test --channel local
```

Avoin MCP-yhteys pysyy vanhassa julkaisussa. Aloita ChatGPT:ssä uusi
keskustelu, jotta uusi julkaisu näkyy.

## Vianetsintä

| Oire | Syy ja korjaus |
|---|---|
| Työkalulistassa on vieraita työkaluja tai `Unknown tool: search` | Portissa vastaa toinen MCP-palvelin. Valitse vapaa portti `mcp server configure-http --listen 127.0.0.1:<portti>` -komennolla |
| `MCP:n riippuvuudet puuttuvat` | Aja `vnetcon-docs`-hakemistossa `npm ci --prefix tyokalut/mcp` |
| `init` ei kysy emoprojektia | `vnetcon-docs` ei ole Git-projektin juuressa tai paketti on purettu ilman asennusversiota. Lisää projekti `mcp add-project`-komennolla |
| `vnetcon-docs/ ei ole vielä commitoituna` tai `repository-mallin dokumentaatiota ei ole` | Commitoi `vnetcon-docs/` emoprojektiin ennen `bootstrap`-komentoa |
| `Työtilaa ei ole: <projekti>@main` | Aja `mcp bootstrap --all` ennen `document`- tai `publish`-komentoa |
| `multiproject-mcp.yaml ei löydy` | Aja `mcp init` ensin, tai anna työtila valitsimella `--config <polku>/multiproject-mcp.yaml` |
| ChatGPT ei näe yhteyttä | Tarkista `tunnel-client doctor --profile vnetcon-docs --explain`, workspacen MCP-oikeudet ja että sekä `mcp serve` että `tunnel-client run` ovat käynnissä |
