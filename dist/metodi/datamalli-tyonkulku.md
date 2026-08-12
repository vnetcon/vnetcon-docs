# Työnkulku: datamallit (jaetut skeemat)

Kuvaa **kertaalleen** ne datarakenteet, joita käytetään useammassa moduulissa tai
jotka määritellään koneluettavassa skeemalähteessä. Tuotos: `datamallit/<ryhma>/<nimi>.md`
+ `datamallit/indeksi.md`. `/generoi-datamallit`-skill ohjaa tänne.

Miksi erikseen: sama skeema (tilaus, asiakas, tuote) kulkee monen moduulin
läpi. Jos se kuvataan joka moduuliin, kuvaukset eriytyvät. Datamalli kuvataan
kerran, ja moduulien datavirrat ja datarakenteet **linkittävät** siihen.

Invariantti: **vain versionhallinnassa olevat lähteet**; ks.
[`konventiot.md`](konventiot.md). Mallipohja:
[`mallipohjat/datamalli.md`](mallipohjat/datamalli.md).

---

## Vaihe D1 — Tunnista skeemalähteet

Lue `../tila/projekti.yaml` → `skeemalahteet`. Jos lista on tyhjä tai
vanhentunut, etsi lähteet uudelleen:

| Lähdetyyppi | Mistä löytyy | Miten luetaan |
|-------------|--------------|---------------|
| Rajapintaskeema | `openapi*.y*ml`, `swagger*.json`, `*.graphql`, `*.proto` | Komponentit/tyypit → yksi datamalli per merkittävä skeema |
| Tietokantaskeema | `**/migrations/*.sql`, `schema.sql`, `*.dbml` | Taulu → datarakenne moduulissa; jaettu käsite → datamalli |
| ORM-/koodimalli | `schema.prisma`, `*.entity.ts`, `models.py`, JPA-entiteetit | Malli → datamalli jos jaettu |
| Tyyppimäärittely | `*.d.ts`, `types/*.ts`, `*.avsc`, JSON Schema | Tyyppi → datamalli jos jaettu |
| Muu deklaratiivinen | `*.yaml`-skeemat, koodigeneroinnin lähteet, projektin oma skeemakieli | Määrittely → datamalli |

**Ohita** generoitu koodi (esim. `*_pb2.py`, `generated/`) ja kuvaa aina
**lähde**, ei generoitua tulosta.

## Vaihe D2 — Päätä generointitapa

Kaksi tapaa, valitse skeemalähteen mukaan:

**A. Deterministinen generointi (suositus, jos lähde on koneluettava ja
skeemoja on kymmeniä).** Kirjoita pieni generaattoriskripti
`tyokalut/datamalli-generaattori/` (esim. Node tai projektin oma kieli), joka
lukee skeemalähteen ja kirjoittaa yhden md-tiedoston per skeema. Tällöin:

- Merkitse generoitu osa selkeästi:
  ```markdown
  <!-- GENEROITU ALKAA — älä muokkaa käsin, regeneroidaan skeemasta -->
  …
  <!-- GENEROITU LOPPUU -->
  ```
- Käsin kirjoitetut osiot (liiketoimintamerkitys, linkit moduuleihin) tulevat
  merkittyjen lohkojen **ulkopuolelle** ja **säilyvät** regeneroinnissa —
  generaattorin pitää lukea olemassa oleva tiedosto ja säilyttää ne.
- Kirjaa ajokomento `tila/projekti.yaml`:iin ja tähän työnkulkuun.

**B. Agenttivetoinen kuvaus** (kun skeemoja on vähän, ne ovat epäsäännöllisiä
tai lähde on koodia). Kirjoita datamallit mallipohjasta lukemalla lähde.

Kerro käyttäjälle kumpaa käytät ja miksi.

## Vaihe D3 — Kirjoita datamallit

Ryhmittele `datamallit/<ryhma>/`-alihakemistoihin, jos skeemoja on yli ~15
(ryhmä = domainalue, ei tekninen tyyppi). Jokaiselle:

- frontmatter `tyyppi: datamalli`, `lahteet` = skeematiedosto(t)
- kenttätaulukko: nimi, tyyppi, pakollisuus, kuvaus
- **sisäkkäiset ja sarjallistetut rakenteet avataan** tai linkitetään toiseen
  datamalliin — ei "object"-tyyppiä ilman sisältöä
- versiointi/yhteensopivuus jos skeema on versioitu
- "Missä käytössä" — linkit moduuleihin, jotka käyttävät tätä (täydentyy
  moduulien dokumentoinnin myötä)

Kirjoita lopuksi `datamallit/indeksi.md`: taulukko kaikista datamalleista
(nimi, ryhmä, lähde, lyhyt kuvaus) — tämä on lukijan sisääntulo.

## Vaihe D4 — Kytke moduuleihin

Muistuta itseäsi (ja kirjaa TODO), että moduulien `datavirrat/`- ja
`datarakenteet/`-dokumenttien pitää **linkittää** näihin datamalleihin sen
sijaan että kopioisivat skeeman. Jos moduuli on jo dokumentoitu ja siinä on
kopioitu skeema, korvaa se linkillä.

## Vaihe D5 — Loki

Kirjaa rivi [`../tila/edistyminen.md`](../tila/edistyminen.md): montako
datamallia syntyi/päivittyi, mistä lähteestä, mikä generointitapa.

> **Versionhallinta:** älä committaa ilman kehittäjän lupaa.

---

## Milloin ajetaan uudelleen

Aina kun skeemalähde muuttuu (`/synkronoi-dokumentaatio` havaitsee sen).
Deterministisessä tavassa: aja generaattori uudelleen. Agenttivetoisessa:
päivitä muuttuneet datamallit paikallaan.
