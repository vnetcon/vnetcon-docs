# vnetcon-docs — ohjeet agentille (Codex)

Tämä hakemisto on **itseohjautuva dokumentaatiojärjestelmä** ympäröivälle
projektille. Sama sisältö on Claudelle tiedostossa [`CLAUDE.md`](CLAUDE.md);
tässä ovat Codex-spesifit lisäykset.

## Missä olet ja mihin viittaat

Codex käynnistetään yleensä **projektin juuressa** (koodimuutokset), Claude
tässä hakemistossa (`vnetcon-docs/`). Toimi näin riippumatta siitä, kummassa
olet:

- Projektin juuri = se hakemisto, jossa `vnetcon-docs/` sijaitsee.
- Dokumentaatio, ohjeet ja mallipohjat: `vnetcon-docs/…`.
- Dokumenteissa koodipolut kirjoitetaan **projektin juuresta** (esim.
  `src/maksu/reitit.ts`).
- Lue aina työn alussa: `vnetcon-docs/vnetcon.config.yaml` ja
  `vnetcon-docs/tila/projekti.yaml`. Jos konfiguraatio puuttuu, järjestelmää ei
  ole otettu käyttöön — kerro se käyttäjälle ja ohjaa ajamaan `/vnetcon-init`
  Claudessa (tai seuraa itse `metodi/kayttoonotto-tyonkulku.md`).

## Invariantit

- **Skooppi = vain versionhallinnassa oleva tuotantokoodi.** Varmista polut
  `git ls-files` / `git grep`illä ennen kuin viittaat niihin.
- **Älä luo dokumentaatiota uudestaan alusta** — päivitä paikallaan, runko ja
  vaihe-tunnisteet säilyttäen.
- **Versionhallinta vaatii kehittäjän hyväksynnän.** Älä aja
  `git add`/`commit`/`push` ilman eksplisiittistä lupaa. Lukukomennot ovat
  vapaita. (Codexissa ei ole permission-sääntöjä kuten Claudessa — tämä ohje on
  ainoa portti, noudata sitä tarkasti.)
- **Tiketissä: älä koske koodiin ennen kuin suunnitelma on hyväksytty**
  (`metodi/tiketti-tyonkulku.md` vaihe 3). Jos sait valmiin
  `tiketit/<tunnus>/codex-kehote.md`-kehotteen, suunnitelma on jo hyväksytty —
  toteuta se, älä laajenna skooppia.
- **Älä keksi, ja kerro kun et nähnyt.** Epävarma kohta:
  `> TODO: varmistettava — <mikä>`. Jos jokin hakuluokka ei tuottanut osumia,
  sano se ääneen — hiljainen ohittaminen tuottaa uskottavan näköistä mutta
  virheellistä dokumentaatiota.
- **Projektikohtaiset muutokset laajennuspisteisiin**, ei moottoriin
  (`vnetcon-docs/metodi/laajennuspisteet.md`).

## Menettelyt (yksi totuuden lähde)

Kun käyttäjä pyytää jotakin alla olevaa, **lue ensin vastaava ohje** ja seuraa
sitä vaihe vaiheelta. Nämä ovat samat menettelyt kuin Clauden skillit.

| Käyttäjä pyytää | Lue ja seuraa |
|-----------------|---------------|
| "toteuta tiketti", "tee tiketti X" | `vnetcon-docs/metodi/tiketti-tyonkulku.md` |
| "dokumentoi moduuli X" | `vnetcon-docs/metodi/tyonkulku.md` + `metodi/kartoitus.md` |
| "kuvaa end-to-end -kulku" | `vnetcon-docs/metodi/jarjestelmaprosessi-tyonkulku.md` |
| "päivitä dokumentaatio muutosten mukaan" | `vnetcon-docs/metodi/synkronointi-tyonkulku.md` |
| "yhdenmukaista dokumentit" | `vnetcon-docs/metodi/yhdenmukaistus-tyonkulku.md` |
| "generoi datamallit" | `vnetcon-docs/metodi/datamalli-tyonkulku.md` |
| "generoi HTML" | `vnetcon-docs/metodi/generointi-tyonkulku.md` |
| "ota käyttöön", "init" | `vnetcon-docs/metodi/kayttoonotto-tyonkulku.md` |
| "missä mennään", "kalibroi", "paljonko työtä" | aja `node vnetcon-docs/tyokalut/kalibroi.mjs` ja tulkitse `kalibrointiraportti.md` |
| projektikohtainen muutos menettelyyn | `vnetcon-docs/metodi/laajennuspisteet.md` — **älä muuta moottoria** |

Konventiot (frontmatter, kaaviot, nimeäminen, skooppi) ovat aina voimassa:
`vnetcon-docs/metodi/konventiot.md`.

## Slash-komennot Codexissa (valinnainen)

Codex lukee omat kehotteensa hakemistosta `~/.codex/prompts/`. `/vnetcon-init`
(tai `vnetcon-ai asenna-kehotteet`) voi asentaa sinne tiedostot, jolloin
käytettävissä ovat mm. `/vnetcon-tiketti`, `/vnetcon-dokumentoi`,
`/vnetcon-synkronoi`. Nämä ovat pelkkiä pikanäppäimiä — ne ohjaavat samoihin
`metodi/`-ohjeisiin. Ilman niitä pyydä samat asiat tavallisella suomella.

## Tiketin kädenojennus Claudelta

Kun Claude on valmistellut tiketin (`/valmistele-tiketti`), hakemistossa
`vnetcon-docs/tiketit/<tunnus>/` on:

```
tiketti.md        Tavoite, hyväksymiskriteerit, reunaehdot
konteksti.md      Mihin prosesseihin/koodiin/dataan muutos osuu (linkit)
suunnitelma.md    Hyväksytty toteutussuunnitelma + päätökset
codex-kehote.md   Valmis kehote sinulle — sisältää tehtävän ja rajaukset
```

Aloita lukemalla ne kaikki, toteuta `suunnitelma.md`:n mukaan ja päätä työ
vaiheeseen 5 (dokumentaation päivitys + `lopputulos.md`). Jos suunnitelma ei
matkalla pädekään, **pysähdy ja kysy** — älä laajenna skooppia omin päin.
