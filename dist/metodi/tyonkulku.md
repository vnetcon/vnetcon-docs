# Työnkulku: dokumentointi

Tämä on dokumentoinnin **täydellinen menettely**. `/dokumentoi`-skill ohjaa
tänne. Menettelyssä on kaksi tilaa: **luontitila** (dokumenttia ei ole) ja
**päivitystila** (dokumentti on jo olemassa). Oletus on päivitys, jos kohde on jo
olemassa.

Lue ensin [`konventiot.md`](konventiot.md) ja [`kartoitus.md`](kartoitus.md)
(projektikohtaiset hakukomennot). Lue myös `../tila/projekti.yaml`.
Muista invariantti: **vain versionhallinnassa oleva koodi**.

> Jos `../vnetcon.config.yaml` puuttuu, projektia ei ole otettu käyttöön → ohjaa
> käyttäjä komentoon `/vnetcon-init` ([`kayttoonotto-tyonkulku.md`](kayttoonotto-tyonkulku.md)).

---

## Vaihe A — Valitse kohde

Nopea tilannekuva (myös käyttäjälle näytettäväksi):

```
node tyokalut/moduulit.mjs --tekematta
```

Se listaa moduulit tilan mukaan ja ehdottaa seuraavan. Virallinen lähde on silti
rekisteri:

1. Lue [`../tila/rekisteri.yaml`](../tila/rekisteri.yaml).
2. Jos käyttäjä nimesi moduulin, käytä sitä. Muuten valitse ensimmäinen
   `tila: tekematta` (tai `kesken`) -moduuli, prioriteettijärjestyksessä
   (`pilotti: true` ensin).
3. **Lue moduulin `tiedostot`-lista, jos se on annettu.** Silloin moduuli ei ole
   hakemisto: `polku` on vain viite, ja rajaus on täsmälleen tuo lista. Useampi
   moduuli voi jakaa saman polun, joten koko hakemiston dokumentointi kirjoittaisi
   toisen moduulin sisällön väärään paikkaan.
4. Merkitse moduulin tila rekisteriin `kesken`.

## Vaihe B — Onko olemassa? (tila-valinta)

- Jos `moduulit/<moduuli>/` **ei ole olemassa** → **luontitila** (vaihe C→).
- Jos on → **päivitystila** (ks. alaosio "Päivitystila").

---

## Luontitila

### Vaihe C — Kartoita moduuli (vain versioidut tiedostot)

Selvitä koodista, älä oleta. Käytä [`kartoitus.md`](kartoitus.md):n
projektikohtaisia hakukomentoja. Vähintään:

- **Rakenne:** `git -C .. ls-files <moduulin-polku>/ | sort`
- **Sisääntulopisteet** (HTTP-reitit, viestikuuntelijat, ajastukset, CLI)
- **Tietokanta** (migraatiot, kyselyt, ORM-mallit)
- **Ulkoiset kutsut** (HTTP-clientit, jonot, tiedostovarastot)
- **Skeemat ja tyypit** — mikä määrittelee datan muodon (OpenAPI, JSON Schema,
  ORM-malli, tyyppimäärittely, EDN/spec, protobuf)
- **Konfiguraatio** (osoitteet, jonojen nimet, ominaisuusliput)

Muodosta ymmärrys ketjusta: **sisääntulo (API/eventti/ajastus) → reitti/
käsittelijä → logiikkakerros → tietokanta/ulkoinen → paluu**.

**Itsediagnoosi — pakollinen.** Jos jokin hakuluokka ei tuota yhtään osumaa
(esim. et löydä sisääntulopisteitä tai tietokantakäsittelyä), **älä jatka
kirjoittamista ikään kuin aluetta ei olisi.** Toimi näin:

1. Kokeile 2–3 vaihtoehtoista hakua projektin omilla termeillä.
2. Jos edelleen tyhjä, päätä kumpi on kyseessä ja kirjaa se:
   - **aluetta ei ole** → mainitse se moduulin yleiskuvauksessa
     (esim. "ei omaa tietokantaa"), tai
   - **haku ei osu** → kirjaa `> TODO: kartoitus ei löytänyt <mitä> — tarkistettava`,
     jätä dokki `tila: luonnos` ja lisää puuttuva haku
     [`kartoitus.md`](kartoitus.md):n "Katvealueet"-osioon.
3. **Kerro tämä käyttäjälle ajon lopussa.** Vaillinainen kartoitus tuottaa
   uskottavan näköistä mutta virheellistä dokumentaatiota; hiljaa jättäminen on
   pahin mahdollinen lopputulos.

Nopea koneellinen tarkistus alueittain: `node tyokalut/kalibroi.mjs`.

**Data on skeemaohjattua, ei vain taulusarakkeita.** Selvitä kussakin vaiheessa
**mikä skeema/tyyppi hallitsee dataa** ja mitkä kentät ovat siten koodin
käytettävissä. Sarjallistetut kentät (JSON/JSONB-sarakkeet, blobit, "payload"-
kentät) **avataan**: selvitä sisältörakenne ja linkitä sitä kuvaavaan
datamalliin — muuten kenttäjoukko katoaa dokumentaatiosta. Jaetut skeemat
kuvataan kertaalleen `datamallit/`-kansioon, ja moduulien datavirrat linkittävät
niihin.

### Vaihe D — Kirjoita dokumentit mallipohjista

Kopioi rakenne kansiosta [`mallipohjat/`](mallipohjat/). Kirjoita **vain se mitä
koodista voi todeta**; epävarmat kohdat `> TODO:`-merkinnällä ja `tila: luonnos`.

1. `moduulit/<moduuli>/yleiskuvaus.md` — [`moduuli-yleiskuvaus.md`](mallipohjat/moduuli-yleiskuvaus.md)
2. `moduulit/<moduuli>/prosessit/<prosessi>.md` — kukin merkittävä prosessi,
   [`prosessikuvaus.md`](mallipohjat/prosessikuvaus.md). Mermaid-sekvenssi +
   vaihe-tunnisteet (`#vaihe-n`).
3. `moduulit/<moduuli>/datavirrat/<virta>.md` — [`datavirta.md`](mallipohjat/datavirta.md).
   Mermaid-flowchart + vaihetaulukko, jossa **kussakin solmussa hallitseva
   skeema/tyyppi ja koodille käytettävissä olevat kentät** (ei vain
   taulusarakkeet).
4. `moduulit/<moduuli>/datarakenteet/<rakenne>.md` — [`datarakenne.md`](mallipohjat/datarakenne.md).
   Paikalliset rakenteet: kentät, tyypit, lähde (SQL DDL / ORM-malli / tyyppi /
   skeematiedosto).
5. **Jaetut datamallit**: monessa moduulissa käytetyt skeemat →
   `datamallit/<nimi>.md` [`datamalli.md`](mallipohjat/datamalli.md), jos ei jo
   kuvattu. Moduulin datavirrat **linkittävät** näihin; älä kopioi skeemaa
   moduuliin.
6. **Liiketoimintakerros**: jos moduulilla on selkeä substanssiprosessi, luo
   `liiketoimintaprosessit/<prosessi>.md` — [`liiketoimintaprosessi.md`](mallipohjat/liiketoimintaprosessi.md).
   Vaihe→koodi→data-taulukko, joka linkittää yllä luotuihin teknisiin
   dokumentteihin.

Täytä jokaisen dokumentin frontmatter `lahteet`-listalla (tarkat polut projektin
juuresta).

### Vaihe E — Viimeistely

- `git-viite`: hae `git -C .. rev-parse --short HEAD` ja merkitse
  frontmatteriin.
- Merkitse `tila: valmis` niille dokumenteille, joissa ei ole avoimia TODOja.
- Lisää moduulin `yleiskuvaus.md`:n "Dokumentit"-osioon linkit kaikkiin
  syntyneisiin dokumentteihin.

---

## Päivitystila

Käytä tätä kun `moduulit/<moduuli>/` on jo olemassa. **Älä kirjoita uudestaan
alusta** — päivitä paikallaan.

### Vaihe P1 — Mitä muuttui?

- Jos toteutat tiketin päätteeksi: kosketetut tiedostot tiedät jo.
- Muuten vertaa dokumenttien `git-viite`-arvoa nykytilaan:
  `git -C .. diff --name-only <git-viite>..HEAD -- <moduulin-polku>/`

### Vaihe P2 — Mitkä dokumentit koskettaa?

Etsi ne dokumentit, joiden frontmatter-`lahteet` osuu muuttuneisiin polkuihin:

```
grep -rl "<muuttunut/polku>" moduulit liiketoimintaprosessit jarjestelmaprosessit --include='*.md'
```

### Vaihe P3 — Päivitä vain osuvat kohdat

- Säilytä rungon otsikot ja **vaihe-tunnisteet** ennallaan.
- Päivitä vain muuttuneet vaiheet/kentät/kaaviot.
- Jos prosessiin tuli uusi vaihe, lisää se; **älä uudelleennumeroi** vanhoja
  tunnisteita (lisää esim. `#vaihe-3b`), jotta linkit eivät rikkoudu.
- Päivitä `paivitetty` ja `git-viite`. Täydennä `lahteet` jos lähdejoukko
  muuttui.
- Jos lähde on **poistettu**, poista viittaus ja päivitä kuvaus; jos koko kohde
  poistui, merkitse `tila: vanhentunut` ja kysy käyttäjältä poistetaanko dokki.

---

## Vaihe F — Päivitä tila ja loki (aina)

1. `tila/rekisteri.yaml`: aseta moduulin `tila` (`valmis`/`kesken`) ja
   `paivitetty`.
2. Lisää rivi [`../tila/edistyminen.md`](../tila/edistyminen.md): pvm, moduuli,
   mitä tehtiin (luonti/päivitys), git-viite. Tämä on se, mistä seuraava sessio
   tietää missä mentiin. Kirjaa myös **kartoituksen katveet** ja avoimet TODOt —
   ne ovat seuraavan session tärkein tieto.
3. Aja `node tyokalut/kalibroi.mjs`, jotta kalibrointiraportin luvut
   (kattavuus, TODO-tiheys, lähdepolut) vastaavat uutta tilaa.

> **Versionhallinta:** älä committaa tuloksia itse. Kerro mitä tiedostoja
> muuttui ja ehdota commitia — `git add`/`git commit` vaatii kehittäjän
> hyväksynnän ([`konventiot.md`](konventiot.md) kohta 9).
