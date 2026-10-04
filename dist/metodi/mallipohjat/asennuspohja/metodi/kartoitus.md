# Kartoitus — projektikohtaiset hakukomennot

> ⚠️ **Tämä tiedosto on vielä pohja.** `/vnetcon-init` korvaa sen tämän projektin
> todellisilla hakukomennoilla (ks. [`kayttoonotto-tyonkulku.md`](kayttoonotto-tyonkulku.md)
> vaihe I2). Jos luet tätä varoitusta dokumentointityön aikana, käyttöönotto on
> kesken — kerro se käyttäjälle ja käytä toistaiseksi
> [`pinot/yleinen.md`](pinot/yleinen.md):n komentoja.

Tämä on **dokumentoinnin tärkein projektikohtainen tiedosto**: se kertoo, mistä
tässä projektissa löytyvät sisääntulopisteet, tietokantakäsittely, ulkoiset
kutsut, skeemat ja konfiguraatio. Hyvä kartoitus → hyvät dokit.

Sääntö: **jokainen tänne kirjoitettu haku on testattu ja tuottaa osumia.** Haku,
joka ei osu mihinkään, on virhe — ei tyhjä alue. Tyhjät alueet kirjataan
"Katvealueet"-osioon perusteluineen.

Rakenne (init täyttää):

## Projektin muoto

- **Monorepo / yksi sovellus:** …
- **Moduulin tunnistus:** … (esim. "hakemisto, jossa on `package.json`")
- **Poisrajaukset:** … (generoitu koodi, arkistot, kokeilut)

## Sisääntulopisteet

```
# HTTP-reitit
…
# Viestikuuntelijat / eventit
…
# Ajastukset
…
# CLI / työkalut
…
```

## Tietokanta ja tallennus

```
# Migraatiot / skeema
…
# Kyselyt / ORM
…
```

## Ulkoiset riippuvuudet

```
# HTTP-clientit
…
# Jonot / topicit / tiedostovarasto
…
```

## Skeemat ja tyypit (datan muodon määrittelijät)

```
…
```

## Konfiguraatio

```
…
```

## Testit ja build

- **Testikomento:** …
- **Buildkomento:** …
- **Testien sijainti ja nimeämiskäytäntö:** …

## Katvealueet

> **Tämä osio on kartoituksen arvokkain osa.** Tänne kirjataan alueet, jotka
> geneeriset haut eivät löydä — ja kumpi tapaus on kyseessä. Ilman tätä jokainen
> sessio etsii samat asiat uudelleen ja jättää samat aukot.
>
> Lähde: `node tyokalut/kalibroi.mjs` → 0-osuman alueet, tarkistettuna koodista.

| Alue | Löytyykö projektista | Projektin oma kaava / miksi ei löydy |
|------|---------------------|--------------------------------------|
| <esim. serverless-funktiot> | kyllä | <geneerinen haku etsii `exports.handler`; tässä projektissa … — hae sen sijaan `…`> |
| <esim. ajastetut ajot> | ei | <ajastus on infrastruktuurissa, ei koodissa — ei dokumentoitavaa koodipuolella> |

## Projektikohtaiset huomiot

> Asiat, jotka toistuvasti hämäävät dokumentoinnissa: nimeämispoikkeamat,
> kaksi rinnakkaista sukupolvea samasta moduulista, generoitu koodi, jne.
