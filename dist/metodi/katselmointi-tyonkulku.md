# Työnkulku: katselmointi (ihmisen korjaukset dokumentaatioon)

Tämä työnkulku vie katselmoinnissa tai käytössä löytyneet korjaukset oikeisiin
paikkoihin niin, että ne **säilyvät seuraavissa ajoissa**. `/katselmoi`-skill
ohjaa tänne.

Lähtötietona on mitä tahansa ihmisen antamaa palautetta: katselmoinnin
muistiinpanot, kommentit, sähköposti, puhe tai lista. Palaute voi koskea yhtä
lausetta, koko moduulia, termiä, järjestelmien välistä integraatiota tai
tekoälyn yleistä väärää oletusta.

Invariantti: **ihmisen havainto on vahvempi kuin koodista tehty päättely**, mutta
se ei ohita koodia hiljaa. Jos havainto on ristiriidassa koodin kanssa, kerro
ristiriita ja kysy ennen kuin kirjaat sen.

---

## Vaihe K1 — Lue ohjaus ja kerää havainnot

1. Lue [`konventiot.md`](konventiot.md) kohta 11, [`ohjaus.md`](ohjaus.md),
   [`sanasto.md`](sanasto.md) ja yhteinen ohjaus, jos sellainen on.
2. Pura palaute **yksittäisiksi havainnoiksi**. Yksi havainto = yksi väite, joka
   on joko oikein tai väärin.
3. Näytä havaintolista käyttäjälle ja tarkista, että tulkitsit sen oikein, ennen
   kuin muutat mitään.

## Vaihe K2 — Luokittele

Jokainen havainto kuuluu yhteen luokkaan. Luokka ratkaisee, minne korjaus
kirjataan:

| Luokka | Esimerkki | Minne |
|---|---|---|
| **Dokumentin korjaus** | "Lasku ei synny tilauksesta vaan toimituksesta." | Dokumentin teksti, vahvistettuna kohtana (K3) |
| **Yleinen väärä oletus** | "Arkisto-alkuiset taulut eivät ole käytössä missään." | [`ohjaus.md`](ohjaus.md) *Korjatut oletukset* + kaikki dokumentit, joissa oletus esiintyy |
| **Periaate** | "Älä kuvaa testidataa tuotantodatana." | [`ohjaus.md`](ohjaus.md) *Periaatteet* |
| **Termi tai käsite** | "Asiakas = sopimusasiakas, ei loppukäyttäjä." | [`sanasto.md`](sanasto.md); jos termi on yhteinen usealle järjestelmälle, yhteinen sanasto |
| **Rakenne tai sijainti** | "Laskutuslogiikka on myös `jobs/`-hakemistossa." | [`kartoitus.md`](kartoitus.md), `tila/rekisteri.yaml` tai `tila/rakenne.yaml` |
| **Järjestelmien välinen integraatio** | "Tilaukset tulevat CRM:stä REST-rajapinnan kautta." | Integraatiotietue: [`integraatio-tyonkulku.md`](integraatio-tyonkulku.md) |
| **Vastaus avoimeen kysymykseen** | "Alennussääntö johtuu kumppanisopimuksesta." | Kyseinen `> TODO: …` korvataan vastauksella, vahvistettuna kohtana |
| **Uusi avoin kysymys** | "Kukaan ei tiedä, miksi tämä ajo on yöllä." | `> TODO: substanssiosaajan vahvistus — <kysymys>` |

Jos havainto sopii useaan luokkaan (esim. yleinen väärä oletus, joka näkyy kolmessa
dokumentissa), tee kaikki.

## Vaihe K3 — Tee korjaukset

**Dokumentin korjaus ja vastaus avoimeen kysymykseen**

1. Etsi kohta: `grep -rn "<avainsana>" moduulit liiketoimintaprosessit jarjestelmaprosessit datamallit --include='*.md'`.
2. Tarkista koodista, onko havainto ristiriidassa koodin kanssa. Jos on, **kysy**.
3. Korjaa teksti ja merkitse se vahvistetuksi:

   ```markdown
   <!-- vahvistettu: YYYY-MM-DD · katselmointi · <kuka> -->
   <korjattu teksti>
   <!-- /vahvistettu -->
   ```

4. Poista korjattuun kohtaan liittyvä `> TODO: …`. Jos dokumentin kaikki
   TODO-kohdat on ratkaistu ja sisältö on katselmoitu, aseta frontmatteriin
   `tila: valmis` ja `katselmoitu: YYYY-MM-DD`.

**Yleinen väärä oletus ja periaate**

1. Lisää merkintä [`ohjaus.md`](ohjaus.md):hen seuraavalla vapaalla tunnisteella
   (`O-00n` tai `P-00n`) ja täytä kaikki kentät, myös lähde.
2. Etsi **kaikki** dokumentit, joissa oletus esiintyy, ja korjaa ne kuten yllä.
   Viittaa korjauksessa tunnisteeseen, esim. `(ohjaus O-003)`.

**Termi**

Lisää termi [`sanasto.md`](sanasto.md):hen. Jos dokumenteissa on käytetty väärää
termiä, korjaa ne. Useaa järjestelmää koskeva termi kuuluu yhteiseen sanastoon
(`mcp-tyotila/yhteiset/sanasto.md`); jos sitä ei ole, kirjaa termi projektin
sanastoon ja kerro käyttäjälle.

**Rakenne tai sijainti**

Päivitä [`kartoitus.md`](kartoitus.md):n hakukomennot tai rekisteri. Ehdota
lopuksi `/dokumentoi <moduuli>` niille moduuleille, joiden kuvaus jäi
vajaaksi väärän rakenteen takia.

**Integraatio**

Siirry [`integraatio-tyonkulku.md`](integraatio-tyonkulku.md):hen ja palaa sen
jälkeen jäljellä oleviin havaintoihin.

## Vaihe K4 — Loki ja raportti

1. Lisää rivi `tila/edistyminen.md`:hen:
   `pvm · katselmointi · <n> havaintoa · mitä korjattiin · <kuka>`.
2. Raportoi käyttäjälle taulukkona: havainto → luokka → minne kirjattiin.
   Erottele havainnot, joita **et** kirjannut (ristiriita koodin kanssa,
   epäselvä), ja syy.
3. Ehdota commitia. **Älä committaa ilman lupaa.** Jos dokumentaatio julkaistaan
   moniprojekti-MCP:llä, muistuta, että korjaukset näkyvät AI-chateissa vasta
   commitin, `refresh`- ja `publish`-komennon jälkeen.

---

## Miten korjaukset pysyvät voimassa

- **Vahvistettua kohtaa** ei muuta mikään työnkulku. Jos koodi muuttuu, kohtaan
  lisätään huomautus, ja ihminen päättää ([`konventiot.md`](konventiot.md) 11.2).
- **Ohjaus ja sanasto** luetaan ennen jokaista kirjoitusta, joten sama virhe ei
  toistu uusissa dokumenteissa ([`konventiot.md`](konventiot.md) 11.1).
- **Integraatiotietueet** ovat ihmisen hyväksymiä, ja MCP tarjoaa ne
  AI-clienteille erillään projektien omasta dokumentaatiosta.
