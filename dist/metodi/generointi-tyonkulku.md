# Työnkulku: HTML-generointi

Muodostaa dokumentaation `.md`-tiedostoista selailtavan **staattisen HTML-version**
hakemistoon `html/`. `/generoi-html`-skill ohjaa tänne.

`html/` on **johdettu tuotos** — sitä ei muokata käsin eikä versioida
(`.gitignore`). Muutokset tehdään aina `.md`-lähteisiin ja generoidaan uudelleen.

Generaattori: [`../tyokalut/html-generaattori/`](../tyokalut/html-generaattori/)
(Node). Se

- muuntaa md→html ja kirjoittaa `.md`-linkit `.html`-linkeiksi,
- näyttää frontmatterin metatietopalkkina (ei raakadumppia),
- renderöi Mermaid-kaaviot selaimessa (vendoroitu `mermaid.min.js`),
- rakentaa taittuvan navigaation hakemistopuusta (`<details>`, +/− -napit,
  auto-avaa nykyisen sivun haara, "Laajenna kaikki"),
- koostaa **client-side-haun** (MiniSearch, vendoroitu; koko tekstin indeksi
  upotetaan JS:nä → toimii offline `file://`-osoitteesta),
- lukee asetukset `../vnetcon.config.yaml`:n `html`- ja
  `dokumentaatio`-osioista ja informaatioarkkitehtuurin
  `../tila/rakenne.yaml`:sta.

---

## Vaihe G1 — Riippuvuudet (kerran / kun package.json muuttuu)

```
cd tyokalut/html-generaattori
npm install
```

> `npm install` vaatii verkon (hakee mm. mermaidin). Tarvitaan vain
> ensimmäisellä kerralla tai kun riippuvuudet muuttuvat. Ilman sitä HTML
> syntyy, mutta haku ja kaaviot eivät toimi (generaattori varoittaa).

## Vaihe G2 — Generoi

```
node generoi.mjs
```

(tai `npm run generoi`, tai juuresta
`./tyokalut/vnetcon-ai/vnetcon-ai html`). Tuottaa/uudelleenmuodostaa koko
`html/`-puun. Ajo on idempotentti: `html/` tyhjennetään ja rakennetaan uudelleen
md:stä. Ajo **ei muuta `.md`-lähteitä**.

Valinnaiset liput:

```
node generoi.mjs --ulos <polku>    # muu tuotoshakemisto
node generoi.mjs --hiljaa          # vain virheet
```

## Vaihe G3 — Tarkista

Aja ensin linkkitarkistus (ei vaadi riippuvuuksia):

```
node tyokalut/tarkista-linkit.mjs --lahteet
```

Se kertoo rikkinäiset sisäiset linkit ja `lahteet`-polut, jotka eivät löydy
projektista. Korjaa löydökset `.md`-lähteisiin ja generoi uudelleen.

Avaa sitten `html/index.html` selaimessa. Varmista, että:

- navigaatio näyttää moduulit, liiketoimintaprosessit, järjestelmäprosessit ja
  datamallit,
- sivujen väliset linkit aukeavat (`.md` → `.html`),
- Mermaid-kaaviot piirtyvät,
- vasemman palkin **hakukenttä** löytää sivuja,
- etusivun järjestelmäkartta vastaa `tila/rakenne.yaml`:ia.

Jos jokin kaavio ei piirry, syy on yleensä Mermaid-syntaksissa: tarkista
nimiöiden erikoismerkit (`;`, `<`, `>`) — generaattori suojaa yleisimmät, mutta
ei kaikkia.

## Vaihe G4 — Jakelu (valinnainen)

```
./tyokalut/vnetcon-ai/vnetcon-ai html --zip
```

Paketoi `html.zip`:n, jonka voi lähettää eteenpäin — se toimii ilman verkkoa ja
ilman palvelinta (avaa `index.html`).

## Vaihe G5 — Loki (valinnainen)

Jos generointi on osa laajempaa dokumentointiajoa, mainitse se
[`../tila/edistyminen.md`](../tila/edistyminen.md)-rivillä. Erillistä
tilatiedostoa ei tarvita, koska `html/` on aina täysin johdettu md:stä.

---

## Milloin ajetaan

Aina kun `.md`-dokumentteja on luotu/päivitetty ja halutaan tuore selattava
versio: dokumentoinnin, synkronoinnin, tiketin tai yhdenmukaistuksen jälkeen.
