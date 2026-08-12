---
name: yhdenmukaista-dokumentaatio
description: Päivitä jo kirjoitetut dokumentit vastaamaan nykyisiä mallipohjia ja konventioita, kun menettely on muuttunut (uusi mallipohja, uusi kenttä, uusi rakenne). Etsii dokit, joiden metodi-versio on vanhentunut, ja yhdenmukaistaa ne paikallaan. Käytä kun mallipohjia tai konventioita on muutettu ja vanhat dokumentit pitää saada samaan malliin.
---

# Yhdenmukaista dokumentaatio

Päivittää olemassa olevat dokumentit nykyisen menettelyn (mallipohjat +
konventiot) mukaisiksi. Reagoi **menettelymuutokseen**, ei koodimuutokseen
(koodimuutoksiin käytä `/synkronoi-dokumentaatio`).

## Toimi näin

1. **Lue menettely:** `metodi/yhdenmukaistus-tyonkulku.md` (Y1–Y5),
   `metodi/konventiot.md` ja päivitystila `metodi/tyonkulku.md`:n osiosta
   "Päivitystila".
2. **Nykyinen versio:** lue `tila/metodi.yaml` (`metodi_versio` +
   `muutokset`-loki, kentästä `vaikuttaa` näet mitä dokkityyppejä kukin muutos
   koskee).
3. **Etsi vanhentuneet dokit:** ne, joiden frontmatterin `metodi-versio` on
   pienempi kuin nykyinen tai puuttuu. Rajaa käyttäjän nimeämään moduuliin/
   dokkityyppiin, jos annettu. Jos määrä on suuri, kerro laajuus ja tee erissä.
4. **Yhdenmukaista päivitystilassa:** säilytä runko ja vaihe-tunnisteet, lisää
   vain se mitä uusi malli vaatii. Jos uusi malli vaatii koodista johdettua
   tietoa (esim. datavirtojen kenttätason erittely) tai uuden jaetun rakenteen
   (`datamallit/`), kartoita/luo se ja linkitä.
5. **Merkitse:** `metodi-versio` = nykyinen, `paivitetty` = pvm. `git-viite`
   säilyy, jos koodia ei luettu uudelleen muuttuneena. Kirjaa rivi
   `tila/edistyminen.md`:hen.

## Invariantit

- Vain versionhallinnassa oleva koodi; **älä committaa** ilman kehittäjän lupaa.
- Älä luo dokkeja alusta vaan päivitä paikallaan.
- Älä arvaa — dynaamiset/epävarmat kohdat merkitään `> TODO:`.
- Jos huomaat, että menettelyn parannus olisi hyödyllinen **kaikissa
  projekteissa**, mainitse se käyttäjälle: se kannattaa viedä myös
  `vnetcon-docs`-paketin lähteeseen.

Käyttäjän argumentti (jos annettu) on kohde (moduuli tai dokkityyppi).
