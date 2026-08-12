---
name: vnetcon-init
description: Ota vnetcon-docs käyttöön tässä projektissa. Kartoittaa projektin (kieli, kehys, moduulit, skeemalähteet, testikomennot), kysyy muutaman asian ja kirjoittaa vnetcon.config.yaml, tila/projekti.yaml, tila/rekisteri.yaml, tila/rakenne.yaml sekä projektikohtaisen metodi/kartoitus.md. Käytä kun dokumentaatiojärjestelmä otetaan käyttöön uudessa projektissa tai kun käyttöönottoa halutaan päivittää.
---

# Ota käyttöön (init)

Sovittaa geneerisen `vnetcon-docs`-paketin **tähän** projektiin. Tämä on
kertaluontoinen — ilman sitä muut komennot eivät tiedä mistä projektista on kysymys.

## Toimi näin

1. **Lue menettely:** `metodi/kayttoonotto-tyonkulku.md` (vaiheet I0–I7) ja
   `metodi/konventiot.md`.
2. **Noudata vaiheita järjestyksessä:**
   - I0 — onko käyttöönotto jo tehty? (`vnetcon.config.yaml` olemassa → päivitä,
     älä nollaa)
   - I1 — **aja `node tyokalut/kalibroi.mjs` ensin** ja lue
     `kalibrointiraportti.md`: laajuus, kielet, moduuliehdokkaat, skeemalähteet,
     komennot ja **alueet joissa oli 0 osumaa**. Täydennä sitten omilla hauilla.
   - I2 — käy **jokainen 0-osuman alue** läpi koodista (onko sitä olemassa?),
     valitse pinoprofiili(t) `metodi/pinot/`-kansiosta ja **kirjoita
     `metodi/kartoitus.md`** tämän projektin todellisilla hakukomennoilla.
     Testaa jokainen kirjoittamasi haku; kirjaa aidot puutteet
     "Katvealueet"-osioon. Aja kalibrointi uudelleen lopuksi.
   - I3 — kysy `AskUserQuestion`illa vain se mitä et voi päätellä: moduulijako,
     osa-alueet, sanasto, agentit/pilvipalvelu. Esitä päättelemäsi vastaus oletuksena.
   - I4 — kirjoita `vnetcon.config.yaml` (pohja: `vnetcon.config.example.yaml`),
     `tila/projekti.yaml`, `tila/rekisteri.yaml` (yksi **pilotti**),
     `tila/rakenne.yaml`, `johdanto.md`
   - I5 — kytke projektin juuri: `AGENTS.md`/`CLAUDE.md`-viittaukset (lisää, älä
     ylikirjoita) ja kysy `.gitignore`-rivit
   - I6 — aja `vnetcon-ai doctor` + kalibrointi vielä kerran, näytä tulos
   - I7 — kerro seuraava askel: `/dokumentoi <pilottimoduuli>` — ja **kerro
     rehellisesti jäljelle jääneet katvealueet**, älä anna ymmärtää että
     dokumentointi tuottaa valmista jälkeä jos kartoitus jäi ohuelle

## Invariantit

- **Älä kirjoita moduuli- tai liiketoimintadokumentteja** — tämä on
  käyttöönotto, ei dokumentointi.
- **Älä arvaa projektin faktoja.** Lue koodista tai kysy. Väärä
  `metodi/kartoitus.md` tuottaa väärää dokumentaatiota kaikissa myöhemmissä ajoissa.
- **Kaikki kirjoitettava sisältö laajennuspisteisiin** — ks.
  `metodi/laajennuspisteet.md`. Älä muokkaa moottoritiedostoja
  (`metodi/*-tyonkulku.md`, `metodi/konventiot.md`, `tyokalut/`, paketin skillit).
- **Älä committaa** eikä muokkaa projektin tiedostoja (`../`) ilman lupaa.
- **Älä pyydä tunnisteita chattiin** — pilvipalvelun tunniste kirjoitetaan
  `~/.vnetcon/credentials.env`-tiedostoon käyttäjän itsensä toimesta.

Käyttäjän argumentti (jos annettu) on projektin nimi tai rajaus (esim. vain
tietty alihakemisto).
