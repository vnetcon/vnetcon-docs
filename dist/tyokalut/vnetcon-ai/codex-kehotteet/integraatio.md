Kuvaa järjestelmien välinen integraatio integraatiotietueeksi.

Integraatio: $ARGUMENTS

Toimi näin:

1. Lue `__VNETCON_DOCS__/metodi/integraatio-tyonkulku.md` (I1–I4) ja
   `__VNETCON_DOCS__/metodi/mallipohjat/integraatio.yaml`.
2. Paikanna hakemisto: `vnetcon.config.yaml` → `ohjaus.integraatiot`, muuten
   `__VNETCON_DOCS__/mcp-tyotila/interfaces/`. Jos sitä ei ole, kerro että
   tietueet kuuluvat MCP-työtilaan (`vnetcon-ai mcp init`), äläkä kirjoita muualle.
3. Kerää tämän projektin puoli koodista ja toisen osapuolen puoli käyttäjältä.
   Älä arvaa; puuttuva tieto on `ei tiedossa`.
4. Kirjoita `interfaces/<interface_id>.yaml` tilassa `status: draft`.
5. Raportoi sijainti, tila ja avoimet kysymykset.

Ehdottomat rajat: vain ihminen hyväksyy tilaksi `active`, **älä committaa**
ilman lupaa.
