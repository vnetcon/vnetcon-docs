---
name: dokumentoi-kaikki
description: Rakentaa kattavan dokumentaation optimoidussa järjestyksessä — parametroitavissa osa-alueella (yksi osa-alue tai kaikki). Ajaa datamallit, dokumentoi moduulit syvästi rinnakkain (moniagenttinen workflow), end-to-end-kulut, liiketoimintaprosessit ja HTML:n. Käytä kun halutaan tuottaa tai laajentaa kattava dokumentaatio isossa erässä.
---

# Dokumentoi kaikki (orkestroija)

Rakentaa dokumentaation **oikeassa riippuvuusjärjestyksessä**, joko yhdelle
osa-alueelle tai koko projektille. Moduulit dokumentoidaan syvästi rinnakkain
moniagenttisella workflowlla.

**Argumentti:** osa-alueen tunnus `tila/rakenne.yaml`:sta. Ilman argumenttia:
**kaikki** osa-alueet.

> ⚠️ **Iso operaatio.** Iso projekti voi kuluttaa miljoonia tokeneita ja tuntia
> tilausrajaa. **Suositus: aja osa-alue kerrallaan.** Kerro käyttäjälle mitkä
> moduulit aiotaan dokumentoida ja **pyydä vahvistus** ennen workflow-vaihetta.

## Toimi näin

1. **Tarkista lähtötilanne:** aja `node tyokalut/kalibroi.mjs`. Jos siinä on
   **estoja** (käyttöönotto kesken tai `metodi/kartoitus.md` yhä geneerinen
   pohja), älä käynnistä isoa ajoa — kerro este ja ohjaa `/vnetcon-init`iin.
   Kalibroimaton iso ajo polttaa budjetin ja tuottaa vaillinaista jälkeä.
2. **Ratkaise kohde.** Lue `tila/rakenne.yaml` ja `tila/rekisteri.yaml`. Jos
   argumentti annettu, ota kyseisen osa-alueen `moduulit`; muuten kaikkien.
   Jätä pois `rajattu-pois`-moduulit. Näytä lista, **kalibroinnin laajuusarvio
   (tokenit)** ja **pyydä vahvistus**.
3. **Datamallit ensin** (perusta, johon moduulit linkittävät): seuraa
   `metodi/datamalli-tyonkulku.md`. Ohita, jos skeemalähteitä ei ole tai
   datamallit ovat jo ajan tasalla — kerro kumpi.
4. **Moduulit syvästi (fan-out).** Lue `vnetcon.config.yaml`:sta
   `agentit.aliagentit.dokumentointi_malli` ja `verifiointi_malli` sekä
   `tila/metodi.yaml`:sta `metodi_versio`. Kutsu `Workflow`-työkalua
   `name: "dokumentoi-moduulit"`,
   `args: { osaAlue, moduulit: [...], metodiVersio, mallit: { dokumentointi, verifiointi } }`.
   Jätä tyhjät mallit pois argsista — silloin aliagentit perivät pääagentin
   mallin. Se dokumentoi jokaisen moduulin ja verifioi tuloksen koodia vasten.
   (Tämä on eksplisiittinen moniagenttiajo — käyttäjä käynnisti sen tällä
   komennolla.) Jos workflowt eivät ole käytössä, tee tämä vaihe erissä
   `/dokumentoi <moduuli>` -ajoina.
5. **End-to-end -kulut.** Tunnista osa-alueen keskeiset moduulirajat ylittävät
   kulut ja dokumentoi ne `metodi/jarjestelmaprosessi-tyonkulku.md`:n mukaan
   (`jarjestelmaprosessit/`). Päivitä `tila/rakenne.yaml`:n `kytkennat`.
6. **Liiketoimintaprosessit.** Dokumentoi osa-alueen olennaiset
   liiketoimintaprosessit ja linkitä ne järjestelmä-/moduuliprosesseihin.
7. **Päivitä tila** (orkestroija tekee tämän, ei workflow-agentit):
   `tila/rekisteri.yaml` ja rivit `tila/edistyminen.md`:hen. Kirjaa myös
   löydökset, avoimet TODOt ja tehdyt rajaukset.
8. **HTML viimeisenä:** `cd tyokalut/html-generaattori && node generoi.mjs`
   (aja `npm install` ensin jos `node_modules` puuttuu).
9. **Kalibroi lopuksi** (`node tyokalut/kalibroi.mjs`) ja kerro käyttäjälle
   kattavuus, TODO-tiheys ja jäljelle jääneet katvealueet — nämä ovat se tieto,
   jonka perusteella hän päättää mitä tehdään seuraavaksi.

## Kustannus: konteksti, ei tuotos

Mitatussa ajossa **70 % kustannuksesta oli kontekstin uudelleenlukua** (välimuistista
luettuja tokeneita), ei dokumenttien kirjoittamista — output oli 16 %. Ja 84 %
kulutuksesta tapahtui yli 150 000 tokenin kontekstissa.

Fan-out-vaihe on tässä kunnossa: jokainen aliagentti saa oman tyhjän kontekstinsa.
**Kallis osa on orkestroijan oma sessio**, joka kasvaa vaiheiden myötä ja luetaan
uudelleen joka pyynnöllä. Siksi:

- **Kerro käyttäjälle vaiheiden välissä, että sessio kannattaa tyhjentää** (`/clear`)
  ennen seuraavaa isoa vaihetta — erityisesti datamallien jälkeen ja
  end-to-end-vaiheen jälkeen. Työn tila on tiedostoissa (`tila/rekisteri.yaml`,
  `tila/edistyminen.md`), ei sessiossa, joten mitään ei menetetä.
- **Älä aja käyttöönottoa, dokumentointia ja synkronointia samassa sessiossa.**
- Jos ajat moduulit erikseen `/dokumentoi`-komennoilla, **yksi moduuli per sessio**.

## Invariantit

- Vain versionhallinnassa oleva koodi. **Älä committaa** ilman kehittäjän lupaa.
- Idempotentti: olemassa olevat dokit päivitetään paikallaan, ei luoda alusta.
- Raportoi rehellisesti: jos jokin moduuli jäi kesken tai verifiointi löysi
  virheitä, kerro se — älä ilmoita valmiiksi mitä ei tarkistettu.
