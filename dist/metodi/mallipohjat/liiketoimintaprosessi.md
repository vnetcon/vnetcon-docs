---
otsikko: <Liiketoimintaprosessin nimi>
tyyppi: liiketoimintaprosessi
moduuli: <moduuli tai "monta">
lahteet:
  - <moduuli>/src/...
paivitetty: YYYY-MM-DD
git-viite: <lyhyt-commit-hash>
metodi-versio: 2
tila: luonnos
---

# <Liiketoimintaprosessin nimi>

> **Mallipohja.** Kopioi kansioon `liiketoimintaprosessit/`. Tämä on
> ei-tekninen, substanssiosaajalle suunnattu kerros ja koko dokumentaation
> **sisääntulopiste**. Poista ohjelainaukset (> …) kun täytät.

## Tarkoitus

<Mitä tämä prosessi saa aikaan liiketoiminnan / substanssin kannalta ja miksi.
1–3 lausetta, ei teknisiä termejä.>

## Toimijat ja laukaisin

- **Kuka/mikä käynnistää:** <käyttäjärooli, järjestelmä tai ajastus>
- **Lopputulos:** <mitä prosessin päätteeksi on tapahtunut>
- **Kuinka usein / millä volyymilla:** <jos tiedossa; muuten poista>

## Prosessin vaiheet

> Jokainen vaihe sitoo yhteen substanssin, koodin ja datan. "Tekninen kohta" ja
> "Data" ovat linkkejä teknisiin dokumentteihin — tästä porautuu syvemmälle.

| Vaihe | Mitä tapahtuu (substanssi) | Tekninen kohta | Käytettävissä oleva data |
|-------|----------------------------|----------------|--------------------------|
| 1 | <selkokielinen kuvaus> | [prosessi #vaihe-1](../moduulit/<moduuli>/prosessit/<x>.md#vaihe-1) · `<moduuli>/src/...:rivi` | [<rakenne>](../moduulit/<moduuli>/datarakenteet/<y>.md) |
| 2 | … | … | … |

## Liiketoimintasäännöt

<Olennaiset säännöt/ehdot substanssin kielellä, esim. "X sallitaan vain kun …".
Merkitse epävarmat: `> TODO: varmistettava substanssiosaajalta`.>

## Poikkeukset ja virhetilanteet substanssin kannalta

<Mitä tapahtuu kun jotain menee pieleen — kenelle se näkyy ja miten se
korjataan. Ei teknisiä virhekoodeja, vaan seuraus käyttäjälle.>

## Liittyvät

- Järjestelmäprosessit (end-to-end): <linkit `../jarjestelmaprosessit/`>
- Tekniset prosessit: <linkit `../moduulit/<moduuli>/prosessit/`>
- Datamallit: <linkit `../datamallit/`>
