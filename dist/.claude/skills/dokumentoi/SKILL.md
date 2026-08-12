---
name: dokumentoi
description: Dokumentoi tai päivitä yhden moduulin prosessit, datavirrat, datarakenteet ja liiketoimintaprosessit vnetcon-docs-järjestelmään. Käytä kun halutaan tuottaa tai päivittää projektin teknistä dokumentaatiota moduuli kerrallaan. Skooppi on vain versionhallinnassa oleva koodi.
---

# Dokumentoi moduuli

Ohjaa yhden moduulin dokumentointia. Sinun ei tarvitse muistaa menettelyä — se
on tiedostoissa.

## Toimi näin

1. **Tarkista käyttöönotto:** jos `vnetcon.config.yaml` puuttuu, ohjaa käyttäjä
   komentoon `/vnetcon-init` ja lopeta.
2. **Lue menettely:** `metodi/tyonkulku.md` (dokumentoinnin täydellinen
   työnkulku: luonti- ja päivitystila), `metodi/konventiot.md` (skooppi,
   frontmatter, kaaviot, nimeäminen) ja `metodi/kartoitus.md` (tämän projektin
   hakukomennot). Lue myös `tila/projekti.yaml`.
3. **Katso tila:** aja `node tyokalut/moduulit.mjs --tekematta` (nopea listaus +
   ehdotus) ja lue `tila/rekisteri.yaml`, joka on virallinen lähde. Valitse
   kohdemoduuli (käyttäjän nimeämä tai ensimmäinen `tekematta`, pilotti ensin).
   Merkitse `kesken`.
4. **Noudata työnkulkua** vaihe vaiheelta (A→F). Muista invariantti:
   dokumentoi ja viittaa **vain versionhallinnassa olevaan koodiin** — varmista
   polut `git -C .. ls-files`illä. Koodipolut kirjoitetaan projektin juuresta.
5. **Kirjoita kenttätasolla.** Datavirroissa jokaisessa solmussa hallitseva
   skeema/tyyppi ja koodille käytettävissä olevat kentät. Sarjallistetut kentät
   (JSON/JSONB, blob, payload) **avataan** ja linkitetään datamalliin.
6. **Kerro mitä et nähnyt.** Jos jokin hakuluokka (sisääntulopisteet, tietokanta,
   ulkoiset kutsut, skeemat) ei tuottanut yhtään osumaa, kokeile vaihtoehtoisia
   hakuja; jos edelleen tyhjä, päätä onko aluetta olemassa vai ei ja kirjaa
   kumpi — `> TODO: kartoitus ei löytänyt <mitä>` + lisäys
   `metodi/kartoitus.md`:n "Katvealueet"-osioon. **Mainitse tämä yhteenvedossa.**
7. **Päivitä lopuksi** `tila/rekisteri.yaml` ja lisää rivi
   `tila/edistyminen.md`:hen (myös löydökset, katveet ja avoimet TODOt). Aja
   `node tyokalut/kalibroi.mjs`, jotta kattavuus- ja laatuluvut päivittyvät.

## Invariantit

- Jos `moduulit/<moduuli>/` on jo olemassa → **päivitystila**, päivitä
  paikallaan säilyttäen runko ja vaihe-tunnisteet. Älä luo alusta.
- Älä keksi. Epävarma kohta: `> TODO: varmistettava — <mikä>` + `tila: luonnos`.
- **Älä committaa** ilman kehittäjän lupaa.

Käyttäjän argumentti (jos annettu) on dokumentoitavan moduulin nimi.
