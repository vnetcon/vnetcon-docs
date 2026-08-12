# Työnkulku: tiketin toteutus

Tämä on tiketin toteutuksen **täydellinen menettely**. Dokumentaatio
(`liiketoimintaprosessit/`, `jarjestelmaprosessit/`, `moduulit/`) toimii
kontekstipohjana, jotta kehittäjän ei tarvitse itse koota tietoja.

Menettely on **agenttiriippumaton**: sekä Claude että Codex seuraavat samoja
vaiheita. Työ voi myös jakautua kahdelle agentille — Claude valmistelee
(vaiheet 0–3, `/valmistele-tiketti`) ja Codex toteuttaa (vaiheet 4–5,
`/toteuta-tiketti`). Ks. [`agentit.md`](agentit.md).

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
> `konteksti.md` ja `suunnitelma.md` ja siirry suoraan vaiheeseen 4.

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
   `testikomento`/`buildkomento` ja alueen olemassa olevat testit.

Kirjoita `tiketit/<tunnus>/konteksti.md`: mihin prosesseihin/koodiin/dataan
muutos osuu, linkit dokumentteihin ja koodikohtiin, sekä testauspolku. **Esitä
tämä siivu kehittäjälle vahvistettavaksi/korjattavaksi** ennen kuin jatkat.

## Vaihe 2 — Suunnittele ja iteroi

- Laadi toteutussuunnitelma: mitkä tiedostot muuttuvat, miten, missä
  järjestyksessä; testit; migraatiot; riskit; rollback.
- Esitä tarkentavat kysymykset ja iteroi kehittäjän kanssa.
- **Älä tee vielä koodimuutoksia.**
- Kirjaa suunnitelma ja iteraatioiden olennaiset päätökset (mitä muuttui, miksi)
  tiedostoon `tiketit/<tunnus>/suunnitelma.md`.

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
  eksplisiittinen kielto laajentaa skooppia. Ks. [`agentit.md`](agentit.md).

## Vaihe 4 — Toteuta

> **Versionhallinta vaatii kehittäjän hyväksynnän** ([`konventiot.md`](konventiot.md)
> kohta 9). Tee koodimuutokset tiedostoihin, mutta **älä aja
> `git add`/`git commit`/`git push` ilman eksplisiittistä lupaa.** Suunnitelman
> hyväksyntä (vaihe 3) EI ole lupa committaamiseen.

- Toteuta hyväksytyn suunnitelman mukaan.
- Pysy tiketin skoopissa ja reunaehdoissa. Jos matkalla paljastuu, että
  suunnitelma ei päde, **palaa vaiheeseen 2–3** (älä laajenna skooppia omin päin).
- Aja testit / buildit projektin tapojen mukaan (`tila/projekti.yaml`).
  Raportoi tulos rehellisesti — myös epäonnistuneet ajot ja ohitetut testit.

## Vaihe 5 — Sulje silmukka (dokumentaation päivitys)

1. Tunnista kosketetut tiedostot: `git -C .. diff --name-only`.
2. Etsi dokumentit joiden `lahteet` osuu niihin ([`tyonkulku.md`](tyonkulku.md)
   vaihe P2) ja **päivitä** ne päivitystilassa (P3). Kehittäjä hyväksyy
   päivitykset kuten koodimuutoksetkin.
3. Kirjoita `tiketit/<tunnus>/lopputulos.md`: mitä toteutettiin, **linkit
   committiin / PR:ään / haaraan** (ei koodin duplikointia), testien tulos ja
   mitkä dokumentit päivitettiin. Aseta tiketin `tila: valmis`.
4. Lisää rivi `tila/edistyminen.md`:hen.

---

## Jatkaminen keskeytyneestä tiketistä

Jos `tiketit/<tunnus>/` on jo olemassa, lue sen tiedostot ja jatka siitä
vaiheesta, jota ei ole vielä viety loppuun. Vihjeet: `tiketti.md`:n `tila`,
puuttuva `suunnitelma.md` (vaihe 2 kesken), puuttuva hyväksyntämerkintä (vaihe 3
kesken), puuttuva `lopputulos.md` (vaihe 4–5 kesken).
