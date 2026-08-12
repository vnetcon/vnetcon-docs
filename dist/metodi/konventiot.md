# Konventiot

Nämä säännöt koskevat kaikkea `vnetcon-docs/`-dokumentaatiota. Noudata niitä
sekä luodessasi että päivittäessäsi. Nämä eivät ole projektikohtaisia — projektin
faktat ovat `tila/projekti.yaml`:ssa ja asetukset `vnetcon.config.yaml`:ssa.

## 1. Skooppi: vain versionhallinnassa oleva tuotantokoodi

- Dokumentoi ja viittaa **vain tiedostoihin, jotka ovat `git -C .. ls-files`
  -listalla** (paahaara `vnetcon.config.yaml`:n `projekti.paahaara`).
- Versioimattomat hakemistot ja tiedostot ohitetaan — myös versioidun
  hakemiston sisällä olevat untracked-tiedostot.
- Ennen kuin viittaat polkuun, varmista se: `git -C .. ls-files <polku>` tai
  `git -C .. grep -n <termi> -- <polku>`.
- Rekisteri (`tila/rekisteri.yaml`) rakennetaan `git ls-files`-sisällöstä, ei
  tiedostojärjestelmän `ls`-listauksesta.
- **Poikkeus:** jos `projekti.versionhallinta: none`, käytä tiedostojärjestelmää
  ja jätä `git-viite` tyhjäksi (`-`). Kirjaa tämä `tila/projekti.yaml`:iin.

## 2. Polut

- Koodipolut kirjoitetaan **projektin juuresta**, ilman `../`-etuliitettä:
  `src/maksu/reitit.ts`, `services/billing/db/migrations/002_lasku.sql`.
- Dokumenttien väliset linkit ovat **suhteellisia** (toimivat GitHubissa ja
  generoidussa HTML:ssä): `../../datamallit/lasku.md`.
- Komennot ajetaan tästä hakemistosta, projektin juureen viitataan `-C ..`
  -lipulla tai suhteellisella polulla.

## 3. Kieli ja muoto

- **Kieli:** `vnetcon.config.yaml` → `dokumentaatio.kieli` (oletus suomi).
  Sama kieli kaikissa dokumenteissa; tiedostonimet aina ilman ääkkösiä.
- **Tiedostomuoto: Markdown (`.md`).** Markdown on totuuden lähde. Selattava
  HTML-versio (`html/`) on **johdettu** md:stä generaattorilla
  ([`generointi-tyonkulku.md`](generointi-tyonkulku.md)) — sitä ei muokata
  käsin eikä versioida.
- **Kaaviot: Mermaid** inline-koodilohkoina (```` ```mermaid ````). Prosesseille
  `sequenceDiagram`, datavirroille `flowchart`.
- **Metatiedot: YAML-frontmatter** jokaisen dokumentin alussa (kohta 4).

## 4. Frontmatter-skeema (tuotosdokumentit)

Jokainen `liiketoimintaprosessit/`-, `jarjestelmaprosessit/`-, `moduulit/`- ja
`datamallit/`-dokumentti alkaa näin:

```yaml
---
otsikko: <ihmisluettava otsikko>
tyyppi: liiketoimintaprosessi | jarjestelmaprosessi | moduuli-yleiskuvaus | prosessi | datavirta | datarakenne | datamalli
moduuli: <moduulin nimi>          # liiketoimintaprosessille voi olla "monta"
lahteet:                          # versioidut polut, joista dokumentti on johdettu
  - src/maksu/reitit.ts
  - db/migrations/002_lasku.sql
paivitetty: YYYY-MM-DD
git-viite: <lyhyt-commit-hash>    # mihin committiin nähden dokumentti on ajan tasalla
metodi-versio: <n>                # mihin menettelyn versioon (tila/metodi.yaml) dokki on yhdenmukaistettu
tila: luonnos | valmis | vanhentunut
---
```

`lahteet` on **päivitettävyyden ydin**: kun jokin listattu polku muuttuu,
dokumentti tunnistetaan päivitettäväksi. Pidä se ajan tasalla.

## 5. Pysyvät vaihe-tunnisteet

Prosessi- ja liiketoimintaprosessikuvausten vaiheet numeroidaan ja niihin
viitataan **pysyvillä ankkureilla**: otsikko `### Vaihe 3 — Tallennus` saa
ankkurin `#vaihe-3`. Tunnisteet **eivät muutu** vaikka sisältö päivittyy — näin
ristiinlinkitys (liiketoiminta → tekniikka → data) ei rikkoudu. Uusi vaihe
väliin: `### Vaihe 3b — …`, ei uudelleennumerointia.

## 6. Koodiviittaukset

- Muoto: `` `src/maksu/reitit.ts:42` `` — polku projektin juuresta, rivinumero
  jos osoitat tiettyyn kohtaan.
- Viittaa mieluiten funktioon/määrittelyyn **nimeltä**, jotta viittaus kestää
  pientä rivisiirtymää.

## 7. Ristiinlinkitys

- Liiketoimintaprosessin jokainen vaihe linkittää tekniseen prosessivaiheeseen
  (`../moduulit/<moduuli>/prosessit/<x>.md#vaihe-n`) ja käytettävissä olevaan
  dataan (`.../datarakenteet/<y>.md`).
- Datavirran solmut linkittävät vastaaviin datarakenteisiin tai datamalleihin.
- **Jaetut skeemat kuvataan kerran `datamallit/`-kansioon** (ei kopioida
  moduuleihin); datavirrat ja datarakenteet linkittävät niihin. Kuvaa aina
  **mikä skeema/tyyppi hallitsee dataa missäkin vaiheessa** ja mitkä kentät ovat
  siten koodin käytettävissä — ei pelkkiä tietokannan sarakkeita.

## 8. Nimeäminen

- Tiedostot ja hakemistot: `pienet-kirjaimet-viivalla.md` (kebab-case), ei
  ääkkösiä tiedostonimissä.
- Moduulihakemisto = moduulin nimi sellaisenaan projektissa (esim.
  `moduulit/maksupalvelu/`). Rakenne on aina `moduulit/`, vaikka HTML:ssä
  näytettäisiin projektin oma sanasto (`dokumentaatio.moduulit_label`).

## 9. Versionhallinta vaatii aina kehittäjän hyväksynnän

**Älä koskaan aja `git add`, `git commit`, `git push` (tai muuta työpuun/
historian pysyvästi muuttavaa git-komentoa) ilman kehittäjän eksplisiittistä
lupaa** — koski se sitten dokumentaatiota tai koodimuutoksia.

- Lukuoperaatiot (`status`, `diff`, `log`, `ls-files`, `grep`, `rev-parse`,
  `show`) ovat sallittuja vapaasti.
- Kun työ on valmis, **kerro mitä on muuttunut ja ehdota commitia** — mutta
  odota, että kehittäjä hyväksyy tai tekee sen itse.
- Tämä koskee myös tikettiprosessin vaiheita 4–5.

**Kova varmistus (Claude Code):** `.claude/settings.json` sisältää
permission-säännöt, jotka pakottavat interaktiivisen hyväksynnän joka kerta:

```json
{ "permissions": { "ask": ["Bash(git add:*)", "Bash(git commit:*)", "Bash(git push:*)"] } }
```

Komennot eivät ole estettyjä (`deny`) vaan **aina hyväksytettäviä** (`ask`).
**Codexissa vastaavaa harness-porttia ei ole** — siellä tämä ohje on ainoa
portti, joten noudata sitä erityisen tarkasti (ks. [`agentit.md`](agentit.md)).

## 10. Kun et ole varma

Älä keksi. Jos koodista ei selviä miten jokin toimii, merkitse dokumenttiin
`> TODO: varmistettava — <mikä>` ja jätä se `tila: luonnos`. Älä arvaa
liiketoimintamerkitystä; merkitse se avoimeksi kysymykseksi substanssiosaajalle
(`> TODO: substanssiosaajan vahvistus`).
