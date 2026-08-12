---
name: toteuta-tiketti
description: Toteuta rajattu koodimuutos (tiketti) käyttäen vnetcon-docs-dokumentaatiota kontekstipohjana. Kysyy muutaman ydinasian, kokoaa kontekstin automaattisesti, suunnittelee ja iteroi, pyytää hyväksynnän ennen koodimuutoksia, toteuttaa ja päivittää dokumentaation lopuksi. Käytä kun toteutetaan tiketti tai rajattu muutos projektiin.
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
   ja **siirry suoraan vaiheeseen 4**. Älä suunnittele uudelleen.
3. **Muuten noudata vaiheita järjestyksessä:**
   - Vaihe 0 — kevyt vastaanotto (4 kysymystä `AskUserQuestion`illa)
   - Vaihe 1 — kokoa konteksti dokumentaatiosta, esitä kehittäjälle
   - Vaihe 2 — suunnittele ja iteroi (ei vielä koodimuutoksia)
   - Vaihe 3 — **hyväksyntäportti: käytä plan modea**, odota eksplisiittistä lupaa
   - Vaihe 4 — toteuta hyväksytyn suunnitelman mukaan, aja testit/buildit
   - Vaihe 5 — sulje silmukka: päivitä dokumentaatio + `lopputulos.md`
4. **Tallenna työ** hakemistoon `tiketit/<tunnus>/` sitä mukaa kuin etenet
   (tiketti.md, konteksti.md, suunnitelma.md, lopputulos.md), jotta työhön voi
   palata ja agentti voi vaihtua.

## Invariantit

- **Älä koske koodiin ennen vaiheen 3 hyväksyntää.**
- Pysy tiketin skoopissa ja reunaehdoissa. Jos suunnitelma ei matkalla päde,
  **palaa vaiheeseen 2–3** — älä laajenna skooppia omin päin.
- **Raportoi testitulokset rehellisesti**, myös epäonnistuneet ajot ja ohitetut
  testit.
- **Älä aja `git add`/`commit`/`push`** ilman eksplisiittistä lupaa —
  suunnitelman hyväksyntä ei ole lupa committaamiseen.
- Viittaa vain versionhallinnassa olevaan koodiin.

Käyttäjän argumentti (jos annettu) on tiketin tunnus. Jos
`tiketit/<tunnus>/` on jo olemassa, jatka keskeytyneestä kohdasta.
