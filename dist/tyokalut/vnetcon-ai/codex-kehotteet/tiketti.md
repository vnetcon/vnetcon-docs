Toteuta tiketti tämän projektin vnetcon-docs-menettelyn mukaan.

Tiketin tunnus: $ARGUMENTS

Toimi näin:

1. Lue `__VNETCON_DOCS__/metodi/tiketti-tyonkulku.md` (vaiheet 0–5) ja
   `__VNETCON_DOCS__/metodi/konventiot.md`. Lue myös
   `__VNETCON_DOCS__/tila/projekti.yaml` (testi- ja buildkomennot).
2. Jos `__VNETCON_DOCS__/tiketit/<tunnus>/` on olemassa, lue kaikki sen
   tiedostot ja **jatka siitä vaiheesta, joka on kesken**. Jos hakemistossa on
   `codex-kehote.md`, suunnitelma on jo hyväksytty — älä suunnittele uudelleen,
   mutta **aloita vaiheesta 3b (vastaanottoportti), et toteutuksesta**:
   tarkista suunnitelma koodia vasten ja esitä kehittäjälle (a) miten aiot
   toteuttaa sen 3–5 rivillä, (b) mistä olet eri mieltä ja miksi, (c) avoimet
   kysymykset. Pysähdy ja odota "jatka". Kirjaa tulos `vastaanotto.md`:hen.
3. Muuten aloita vaiheesta 0: kysy tunnus, tavoite, hyväksymiskriteerit ja
   reunaehdot yhtenä numeroituna kysymyssarjana.
4. Kirjoita jokainen vaihe tiedostoon sitä mukaa kuin etenet, jotta työhön voi
   palata ja agentti voi vaihtua.

Ehdottomat rajat:

- **Älä koske koodiin ennen kuin suunnitelma on eksplisiittisesti hyväksytty** —
  ja jos suunnitelma tuli tiedostona toisesta sessiosta, ennen kuin olet käynyt
  vaiheen 3b vastaanottoportin ja saanut luvan jatkaa.
- **Valmis suunnitelma ei ole käsky.** Jos olet siitä eri mieltä, sano se ennen
  toteutusta — se on nimenomaan sinun tehtäväsi tässä vaiheessa.
- **Älä aja `git add`/`git commit`/`git push` ilman erillistä lupaa** — myös
  suunnitelman hyväksyntä ei ole lupa committaamiseen.
- Pysy tiketin skoopissa. Jos suunnitelma ei päde, pysähdy ja kysy.
- Viittaa vain versionhallinnassa olevaan koodiin (`git ls-files`).
- **Testit ehdotetaan ennen toteutusta.** Jos suunnittelet itse, `suunnitelma.md`
  saa oman "Testit"-osion: mitä testataan, johdettuna hyväksymiskriteereistä ja
  dokumentaatiosta — **ei koodista**. Kysy myös kehittäjältä, mitä muuta pitäisi
  testata.
- **Älä muuta äläkä poista yhtäkään testiä ilman kehittäjän lupaa**, et myöskään
  itse kirjoittamiasi: ne hyväksyttiin vaiheessa 3. Ei poikkeusta "mekaanisille"
  korjauksille — esitä testimuutokset erässä perusteluineen.
- **Kun testi hylkää, nimeä diagnoosi äläkä valitse puolestasi:** koodi väärin →
  korjaa; testi väärin → **kysy kehittäjältä ja esitä todisteet** (mitä testi
  odottaa, mitä koodi tekee, mitä kriteerit ja dokumentaatio sanovat);
  suunnitelma väärin → palaa vaiheeseen 2.
- Raportoi testitulokset rehellisesti, myös epäonnistumiset. Vertaa
  `__VNETCON_DOCS__/tila/projekti.yaml` → `testit.ennestaan_punaiset`
  -**nimijoukkoon**, älä hylättyjen lukumäärään.
