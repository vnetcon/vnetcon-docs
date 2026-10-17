# Lähdeaineistot ilman koodia

> 🇬🇧 [In English](without-code.md) · [Takaisin MCP:n pääohjeeseen](../README.md) ·
> [Lähdeaineistot](lahdeaineistot.md) · [Vienti](vienti.md)

vnetcon-docsin ydin on järjestelmien dokumentaatio, joka on tarkistettu koodia
vasten. Tietopohjan voi kuitenkin aloittaa myös **ilman koodia**: organisaation
hyväksytyistä dokumenteista (Word, PowerPoint, Excel, PDF, Markdown, teksti).
Järjestelmien dokumentaation voi lisätä myöhemmin samaan tietopohjaan.

## Milloin tästä on hyötyä

vnetcon-docs ei korvaa AI-clienttiä. Se tuo hyväksytyn aineiston siihen
clienttiin, jota organisaatio jo käyttää (ChatGPT, Claude, Copilot). Pelkillä
dokumenteilla hyöty on suurin, kun organisaatiolla on jokin näistä:

- dokumentit muualla kuin SharePointissa, tai ei Copilot-lisenssejä
- tarve päättää, mitä tekoäly saa käyttää: jokainen tiedosto hyväksytään, ja
  vastauksessa näkyvät lähde, tiedosto, omistaja ja hyväksyntäpäivä
- useampi AI-client rinnakkain
- tarve tietää, milloin AI:n käyttämä dokumentti on vanhentunut

Jos kaikki dokumentit ovat jo SharePointissa ja Copilot-lisenssit on hankittu,
lisäarvo rajautuu hyväksyntään, alkuperään ja vanhentumisen tunnistukseen.

## Käyttöönotto

Esivaatimukset: Node.js 22.13 tai uudempi ja npm. Gitiä eikä AI-agenttia
tarvita.

1. Pura `vnetcon-docs`-paketti mihin tahansa hakemistoon. Emoprojektia ei
   tarvita.
2. Asenna riippuvuudet ja käynnistä hallintakäyttöliittymä
   `vnetcon-docs`-hakemistossa:

   bash (macOS, Linux, WSL, Git Bash):

   ```bash
   npm ci --prefix tyokalut/mcp
   ./tyokalut/vnetcon-ai/vnetcon-ai mcp ui
   ```

   PowerShell (Windows):

   ```powershell
   npm ci --prefix tyokalut\mcp
   tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp ui
   ```

3. Avaa `http://127.0.0.1:8799/ui/` ja valitse **Aloita lähdeaineistoista**.
   Työtila luodaan ilman emoprojektia, ja Lähdeaineistot-välilehti avautuu.
4. **Lähdeaineistot:** lisää lähde (tunnus, nimi, hakemisto tai lataus,
   omistaja, tietoluokka). Jätä projektit tyhjäksi. Skannaa, esikatsele ja
   hyväksy tiedostot.
5. **Kanavat ja julkaisu:** luo kanava, lisää lähde kanavaan ja julkaise.
6. **Yhteys:**
   - ChatGPT tunnelin kautta: [ChatGPT-yhteys vaihe vaiheelta](chatgpt.md)
   - Claude, Codex, Cursor ja VS Code: välilehti **Yhteys**
   - jos MCP-yhteyttä ei voi käyttää: [Vienti](#vienti)

Prosessi-välilehti näyttää tietopohjan valmiina, kun kanavassa on julkaistu
lähde. Projektien puuttumista ei näytetä keskeneräisenä.

### Komentorivillä

bash (macOS, Linux, WSL, Git Bash):

```bash
npm ci --prefix tyokalut/mcp
./tyokalut/vnetcon-ai/vnetcon-ai mcp init --ilman-emoprojektia
./tyokalut/vnetcon-ai/vnetcon-ai mcp source add --id ohjeet --type directory --location /mnt/yhteiset/ohjeet --name "Asiakaspalvelun ohjeet" --owner Asiakaspalvelu --classification Sisäinen
./tyokalut/vnetcon-ai/vnetcon-ai mcp source scan ohjeet
./tyokalut/vnetcon-ai/vnetcon-ai mcp source preview ohjeet --file "Toimintaohje.pdf"
./tyokalut/vnetcon-ai/vnetcon-ai mcp source approve ohjeet --all-changed
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel create local
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel add-source local ohjeet
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
./tyokalut/vnetcon-ai/vnetcon-ai mcp smoke-test --channel local
```

PowerShell (Windows):

```powershell
npm ci --prefix tyokalut\mcp
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp init --ilman-emoprojektia
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source add --id ohjeet --type directory --location \\palvelin\yhteiset\ohjeet --name "Asiakaspalvelun ohjeet" --owner Asiakaspalvelu --classification Sisäinen
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source scan ohjeet
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source preview ohjeet --file "Toimintaohje.pdf"
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source approve ohjeet --all-changed
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel create local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel add-source local ohjeet
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp smoke-test --channel local
```

## Mitä AI-client näkee

- **Palvelimen ohje** kertoo, että tietopohja on hyväksyttyä lähdeaineistoa:
  aloita `list_sources`-työkalusta, mainitse lähde, tiedosto ja PDF:stä sivu, ja
  sano, jos tietoa ei löydy.
- **Merkintä:** dokumentin otsakkeessa on *Hyväksytty lähdeaineisto*,
  hyväksyntäpäivä, omistaja, tietoluokka ja tiiviste. Merkintää "ei tarkistettu
  koodia vasten" käytetään vain lähteissä, jotka on linkitetty projekteihin,
  koska vain niissä on koodia, johon verrata. Koneluettava kenttä
  `verified_against_code: false` on aina mukana.
- **PDF:** hakutuloksessa on sivunumero (`page`). Otsikot ja taulukot eivät
  säily, vaan teksti tulee riveinä ja kappaleina. Skannattua PDF:ää ei tueta.
  Ks. [Lähdeaineistot](lahdeaineistot.md#pdf).
- `list_projects` palauttaa tyhjän listan.

## Vienti

Kun MCP-yhteyttä ei voi käyttää, lähdeaineisto viedään tiedostoina ja valmiina
ohjetekstinä AI-clientin projektiin.

- **Käyttöliittymässä:** välilehti **Vienti**. Valitse *Ei projektia (vain
  lähdeaineisto)* ja lähteet.
- **Komentorivillä:** `export create --channel local --source ohjeet --target chatgpt-projekti`

Paketissa on yksi tiedosto lähdettä kohden (`70-lahdeaineisto-<lähde>.md`).
Jos lähde ylittää profiilin tiedostokokorajan, se jaetaan osiin
(`70-lahdeaineisto-<lähde>-1.md`, `-2.md` jne.). Vienti näkyy vanhentuneena,
kun muuttunut dokumentti hyväksytään ja julkaistaan. Ks. [Vienti](vienti.md).

## Järjestelmien dokumentaatio myöhemmin

Kun samaan tietopohjaan halutaan järjestelmän dokumentaatio, lisää projekti
(`add-project` tai välilehti **Projektit**) ja liitä lähteet siihen
(`source set <id> --link <projekti>`). Sen jälkeen:

- palvelimen ohje erottaa koodidokumentaation ja lähdeaineiston
- linkitetyt lähteet merkitään "ei tarkistettu koodia vasten"
- ristiriidassa AI-client painottaa toteutuksen osalta koodidokumentaatiota.
