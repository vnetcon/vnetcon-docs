---
name: generoi-html
description: Muodosta dokumentaation md-tiedostoista selailtava staattinen HTML-versio html/-hakemistoon (linkit .md→.html, Mermaid-kaaviot, navigaatio, koko tekstin haku). Käytä kun halutaan tuore selattava tai jaeltava HTML-versio dokumentaatiosta.
---

# Generoi HTML

Muodostaa dokumentaation `.md`-tiedostoista staattisen HTML-version
`html/`-hakemistoon. `html/` on johdettu tuotos (ei muokata käsin, ei versioida).

## Toimi näin

1. **Lue menettely:** `metodi/generointi-tyonkulku.md` (vaiheet G1–G5).
2. **Riippuvuudet:** jos `tyokalut/html-generaattori/node_modules` puuttuu, aja
   siellä `npm install` (vaatii verkon; tarvitaan kerran). Ilman sitä HTML
   syntyy, mutta haku ja Mermaid-kaaviot eivät toimi — kerro se käyttäjälle.
3. **Tarkista linkit ensin:** `node tyokalut/tarkista-linkit.mjs --lahteet`
   (ei vaadi riippuvuuksia). Korjaa rikkinäiset linkit ja `lahteet`-polut
   `.md`-lähteisiin ennen generointia.
4. **Generoi:** `cd tyokalut/html-generaattori && node generoi.mjs`. Ajo
   tyhjentää ja rakentaa koko `html/`-puun uudelleen md:stä.
5. **Tarkista** generaattorin tuloste: sivumäärä ja varoitukset. Kerro
   käyttäjälle avattava polku (`html/index.html`) ja pyydä silmäilemään
   navigaatio, linkit, kaaviot, haku ja etusivun järjestelmäkartta.
6. **Jakelu** (jos pyydetään): `./tyokalut/vnetcon-ai/vnetcon-ai html --zip`
   tuottaa `html.zip`:n, joka toimii ilman verkkoa ja palvelinta.

## Invariantit

- Älä muokkaa `html/`-tiedostoja käsin — muutokset `.md`:hen ja generoi uudelleen.
- Generointi ei muuta `.md`-lähteitä.
- Jos jokin Mermaid-kaavio ei piirry, korjaa **lähde-md**:n kaaviosyntaksi (usein
  nimiön erikoismerkit `;` `<` `>`), älä generoitua HTML:ää.
- **Älä committaa** (`html/` on muutenkin `.gitignore`ssa).
