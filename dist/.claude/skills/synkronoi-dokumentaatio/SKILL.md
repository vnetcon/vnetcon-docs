---
name: synkronoi-dokumentaatio
description: Päivitä dokumentaatio vastaamaan koodimuutoksia, jotka on tehty ilman tikettiprosessia (suorat commitit, merget, muiden kehittäjien muutokset). Vertaa dokumentaation lähtötasoa nykyiseen HEADiin, tunnistaa muuttuneiden tiedostojen perusteella osuvat dokumentit ja päivittää ne paikallaan. Käytä kun halutaan synkronoida dokumentaatio ajan tasalle tai tarkistaa onko se ajautunut koodista.
---

# Synkronoi dokumentaatio

Pitää dokumentaation ajan tasalla kaikkien koodimuutosten kanssa — riippumatta
siitä, tehtiinkö muutos tiketillä vai ei. Käyttää samaa päivitystilaa kuin
tavallinen dokumentointi, mutta valitsee päivitettävät dokit git-diffin
perusteella.

## Toimi näin

1. **Lue menettely:** `metodi/synkronointi-tyonkulku.md` (vaiheet S1–S4) ja
   `metodi/konventiot.md`. Päivitystilan yksityiskohdat: `metodi/tyonkulku.md`
   osio "Päivitystila".
2. **Baseline:** lue `tila/synkronoitu.yaml`. Jos käyttäjä antoi vertailukohdan
   (commit/tagi/haara), käytä sitä. Jos baseline puuttuu, käytä dokkien omia
   `git-viite`-arvoja (ks. työnkulun erikoistapaus).
3. **Muutosjoukko:** `git -C .. diff --name-status <baseline>..HEAD`. Luokittele
   M/A/D/R ja etsi osuvat dokit `lahteet`-kentän perusteella. Jos muutosjoukko on
   hyvin suuri, ryhmittele moduuleittain, **kerro laajuus ja kysy mistä
   aloitetaan**.
4. **Päivitä paikallaan:** tekninen ja datakerros johdetaan koodista;
   liiketoiminnallinen "miksi", jota diffistä ei voi päätellä, merkitään
   `> TODO: substanssiosaajan vahvistus`. Kirjaa kattamattomat aukot.
5. **Päivitä lähtötaso ja loki:** `tila/synkronoitu.yaml` (+ historia-rivi),
   muuttuneiden dokkien frontmatter, tarvittaessa `tila/rekisteri.yaml`, ja rivi
   `tila/edistyminen.md`:hen. Ehdota `/generoi-html`-ajoa.

## Invariantit

- Vain versionhallinnassa oleva koodi; **älä committaa** ilman kehittäjän lupaa.
- Älä arvaa liiketoimintamerkitystä — merkitse se tarkistettavaksi.
- Jos baseline == HEAD, raportoi "ajan tasalla" ja lopeta.

Käyttäjän argumentti (jos annettu) on vertailukohta (esim. commit tai haara).
