---
tunnus: <TIKETTI-123>
otsikko: <Lyhyt kuvaus>
tila: kesken            # kesken | odottaa-hyvaksyntaa | valmis | peruttu
pvm: YYYY-MM-DD
git-viite: <HEAD tiketin aloitushetkellä>
agentti: <claude | codex>
vaihe: 0                # viimeisin valmistunut vaihe (0, 1, 2, 3, 3b, 4, 4b, 5)
---

# <TIKETTI-123> — <otsikko>

> **Mallipohja.** Kopioi tiedostoksi `tiketit/<tunnus>/tiketti.md` (vaihe 0).
> Muut vaiheet omiin tiedostoihinsa: `konteksti.md` (1), `suunnitelma.md` (2–3),
> `codex-kehote.md` (3, jos työ siirtyy agentilta toiselle), `vastaanotto.md`
> (3b, toteuttajan tarkistus ja erimielisyydet), `lopputulos.md` (5).
> Menettely: [`../../metodi/tiketti-tyonkulku.md`](../../metodi/tiketti-tyonkulku.md).

## Tavoite (substanssi)

<Mitä pitää muuttua ja miksi. Kehittäjän omin sanoin, ei teknisenä ratkaisuna.>

## Hyväksymiskriteerit

> Näistä johdetaan vaiheen 2 testit. Kriteeri, jota ei saa käännettyä testiksi,
> on liian epämääräinen — tarkenna kriteeriä, älä keksi testiä sen ympärille.

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
| 2 Suunnitelma + testit | `suunnitelma.md` (sis. "Testit"-osio) | — |
| 3 Hyväksyntä | `suunnitelma.md` (merkintä) | — |
| 3b Vastaanotto | `vastaanotto.md` | — (vain jos toteuttaja ≠ suunnittelija) |
| 4 Toteutus + testiajo | koodi + testit | — |
| 4b Diagnoosi | `lopputulos.md` (testiosio) | — (vain jos testejä hylkäsi) |
| 5 Sulkeminen | `lopputulos.md` | — |
