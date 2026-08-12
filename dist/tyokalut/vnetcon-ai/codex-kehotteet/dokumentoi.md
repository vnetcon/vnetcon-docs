Dokumentoi projektin moduuli vnetcon-docs-järjestelmään.

Kohde (jos annettu): $ARGUMENTS

Toimi näin:

1. Lue `__VNETCON_DOCS__/metodi/tyonkulku.md` (luonti- ja päivitystila),
   `__VNETCON_DOCS__/metodi/konventiot.md`,
   `__VNETCON_DOCS__/metodi/kartoitus.md` (tämän projektin hakukomennot) ja
   `__VNETCON_DOCS__/tila/projekti.yaml`.
2. Valitse kohde: annettu moduuli tai ensimmäinen `tekematta`
   `__VNETCON_DOCS__/tila/rekisteri.yaml`:sta (pilotti ensin). Merkitse `kesken`.
3. Jos `__VNETCON_DOCS__/moduulit/<moduuli>/` on jo olemassa, **päivitä
   paikallaan** — säilytä runko ja vaihe-tunnisteet, älä luo alusta.
4. Kartoita vain versionhallinnassa oleva koodi. Kirjoita mallipohjista
   (`__VNETCON_DOCS__/metodi/mallipohjat/`): yleiskuvaus, prosessit, datavirrat
   (kenttätasolla: hallitseva skeema per solmu, sarjallistetut kentät avattuna),
   datarakenteet. Linkitä jaettuihin datamalleihin.
5. Täytä frontmatter (`lahteet`, `paivitetty`, `git-viite`, `metodi-versio`).
   Koodipolut kirjoitetaan projektin juuresta.
6. Päivitä lopuksi `tila/rekisteri.yaml` ja lisää rivi `tila/edistyminen.md`:hen.

Ehdottomat rajat: älä keksi (epävarma kohta → `> TODO: varmistettava — <mikä>`),
älä muokkaa projektin koodia, **älä committaa** ilman lupaa.
