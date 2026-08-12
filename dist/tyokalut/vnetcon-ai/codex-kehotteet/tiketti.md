Toteuta tiketti tämän projektin vnetcon-docs-menettelyn mukaan.

Tiketin tunnus: $ARGUMENTS

Toimi näin:

1. Lue `__VNETCON_DOCS__/metodi/tiketti-tyonkulku.md` (vaiheet 0–5) ja
   `__VNETCON_DOCS__/metodi/konventiot.md`. Lue myös
   `__VNETCON_DOCS__/tila/projekti.yaml` (testi- ja buildkomennot).
2. Jos `__VNETCON_DOCS__/tiketit/<tunnus>/` on olemassa, lue kaikki sen
   tiedostot ja **jatka siitä vaiheesta, joka on kesken**. Jos hakemistossa on
   `codex-kehote.md`, suunnitelma on jo hyväksytty — toteuta se (vaiheet 4–5)
   äläkä suunnittele uudelleen.
3. Muuten aloita vaiheesta 0: kysy tunnus, tavoite, hyväksymiskriteerit ja
   reunaehdot yhtenä numeroituna kysymyssarjana.
4. Kirjoita jokainen vaihe tiedostoon sitä mukaa kuin etenet, jotta työhön voi
   palata ja agentti voi vaihtua.

Ehdottomat rajat:

- **Älä koske koodiin ennen kuin suunnitelma on eksplisiittisesti hyväksytty.**
- **Älä aja `git add`/`git commit`/`git push` ilman erillistä lupaa** — myös
  suunnitelman hyväksyntä ei ole lupa committaamiseen.
- Pysy tiketin skoopissa. Jos suunnitelma ei päde, pysähdy ja kysy.
- Viittaa vain versionhallinnassa olevaan koodiin (`git ls-files`).
- Raportoi testitulokset rehellisesti, myös epäonnistumiset.
