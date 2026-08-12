---
tunnus: <TIKETTI-123>
otsikko: <Lyhyt kuvaus>
tila: kesken            # kesken | odottaa-hyvaksyntaa | valmis | peruttu
pvm: YYYY-MM-DD
git-viite: <HEAD tiketin aloitushetkellä>
agentti: <claude | codex>
vaihe: 0                # viimeisin valmistunut vaihe (0–5)
---

# <TIKETTI-123> — <otsikko>

> **Mallipohja.** Kopioi tiedostoksi `tiketit/<tunnus>/tiketti.md` (vaihe 0).
> Muut vaiheet omiin tiedostoihinsa: `konteksti.md` (1), `suunnitelma.md` (2–3),
> `codex-kehote.md` (3, jos työ siirtyy agentilta toiselle), `lopputulos.md` (5).
> Menettely: [`../../metodi/tiketti-tyonkulku.md`](../../metodi/tiketti-tyonkulku.md).

## Tavoite (substanssi)

<Mitä pitää muuttua ja miksi. Kehittäjän omin sanoin, ei teknisenä ratkaisuna.>

## Hyväksymiskriteerit

- [ ] <tarkistettavissa oleva ehto>
- [ ] <…>

## Reunaehdot

- **Ei saa muuttua:** <rajapinnat, käytös, suorituskyky>
- **Migraatiot:** <tarvitaanko, onko taaksepäin yhteensopiva>
- **Yhteensopivuus:** <asiakkaat, versiot, muut moduulit>
- **Muut:** <aikataulu, riippuvuudet toisiin tiketteihin>

## Lähteet

- Tiketti: <linkki>
- Keskustelut/päätökset: <linkit>

## Vaiheiden tila

| Vaihe | Tiedosto | Tila |
|-------|----------|------|
| 0 Vastaanotto | `tiketti.md` | valmis |
| 1 Konteksti | `konteksti.md` | — |
| 2 Suunnitelma | `suunnitelma.md` | — |
| 3 Hyväksyntä | `suunnitelma.md` (merkintä) | — |
| 4 Toteutus | koodi | — |
| 5 Sulkeminen | `lopputulos.md` | — |
