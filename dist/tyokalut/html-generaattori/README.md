# html-generaattori

Muuntaa `vnetcon-docs/`-dokumentaation `.md`-tiedostot staattiseksi
HTML-sivustoksi hakemistoon `vnetcon-docs/html/`.

```bash
npm install        # kertaluontoinen (vaatii verkon)
node generoi.mjs   # tai: npm run generoi
```

Menettely ja tarkistuslista: [`../../metodi/generointi-tyonkulku.md`](../../metodi/generointi-tyonkulku.md).

## Liput

| Lippu | Merkitys |
|-------|----------|
| `--ulos <polku>` | Muu tuotoshakemisto (oletus `html`, suhteessa `vnetcon-docs/`-juureen) |
| `--hiljaa` | Vain virheet ja varoitukset |

## Mistä asetukset tulevat

| Lähde | Mitä ohjaa |
|-------|-----------|
| `../../vnetcon.config.yaml` → `dokumentaatio` | sivuston otsikko, kieli, moduulien näyttönimi, johdantotiedosto |
| `../../vnetcon.config.yaml` → `html` | renderöitävät ryhmät, navigaation tasot, ryhmäotsikot, järjestelmäkartta |
| `../../tila/rakenne.yaml` | navigaation ryhmittely osa-alueisiin + etusivun järjestelmäkartan solmut ja nuolet |
| `../../johdanto.md` | etusivun johdantoteksti |

Kaikki ovat valinnaisia: ilman niitä generaattori käyttää oletuksia ja litteää
navigaatiota.

## Mitä tuotokseen syntyy

```
html/index.html          Etusivu: johdanto, järjestelmäkartta, moduulikortit
html/<ryhma>/**.html     Yksi sivu per .md-tiedosto (sama hakemistorakenne)
html/assets/tyyli.css    Tyylit (vaalea + tumma tila)
html/assets/mermaid.min.js    Kaaviot (vendoroitu, offline)
html/assets/minisearch.min.js Haku (vendoroitu, offline)
html/assets/haku-indeksi.js   Koko tekstin hakuindeksi (upotettu JS:nä)
html/assets/haku.js           Hakulogiikka + navigaation laajennus
```

Tuotos toimii sellaisenaan `file://`-osoitteesta — ei tarvitse palvelinta eikä
verkkoa. `html/` on **johdettu**: sitä ei muokata käsin eikä versioida.

## Huomiot

- Ilman `npm install`ia HTML syntyy, mutta haku ja kaaviot eivät toimi
  (generaattori varoittaa).
- Mermaid-kaavioiden nimiöiden erikoismerkit (`;`, `<`, `>`) suojataan
  automaattisesti. Jos kaavio ei silti piirry, korjaa **lähde-md**.
- Frontmatterin `lahteet` näkyy sivulla taittuvana "Lähteet (koodi)" -osiona.
- Vaihe-otsikot (`### Vaihe 3 — …`) saavat pysyvän ankkurin `#vaihe-3`, jotta
  ristiinlinkitys ei rikkoudu.
