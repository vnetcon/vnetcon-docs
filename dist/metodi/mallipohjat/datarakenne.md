---
otsikko: <Rakenteen nimi>
tyyppi: datarakenne
moduuli: <moduuli>
lahteet:
  - <moduuli>/db/migrations/002_<taulu>.sql
paivitetty: YYYY-MM-DD
git-viite: <lyhyt-commit-hash>
metodi-versio: 1
tila: luonnos
---

# <Rakenteen nimi>

> **Mallipohja.** Kopioi tiedostoksi `moduulit/<moduuli>/datarakenteet/<nimi>.md`.
> Kuvaa yksi datarakenne yhdessä pisteessä: taulu, tyyppi, validointiskeema tai
> ORM-malli.
>
> **Jos kyse on jaetusta skeemasta** (käytössä useassa moduulissa tai
> määritelty keskitetyssä skeemalähteessä), älä kuvaa sitä tässä vaan jaetussa
> [`datamallit/`](../../../datamallit/)-kansiossa
> ([`datamalli.md`](../../../metodi/mallipohjat/datamalli.md)) ja **linkitä**
> siihen. Tähän kuvataan moduulikohtaiset/paikalliset rakenteet.
>
> Suhteelliset polut alla ovat kirjoitettu **kohdesijainnista** käsin
> (`moduulit/<moduuli>/datarakenteet/`) — ne toimivat vasta kun tiedosto on
> kopioitu sinne.

## Mikä ja missä

- **Tyyppi:** <SQL-taulu / tyyppimäärittely / validointiskeema / ORM-malli / viestin muoto>
- **Määrittely:** `<moduuli>/...:rivi`
- **Missä käytössä:** <mihin prosessin vaiheeseen/datavirran solmuun liittyy;
  mitkä kentät ovat koodin käytettävissä>

## Kentät

> Sarjallistetuille kentille (JSON/JSONB, blob, payload) merkitse tyypin perään
> `(skeema)` ja linkitä sisältöä kuvaavaan datamalliin "Sisältörakenne"-
> sarakkeessa — älä jätä sisältöä avaamatta.

| Kenttä | Tyyppi | Pakollinen | Sisältörakenne (jos sarjallistettu) | Kuvaus |
|--------|--------|------------|-------------------------------------|--------|
| `<nimi>` | `<tyyppi>` | kyllä/ei | — | <selitys, myös substanssimerkitys jos ei ilmiselvä> |
| `<meta>` | `jsonb (skeema)` | ei | [<datamalli>](../../../datamallit/<x>.md) | <mitä sisältää> |

## Sarjallistetut kentät

> Poista tämä osio jos rakenteessa ei ole sarjallistettuja kenttiä.

| Kenttä | Mitä sisältää | Sisällön datamalli | (De)serialisointi koodissa |
|--------|---------------|--------------------|----------------------------|
| `<kenttä>` | <kuvaus> | [<datamalli>](../../../datamallit/<x>.md) | `<moduuli>/...:rivi` |

## Rajoitteet ja suhteet

<Pääavain, viiteavaimet, uniikkiehdot, indeksit, check-ehdot; viittaukset muihin
rakenteisiin. Jos kyse ei ole taulusta: pakollisuudet, oletusarvot, versiointi.>

## Liittyvät

- Datavirta: [<virta>](../datavirrat/<x>.md)
- Prosessi: [<prosessi>](../prosessit/<x>.md)
