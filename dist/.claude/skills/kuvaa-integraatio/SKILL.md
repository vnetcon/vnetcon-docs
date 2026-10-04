---
name: kuvaa-integraatio
description: Kuvaa kahden tai useamman järjestelmän (Git-repon) välinen rajapinta integraatiotietueeksi moniprojekti-MCP:n interfaces/-hakemistoon. Kerää tämän projektin puolen koodista ja toisen osapuolen tiedot käyttäjältä tai julkaistusta dokumentaatiosta; tietue jää luonnokseksi, kunnes ihminen hyväksyy sen. Käytä kun halutaan kuvata järjestelmien välinen integraatio tai korjata sen kuvausta.
---

# Kuvaa integraatio

## Toimi näin

1. **Lue menettely:** `metodi/integraatio-tyonkulku.md` (vaiheet I1–I4) ja
   mallipohja `metodi/mallipohjat/integraatio.yaml`.
2. **Paikanna hakemisto:** `vnetcon.config.yaml` → `ohjaus.integraatiot`, muuten
   `mcp-tyotila/interfaces/`. Jos kumpaakaan ei ole, kerro että tietueet
   kuuluvat MCP-työtilaan (`vnetcon-ai mcp init`), äläkä kirjoita muualle.
3. **Kerää tiedot:** tämän projektin puoli koodista, toisen osapuolen puoli
   käyttäjältä. Älä arvaa; puuttuva tieto on `ei tiedossa` ja kysymys raporttiin.
4. **Kirjoita tietue** `interfaces/<interface_id>.yaml`, `status: draft`.
   Vain ihminen hyväksyy tilaksi `active`.
5. **Raportoi** sijainti, tila ja avoimet kysymykset.

## Invariantit

- Sama nimi kahdessa järjestelmässä ei tarkoita samaa käsitettä.
- **Älä committaa** ilman kehittäjän lupaa.

Käyttäjän argumentti on integraation nimi tai kuvaus.
