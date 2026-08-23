---
name: valmistele-tiketti
description: Valmistele tiketti toteutusta varten ilman koodimuutoksia — ottaa tiketin vastaan, kokoaa kontekstin dokumentaatiosta, suunnittelee ja iteroi kehittäjän kanssa, hakee hyväksynnän ja kirjoittaa valmiin toteutuskehotteen toteuttavalle agentille (esim. Codexille). Käytä kun tiketti halutaan suunnitella Claudella ja toteuttaa toisella agentilla.
---

# Valmistele tiketti (vaiheet 0–3)

Tekee tiketin **suunnittelutyön** ja jättää toteutuksen toiselle agentille.
Lopputulos on hakemisto `tiketit/<tunnus>/`, josta toteuttava agentti pystyy
jatkamaan ilman keskusteluhistoriaa.

**Et koske koodiin tässä komennossa.** Jos haluat myös toteuttaa, käytä
`/toteuta-tiketti`.

## Toimi näin

1. **Lue menettely:** `metodi/tiketti-tyonkulku.md` (vaiheet 0–3),
   `metodi/konventiot.md` ja `metodi/agentit.md` (kädenojennus). Lue myös
   `tila/projekti.yaml` (testi-/buildkomennot).
2. **Vaihe 0 — vastaanotto:** kysy `AskUserQuestion`illa neljä ydinasiaa
   (tunnus, tavoite substanssina, hyväksymiskriteerit, reunaehdot). Luo
   `tiketit/<tunnus>/tiketti.md` mallipohjasta `metodi/mallipohjat/tiketti.md`.
3. **Vaihe 1 — konteksti:** etsi osuvat liiketoiminta-, järjestelmä- ja
   moduuliprosessit sekä niiden `lahteet`-koodikohdat. Selvitä myös **miten
   muutos testataan**. Kirjoita `konteksti.md` ja **esitä se kehittäjälle
   vahvistettavaksi** ennen kuin jatkat.
4. **Vaihe 2 — suunnittele ja iteroi:** tiedostot, järjestys, testit, migraatiot,
   riskit, rollback. Kirjaa `suunnitelma.md` ja päätökset perusteluineen.
   **`suunnitelma.md`:hen tulee oma "Testit"-osio:** mitä testataan, johdettuna
   hyväksymiskriteereistä ja dokumentoidusta käyttäytymisestä — **ei koodista**,
   koska toteutusta ei vielä ole. Listaa myös olemassa olevat testit, joiden
   odotat muuttuvan. **Kysy kehittäjältä, mitä muuta pitäisi testata** — hän
   tietää tapauksia, joita et voi johtaa kriteereistä. Yksi rivi per testi
   luettavana väitteenä, ei tiedostonimenä.
5. **Vaihe 3 — hyväksyntäportti:** esitä lopullinen suunnitelma **plan modessa**
   ja odota eksplisiittistä hyväksyntää. Kirjaa hyväksyntä `suunnitelma.md`:hen.
6. **Kirjoita toteutuskehote:** `tiketit/<tunnus>/codex-kehote.md`
   (rakenne: `metodi/agentit.md`). Kehotteen pitää olla **itsenäisesti
   riittävä**: luettavat tiedostot, tehtävä, muutettavat tiedostot, reunaehdot,
   **hyväksytty testilista**, testikomennot, lopetusohje (vaihe 5 + ei committia
   + pysähdy jos suunnitelma ei päde + **ei testimuutoksia ilman lupaa**).
   **Kehotteen on aloitettava vaiheen 3b vastaanottoportilla**:
   toteuttava agentti tarkistaa suunnitelman koodia vasten, esittää toteutuksen,
   eriävät kohtansa ja avoimet kysymyksensä kehittäjälle ja odottaa lupaa ennen
   kuin koskee koodiin. Älä kirjoita kehotetta niin, että se lukee kuin käsky —
   suunnitelmasi on paras arvaus, ei totuus, ja toteuttaja näkee koodin
   tarkemmin.
7. **Kerro käynnistyskomento:**
   `./tyokalut/vnetcon-ai/vnetcon-ai toteuta <tunnus>` — ja mikä agentti sillä
   käynnistyy (`vnetcon.config.yaml` → `agentit.toteutus`).

## Invariantit

- **Ei koodimuutoksia** (`../`-puuhun ei kirjoiteta mitään). Vain
  `tiketit/<tunnus>/`-tiedostot syntyvät.
- Vain versionhallinnassa oleva koodi konteksissa; varmista polut.
- Jos alue on dokumentoimaton, kartoita se koodista ja **ehdota** alueen
  dokumentointia — älä jätä kontekstia tyhjäksi.
- **Älä committaa** ilman kehittäjän lupaa.

Jos `tiketit/<tunnus>/` on jo olemassa, jatka keskeytyneestä vaiheesta.
