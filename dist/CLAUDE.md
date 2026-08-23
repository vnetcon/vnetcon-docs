# vnetcon-docs — ohjeet agentille

Tämä hakemisto on **itseohjautuva dokumentaatiojärjestelmä** ympäröivälle
projektille (`../`). Tavoite: tuottaa ja ylläpitää prosessi-, datavirta- ja
liiketoimintakuvauksia niin, että **kuka tahansa uusi sessio voi jatkaa työtä
ilman käsin annettua ohjausta** — ohjeet ovat tiedostoissa, eivät promptissa.

Kun työskentelet tässä hakemistossa, noudata näitä ohjeita. Sama sisältö on
Codexille tiedostossa [`AGENTS.md`](AGENTS.md).

## Ensin: onko projekti otettu käyttöön?

Jos `vnetcon.config.yaml` **puuttuu**, järjestelmä ei ole vielä käyttöönotettu.
Kerro se käyttäjälle ja ohjaa komentoon `/vnetcon-init` (menettely:
[`metodi/kayttoonotto-tyonkulku.md`](metodi/kayttoonotto-tyonkulku.md)). Älä
aloita dokumentointia ennen käyttöönottoa — muuten kirjoitat vääriä oletuksia.

Kun konfiguraatio on olemassa, **lue se aina työn alussa**:
`vnetcon.config.yaml` (asetukset) ja `tila/projekti.yaml` (projektin faktat:
pino, moduulit, komennot, hakemistokartta).

## Roolisi ja invariantit

- **Projektin juuri on `..`**, ei tämä hakemisto. Kaikki koodiviittaukset ja
  git-komennot kohdistuvat sinne: `git -C .. ls-files`, `git -C .. grep -n …`.
  Dokumenteissa polut kirjoitetaan **projektin juuresta** (esim.
  `src/maksu/reitit.ts`), ei `../`-alkuisina.
- **Skooppi = vain versionhallinnassa oleva tuotantokoodi.** Dokumentoi ja
  viittaa vain tiedostoihin, jotka ovat `git -C .. ls-files`-listalla.
  Versioimattomat tiedostot ohitetaan (myös versioidun hakemiston sisällä).
  Tarkista polku aina ennen kuin viittaat siihen. (Jos projekti ei ole
  git-repo, `vnetcon.config.yaml`:n `projekti.versionhallinta: none` — silloin
  käytetään tiedostojärjestelmää ja jätetään `git-viite` tyhjäksi.)
- **Älä luo dokumentaatiota uudestaan alusta.** Jos dokumentti on jo olemassa,
  päivitä se paikallaan runko ja vaihe-tunnisteet säilyttäen (päivitystila).
- **Versionhallinta vaatii aina kehittäjän hyväksynnän.** Älä koskaan aja
  `git add`/`git commit`/`git push` ilman eksplisiittistä lupaa — kirjoita
  tiedostot, kerro muutokset ja ehdota commitia, mutta jätä päätös kehittäjälle.
  Git-lukukomennot (status/diff/log/ls-files/grep/rev-parse) ovat sallittuja.
- **Tiketissä: älä koske koodiin ennen kuin suunnitelma on hyväksytty**
  ([`metodi/tiketti-tyonkulku.md`](metodi/tiketti-tyonkulku.md) vaihe 3). Jos
  suunnitelma tuli **tiedostona toisesta sessiosta** (`suunnitelma.md` /
  `codex-kehote.md`), se on jo hyväksytty — mutta **käy silti vaiheen 3b
  vastaanottoportti ennen toteutusta**: tarkista suunnitelma koodia vasten,
  kerro mistä olet eri mieltä ja odota lupaa. Valmis suunnitelma ei ole käsky.
- **Älä keksi, ja kerro kun et nähnyt.** Jos koodista ei selviä miten jokin
  toimii, merkitse `> TODO: varmistettava — <mikä>` ja jätä `tila: luonnos`. Jos
  jokin hakuluokka ei tuottanut yhtään osumaa, **sano se ääneen** ajon lopussa —
  vaillinainen kartoitus tuottaa uskottavan näköistä mutta virheellistä
  dokumentaatiota, ja hiljainen ohittaminen on pahin lopputulos.
- **Projektikohtaiset muutokset laajennuspisteisiin**, ei moottoriin
  ([`metodi/laajennuspisteet.md`](metodi/laajennuspisteet.md)) — muuten paketin
  päivitys ylikirjoittaa ne.
- **Kaaviot Mermaid, metatiedot YAML-frontmatter, kieli
  `dokumentaatio.kieli`** (oletus suomi). Ks.
  [`metodi/konventiot.md`](metodi/konventiot.md).

## Mistä löydät ohjeet (yksi totuuden lähde)

Tämä CLAUDE.md on vain reititin. Varsinainen menettely on `metodi/`-kansiossa:

- **Käyttöönotto** (uusi projekti) → [`metodi/kayttoonotto-tyonkulku.md`](metodi/kayttoonotto-tyonkulku.md)
- **Dokumentointi** (luonti + päivitys) → [`metodi/tyonkulku.md`](metodi/tyonkulku.md)
- **Projektin kartoitus** (mistä koodista mitä etsitään) → [`metodi/kartoitus.md`](metodi/kartoitus.md)
- **Laajennuspisteet** (mihin projektikohtaiset muutokset kuuluvat) → [`metodi/laajennuspisteet.md`](metodi/laajennuspisteet.md)
- **Järjestelmäprosessi** (end-to-end, moduulirajat ylittävä) → [`metodi/jarjestelmaprosessi-tyonkulku.md`](metodi/jarjestelmaprosessi-tyonkulku.md)
- **Tiketin toteutus** (vaiheet 0–5, sis. vaiheen 3b vastaanottoportti) → [`metodi/tiketti-tyonkulku.md`](metodi/tiketti-tyonkulku.md)
- **Synkronointi** (muutokset ilman tikettiä) → [`metodi/synkronointi-tyonkulku.md`](metodi/synkronointi-tyonkulku.md)
- **Yhdenmukaistus** (menettelymuutos → vanhat dokit) → [`metodi/yhdenmukaistus-tyonkulku.md`](metodi/yhdenmukaistus-tyonkulku.md)
- **Datamallit** (jaetut skeemat) → [`metodi/datamalli-tyonkulku.md`](metodi/datamalli-tyonkulku.md)
- **HTML-generointi** (selattava versio md:stä) → [`metodi/generointi-tyonkulku.md`](metodi/generointi-tyonkulku.md)
- **Agenttien työnjako** (Claude/Codex, työnjako, tarjoaja) → [`metodi/agentit.md`](metodi/agentit.md)
- **Konventiot** (frontmatter, kaaviot, nimeäminen, skooppi) → [`metodi/konventiot.md`](metodi/konventiot.md)
- **Sanasto** (projektin domain-termit) → [`metodi/sanasto.md`](metodi/sanasto.md)
- **Mallipohjat** → [`metodi/mallipohjat/`](metodi/mallipohjat/)
- **Tila**: projektin faktat → `tila/projekti.yaml`, mitä dokumentoitu →
  `tila/rekisteri.yaml`, sessioloki → `tila/edistyminen.md`, synkronoinnin
  lähtötaso → `tila/synkronoitu.yaml`, menettelyn versio → `tila/metodi.yaml`,
  informaatioarkkitehtuuri → `tila/rakenne.yaml`

## Skillit (käynnistys)

Kehittäjä käynnistää työn skillillä; ne vain ohjaavat sinut yllä oleviin
metodi-ohjeisiin:

- `/vnetcon-init` — käyttöönotto: kartoita projekti ja konfiguroi järjestelmä
- `/kalibroi` — lähtötilanne, katvealueet, laatu ja laajuusarvio (halpa; aja usein)
- `/dokumentoi [moduuli]` — dokumentoi tai päivitä yhden moduulin dokumentaatio
- `/dokumentoi-kaikki [osa-alue]` — orkestroija: kattava dokumentaatio oikeassa
  järjestyksessä (datamallit → moduulit fan-out → end-to-end → liiketoiminta → HTML)
- `/dokumentoi-jarjestelmaprosessi [aihe]` — end-to-end -kulku moduulirajojen yli
- `/generoi-datamallit` — jaetut skeemat `datamallit/`-kansioon
- `/generoi-html` — selattava HTML-versio `html/`-kansioon
- `/valmistele-tiketti` — tiketin vastaanotto, konteksti, suunnitelma +
  toteutuskehote toiselle agentille (ei koodimuutoksia)
- `/toteuta-tiketti` — toteuta rajattu koodimuutos dokumentaatio kontekstipohjana
- `/synkronoi-dokumentaatio` — dokit ajan tasalle koodimuutosten kanssa
- `/yhdenmukaista-dokumentaatio` — vanhat dokit nykyisiin mallipohjiin
- `/agentit` — konfiguroi agentit ja tarjoaja (kenen AI-tiliä vasten ajetaan)

## Hakemistokartta

```
metodi/                 Moottori: miten dokumentoidaan (ohjeet + mallipohjat)
tila/                   Projektin faktat + rekisteri (mitä tehty) + sessioloki
liiketoimintaprosessit/ Ei-tekninen kerros; voi ylittää moduulirajat; sisääntulo
jarjestelmaprosessit/   End-to-end -kulut moduulirajojen yli (tekninen)
datamallit/             Jaetut skeemat; moduulit linkittävät
moduulit/<moduuli>/     Tekninen tuotos: yleiskuvaus, prosessit, datavirrat, datarakenteet
tiketit/<tunnus>/       Tikettityön jälki (vaiheet 0–5, 3b), audit-jälki + agenttien kädenojennus
tyokalut/               html-generaattori, vnetcon-ai (agenttien käynnistys)
html/                   Generoitu selattava HTML (johdettu md:stä; ei versioida)
```
