---
name: agentit
description: Konfiguroi kumpi tekoälyagentti (Claude vai Codex) tekee dokumentoinnin, toteutuksen ja päivitykset, ja mitä pilvipalvelua vasten ne ajetaan (Vnetconin pilviympäristö vai käyttäjän oma tili). Käytä kun halutaan asettaa tai vaihtaa agenttien työnjako, malli, palvelun osoite tai tunnisteen lähde.
---

# Konfiguroi agentit ja pilvipalvelu

Asettaa `vnetcon.config.yaml`:n `agentit`- ja `laskutus`-osiot sekä tarvittavat
käynnistysasetukset, jotta Claude ja/tai Codex ajetaan halutulla tavalla.

## Toimi näin

1. **Lue nykytila:** `vnetcon.config.yaml` (`agentit`, `laskutus`) ja
   `metodi/agentit.md` (työnjako, vaihtoehdot, ympäristömuuttujat). Aja
   `./tyokalut/vnetcon-ai/vnetcon-ai doctor` ja näytä tulos — se kertoo mitkä
   agentit on asennettu ja mitkä tunnisteet löytyvät.
2. **Kysy `AskUserQuestion`illa** (esitä nykyinen arvo oletuksena):
   - **Työnjako:** kuka dokumentoi, kuka toteuttaa, kuka päivittää
     (`claude`/`codex`). Oletus: dokumentointi Claude, toteutus ja päivitys Codex.
   - **Tarjoaja per agentti.** Suosittele tässä järjestyksessä ja kerro miksi:
     1. `oma` — käyttäjän oma kirjautuminen. **Oletus.** Koodi ei kulje
        kolmannen osapuolen läpi, ei lisäsopimuksia.
     2. `bedrock` / `vertex` / `anthropic-api` / `openai-api` — käyttäjän oma
        pilvitili tai API-avain; avaimet ja liikenne pysyvät hänen tenantissaan.
     3. `vnetcon-pilvi` — **vain pilottivaiheeseen.** Kerro selvästi, että
        promptissa on koodia, joten tämä tekee palveluntarjoajasta
        tietosuoja-asetuksen mukaisen käsittelijän ja vaatii sopimuksen sekä
        tietoturva-arvion. Älä esitä tätä helppona oikotienä.
   - **Malli** (tyhjä = agentin oletus) ja tarvittaessa alue/projekti-id.
   - **Laskutustunniste** (`laskutus.asiakas`) ja halutaanko käyttöloki.
3. **Kirjoita `vnetcon.config.yaml`.** Vain osoitteet, mallit ja
   `token_lahde`-viittaukset — **ei tunnisteita**.
4. **Jos tarjoaja on `vnetcon-pilvi` tai API-avainpohjainen:**
   - Kerro käyttäjälle, että tunniste kirjoitetaan tiedostoon
     `~/.vnetcon/credentials.env` muodossa `MUUTTUJA=arvo`, ja anna valmis
     komento (`vnetcon-ai tunnisteet --alusta` luo pohjan oikeilla oikeuksilla).
     **Älä pyydä tunnistetta chattiin äläkä kirjoita sitä mihinkään tiedostoon
     tämän hakemiston sisällä.**
   - Claudelle: lisää `.claude/settings.json`:iin `env.ANTHROPIC_BASE_URL` ja
     `apiKeyHelper: "./tyokalut/vnetcon-ai/hae-token.sh"`, jotta pelkkä `claude`
     tässä hakemistossa käyttää palvelua. Säilytä olemassa olevat
     `permissions`-säännöt — **älä ylikirjoita tiedostoa kokonaan**.
   - Codexille: käynnistys tapahtuu `vnetcon-ai codex` -skriptillä, joka antaa
     tarjoajan `-c`-parametreina. Käyttäjän `~/.codex/config.toml`:ia ei muokata
     ilman erillistä lupaa.
5. **Tarkista:** aja `doctor` uudelleen ja kerro mikä toimii, mikä puuttuu ja
   millä komennolla agentit käynnistetään.
6. **Kirjaa rivi** `tila/edistyminen.md`:hen (mitä konfiguroitiin — ei tunnisteita).

## Invariantit

- **Tunnisteita ei koskaan kirjoiteta** `vnetcon-docs/`-hakemistoon, lokiin,
  edistymislokiin eikä chattiin. Vain viittaus `~/.vnetcon/credentials.env`:iin.
- Älä muokkaa käyttäjän globaaleja asetuksia (`~/.claude/settings.json`,
  `~/.codex/config.toml`) ilman eksplisiittistä lupaa.
- Jos käyttäjä valitsee `oma`, **poista** aiemmin kirjoitetut
  `env.ANTHROPIC_BASE_URL`/`apiKeyHelper`-asetukset, jotta oma tili toimii.
- **Älä committaa** ilman kehittäjän lupaa.

Käyttäjän argumentti (jos annettu) voi olla agentti (`claude`/`codex`) tai
`doctor` (näytä vain tila).
