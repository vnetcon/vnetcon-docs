# Työnkulku: tiketin toteutus

Tämä on tiketin toteutuksen **täydellinen menettely**. Dokumentaatio
(`liiketoimintaprosessit/`, `jarjestelmaprosessit/`, `moduulit/`) toimii
kontekstipohjana, jotta kehittäjän ei tarvitse itse koota tietoja.

Menettely on **agenttiriippumaton**: sekä Claude että Codex seuraavat samoja
vaiheita. Työ voi myös jakautua kahdelle agentille — Claude valmistelee
(vaiheet 0–3, `/valmistele-tiketti`) ja Codex toteuttaa (vaiheet 3b–5,
`/toteuta-tiketti`). Ks. [`agentit.md`](agentit.md).

**Molemmat puolet ovat interaktiivisia.** Suunnittelu keskustellaan vaiheissa
1–3 ja toteutus avataan uudelleen vaiheessa 3b: toteuttava agentti tarkistaa
saamansa suunnitelman koodia vasten ja saa olla siitä eri mieltä ennen kuin
koodiin kosketaan. Kädenojennus siirtää suunnitelman, ei suunnittelijan
arvovaltaa.

**Testit ovat osa suunnitelmaa, eivät toteutuksen sivutuote.** Ne ehdotetaan
vaiheessa 2 ja hyväksytään vaiheessa 3 — ennen kuin riviäkään on kirjoitettu —
ja niitä ei muuteta myöhemmin ilman kehittäjän lupaa. Testi, jota agentti saa
muuttaa silloin kun se hylkää, ei ole riippumaton tarkistus vaan kuvaus siitä
mitä koodi sattuu tekemään.

**Kaikki vaiheet tallennetaan** hakemistoon `tiketit/<tunnus>/`, jotta työhön voi
palata, keskeytynyt työ voi jatkua toisessa sessiossa ja **agentti voi vaihtua
kesken työn**. Kirjoita tiedostot sitä mukaa kuin vaiheet etenevät — älä jätä
kirjaamista loppuun.

Invariantti kaikessa: **vain versionhallinnassa oleva koodi**; ks.
[`konventiot.md`](konventiot.md).

---

## Vaihe 0 — Vastaanotto (kevyt kyselysarja)

Kysy kehittäjältä vain nämä neljä ydinasiaa (loput päättelet dokumentaatiosta):

1. **Tiketin tunnus / linkki**
2. **Tavoite substanssina**: mitä pitää muuttua ja miksi
3. **Hyväksymiskriteerit** / valmiin määritelmä
4. **Reunaehdot**: mitä EI saa muuttua, migraatiot, yhteensopivuus, suorituskyky

Claudessa käytä `AskUserQuestion`ia; Codexissa kysy tavallisena kysymyksenä
(numeroitu lista, yksi viesti).

Luo hakemisto `tiketit/<tunnus>/` ja kirjoita vastaukset tiedostoon
`tiketti.md` (mallipohja [`mallipohjat/tiketti.md`](mallipohjat/tiketti.md);
frontmatter: `tunnus`, `otsikko`, `tila: kesken`, `pvm`, `git-viite` = nykyinen
HEAD, `agentti`).

> **Jos `tiketit/<tunnus>/codex-kehote.md` (tai vastaava valmis kehote) on jo
> olemassa**, vaiheet 0–3 on tehty toisessa sessiossa: lue `tiketti.md`,
> `konteksti.md` ja `suunnitelma.md` ja siirry **vaiheeseen 3b** (et suoraan
> toteutukseen).

## Vaihe 1 — Kokoa konteksti automaattisesti

Päättele tiketin tavoitteesta, mihin järjestelmän osaan muutos osuu:

1. Etsi osuva **liiketoimintaprosessi** ja sen kautta järjestelmä- ja
   moduuliprosessit.
2. Etsi osuvat dokumentit myös hakusanoilla:
   ```
   grep -rln "<avainsana>" moduulit liiketoimintaprosessit jarjestelmaprosessit datamallit --include='*.md'
   ```
3. Kerää dokumenttien `lahteet`-poluista **konkreettiset koodikohdat**, joita
   muutos todennäköisesti koskee. Varmista polut `git -C .. ls-files`illä.
4. Jos aluetta **ei ole vielä dokumentoitu**, kartoita se koodista suoraan
   ([`tyonkulku.md`](tyonkulku.md) vaihe C + [`kartoitus.md`](kartoitus.md)) ja
   harkitse alueen dokumentointia osana tikettiä.
5. Selvitä myös **miten muutos testataan**: `tila/projekti.yaml`:n
   `komennot.testi`/`komennot.build`, `testit.lahtotaso` (mitkä testit olivat
   ennestään punaisia) ja **mitkä olemassa olevat testit kattavat muutosalueen**.
   Jos yksikään ei kata sitä, sano se ääneen — se on tiketin riskitieto, ei
   sivuseikka.

Kirjoita `tiketit/<tunnus>/konteksti.md`: mihin prosesseihin/koodiin/dataan
muutos osuu, linkit dokumentteihin ja koodikohtiin, sekä testauspolku. **Esitä
tämä siivu kehittäjälle vahvistettavaksi/korjattavaksi** ennen kuin jatkat.

## Vaihe 2 — Suunnittele ja iteroi

- Laadi toteutussuunnitelma: mitkä tiedostot muuttuvat, miten, missä
  järjestyksessä; migraatiot; riskit; rollback.
- **Ehdota testit — ennen toteutusta** (oma osionsa, ks. alla).
- Esitä tarkentavat kysymykset ja iteroi kehittäjän kanssa.
- **Älä tee vielä koodimuutoksia.**
- Kirjaa suunnitelma ja iteraatioiden olennaiset päätökset (mitä muuttui, miksi)
  tiedostoon `tiketit/<tunnus>/suunnitelma.md`.

### Testit ehdotetaan ennen toteutusta

`suunnitelma.md` sisältää osion **"Testit"**, jossa kerrotaan mitä tullaan
testaamaan — *ennen kuin riviäkään on kirjoitettu*. Kehittäjä hyväksyy sen
vaiheessa 3 samalla kuin muun suunnitelman.

Syy on rakenteellinen: **testiä ei voi johtaa toteutuksesta, jos toteutusta ei
ole.** Toteutuksesta johdettu testi väittää sen mitä koodi tekee, ei sitä mitä
sen pitäisi tehdä — ja läpäisee määritelmällisesti, myös bugin kanssa.

1. **Johda testit hyväksymiskriteereistä** (`tiketti.md`) **ja dokumentoidusta
   käyttäytymisestä** (`moduulit/<moduuli>/prosessi*.md`) — **älä koodista.**
   Jos jotain hyväksymiskriteeriä ei saa käännettyä testiksi, kriteeri oli
   epämääräinen: korjaa kriteeri, älä keksi testiä sen ympärille.
2. **Listaa myös olemassa olevat testit, joiden odotat muuttuvan** ja miksi.
   Ennustettu testimuutos on rutiinia; yllättävä testimuutos vaiheessa 4 on
   merkki siitä, että tämä suunnitelma oli väärässä.
3. **Kysy kehittäjältä, mitä muuta pitäisi testata.** Portti on kaksisuuntainen:
   kehittäjä tietää usein tapauksen, jota et voi johtaa kriteereistä etkä
   dokumenteista — juuri sitä laitostietoa, jota dokumentaatio yrittää pelastaa.
4. **Pysy tiketin skoopissa:** testataan tämän tiketin muutos, ei koko moduulia.
   Testit ovat luonnollinen skoopin laajenemisreitti.
5. Jos alue on testitön ja kehittäjä ei halua testejä tähän tikettiin, **kirjaa
   päätös ja perustelu** — velka tehdään näkyväksi, ei ohiteta hiljaa.

Muoto: yksi rivi per testi, ihmisen luettavana väitteenä eikä tiedostonimenä —
*"hylkää hyvityksen, joka on suurempi kuin alkuperäinen maksu"*. Tämä on koko
työnkulun **helpoin katselmoitava kohta**: suunnitelman arviointi vaatii tietoa
siitä miten järjestelmä on rakennettu, testilistan arviointi vain siitä mitä sen
pitäisi tehdä.

## Vaihe 3 — Hyväksyntäportti

Esitä lopullinen suunnitelma ja **odota kehittäjän eksplisiittistä hyväksyntää**
ennen toteutusta. Ilman hyväksyntää ei kosketa koodiin. Kirjaa hyväksyntä
(kuka, milloin, mitä hyväksyttiin) `suunnitelma.md`:hen.

- **Claudessa:** käytä plan modea.
- **Codexissa:** esitä suunnitelma ja pyydä selkeä "toteuta"-vahvistus. Älä
  käytä täysin automaattista tilaa tämän portin ohittamiseen.
- **Jos työ siirretään toiselle agentille tässä kohdassa** (Claude → Codex),
  kirjoita `tiketit/<tunnus>/codex-kehote.md`: tehtävä, hyväksytty suunnitelma
  tiivistettynä, muutettavat tiedostot, reunaehdot, testikomennot ja
  eksplisiittinen kielto laajentaa skooppia. **Kehotteen on käskettävä aloittaa
  vaiheesta 3b**, ei toteutuksesta. Ks. [`agentit.md`](agentit.md).

## Vaihe 3b — Vastaanottoportti (kun suunnitelma tulee tiedostosta)

Tämä vaihe koskee **toteuttavaa agenttia silloin, kun se ei itse suunnitellut** —
eli suunnitelma tulee `suunnitelma.md`/`codex-kehote.md`-tiedostosta, ei
keskustelusta. Silloin **koodiin ei kosketa suoraan.**

Syy on kokemusperäinen: valmisteleva agentti kirjoittaa suunnitelman lukemalla
koodia, toteuttava agentti muuttaa sitä — ja ne ovat säännöllisesti eri mieltä
ratkaisusta. Erimielisyys on hyödyllistä vain jos se tulee esiin **ennen**
toteutusta. Hyväksytty suunnitelma on paras tiedossa oleva arvaus, ei totuus.

Tee tässä järjestyksessä:

1. **Lue** `tiketti.md`, `konteksti.md`, `suunnitelma.md` (ja saatu kehote).
2. **Tarkista suunnitelma koodia vasten** — älä luota kehotteeseen:
   - ovatko mainitut polut olemassa (`git ls-files`) ja sisältävätkö ne sen mitä
     suunnitelma väittää
   - pitävätkö oletukset rajapinnoista, tyypeistä, kutsujista ja testeistä
   - onko suunnitelma toteutettavissa sellaisenaan ja täyttääkö se
     hyväksymiskriteerit
   - mikä rikkoutuu, mitä suunnitelmassa ei mainita (kutsujat, migraatiot, testit)
   - **ovatko suunnitelman "Testit"-osion testit kirjoitettavissa esitetyssä
     muodossa** — onko niillä tarvittavat kiinnikkeet koodissa, ja pitääkö
     paikkansa väite siitä, mitkä olemassa olevat testit kattavat alueen. Tämä on
     kohta, jossa suunnittelija erehtyy usein: hän ei ole ajanut mitään.
3. **Esitä kehittäjälle nämä kolme kohtaa — ja pysähdy:**
   - **Toteutus:** 3–5 riviä siitä miten aiot suunnitelman toteuttaa
   - **Eriävät kohdat:** mistä olet eri mieltä, miksi, ja oma ehdotuksesi. Jos et
     ole mistään eri mieltä, sano se — älä keksi erimielisyyttä muodon vuoksi.
   - **Avoimet kysymykset:** mitä pitää ratkaista ennen kuin voi jatkaa
4. **Odota eksplisiittistä lupaa** ("jatka" / "toteuta"). Keskustele niin monta
   kierrosta kuin tarvitaan — portti on kaksisuuntainen: myös kehittäjä korjaa
   sinun tulkintaasi, ei vain sinä suunnitelmaa.
5. **Kirjaa** `tiketit/<tunnus>/vastaanotto.md`: mitä tarkistit, mistä olit eri
   mieltä, mitä päätettiin ja kuka hyväksyi. Tämä on ainoa jälki siitä, että
   suunnitelma muuttui matkalla.

### Miten erimielisyys ratkaistaan

**Erimielisyys ratkotaan lähtökohtaisesti tässä samassa sessiossa toteuttavan
agentin kanssa.** Kehittäjä voi kertoa 3b:ssä miten asia kannattaa tehdä, ja
toteuttavan agentin ehdotus voidaan hyväksyä sellaisenaan — paluu edelliseen
vaiheeseen on poikkeus, ei sääntö. Portti on kehittäjän, ei kummankaan agentin:
toteuttavan agentin ehdotus on ehdotus samalla tavalla kuin valmistelevan
agentin suunnitelma on ehdotus, ja kehittäjä päättää kumpi pätee.

Kolme lopputulosta:

| Erimielisyys | Mitä tehdään | Kirjaus |
|--------------|--------------|---------|
| **Ei erimielisyyttä tai vain yksityiskohta** | Sovitaan 3b:ssä, siirrytään vaiheeseen 4 | `vastaanotto.md` |
| **Suunnitelma muuttuu, perusratkaisu pitää** | Sovitaan 3b:ssä toteuttavan agentin kanssa ja jatketaan vaiheeseen 4 — **tavallisin tapaus**, ei paluuta valmistelevalle agentille | `vastaanotto.md` (muutos + perustelu) |
| **Perusratkaisu ei päde** | Palaa vaiheeseen 2 | `suunnitelma.md` päivitetään |

Kun suunnitelma muuttuu 3b:ssä, **`vastaanotto.md` on se, minkä mukaan
toteutetaan** — `suunnitelma.md` jää siihen muotoon, jossa se hyväksyttiin
vaiheessa 3, ja ero näiden välillä on tarkoituksellinen audit-jälki. Päivitä
`suunnitelma.md` vain, jos palataan vaiheeseen 2.

**Vaiheeseen 2 palataan ensisijaisesti tässä sessiossa** — toteuttava agentti
suunnittelee uudelleen kehittäjän kanssa. Tiketti palautetaan valmistelevalle
agentille vain, jos uudelleensuunnittelu vaatii kontekstia, jota toteuttavalla
agentilla ei ole: laaja kartoitus usean moduulin yli, vaikutus dokumentaatioon
tai liiketoimintaprosesseihin, tai muutos, joka muuttaa tiketin rajausta.

Älä missään tapauksessa toteuta suunnitelmaa, jonka tiedät vääräksi, vain koska
se on hyväksytty.

> **Portti ei toistu, jos sama sessio teki vaiheet 0–3.** Silloin hyväksyntä
> vaiheessa 3 annettiin täydellä kontekstilla, ja 3b olisi sama kysely uudestaan.
> Kirjaa `vastaanotto.md`:hen tällöin vain rivi "sama sessio suunnitteli — 3b ei
> sovellu", tai jätä tiedosto luomatta.

## Vaihe 4 — Toteuta

> **Versionhallinta vaatii kehittäjän hyväksynnän** ([`konventiot.md`](konventiot.md)
> kohta 9). Tee koodimuutokset tiedostoihin, mutta **älä aja
> `git add`/`git commit`/`git push` ilman eksplisiittistä lupaa.** Suunnitelman
> hyväksyntä (vaihe 3) EI ole lupa committaamiseen.

- Toteuta hyväksytyn suunnitelman mukaan — ja jos vaihe 3b muutti sitä, sen
  mukaan kuin vaiheessa 3b sovittiin (`vastaanotto.md`).
- Pysy tiketin skoopissa ja reunaehdoissa. Jos matkalla paljastuu, että
  suunnitelma ei päde, **palaa vaiheeseen 2–3** (älä laajenna skooppia omin päin).
- **Kirjoita vaiheessa 2 hyväksytyt testit.** Ei muita: hyväksytty testilista on
  testien skooppi samalla tavalla kuin suunnitelma on koodin skooppi.
- **Aja testit / buildit** projektin tapojen mukaan (`tila/projekti.yaml` →
  `komennot`). Raportoi tulos rehellisesti — myös epäonnistuneet ajot, ohitetut
  testit ja ajot jotka eivät käynnistyneet lainkaan.

### Testien muuttaminen vaatii aina luvan

**Älä muuta äläkä poista yhtäkään testiä ilman kehittäjän eksplisiittistä
lupaa.** Tämä koskee myös testejä, jotka kirjoitit itse tässä tiketissä: ne
hyväksyttiin vaiheessa 3, joten ne eivät ole enää sinun luonnoksiasi.

Sääntö on ehdoton, eikä siihen ole poikkeusta "puhtaasti mekaanisille"
korjauksille. Raja mekaanisen korjauksen ja assertionin hiljaisen löysentämisen
välillä on täsmälleen se, jota et pysty tässä tilanteessa luotettavasti
arvioimaan. Kustannukset ovat epäsymmetriset: luvan kysyminen maksaa yhden rivin
keskustelua, väärin heikennetty testi maksaa hiljaisesti ja pysyvästi. Esitä
tarvittavat testimuutokset **erässä**, älä yksi kerrallaan.

Jos testi on ennestään punainen (`tila/projekti.yaml` → `testit.ennestaan_punaiset`),
se ei ole poikkeus: sitäkään ei korjata ilman lupaa, mutta sen hylkääminen ei
myöskään ole sinun aiheuttamasi.

### Vaihe 4b — Diagnosoi ero, älä korjaa sitä pois

Kun testi hylkää, vaihtoehtoja on kolme, ja **sinun tehtäväsi on nimetä mikä
niistä — ei valita kehittäjän puolesta:**

| Diagnoosi | Toimi |
|-----------|-------|
| **Koodi on väärin** | Korjaa koodi. Ei erillistä lupaa — se kuuluu tikettiin. |
| **Testi on väärin** | **Kysy kehittäjältä.** Esitä näkemyksesi, mutta päätös on hänen. |
| **Suunnitelma on väärin** | Palaa vaiheeseen 2–3. |

**Vertaa lähtötasoon, älä absoluuttiseen vihreyteen.** Lue
`tila/projekti.yaml` → `testit`:

- hylätty nimi, jota **ei** ole `ennestaan_punaiset`-listalla → **rikoit sen**
- hylätty nimi, joka **on** listalla → ennestään punainen, konteksti eikä tapahtuma
- listalla ollut nimi, joka nyt menee läpi → korjaantui, kirjaa `lopputulos.md`:hen

Sama määrä hylättyjä eri nimillä tarkoittaa, että **molemmat tapahtuivat**. Siksi
vertailu tehdään nimijoukkona eikä lukumääränä.

Kun kysyt "onko vika testissä vai koodissa", **kysymys on esitettävä niin että
siihen voi vastata.** Pelkkä tuomio ei riitä — tarvitaan todisteet:

```
Testi odottaa pyöristettyä arvoa (spec/maksut/refund_spec.rb:12).
Koodi katkaisee (src/maksut/hyvitys.rb:88).
Tiketin hyväksymiskriteerit eivät ota kantaa.
moduulit/maksut/prosessi-hyvitys.md sanoo "pyöristetty", lähde hyvitys.rb:40.
Oma näkemykseni: koodi on väärässä. Varaus: dokumentti on vuodelta 2024.
```

Matalan osaamisen tilanteessa kehittäjän kyky päättää riippuu täysin siitä,
miten kysymys on muotoiltu. Portin laatu **on** kysymyksen laatu.

> **Yllättävä testimuutos on suunnitelman vika, ei testin.** Jos vaiheessa 4
> joudutaan toistuvasti muuttamaan testejä, joiden muuttumista vaihe 2 ei
> ennustanut, ongelma on suunnitteluvaiheessa. Sano se ääneen.

## Vaihe 5 — Sulje silmukka (dokumentaation päivitys)

1. Tunnista kosketetut tiedostot: `git -C .. diff --name-only`.
2. Etsi dokumentit joiden `lahteet` osuu niihin ([`tyonkulku.md`](tyonkulku.md)
   vaihe P2) ja **päivitä** ne päivitystilassa (P3). Kehittäjä hyväksyy
   päivitykset kuten koodimuutoksetkin.
3. Kirjoita `tiketit/<tunnus>/lopputulos.md`: mitä toteutettiin, **linkit
   committiin / PR:ään / haaraan** (ei koodin duplikointia) ja mitkä dokumentit
   päivitettiin. Aseta tiketin `tila: valmis`.
4. **Kirjaa testit omana osionaan** `lopputulos.md`:hen:
   - **lisätyt** testit
   - **muutetut** testit: mikä muuttui, miksi, ja **kuka antoi luvan**
   - **ennestään punaiset, jotka korjaantuivat** (poistuvat lähtötasolta)
   - **uudet hylätyt**, jos jäi sellaisia, ja miksi ne jäivät
   - ajon lopputila verrattuna lähtötasoon
5. **Jos lähtötaso muuttui**, päivitä `tila/projekti.yaml` → `testit`
   (`ennestaan_punaiset`, `lapi`, `pvm`, `git-viite`). Muuten seuraava tiketti
   vertaa vanhentuneeseen tietoon.
6. Lisää rivi `tila/edistyminen.md`:hen.

---

## Jatkaminen keskeytyneestä tiketistä

Jos `tiketit/<tunnus>/` on jo olemassa, lue sen tiedostot ja jatka siitä
vaiheesta, jota ei ole vielä viety loppuun. Vihjeet: `tiketti.md`:n `tila`,
puuttuva `suunnitelma.md` (vaihe 2 kesken), puuttuva hyväksyntämerkintä (vaihe 3
kesken), `suunnitelma.md` ilman "Testit"-osiota (vaihe 2 kesken), puuttuva
`vastaanotto.md` vaikka suunnitelma on hyväksytty toisessa sessiossa (vaihe 3b
kesken), puuttuva `lopputulos.md` (vaihe 4–5 kesken).
