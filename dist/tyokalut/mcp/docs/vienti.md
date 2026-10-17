# Vienti: dokumentaatio tiedostoina AI-clientille

> 🇬🇧 [In English](export.md) · [Takaisin MCP:n pääohjeeseen](../README.md) ·
> [ChatGPT-yhteys](chatgpt.md)

Kun MCP-yhteyttä ei voida käyttää, julkaistusta kanavasta muodostetaan
**vientipaketti**. Se sisältää muutaman Markdown-tiedoston ja valmiin ohjetekstin,
jotka asiakas lataa AI-clientin projektiin, esimerkiksi ChatGPT Business- tai
Enterprise-projektiin. Tyypillisiä syitä:

- Secure MCP Tunnelia ei sallita, tai Developer mode on estetty.
- Tietoturvan hyväksyntä MCP-yhteydelle on kesken.
- Halutaan nopea pilotti ilman asennuksia asiakkaan päässä.

**Vienti on varakanava, ei MCP:n korvaaja.** Se on kopio tietystä versiosta, eikä
se päivity, kun koodi muuttuu. Hallintakäyttöliittymä näyttää, milloin kanavassa
on viennin jälkeen uudempi julkaisu.

> **Tarkista ensin, saako dokumentaatiota käsitellä AI-clientissä.** Vienti
> siirtää koko valitun dokumentaation AI-palvelun tallennukseen. Asiakkaan koodista
> tuotettua dokumentaatiota ei viedä ennen kuin organisaation AI-linjaus sallii sen.

## Mitä MCP:hen verrattuna menetetään

| MCP takaa | Viennissä | Lievennys |
|---|---|---|
| Ajantasaisuus | Kopio tietystä julkaisusta | Commit-SHA ja päiväys jokaisessa tiedostossa ja ohjetekstissä. Vientitaulukko näyttää vanhentuneet. |
| Projektien eristys haussa | AI-clientin tiedostohaku ei pidä projekteja erillään | Oletus yksi projekti per vienti. Useampi vaatii `--multi-project`-valinnan. |
| Jäljitettävyys osumatasolla | Viittaus tiedostoon, ei aina kohtaan | Dokumentin polku näkyy jokaisen dokumentin otsikossa. Lähdeviitteet säilyvät. |
| Käyttöoikeudet projekti- ja kanavakohtaisesti | Kaikki, joilla on pääsy AI-clientin projektiin, näkevät kaiken | Erillinen vienti kullekin näkyvyysalueelle |

## Pikaohje

### Hallintakäyttöliittymässä

1. Julkaise kanava (*Kanavat ja julkaisu → Julkaise*).
2. Avaa välilehti **Vienti**.
3. Valitse kanava, projekti ja kohde. Kirjoita vastaanottaja ja tarvittaessa tietoluokka.
4. **Esikatsele**: tiedostot, koot ja varoitukset profiilin rajoista.
5. **Muodosta vienti**.
6. Vientitaulukossa: **Lataa zip** ja toimita se asiakkaalle, tai **Kopioi ohjeteksti**.

Välilehti näkyy vain admin-oikeudella, koska vienti sisältää koko dokumentaation.

### Komentorivillä

bash (macOS, Linux, WSL, Git Bash):

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp export plan --channel local --project emoprojekti --target chatgpt-projekti
./tyokalut/vnetcon-ai/vnetcon-ai mcp export create --channel local --project emoprojekti --target chatgpt-projekti --label "Asiakas / tietohallinto"
./tyokalut/vnetcon-ai/vnetcon-ai mcp export list
./tyokalut/vnetcon-ai/vnetcon-ai mcp export write <vienti> --out vienti.zip
```

PowerShell (Windows):

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export plan --channel local --project emoprojekti --target chatgpt-projekti
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export create --channel local --project emoprojekti --target chatgpt-projekti --label "Asiakas / tietohallinto"
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export list
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export write <vienti> --out vienti.zip
```

## Paketin sisältö

```text
vnetcon-vienti-<vienti>.zip
  LUE-MINUT.md       vastaanottajalle: versio, käyttöönotto, päivitys, rajoitukset
  ohjeet.md          valmis teksti AI-clientin projektin ohjekenttään
  manifest.json      tunnisteet, profiili, tiedostojen tarkistussummat
  tiedostot/         nämä ladataan AI-clientin projektiin
    <projekti>-00-yleiskuva.md            johdanto ja dokumenttiluettelo
    <projekti>-10-liiketoimintaprosessit.md
    <projekti>-20-jarjestelmaprosessit.md
    <projekti>-30-moduuli-<moduuli>.md    yksi per moduuli tai ryhmiteltynä
    <projekti>-40-datamallit.md
    50-ohjaus-ja-sanasto.md               vain jos ei mahdu ohjetekstiin
    60-rajapinnat.md                      hyväksytyt rajapintatietueet
```

- **Lähde on aina julkaistu kanava.** Työtilan julkaisemattomat muutokset eivät
  päädy vientiin.
- **Jokaisen tiedoston alussa** on projekti, haara, täysi lähdecommit, julkaisun
  tunniste, vientipäivä, tietolaji ja valinnainen tietoluokka.
- **Jokainen dokumentti** alkaa alkuperäisellä polullaan (`## moduulit/x/yleiskuvaus.md`).
  Otsikot on siirretty tasoa alemmas, frontmatter näytetään YAML-lohkona ja
  dokumenttien väliset linkit muutetaan muotoon "ks. `polku` tiedostossa
  `tiedosto.md`". Lähdeviitteet koodiin säilyvät muuttamattomina.
- **Yhteinen ohjaus ja sanasto** lisätään ohjetekstiin, jos ne mahtuvat profiilin
  merkkirajaan. Muuten ne ovat tiedostona `50-ohjaus-ja-sanasto.md`.
- **Rajapintatietueista** mukaan tulevat vain `active`-tietueet, joiden kaikki
  osapuolet ovat viennissä.

## Kohdeprofiilit

| Profiili | Käyttö | Tiedostoja | Tiedostokoko | Ohjeteksti |
|---|---|---|---|---|
| `chatgpt-projekti` | ChatGPT-projekti (Business, Enterprise, Edu, Pro) | 40 | 5 Mt | 8000 merkkiä |
| `custom-gpt` | Custom GPT:n Knowledge ja Instructions | 20 | 5 Mt | 8000 merkkiä |
| `claude-projekti` | Claude-projekti | ei rajaa | 30 Mt | ei rajaa |
| `yleinen` | Copilot, Gemini, arkistointi; yksi tiedosto per dokumentti | ei rajaa | ei rajaa | ei rajaa |

Rajat on tarkistettu palveluiden ohjeista 17.10.2026:

- **ChatGPT-projekti:** 40 tiedostoa Business-, Enterprise-, Edu- ja
  Pro-tileillä, Plus ja Go 25, Free 5. Kerralla voi ladata 10 tiedostoa. Tiedosto
  enintään 512 Mt ja tekstitiedosto enintään 2 miljoonaa tokenia
  ([Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt),
  [File uploads FAQ](https://help.openai.com/en/articles/8555545-file-uploads-faq)).
  Projektin ohjekentän pituudelle ei löytynyt virallista rajaa, joten käytössä on
  Custom GPT:n 8000 merkkiä.
- **Custom GPT:** 20 tiedostoa GPT:n elinkaaren aikana, ohjeteksti enintään 8000
  merkkiä.
- **Claude-projekti:** tiedosto enintään 30 Mt, tiedostojen määrää ei rajata. Kun
  sisältö lähestyy kontekstin rajaa, Claude siirtyy RAG-hakuun
  ([tiedostot](https://support.claude.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude),
  [RAG](https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects)).
- **5 Mt** on laatuun perustuva raja, ei palvelun enimmäiskoko. Se pitää
  suomenkielisen tekstin selvästi alle 2 miljoonan tokenin.

`export profiles` näyttää rajat ja huomiot. Rajat muuttuvat palveluissa, ja ne
voi muuttaa konfiguraatiossa, esimerkiksi Plus-tilille `max_files: 25`:

```yaml
exports:
  language: fi            # fi tai en; oletus fi
  profiles:
    chatgpt-projekti:
      max_files: 25       # ChatGPT Plus
    oma-profiili:
      label: Organisaation AI-portaali
      grouping: merged    # merged tai per-document
      max_files: 10
      max_file_bytes: 2000000
      instructions_chars: 4000
```

Jos moduuleja on enemmän kuin tiedostorajaan mahtuu, ne kootaan tasakokoisiin
ryhmiin (`<projekti>-30-moduulit-1.md` …). Jos raja ylittyy silti, vienti
muodostetaan ja varoitus näytetään.

## Tila ja päivitys

| Tila | Merkitys |
|---|---|
| ajan tasalla | Kanavan julkaisu, yhteinen ohjaus ja rajapinnat ovat samat kuin viennissä |
| vanhentunut | Kanavassa on uudempi julkaisu, tai ohjaus tai rajapinnat ovat muuttuneet. Syy näkyy taulukossa ja `export show`:ssa |
| kanava poistettu | Kanavaa ei ole enää tai sitä ei ole julkaistu |

**Muodosta uudelleen** (`export recreate <vienti>`) tekee uuden viennin samoilla
valinnoilla kanavan nykyisestä julkaisusta. Vanha vienti säilyy, kunnes poistat
sen. Pyydä asiakasta poistamaan vanhat tiedostot AI-clientin projektista ennen
uusien lataamista. Muuten versiot sekoittuvat haussa.

Vanhentuneet viennit näkyvät myös Prosessi-välilehdellä ja `process`-komennossa
rivillä *Viennit asiakkaille*.

## Käyttöoikeudet ja tallennus

- Viennin muodostus, luku ja lataus vaativat admin-oikeuden.
- Projektirajattu ylläpitäjä (`--projects`) näkee ja voi viedä vain sallittuja
  projekteja.
- Viennit tallentuvat julkaisujen rinnalle hakemistoon
  `<storage.root>/exports/<vienti>/` (`record.json`, `paketti.zip`, `sisalto/`).
  Ne ovat itsenäisiä: `publications prune` ei riko niitä.
- Viennin tekijä kirjataan (`ui:<käyttäjä>` tai `cli:<käyttäjätunnus>`). Lataukset
  kirjataan palvelimen lokiin vain metatietoina, ei sisältöä.
- `export remove` siirtää viennin roskakoriin. `remove-project --purge` poistaa
  myös projektin viennit.

## Komennot

| Komento | Käyttöliittymässä |
|---|---|
| `export profiles [--json]` | Kohde-valikko |
| `export plan --channel <k> --project <id>[,…] [--multi-project] --target <profiili> [--label …] [--classification …] [--lang fi\|en] [--no-guidance] [--no-interfaces] [--json]` | Esikatsele |
| `export create …` (samat valinnat) | Muodosta vienti |
| `export list [--json]` | Vientitaulukko |
| `export show <vienti> [--instructions] [--json]` | Tiedostot, Kopioi ohjeteksti |
| `export recreate <vienti>` | Muodosta uudelleen |
| `export write <vienti> --out <hakemisto\|tiedosto.zip>` | Lataa zip |
| `export remove <vienti> [--confirm] [--purge]` | Poista |
