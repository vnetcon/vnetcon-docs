# Työnkulku: järjestelmien välinen integraatio

Tämä työnkulku kuvaa kahden tai useamman järjestelmän (Git-repon) välisen
rajapinnan **integraatiotietueeksi**. `/kuvaa-integraatio`-skill ohjaa tänne,
samoin [`katselmointi-tyonkulku.md`](katselmointi-tyonkulku.md), kun
katselmoinnissa kuvataan integraatio.

Miksi erillinen tietue: kahdessa projektissa esiintyvä sama nimi (`Customer`,
`Order`) ei tarkoita samaa käsitettä. Projektien välinen yhteys on olemassa vain,
jos se on kirjattu ihmisen hyväksymään tietueeseen. Moniprojekti-MCP tarjoaa
tietueet AI-clienteille erillään projektien omasta dokumentaatiosta
(`list_interfaces`, `get_interface`), eikä se päättele yhteyksiä samankaltaisesta
tekstistä.

---

## Vaihe I1 — Paikanna integraatiotietueiden hakemisto

Tietueet ovat MCP-työtilan `interfaces/`-hakemistossa:

1. `vnetcon.config.yaml`:n `ohjaus.integraatiot`, jos asetettu
2. muuten `mcp-tyotila/interfaces/` tässä hakemistossa

Jos kumpaakaan ei ole, MCP-työtilaa ei ole luotu. Kerro käyttäjälle, että
tietueet kuuluvat MCP-työtilaan (`vnetcon-ai mcp init`), ja kysy, luodaanko se
ensin. Älä kirjoita tietuetta muualle.

Selvitä myös työtilan projektit ja niiden `project_id`:t tiedostosta
`mcp-tyotila/multiproject-mcp.yaml`. Tietueen osapuolet viittaavat niihin.

## Vaihe I2 — Kerää tiedot

1. Lue ohjaus ([`konventiot.md`](konventiot.md) kohta 11).
2. **Tämän projektin puoli koodista:** HTTP-clientit tai reitit, viestijonot,
   tiedostosiirrot, jaetut tietokannat. Kirjaa lähteet (`source_references`) ja
   sopimus (OpenAPI, AsyncAPI, skeema), jos sellainen on versionhallinnassa.
3. **Toisen osapuolen puoli:** sen koodia ei yleensä ole käytettävissä. Käytä
   käyttäjän antamaa tietoa ja, jos MCP-työtila on käytettävissä, toisen projektin
   julkaistua dokumentaatiota. **Älä arvaa.** Puuttuva tieto kirjataan
   arvoksi `ei tiedossa` ja kysymykseksi raporttiin.
4. Kysy käyttäjältä ainakin: suunta (kuka tarjoaa, kuka käyttää), tunnistus, ja
   mitkä kentät oikeasti siirtyvät.

## Vaihe I3 — Kirjoita tietue

1. Kopioi [`mallipohjat/integraatio.yaml`](mallipohjat/integraatio.yaml)
   tiedostoksi `interfaces/<interface_id>.yaml`.
2. Täytä kentät. `data_mappings` kuvaa vastaavuudet kenttätasolla; älä väitä,
   että osapuolten tietomallit ovat sama malli.
3. Jätä `status: draft`. **Vain ihminen** muuttaa tilaksi `active` ja täyttää
   `review`-kentät. Jos käyttäjä hyväksyy tietueen tässä ajossa, täytä ne hänen
   nimellään ja päivämäärällä.
4. Linkitä tietue molempien osapuolten dokumentaatioon, jos ne ovat
   käytettävissä: lisää tämän projektin moduulin dokumenttiin maininta
   `Integraatio: <display_name> (interfaces/<interface_id>.yaml)`.

## Vaihe I4 — Loki ja raportti

1. Rivi `tila/edistyminen.md`:hen: `pvm · integraatio · <interface_id> · <status>`.
2. Kerro käyttäjälle tietueen sijainti, tila ja avoimet kysymykset.
3. Ehdota commitia. **Älä committaa ilman lupaa.** Tietue näkyy AI-chateissa
   MCP:n kautta heti, kun MCP-palvelin käynnistetään uudelleen tai uusi yhteys
   avataan; tietueita ei julkaista `publish`-komennolla.
