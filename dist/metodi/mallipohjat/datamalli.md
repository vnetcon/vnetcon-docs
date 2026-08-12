---
otsikko: <Datamallin nimi>
tyyppi: datamalli
moduuli: monta
lahteet:
  - <skeeman lähdetiedosto, esim. openapi.yaml tai prisma/schema.prisma>
paivitetty: YYYY-MM-DD
git-viite: <lyhyt-commit-hash>
metodi-versio: 1
tila: luonnos
---

# <Datamallin nimi>

> **Mallipohja.** Kopioi tiedostoksi `datamallit/<ryhma>/<nimi>.md`.
> Tämä on **jaettu** skeema: käytössä useammassa moduulissa tai määritelty
> keskitetyssä skeemalähteessä. Kuvataan kerran täällä; moduulien datavirrat ja
> datarakenteet **linkittävät** tähän.
>
> Suhteelliset polut alla ovat kirjoitettu **kohdesijainnista** käsin
> (`datamallit/<ryhma>/`) — ne toimivat vasta kun tiedosto on kopioitu sinne.

## Mikä ja mistä

- **Lähde:** `<polku skeematiedostoon>` (<tyyppi: OpenAPI / JSON Schema / ORM /
  protobuf / tyyppimäärittely / EDN>)
- **Versiointi:** <onko skeema versioitu; miten yhteensopivuus hoidetaan>
- **Tunniste:** <miten yksilö tunnistetaan, esim. `id` / `oid` / luonnollinen avain>

## Kentät

> Sisäkkäiset rakenteet **avataan** tai linkitetään toiseen datamalliin — ei
> pelkkää "object"-tyyppiä. Jos kenttäjoukko on iso, ryhmittele alaotsikoilla.

| Kenttä | Tyyppi | Pakollinen | Kuvaus |
|--------|--------|------------|--------|
| `<nimi>` | `<tyyppi>` | kyllä/ei | <selitys, myös substanssimerkitys> |
| `<sisäkkäinen>` | [<datamalli>](<x>.md) | ei | <viittaus toiseen malliin> |

## Sallitut arvot ja säännöt

<Enumit, arvojoukot, riippuvuudet kenttien välillä ("jos X, niin Y on
pakollinen"), yksiköt ja koordinaatistot. Nämä ovat usein tärkeämpiä kuin
tyypit.>

## Missä käytössä

> Täydentyy moduulien dokumentoinnin myötä. Tämä on se osio, joka tekee
> datamallista hyödyllisen: mistä tämä data tulee ja minne se menee.

| Moduuli | Missä | Rooli |
|---------|-------|-------|
| `<moduuli>` | [<datavirta>](../../moduulit/<moduuli>/datavirrat/<x>.md) | <tuottaa / kuluttaa / tallentaa> |

## Liittyvät

- Indeksi: [datamallit/indeksi.md](../indeksi.md)
- Läheiset mallit: [<nimi>](<y>.md)

<!-- Jos tämä tiedosto on generoitu skeemalähteestä, generoitu osa merkitään:
<!-- GENEROITU ALKAA — älä muokkaa käsin, regeneroidaan skeemasta -->
<!-- GENEROITU LOPPUU -->
Merkittyjen lohkojen ulkopuolinen sisältö säilyy regeneroinnissa. -->
