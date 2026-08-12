Päivitä vnetcon-docs-dokumentaatio vastaamaan koodimuutoksia.

Vertailukohta (jos annettu): $ARGUMENTS

Toimi näin:

1. Lue `__VNETCON_DOCS__/metodi/synkronointi-tyonkulku.md` (S1–S4),
   `__VNETCON_DOCS__/metodi/konventiot.md` ja
   `__VNETCON_DOCS__/metodi/tyonkulku.md` osio "Päivitystila".
2. Lähtötaso: `__VNETCON_DOCS__/tila/synkronoitu.yaml` →
   `viimeisin_synkronoitu_commit` (tai annettu vertailukohta).
3. Hae muutosjoukko `git diff --name-status <baseline>..HEAD`, luokittele
   M/A/D/R ja etsi osuvat dokit frontmatterin `lahteet`-kentän perusteella.
   Jos muutosjoukko on hyvin suuri, kerro laajuus ja kysy mistä aloitetaan.
4. Päivitä osuvat dokit paikallaan. Tekninen ja datakerros johdetaan koodista;
   liiketoiminnallinen "miksi" merkitään
   `> TODO: substanssiosaajan vahvistus` — älä arvaa sitä.
5. Päivitä `tila/synkronoitu.yaml` (+ historia-rivi), muuttuneiden dokkien
   frontmatter ja lisää rivi `tila/edistyminen.md`:hen. Kerro kattamattomat aukot.

Ehdottomat rajat: vain versionhallinnassa oleva koodi, **älä committaa** ilman
lupaa, älä luo dokkeja alusta vaan päivitä paikallaan.
