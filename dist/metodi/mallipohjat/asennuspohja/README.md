# Asennuspohja

Tässä hakemistossa ovat koskemattomat versiot niistä tiedostoista, jotka
muuttuvat projektikohtaisiksi käyttöönotossa (`/vnetcon-init`) ja dokumentoinnissa.
Moniprojekti-MCP luo näistä uuden managed-työtilan, joten työtilan voi luoda
myös jo käyttöönotetusta `vnetcon-docs`-asennuksesta ilman, että sen projektin
tila tai dokumentit kopioituvat toiseen projektiin.

| Pohja | Kohde työtilassa |
|---|---|
| `tila/*.yaml`, `tila/edistyminen.md` | `tila/` (paitsi `tila/metodi.yaml`, joka on moottoria) |
| `metodi/kartoitus.md`, `metodi/sanasto.md`, `metodi/ohjaus.md` | `metodi/` |
| `johdanto.md` | `johdanto.md` |
| `claude-settings.json` | `.claude/settings.json` |

Älä muokkaa näitä tiedostoja projektissa. Ne päivittyvät paketin mukana, ja
lähderepon savutesti varmistaa, että ne vastaavat paketin alkuperäisiä tiedostoja.
