---
name: katselmoi
description: Vie katselmoinnissa tai käytössä löytyneet ihmisen korjaukset dokumentaatioon niin, että ne säilyvät seuraavissa ajoissa. Ottaa vastaan muistiinpanot, kommentit tai listan, luokittelee havainnot (dokumentin korjaus, yleinen väärä oletus, periaate, termi, rakenne, integraatio, vastaus avoimeen kysymykseen) ja kirjaa kunkin oikeaan paikkaan; korjatut kohdat merkitään vahvistetuiksi. Käytä kun dokumentaatiota on katselmoitu tai kun tekoälyn tulkintaa halutaan korjata.
---

# Katselmoi

Tekoälyn tulkintojen korjaukset kirjataan niin, ettei sama virhe toistu ja ettei
seuraava päivitys kirjoita korjausta yli.

## Toimi näin

1. **Lue menettely:** `metodi/katselmointi-tyonkulku.md` (vaiheet K1–K4) ja
   `metodi/konventiot.md` kohta 11.
2. **Lue ohjaus:** `metodi/ohjaus.md`, `metodi/sanasto.md` ja yhteinen ohjaus
   (`vnetcon.config.yaml` → `ohjaus.yhteiset`, oletuksena `mcp-tyotila/yhteiset/`).
3. **Pura palaute havainnoiksi** ja näytä lista käyttäjälle ennen muutoksia.
4. **Luokittele ja kirjaa** jokainen havainto työnkulun taulukon mukaan.
   Dokumentin korjaus merkitään `<!-- vahvistettu: … -->`-merkinnöillä.
5. **Raportoi** havainto → luokka → minne, ja erikseen kirjaamatta jääneet syineen.

## Invariantit

- Ihmisen havainto menee koodista tehdyn päättelyn edelle, mutta ristiriita
  koodin kanssa kerrotaan ja kysytään ennen kirjaamista.
- **Älä committaa** ilman kehittäjän lupaa.

Käyttäjän argumentti on katselmoinnin palaute tai polku tiedostoon, jossa se on.
