---
name: dokumentoi-jarjestelmaprosessi
description: Dokumentoi moduulirajat ylittävä end-to-end -prosessi — miten asia prosessoidaan koko järjestelmän läpi, mitä moduuleja läpäisee ja mikä data siirtyy. Käytä kun halutaan kuvata tai päivittää end-to-end -kulku useamman moduulin yli.
---

# Dokumentoi järjestelmäprosessi (end-to-end)

Kuvaa miten jokin asia prosessoidaan koko järjestelmän läpi moduulirajat
ylittäen. Ei yhden moduulin sisälogiikkaa (siihen linkitetään).

## Toimi näin

1. **Lue menettely:** `metodi/jarjestelmaprosessi-tyonkulku.md` (J1–J5),
   `metodi/konventiot.md` ja `metodi/kartoitus.md`.
2. **Rajaa kulku** (laukaisin → lopputulos). Liian laaja kulku → jaa kahteen.
3. **Jäljitä moduulien väliset kytkennät koodista** — HTTP, viestijonot,
   tiedostovarasto, jaettu tietokanta, ajastukset. Tunnista kytkennän
   **tunniste** (jonon nimi, endpoint, bucket, taulu) ja varmista se **molemmista
   päistä** (tuottaja + kuluttaja). Vain versionhallinnassa oleva koodi.
4. **Kirjoita** `jarjestelmaprosessit/<nimi>.md` mallipohjasta
   (`metodi/mallipohjat/jarjestelmaprosessi.md`): Mermaid-sekvenssi moduuleista +
   hyppytaulukko, jossa jokainen hyppy linkittää moduulin prosessiin ja dataan,
   sekä integraatiotunnistetaulukko.
5. **Päivitä** `tila/rakenne.yaml`:n `kytkennat` (kartan nuolet) ja kirjaa rivi
   `tila/edistyminen.md`:hen.

## Invariantit

- Vain versionhallinnassa oleva koodi; jos dokumentti on jo olemassa, **päivitä
  paikallaan**.
- Infrastruktuurissa määritellyt kytkennät (IaC, pilvikonsolissa tehdyt) eivät
  näy koodissa — merkitse `> TODO:` äläkä arvaa.
- **Älä committaa** ilman kehittäjän lupaa.

Käyttäjän argumentti (jos annettu) on prosessin nimi/aihe (esim. "tilauksen
käsittely").
