# Lähdeaineistot: koodin ulkopuoliset dokumentit

> 🇬🇧 [In English](sources.md) · [Takaisin MCP:n pääohjeeseen](../README.md) ·
> [Vienti](vienti.md)

Organisaation tieto ei ole pelkästään koodissa. Määrittelyt, sopimusliitteet,
arkkitehtuuri- ja koulutusesitykset sekä prosessikuvaukset ovat Word-,
PowerPoint- ja Excel-tiedostoissa. Niitä ylläpidetään muualla kuin projektin
Gitissä, esimerkiksi verkkolevyllä, OneDrivessa tai SharePointissa.

**Lähdeaineisto** tuo nämä dokumentit MCP:hen ja vientiin omana lähteenään:

- **Eri tietolaji.** Koodidokumentaatio on tarkistettu koodia vasten ja sidottu
  committiin. Lähdeaineisto on ihmisen väite siitä, miten asioiden pitäisi olla
  tai miten ne joskus olivat. Se merkitään aina: `kind: lahdeaineisto`,
  `verified_against_code: false`.
- **Eri lähde.** Lähdeaineistolla ei ole repositorya eikä committia. Versio on
  tiedostokohtainen sisältötiiviste, ja tiedostot pysyvät siellä, missä niitä
  ylläpidetään. Niitä ei kopioida projektin Gitiin.
- **Ei mitään ilman hyväksyntää.** Lähdeaineistossa voi olla sopimuksia,
  hintoja ja henkilötietoja, joten jokainen tiedosto hyväksytään ennen julkaisua.

## Tuetut muodot

| Muoto | Muunnos |
|---|---|
| Word (.docx) | Otsikot (myös suomenkielisen Wordin tyylit), kappaleet, listat, taulukot ja alaviitteet. Muutosjäljityksen poistot ohitetaan |
| PowerPoint (.pptx) | Diat järjestyksessä: otsikko, tekstit, taulukot ja puhujan muistiinpanot |
| Excel (.xlsx) | Välilehdet, alueet ja arvot (`xlsx-kartta.mjs`) |
| Markdown (.md), teksti (.txt) | Sellaisenaan |

Kuvat, kaaviot, makrot ja upotetut objektit ohitetaan, ja niiden määrä näkyy
muunnoksen otsakkeessa. Ei tueta: PDF (tulossa), skannatut asiakirjat sekä vanhat
.doc-, .ppt-, .xls- ja .xlsb-muodot. Ne näkyvät tiedostoluettelossa tilassa
*ei tuettu*, ja syy kerrotaan.

Rajat: lähdetiedosto enintään 50 Mt ja muunnos enintään 5 Mt. Rajoja voi muuttaa
konfiguraatiossa (`sources_defaults.max_file_bytes`, `max_converted_bytes`).

## Lähdetyypit

| Tyyppi | Milloin |
|---|---|
| `directory` | Tiedostot ovat palvelimen nähtävissä olevassa hakemistossa: verkkolevy, synkronoitu OneDrive- tai SharePoint-kansio |
| `upload` | Palvelimella ei ole pääsyä lähdejärjestelmään. Tiedostot ladataan hallintakäyttöliittymässä tai komennolla `source upload` |

## Käyttö

### Hallintakäyttöliittymässä

1. Avaa välilehti **Lähdeaineistot** ja lisää lähde: tunnus, nimi, tyyppi,
   hakemisto, omistaja, tietoluokka ja projektit, joihin lähde liittyy.
2. `directory`: **Skannaa nyt**. `upload`: pudota tiedostot laatikkoon tai
   valitse ne tiedostovalitsimella.
3. Avaa **Tiedostot**. **Esikatsele** näyttää, miten tiedosto näkyy
   AI-clienteille. Muuttuneelle tiedostolle näytetään myös ero hyväksyttyyn
   versioon.
4. **Hyväksy** tiedostoittain, tai **Hyväksy uudet ja muuttuneet** esikatselun
   jälkeen.
5. Lisää lähde kanavaan välilehdellä **Kanavat ja julkaisu** ja **Julkaise**.

Prosessi-välilehden rivi *Lähdeaineistot* näyttää, montako tiedostoa odottaa
hyväksyntää ja onko hyväksyttyjä muutoksia julkaisematta.

### Komentorivillä

bash (macOS, Linux, WSL, Git Bash):

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp source add --id maarittelyt --type directory --location /mnt/yhteiset/maarittelyt --name "Asiakasportaalin määrittelyt" --link emoprojekti --owner Tietohallinto --classification Sisäinen
./tyokalut/vnetcon-ai/vnetcon-ai mcp source scan maarittelyt
./tyokalut/vnetcon-ai/vnetcon-ai mcp source show maarittelyt
./tyokalut/vnetcon-ai/vnetcon-ai mcp source preview maarittelyt --file "Toiminnallinen määrittely.docx"
./tyokalut/vnetcon-ai/vnetcon-ai mcp source approve maarittelyt --all-changed
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel add-source local maarittelyt
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
```

PowerShell (Windows):

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source add --id maarittelyt --type directory --location \\palvelin\yhteiset\maarittelyt --name "Asiakasportaalin määrittelyt" --link emoprojekti --owner Tietohallinto --classification Sisäinen
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source scan maarittelyt
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source show maarittelyt
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source preview maarittelyt --file "Toiminnallinen määrittely.docx"
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source approve maarittelyt --all-changed
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel add-source local maarittelyt
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
```

## Tiedoston tilat

| Tila | Merkitys |
|---|---|
| uusi | Löytyi, ei hyväksytty |
| muuttunut | Sisältö eroaa hyväksytystä. **Edellinen hyväksytty versio pysyy julkaistuna**, kunnes uusi hyväksytään |
| hyväksytty | Julkaistaan |
| hylätty | Nykyistä versiota ei julkaista. Aiemmin hyväksytty versio pysyy, ellei hyväksyntää peruta (`source reject --withdraw`) |
| poistettu | Hyväksytty tiedosto puuttuu lähteestä. Se poistuu seuraavasta julkaisusta |
| ei tuettu | Muotoa ei tueta, syy kerrottu |
| virhe | Muunnos epäonnistui tai tiedosto on liian suuri, syy kerrottu |

Skannaus tunnistaa muutokset sisältötiivisteestä. Kun automaattinen haku on
käytössä (`refresh configure-poll`), hakemistolähteet skannataan samalla
aikavälillä. **Skannaus ei koskaan hyväksy eikä julkaise mitään.**

## MCP

| Työkalu | Mitä tekee |
|---|---|
| `list_sources` | Kanavan lähteet, joihin käyttäjällä on oikeus (valinnaisesti yhteen projektiin linkitetyt) |
| `search_sources` | Haku yhdestä lähteestä. Tuloksissa `kind: lahdeaineisto` ja `verified_against_code: false` |
| `fetch_source_document` | Yksi lähdedokumentti otsakkeineen |

Projektihaku (`search`) ei palauta lähdeaineistoa, eikä lähdehaku palauta
koodidokumentaatiota. Palvelimen ohje kehottaa AI-clientiä kertomaan, kun vastaus
perustuu lähdeaineistoon, ja painottamaan ristiriidassa toteutuksen osalta
koodidokumentaatiota.

## Käyttöoikeudet

- Rajaamaton käyttäjä näkee kaikki kanavansa lähteet.
- Projektirajattu käyttäjä (`--projects`) näkee lähteen, jos kaikki sen
  projektit ovat hänelle sallittuja.
- `--sources <id,…>` sallii lähteet erikseen: `auth token create`,
  `auth user add` ja `auth oidc-rule add`.
- Organisaatiotason lähde (ilman projekteja) näkyy rajatulle käyttäjälle vain
  `--sources`-luvalla.
- Lähteiden hallinta, tiedostoluettelo ja esikatselu vaativat admin-oikeuden.

## Viittaukset koodidokumentaatiosta

Koodidokumentti voi viitata lähdeaineistoon `lahteet`-kentässä:

```yaml
lahteet:
  - src/tilaukset/reitit.ts
  - "lahde:maarittelyt/Toiminnallinen määrittely.docx#9f3c1a2b"
```

Julkaisu kirjaa viitteet projektin julkaisun manifestiin ja varoittaa, jos
tiedosto on muuttunut viittauksen jälkeen. `source show` listaa lähteeseen
osoittavat viitteet tiloineen. Linkkitarkistus:
`vnetcon-ai linkit --lahteet --lahdeaineistot <mcp-työtila>`.
Ks. [`metodi/konventiot.md`](../../../metodi/konventiot.md) kohta 4.

## Vienti

`export create … --include-sources` lisää vientiin kanavan lähteet, jotka on
linkitetty vietäviin projekteihin (tai `--source <id,…>`). Ne ovat omina
tiedostoinaan `70-lahdeaineisto-<lähde>.md`, merkinnällä "ei tarkistettu koodia
vasten", ja ohjetekstissä on sääntö niiden käytöstä. Alkuperäisiä tiedostoja ei
viedä. Ks. [Vienti](vienti.md).

## Tallennus

```text
<työtila>/.multiproject/sources/<lähde>/
  inventory.json            tiedostot, tiivisteet, tilat ja hyväksynnät
  converted/                muunnokset tiivisteen mukaan
  uploads/                  upload-lähteen tiedostot
<storage.root>/sources/<lähde>/releases/<digest>/
  manifest.json, documents/, documents.jsonl
```

`source remove` siirtää lähteen roskakoriin. Lähteen omaan hakemistoon ei
kosketa missään vaiheessa.

## Komennot

| Komento | Käyttöliittymässä |
|---|---|
| `source add --id <id> --type <directory\|upload> [--location …] [--name …] [--link <projekti,…>] [--owner …] [--classification …] [--include <glob,…>] [--exclude <glob,…>]` | Lisää lähde |
| `source set <id> …` | Muokkaa |
| `source list [--json]` / `source show <id> [--json]` | Lähdelista, Tiedostot |
| `source scan <id> \| --all` | Skannaa nyt |
| `source upload <id> --file <polku> [--name …]` | Pudota tiedostot |
| `source preview <id> --file <tiedosto> [--diff]` | Esikatsele |
| `source approve <id> (--file <tiedosto> \| --all-changed)` | Hyväksy |
| `source reject <id> --file <tiedosto> [--withdraw]` | Hylkää, Peru hyväksyntä |
| `source remove-file <id> --file <tiedosto> --confirm` | Poista tiedosto |
| `source remove <id> [--confirm] [--purge]` | Poista |
| `channel add-source <kanava> <id>` / `channel remove-source …` | Kanavat ja julkaisu |
