# Laajennuspisteet — mihin projektikohtaiset muutokset kuuluvat

`vnetcon-docs` on kaksiosainen: **moottori** on kaikille projekteille sama ja
päivitettävä, **laajennuspisteet** ovat tämän projektin omaa sisältöä.

Tämä jako on syytä ottaa vakavasti. Jos projektikohtainen muutos tehdään
moottoriin, paketin päivitys (`asenna.sh --paivita`) joko ylikirjoittaa sen tai
jättää projektin pysyvästi vanhaan versioon. Molemmat ovat kalliita.

---

## Sääntö

> **Kaikki projektikohtainen sisältö laajennuspisteisiin. Moottoriin ei kosketa.**

## Laajennuspisteet (sinun sisältöä — päivitys ei koske näihin)

| Polku | Mitä tänne kuuluu |
|-------|-------------------|
| `vnetcon.config.yaml` | Asetukset: projektin nimi, pino, agentit, näyttönimet, HTML |
| `tila/projekti.yaml` | Projektin faktat: hakemistokartta, skeemalähteet, komennot, rajaukset |
| `tila/rekisteri.yaml` | Moduulit ja niiden dokumentointitila |
| `tila/rakenne.yaml` | Osa-alueet ja moduulien väliset kytkennät |
| `tila/synkronoitu.yaml`, `tila/edistyminen.md` | Synkronoinnin lähtötaso ja sessioloki |
| **`metodi/kartoitus.md`** | **Projektikohtaiset hakukomennot — tärkein laajennuspiste** |
| `metodi/sanasto.md` | Projektin domain-termit |
| `metodi/pinot/<oma-pino>.md` | Oma pinoprofiili, jos projektin teknologia ei ole valmiissa |
| `metodi/mallipohjat/<oma>.md` | Oma mallipohja, jos projekti tarvitsee dokkityypin jota ei ole |
| `johdanto.md` | HTML-etusivun johdanto |
| `moduulit/`, `liiketoimintaprosessit/`, `jarjestelmaprosessit/`, `datamallit/`, `tiketit/` | Kaikki dokumentaatio |
| `tyokalut/datamalli-generaattori/` | Projektikohtainen skeemageneraattori, jos tehdään |
| `.claude/settings.json` | Permission- ja ympäristöasetukset |
| `.claude/skills/<oma-skill>/` | Projektin omat skillit |

## Moottori (paketin sisältöä — päivitys ylikirjoittaa)

| Polku | Huom |
|-------|------|
| `metodi/*-tyonkulku.md`, `metodi/konventiot.md`, `metodi/agentit.md`, `metodi/laajennuspisteet.md` | Menettely |
| `metodi/mallipohjat/*` (paketin omat) | Mallipohjien rungot |
| `metodi/pinot/*` (paketin omat) | Valmiit pinoprofiilit |
| `tyokalut/html-generaattori/`, `tyokalut/vnetcon-ai/`, `tyokalut/kalibroi.mjs`, `tyokalut/tarkista-linkit.mjs` | Työkalut |
| `.claude/skills/*` (paketin omat), `.claude/workflows/*` | Skillit |
| `CLAUDE.md`, `AGENTS.md`, `README.md`, `vnetcon.config.example.yaml` | Reitittimet ja ohjeet |

`asenna.sh --paivita` säilyttää `metodi/kartoitus.md`:n, `metodi/sanasto.md`:n ja
`.claude/settings.json`:in vaikka ne ovat samoissa hakemistoissa kuin moottori.
Muut laajennuspisteet ovat omissa hakemistoissaan eivätkä ole päivityksen tiellä.

---

## Yleisimmät kalibrointitarpeet ja mihin ne menevät

| Havainto (kalibrointiraportista) | Minne korjaus |
|----------------------------------|---------------|
| Jokin alue sai **0 osumaa** vaikka sitä on koodissa | `metodi/kartoitus.md` → projektikohtainen haku, joka löytää sen |
| Teknologiaa ei ole valmiissa profiileissa | `metodi/pinot/<oma>.md` + viite `vnetcon.config.yaml`:n `pino.profiilit`-listaan |
| Moduulijako on väärä | `tila/rekisteri.yaml` + perustelu `tila/projekti.yaml`:iin |
| Osa-alueet eivät vastaa domainia | `tila/rakenne.yaml` |
| Testikomentoa ei löytynyt | `tila/projekti.yaml` → `komennot.testi` |
| Skeemalähteitä ei löytynyt tai ne ovat epätyypillisiä | `tila/projekti.yaml` → `skeemalahteet`, tarvittaessa oma generaattori |
| Projekti tarvitsee dokkityypin jota mallipohjissa ei ole | `metodi/mallipohjat/<oma>.md` |
| Dokumenteissa toistuva puute (esim. tietoturvaosio puuttuu) | Lisää osio **mallipohjaan**, kasvata `tila/metodi.yaml` → `metodi_versio` ja aja `/yhdenmukaista-dokumentaatio` |

## Jos moottori pitäisi muuttaa

Toisinaan huomaa, että puute on menettelyssä eikä projektissa — esimerkiksi
mallipohjasta puuttuu osio, jota **kaikki** projektit tarvitsisivat.

Älä muuta moottoria paikallaan. Sen sijaan:

1. Tee muutos laajennuspisteeseen, jotta työ etenee nyt (esim. oma mallipohja).
2. **Kerro se paketin ylläpitäjälle**, jotta se viedään pakettiin — silloin sen
   saa myös seuraava päivitys ja muut projektit.

Tämä on koko paketin kehityksen mekanismi: jokainen projekti parantaa
moottoria, mutta yksikään projekti ei haaraudu siitä.

## Tarkistus

Ennen paketin päivitystä kannattaa nähdä, mitä on muutettu moottorin puolelta:

```
git status --short
git diff --stat -- metodi tyokalut .claude
```

Jos moottoritiedostoissa on muutoksia, siirrä ne laajennuspisteisiin **ennen**
päivitystä — muuten ne katoavat.
