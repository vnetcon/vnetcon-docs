# Työnkulku: järjestelmäprosessi (end-to-end, moduulirajat ylittävä)

Kuvaa miten jokin asia prosessoidaan **koko järjestelmän läpi** (esim. tilauksen
käsittely): mistä alkaa, mitä moduuleja läpäisee ja missä järjestyksessä, ja mikä
data siirtyy kussakin hypyssä. `/dokumentoi-jarjestelmaprosessi`-skill ohjaa tänne.

Tuotos: `jarjestelmaprosessit/<nimi>.md` (mallipohja
[`mallipohjat/jarjestelmaprosessi.md`](mallipohjat/jarjestelmaprosessi.md)).

Invariantti: **vain versionhallinnassa oleva koodi**; ks.
[`konventiot.md`](konventiot.md). Jos dokumentti on jo olemassa →
**päivitystila** (ks. [`tyonkulku.md`](tyonkulku.md)).

---

## Vaihe J1 — Rajaa kulku

Määritä laukaisin ja lopputulos (esim. "käyttäjä lähettää tilauksen" →
"tilaus on toimituksessa ja laskutettu"). Tämä rajaa ketjun. Jos kulku on liian
laaja, jaa se kahteen.

## Vaihe J2 — Jäljitä moduulien väliset kytkennät koodista

Selvitä hypyt — miten moduuli kutsuu seuraavaa. Käytä [`kartoitus.md`](kartoitus.md):n
integraatiohakuja. Yleisimmät kytkentätavat ja mistä ne löytyvät:

- **HTTP-kutsut** — client-kirjastot, `fetch`, base-URL:t konfiguraatiossa
- **Viestijonot / eventit** — jonon/topicin nimi tuottaja- ja kuluttajapäässä
  (nimi on se, mikä sitoo hypyn yhteen)
- **Tiedostovarasto** — bucket/kansio + tapahtumaliipaisin
- **Jaettu tietokanta** — sama taulu kahdessa moduulissa, triggerit, `NOTIFY`
- **Ajastukset** — cron/scheduler-määrittelyt

Tunnista kunkin hypyn **integraatiotapa** ja **siirtyvä data** (linkitä
datamalliin/datarakenteeseen). Jos kytkentä on infrastruktuurissa (IaC, konsolissa
tehty), merkitse `> TODO:` — älä arvaa.

## Vaihe J3 — Kirjoita järjestelmäprosessi

Mallipohjasta: Mermaid-sekvenssi (osallistujina **moduulit**, ei sisäosat) +
hyppytaulukko. Jokainen hyppy **linkittää** sen moduulin omaan
prosessikuvaukseen (porautuminen) ja siirtyvään dataan. Merkitse `lahteet`
kaikkien osallistuvien moduulien osalta.

Älä toista moduulin sisälogiikkaa — siihen linkitetään.

## Vaihe J4 — Päivitä kytkennät karttaan

Lisää löydetyt hypyt [`../tila/rakenne.yaml`](../tila/rakenne.yaml):n
`kytkennat`-listaan (`{from, to, kuvaus}`), niin HTML-etusivun järjestelmäkartta
piirtää nuolet.

## Vaihe J5 — Loki

Lisää rivi [`../tila/edistyminen.md`](../tila/edistyminen.md):
`pvm · <järjestelmäprosessi> · järjestelmäprosessi · <mitä> · <git-viite>`.

> **Versionhallinta:** älä committaa ilman kehittäjän lupaa.

---

## Suhde muihin kerroksiin

- **Liiketoimintaprosessi** = miksi (substanssi).
- **Järjestelmäprosessi** = miten end-to-end (tekninen, moduulirajat ylittävä).
- **Moduulin prosessi** = yhden moduulin sisälogiikka.

Porautuminen: liiketoiminta → järjestelmä → moduuli → data.
