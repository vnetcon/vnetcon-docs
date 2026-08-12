---
name: generoi-datamallit
description: Kuvaa projektin jaetut skeemat (OpenAPI, JSON Schema, SQL-migraatiot, ORM-mallit, tyyppimäärittelyt, protobuf, EDN) kertaalleen datamallit/-kansioon, johon moduulien dokumentit linkittävät. Käytä kun halutaan tuottaa tai päivittää jaetut datamallit skeemalähteistä.
---

# Generoi datamallit (jaetut skeemat)

Tuottaa jaetut datamallit `datamallit/`-kansioon skeemalähteistä. Sama skeema
kuvataan kerran; moduulien datavirrat ja datarakenteet linkittävät siihen.

## Toimi näin

1. **Lue menettely:** `metodi/datamalli-tyonkulku.md` (D1–D5) ja
   `metodi/konventiot.md`.
2. **Tunnista skeemalähteet:** `tila/projekti.yaml` → `skeemalahteet`. Jos tyhjä
   tai vanhentunut, etsi uudelleen (D1:n taulukko: rajapintaskeemat,
   migraatiot, ORM-mallit, tyyppimäärittelyt).
3. **Päätä generointitapa** (D2) ja **kerro käyttäjälle kumpi ja miksi**:
   - **A. Deterministinen generaattori** — jos lähde on koneluettava ja skeemoja
     on kymmeniä. Kirjoita skripti `tyokalut/datamalli-generaattori/`, merkitse
     generoitu osa `<!-- GENEROITU ALKAA/LOPPUU -->`-lohkoilla ja **säilytä**
     käsin kirjoitetut osiot regeneroinnissa. Kirjaa ajokomento
     `tila/projekti.yaml`:iin.
   - **B. Agenttivetoinen kuvaus** — jos skeemoja on vähän tai ne ovat
     epäsäännöllisiä. Kirjoita mallipohjasta lukemalla lähde.
4. **Kirjoita datamallit** (D3): kenttätaulukot, sallitut arvot ja säännöt,
   sisäkkäiset rakenteet avattuna tai linkitettynä. Lopuksi
   `datamallit/indeksi.md`.
5. **Kytke moduuleihin** (D4): jos jossain moduulissa on kopioitu skeema, korvaa
   se linkillä tähän.
6. **Kirjaa rivi** `tila/edistyminen.md`:hen: montako datamallia, mistä lähteestä,
   mikä generointitapa.

## Invariantit

- `GENEROITU`-lohkoja ei muokata käsin (regeneroidaan); käsin kirjoitettu sisältö
  tulee lohkojen ulkopuolelle.
- Kuvaa **lähde**, älä generoitua tulosta (esim. `*.proto`, ei `*_pb2.py`).
- Vain versionhallinnassa olevat lähteet. **Älä committaa** ilman kehittäjän lupaa.
- Jos projektissa ei ole jaettuja skeemoja, kerro se ja lopeta — älä keksi
  datamalleja.
