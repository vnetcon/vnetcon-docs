---
otsikko: <Moduuli> — yleiskuvaus
tyyppi: moduuli-yleiskuvaus
moduuli: <moduuli>
lahteet:
  - <moduuli>/package.json
  - <moduuli>/src/...
paivitetty: YYYY-MM-DD
git-viite: <lyhyt-commit-hash>
metodi-versio: 2
tila: luonnos
---

# <Moduuli> — yleiskuvaus

> **Mallipohja.** Kopioi tiedostoksi `moduulit/<moduuli>/yleiskuvaus.md`.
> Poista ohjelainaukset (> …) kun täytät.

## Tehtävä

<Mihin moduuli on olemassa, 1–3 lausetta. Substanssi ensin, tekniikka sitten.>

## Teknologia

- **Kieli/alusta:** <esim. TypeScript / Node 20>
- **Kehys:** <esim. NestJS>
- **Rajapinta:** <REST / GraphQL / gRPC / eventti / ajastus / CLI>
- **Tietokanta:** <esim. PostgreSQL; skeema/taulut jos relevantti>
- **Keskeiset riippuvuudet:** <mihin muihin moduuleihin/ulkoisiin kytkeytyy>

## Sisääntulopisteet

> Endpointit / eventit / ajastetut ajot / komennot. Kukin: mitä tekee + linkki
> prosessikuvaukseen.

- `<METODI> /<polku>` → [<prosessi>](prosessit/<x>.md) — <lyhyt kuvaus>
- `<jonon nimi>` (eventti) → [<prosessi>](prosessit/<y>.md) — <lyhyt kuvaus>

## Dokumentit

- **Prosessit:** <linkit `prosessit/`-tiedostoihin>
- **Datavirrat:** <linkit `datavirrat/`-tiedostoihin>
- **Datarakenteet:** <linkit `datarakenteet/`-tiedostoihin>
- **Liiketoimintaprosessit:** <linkit `../../liiketoimintaprosessit/`>
- **Järjestelmäprosessit:** <linkit `../../jarjestelmaprosessit/`>

## Koodin kartta

> Keskeiset hakemistot/tiedostot ja niiden vastuu (vain versioidut).

- `<moduuli>/src/.../reitit.ts` — <vastuu>
- `<moduuli>/db/migrations/` — <skeema>

## Ajaminen ja testaus

- **Testit:** `<komento>`
- **Build:** `<komento>`
- **Paikallinen ajo:** <lyhyesti, jos projektissa on tapa>

## Avoimet kysymykset

> `> TODO:`-merkinnät koottuna, jos niitä on. Poista osio jos tyhjä.
