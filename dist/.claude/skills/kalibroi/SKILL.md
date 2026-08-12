---
name: kalibroi
description: Selvitä kuinka hyvin vnetcon-docs osuu tähän projektiin ja mikä jää katveeseen. Ajaa koneellisen kartoituksen, tulkitsee löydökset, tarkistaa katvealueet koodista ja kirjoittaa kalibrointiraportin, joka sisältää laajuusarvion ja priorisoidut korjaukset. Käytä kun halutaan tietää dokumentoinnin lähtötilanne, laatu, kattavuus tai jäljellä olevan työn laajuus.
---

# Kalibroi

Kertoo missä kunnossa dokumentointi on ja **mitä pitää korjata ennen kuin
tulokseen voi luottaa**. Tuottaa `kalibrointiraportti.md`:n, joka on koodivapaa
ja lähetettävissä eteenpäin.

Tämä on halpa ajo (sekunteja, ei tokeneita mainittavasti) ja kannattaa ajaa
ennen isoa dokumentointierää, sen jälkeen, ja aina kun halutaan tietää
ajantasaisuuden tila.

## Toimi näin

1. **Aja koneellinen kartoitus:**
   ```
   node tyokalut/kalibroi.mjs
   ```
   Se kirjoittaa `kalibrointiraportti.md`:n ja `tila/kalibrointi.json`:in. Lue
   molemmat; JSON:issa on tarkat luvut.

   Nopea moduulinäkymä samasta datasta: `node tyokalut/moduulit.mjs`
   (`--tekematta`, `--osa-alue <tunnus>`). Näytä se käyttäjälle, jos hän kysyy
   vain "mitä moduuleja on" tai "mikä on tehty".

2. **Tulkitse löydökset — tässä on skillin arvo.** Työkalu kertoo *mitä* se
   näki; sinun tehtäväsi on kertoa *mitä se tarkoittaa*:
   - **Jokainen 0-osuman katvealue on tarkistettava koodista.** Onko aluetta
     todella olemassa? Käytä `git -C .. grep`iä projektin omilla termeillä ja
     tiedostopäätteillä. Kirjaa kumpi tapaus on kyseessä:
     *(a)* aluetta ei ole → ei toimenpiteitä, tai
     *(b)* alue on toteutettu tavalla jota geneerinen haku ei tunnista → tämä on
     **todellinen katve** ja tuottaa vaillinaista dokumentaatiota huomaamatta.
     Etsi todellinen kaava ja **kirjoita se `metodi/kartoitus.md`:hen**.
   - **Moduulijako:** vastaavatko ehdokkaat todellista rakennetta? Ehdota
     yhdistämisiä, jakoja ja poisrajauksia perusteluineen.
   - **TODO-tiheys:** erottele substanssikysymykset teknisistä epävarmuuksista.
     Korkea tekninen TODO-määrä on merkki huonosta kartoituksesta, ei
     huolellisuudesta.
   - **Puuttuvat lähdepolut:** kertovat ajautumisesta → `/synkronoi-dokumentaatio`.

3. **Täydennä raporttiin oma osio** otsikolla `## Tulkinta ja suositukset`:
   priorisoitu lista (mikä estää, mikä heikentää laatua, mikä on kosmeettista),
   kunkin kohdalla **konkreettinen korjaus ja mihin laajennuspisteeseen se
   kuuluu** (ks. `metodi/laajennuspisteet.md`). Älä toista työkalun tekstiä.

4. **Tarkista laajuusarvio järkeväksi.** Jos moduulien koot vaihtelevat rajusti,
   kerro arvio osa-alueittain (`tila/rakenne.yaml`) eikä yhtenä lukuna. Muistuta,
   että arvio ei sisällä substanssiosaajan aikaa.

5. **Kerro käyttäjälle seuraava askel yhdellä lauseella** — yleensä joko
   `/vnetcon-init` (jos käyttöönotto kesken), kartoituksen korjaus, tai
   `/dokumentoi <pilottimoduuli>`.

## Invariantit

- **Älä muokkaa `kalibrointiraportti.md`:n koneellista osaa** — se
  ylikirjoitetaan seuraavassa ajossa. Oma tulkintasi tulee sen loppuun omaan
  osioonsa; jos haluat sen säilyvän, kerro käyttäjälle että se on syytä siirtää
  omaan tiedostoon ennen seuraavaa ajoa.
- **Älä kirjoita koodia, koodirivejä tai tiedostojen sisältöä raporttiin.**
  Raportti on tarkoitettu myös lähetettäväksi organisaation ulkopuolelle.
- **Älä arvaa katvealueen syytä** — tarkista se koodista tai merkitse
  tarkistamattomaksi.
- Kaikki korjaukset laajennuspisteisiin, ei moottoriin
  (`metodi/laajennuspisteet.md`).
- **Älä committaa** ilman kehittäjän lupaa.

Käyttäjän argumentti (jos annettu) rajaa tulkinnan tiettyyn moduuliin tai
osa-alueeseen.
