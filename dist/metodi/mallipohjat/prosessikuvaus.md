---
otsikko: <Prosessin nimi>
tyyppi: prosessi
moduuli: <moduuli>
lahteet:
  - <moduuli>/src/.../reitit.ts
  - <moduuli>/src/.../kasittelija.ts
paivitetty: YYYY-MM-DD
git-viite: <lyhyt-commit-hash>
metodi-versio: 2
tila: luonnos
---

# <Prosessin nimi>

> **Mallipohja.** Kopioi tiedostoksi `moduulit/<moduuli>/prosessit/<nimi>.md`.
> Kuvaa yksi tekninen prosessi: sisääntulo → logiikka → tallennus → paluu.

## Yhteenveto

- **Laukaisin:** `<METODI> /<polku>` (tai eventti / ajastus / komento)
- **Lopputulos:** <mitä palautetaan / mikä sivuvaikutus syntyy>
- **Idempotentti:** <kyllä/ei — ja miksi se on merkityksellistä>

## Sekvenssi

```mermaid
sequenceDiagram
    actor Kutsuja
    participant API as Reitti
    participant Logiikka
    participant DB as Tietokanta
    Kutsuja->>API: <METODI> /<polku> (payload)
    API->>Logiikka: <validointi/kutsu>
    Logiikka->>DB: <kysely>
    DB-->>Logiikka: <tulos>
    Logiikka-->>API: <malli>
    API-->>Kutsuja: <vastaus>
```

## Vaiheet

> Käytä pysyviä tunnisteita (`### Vaihe n`). Ne eivät muutu, vaikka sisältö
> päivittyy — liiketoiminta- ja datakerros linkittävät näihin. Uusi vaihe
> väliin: `### Vaihe 3b — …`, ei uudelleennumerointia.

### Vaihe 1 — <nimi>

- **Mitä:** <mitä tapahtuu>
- **Koodi:** `<moduuli>/src/...:rivi`
- **Data sisään / ulos:** [<rakenne-sisään>](../datarakenteet/<a>.md) → [<rakenne-ulos>](../datarakenteet/<b>.md)

### Vaihe 2 — <nimi>

- **Mitä:** …
- **Koodi:** …
- **Data:** …

## Virhetilanteet

> Keskeiset virhepolut ja mitä kutsujalle palautetaan. Myös uudelleenyritykset,
> aikakatkaisut ja osittainen eteneminen, jos niitä on.

| Tilanne | Käytös | Kutsujalle | Koodi |
|---------|--------|-----------|-------|
| <esim. validointi epäonnistuu> | <ei sivuvaikutuksia> | `400 <viesti>` | `…:rivi` |

## Liittyvät

- Datavirta: [<virta>](../datavirrat/<x>.md)
- Liiketoimintaprosessi: [<prosessi>](../../../liiketoimintaprosessit/<x>.md)
- Järjestelmäprosessi: [<kulku>](../../../jarjestelmaprosessit/<x>.md)
