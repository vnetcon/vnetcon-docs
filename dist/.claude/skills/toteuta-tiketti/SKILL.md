---
name: toteuta-tiketti
description: Toteuta rajattu koodimuutos (tiketti) käyttäen vnetcon-docs-dokumentaatiota kontekstipohjana. Kysyy muutaman ydinasian, kokoaa kontekstin automaattisesti, suunnittelee ja iteroi, pyytää hyväksynnän ennen koodimuutoksia, toteuttaa ja päivittää dokumentaation lopuksi. Jos suunnitelma tuli toisesta sessiosta, tarkistaa sen koodia vasten ja esittää eriävät näkemykset kehittäjälle ennen toteutusta. Käytä kun toteutetaan tiketti tai rajattu muutos projektiin.
---

# Toteuta tiketti (vaiheet 0–5)

Ohjaa tiketin toteutusta niin, että kehittäjän ei tarvitse itse koota
kontekstia. Dokumentaatio toimii kontekstipohjana.

## Toimi näin

1. **Lue menettely:** `metodi/tiketti-tyonkulku.md` (vaiheet 0–5),
   `metodi/konventiot.md` ja `tila/projekti.yaml` (testi-/buildkomennot).
2. **Tarkista onko valmistelu tehty.** Jos `tiketit/<tunnus>/codex-kehote.md`
   (tai `suunnitelma.md` hyväksyntämerkinnällä) on olemassa, vaiheet 0–3 on
   tehty toisessa sessiossa: lue `tiketti.md`, `konteksti.md`, `suunnitelma.md`
   ja **siirry vaiheeseen 3b** — älä suunnittele uudelleen, mutta älä myöskään
   aloita koodaamista suoraan.
3. **Vaihe 3b — vastaanottoportti** (kun suunnitelma tuli tiedostosta):
   tarkista suunnitelma **koodia vasten** (polut `git -C .. ls-files`illä,
   oletukset rajapinnoista, kutsujat, testit) ja esitä kehittäjälle kolme
   kohtaa: **toteutus** (3–5 riviä), **eriävät kohdat** perusteluineen ja omine
   ehdotuksinesi, **avoimet kysymykset**. Pysähdy ja odota eksplisiittistä
   lupaa; keskustele niin monta kierrosta kuin tarvitaan. Kirjaa portin tulos
   `tiketit/<tunnus>/vastaanotto.md`. Erimielisyys ratkotaan tässä sessiossa
   kehittäjän kanssa; muuttunut suunnitelma toteutetaan `vastaanotto.md`:n
   mukaan. Vaiheeseen 2 palataan vain, jos perusratkaisu ei päde.
4. **Muuten (suunnittelet itse) noudata vaiheita järjestyksessä:**
   - Vaihe 0 — kevyt vastaanotto (4 kysymystä `AskUserQuestion`illa)
   - Vaihe 1 — kokoa konteksti dokumentaatiosta, esitä kehittäjälle
   - Vaihe 2 — suunnittele ja iteroi (ei vielä koodimuutoksia)
   - Vaihe 3 — **hyväksyntäportti: käytä plan modea**, odota eksplisiittistä lupaa
   - (3b ei sovellu: hyväksyntä annettiin täydellä kontekstilla)
   - Vaihe 4 — toteuta hyväksytyn suunnitelman mukaan, aja testit/buildit
   - Vaihe 5 — sulje silmukka: päivitä dokumentaatio + `lopputulos.md`
5. **Tallenna työ** hakemistoon `tiketit/<tunnus>/` sitä mukaa kuin etenet
   (tiketti.md, konteksti.md, suunnitelma.md, vastaanotto.md, lopputulos.md),
   jotta työhön voi palata ja agentti voi vaihtua.

## Invariantit

- **Älä koske koodiin ennen vaiheen 3 hyväksyntää** — tai kun suunnitelma tuli
  tiedostosta, ennen vaiheen 3b lupaa.
- **Valmis suunnitelma ei ole käsky.** Olet velvollinen sanomaan, jos et ole
  siitä samaa mieltä — ennen toteutusta, et sen aikana.
- Pysy tiketin skoopissa ja reunaehdoissa. Jos suunnitelma ei matkalla päde,
  **palaa vaiheeseen 2–3** — älä laajenna skooppia omin päin.
- **Raportoi testitulokset rehellisesti**, myös epäonnistuneet ajot ja ohitetut
  testit.
- **Älä aja `git add`/`commit`/`push`** ilman eksplisiittistä lupaa —
  suunnitelman hyväksyntä ei ole lupa committaamiseen.
- Viittaa vain versionhallinnassa olevaan koodiin.

Käyttäjän argumentti (jos annettu) on tiketin tunnus. Jos
`tiketit/<tunnus>/` on jo olemassa, jatka keskeytyneestä kohdasta.
