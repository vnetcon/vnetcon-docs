# Moniprojekti-MCP — toteutusspeksin luonnos

> Tila: ehdotus keskustelun ja jatkomuokkauksen pohjaksi
> Tavoite: määritellä toteutettava palvelu, joka muodostaa ja julkaisee 1–N
> Git-projektin dokumentaation AI-clienttien käyttöön niin, että projektien
> sisältö, versiot ja käyttöoikeudet eivät sekoitu keskenään.

> Toteutustilanne 0.3: tiedostopohjainen julkaisu, stdio ja Streamable HTTP,
> `none`/bearer/basic/OIDC-autentikointi, claim-pohjainen valtuutus,
> manuaalinen/poll/webhook-muutosten havaitseminen sekä debounce-refresh-jono on
> toteutettu. Webhook on tarjoajariippumaton CI/hook-päätepiste; GitHubin,
> GitLabin, Bitbucketin ja Azure DevOpsin natiivipayload-adapterit ja pilvitallennus
> ovat myöhempiä laajennuksia. Hallintakäyttöliittymä (`/ui`) on toteutettu. Refresh ei käynnistä
> AI-dokumentointia tai julkaisua automaattisesti.

## 1. Tavoite

Toteutetaan valmis, konfiguroitava moniprojekti-MCP-ratkaisu, joka:

- seuraa määritettyjen lähdekoodirepositorioden ja refien muutoksia;
- käyttää projektikohtaisesti joko lähderepositoryssa olevaa `vnetcon-docs`-
  aineistoa tai julkaisupuolella ylläpidettävää dokumentaatiotyötilaa;
- päivittää managed-työtilan dokumentaation lähderefin muutosten perusteella tai
  lukee repository-mallin dokumentaation lähdecommitista;
- validoi ja julkaisee dokumentaation muuttumattomina snapshot-julkaisuina;
- virkistää MCP-palvelun käyttämän katalogin ja hakuindeksit hallitusti;
- tarjoaa dokumentit AI-clienteille projektin ja version mukaan rajattuina;
- pitää eri projektien dokumentit erillisinä tietokokonaisuuksina;
- kuvaa projektien väliset yhteydet vain erikseen määriteltyjen ja hyväksyttyjen
  rajapintojen kautta;
- toimii ensin paikallisena pilottina ja myöhemmin organisaation omassa
  AWS-verkossa.

Ratkaisun tarkoitus ei ole muodostaa eri repositoryjen dokumenteista yhtä
rajatonta tietomassaa. Moniprojektisuus tarkoittaa usean itsenäisen projektin
tarjoamista saman palvelun kautta, ei projektirajojen poistamista.

Lähdekoodiprojektin Git-haarassa voi olla `vnetcon-docs/`-hakemisto, mutta sitä
ei vaadita. Uusia vaatimuksia ei aseteta nykyisten projektien kehitysmallille
vain MCP-jakelun takia. Jokaiselle projektille valitaan eksplisiittisesti yksi
dokumentaation omistajuusmalli:

- `repository`: `vnetcon-docs/` on osa lähderepositorya ja kulkee sen refien
  mukana;
- `managed`: lähderepository sisältää vain lähdekoodin ja julkaisupalvelu
  ylläpitää projekti- ja refikohtaista `vnetcon-docs`-työtilaa.

Samalle projektille ja refille ei käytetä molempia malleja yhtä aikaa.

## 2. Keskeiset käsitteet

### 2.1 Projekti

`project_id`:llä tunnistettu lähdekoodin Git-repository.
Projektilla on oma:

- lähdekoodin Git-historia ja seurattavat refit;
- valittu dokumentaation omistajuusmalli ja sen tila;
- konfiguraatio;
- julkaisu- ja retention-politiikka;
- hakuindeksi;
- käyttöoikeusraja;
- järjestelmäraja.

`project_id` on pysyvä tekninen tunniste. Repositoryn tai näyttönimen vaihto ei
vaihda sitä.

### 2.2 Dokumentaation omistajuusmalli

#### Repository-malli

Projektissa jo oleva `vnetcon-docs/` on dokumentaation totuuden lähde. Se
versioituu koodin kanssa samoissa brancheissa ja päivittyy projektin nykyisen
kehityskäytännön kautta. Julkaisupalvelu:

- lukee aineiston tarkasta lähdecommitista;
- validoi sen;
- muodostaa indeksin ja snapshotin;
- ei kirjoita tai pushaa muutoksia lähderepositoryyn.

Jos julkaisupalvelun AI-analyysi löytää päivitystarpeen, se voi tuottaa raportin
tai erikseen käyttöönotettavan muutosehdotuksen. Se ei muuta repository-mallin
dokumentaatiota taustalla lähderepositorion ulkopuolella, koska silloin syntyisi
kaksi totuuden lähdettä.

#### Managed-malli

Julkaisupuolella säilytettävä projektin ja lähderefin oma `vnetcon-docs`-tila.
Työtila sisältää dokumentit, synkronoinnin baselinen, rekisterit ja käytetyn
menetelmäversion, mutta ei ole osa lähdekoodiprojektin Git-haaraa.

Työtilan avain on:

```text
(project_id, source_ref)
```

Työtila on pitkäikäinen, jotta dokumentteja voidaan päivittää paikallaan eikä
generoida joka ajossa alusta. Dokumentaation oma muutoshistoria voidaan
säilyttää julkaisupuolen paikallisessa Git-repositoryssa tai muussa
versionoidussa tallennuksessa. Tätä dokumentaatiorepositorya ei tarvitse
pushata lähdekoodin Git-palveluun.

Työtila ja lähdekoodin checkout ovat eri asioita. Päivitysajossa työtilan
viereen luodaan tilapäinen checkout lähdeprojektin tarkasta commitista:

```text
workspaces/<project_id>/<encoded-ref>/
  source/                  # julkaisupuolen refikohtainen checkout
    vnetcon-docs/          # managed-tilassa paikallinen, pysyvä ja Gitissä ohitettu
```

Managed-hakemisto sijaitsee vain julkaisupuolen checkout-kopiossa. Se lisätään
checkoutin `.git/info/exclude`-tiedostoon, joten se ei muuta lähderepositorya tai
näy sen commitoitavana sisältönä. Rakenne säilyttää nykyisten `vnetcon-docs`-
työnkulkujen oletuksen, että lähdeprojektin juuri on dokumenttihakemiston
ylähakemisto, eikä vaadi Windowsissa symlinkkejä.

Jos seurattavaan lähdehaaraan myöhemmin lisätään versionhallittu
`vnetcon-docs/`, managed-ajo pysähtyy. Omistajuus vaihdetaan tällöin hallitusti
repository-malliin tai lähdehaaran hakemisto käsitellään erikseen; kahta
samannimistä totuuden lähdettä ei yhdistetä automaattisesti.

#### Mallin valinta

Valinta tehdään projektirekisterin konfiguraatiossa, eikä palvelu päättele tai
vaihda sitä automaattisesti hakemiston olemassaolon perusteella. Tämä estää
esimerkiksi tilapäisesti puuttuvan `vnetcon-docs/`-hakemiston tulkitsemisen
luvanvaraiseksi siirtymiseksi managed-malliin.

Mallia voidaan vaihtaa hallitulla migraatiolla:

- `repository -> managed`: valitun lähdecommitin dokumentaatio tuodaan uuden
  managed-työtilan lähtötilaksi;
- `managed -> repository`: hyväksytty dokumentaatiorevisio viedään erillisenä
  muutosehdotuksena projektiin, ja omistajuus vaihtuu vasta muutoksen yhdistyttyä.

### 2.3 Snapshot-julkaisu

Yhden projektin yhden tarkan Git-commitin muuttumaton dokumentaatiojulkaisu.
Sen identiteetti on vähintään:

```text
(project_id, source_commit_sha, documentation_revision, docs_schema_version)
```

Ref, kuten `main` tai `release/3.2`, on snapshotin metadataa ja käyttäjälle
ymmärrettävä alias. Ref ei ole muuttumattoman julkaisun identiteetti.

Managed-mallissa `documentation_revision` on dokumentaatiotyötilan täysi
Git-SHA tai, jos työtila ei käytä Gitiä, julkaistavan aineiston sisältötiiviste.
Repository-mallissa se on kyseisestä lähdecommitista poimitun
`vnetcon-docs`-aineiston sisältötiiviste. Näin mallien julkaisut käyttävät samaa
snapshot-formaattia, vaikka dokumentaation omistajuus on erilainen.

### 2.4 Julkaisupaketti

Muuttumaton manifesti, joka valitsee yhdestä tai useammasta projektista tarkat,
keskenään käytettäväksi hyväksytyt snapshotit.

```json
{
  "bundle_id": "customer-platform-2026-10-03.1",
  "created_at": "2026-10-03T10:15:00Z",
  "projects": [
    {
      "project_id": "frontend",
      "ref": "main",
      "source_commit_sha": "<full-sha>",
      "documentation_revision": "<docs-full-sha-or-digest>",
      "release_id": "<opaque-release-id>"
    },
    {
      "project_id": "backend",
      "ref": "release/3.2",
      "source_commit_sha": "<full-sha>",
      "documentation_revision": "<docs-full-sha-or-digest>",
      "release_id": "<opaque-release-id>"
    }
  ]
}
```

Julkaisupaketti ei kopioi kaikkia dokumentteja yhteen hakemistoon eikä muodosta
niistä yhtä yhteistä indeksiä. Se viittaa erillisiin projektisnapshoteihin.

### 2.5 Julkaisukanava

Muuttuva osoitin yhteen hyväksyttyyn julkaisupakettiin. Esimerkkejä ovat
`development`, `staging` ja `production`.

Kanavan osoitin vaihdetaan atomisesti vasta, kun kaikki paketin snapshotit,
indeksit ja rajapintakuvaukset on validoitu. Tämä estää tilanteen, jossa AI
käyttäisi esimerkiksi frontendin uutta versiota ja backendin vanhaa versiota
vahingossa samana kokonaisuutena.

### 2.6 Yhteinen rajapinta

Kahden tai useamman projektin välinen erikseen määritelty sopimus. Rajapinta ei
ole projektien dokumenttien automaattinen yhdistelmä, vaan oma hyväksytty
tietueensa, jossa kerrotaan osapuolten roolit ja tarkat lähteet.

Esimerkkejä:

- HTTP- tai GraphQL-rajapinta;
- tapahtuma tai viestijonon topic;
- tiedostomuoto;
- tietokantaintegraatio;
- kutsuttava kirjasto tai SDK;
- tunnistus- tai valtuutusprotokolla.

## 3. Arkkitehtuuripäätös

Ratkaisu toimitetaan yhtenä tuotteena ja yhtenä konfiguraatiomallina, mutta se
sisältää neljä erillistä vastuuta:

```text
Lähdekoodin Git-repositoryt ja niiden elävät refit
      |
      v
1. refresh controller
      |
      +-- repository: lue vnetcon-docs lähdecommitista --+
      |                                                  |
      +-- managed: päivitä refin dokumentaatiotyötila ---+
                                                         |
                                                         v
2. validator / publisher
      |
      v
muuttumattomat snapshotit + projektikohtaiset indeksit
      |
      v
3. katalogi, julkaisupaketit ja kanavat
      |
      v
4. vain lukeva MCP runtime
      |
      v
AI-clientit
```

Paikallisessa pilotissa kaikki vastuut voidaan ajaa yhdellä komennolla tai
Docker Compose -kokonaisuutena. Tuotannossa ne suoritetaan eri prosesseina ja
eri oikeuksilla.

MCP-runtime ei tuotannossa kloonaa repositoryja, vaihda Git-haaroja eikä rakenna
indeksejä käyttäjäpyynnön aikana. Git-tunnukset ovat vain refresh- ja
päivityskomponenteilla.
Runtime lukee ainoastaan hyväksyttyjä julkaisuja.

Lähdekoodirepositoryjen omat haarat elävät normaalisti. Managed-mallissa
julkaisupuolen dokumentaatiotyötila seuraa haaran viimeksi käsiteltyä täyttä
commit-SHA:ta. Repository-mallissa julkaistava dokumentaatio luetaan suoraan
samasta commitista kuin koodi. Kumpikaan malli ei anna julkaisupalvelulle
automaattista kirjoitusoikeutta lähderepositoryyn.

Tämä jako säilyttää mahdollisuuden tarjota käyttäjälle "itsensä virkistävä"
palvelu ilman, että ulospäin palveleva MCP-prosessi saa Git- tai
kirjoitusoikeuksia.

## 4. Valmis konfiguroitava palvelu

Ratkaisun tavoiteltu käyttöönotto:

```bash
multiproject-mcp validate --config multiproject-mcp.yaml
multiproject-mcp refresh --config multiproject-mcp.yaml
multiproject-mcp serve --config multiproject-mcp.yaml
```

Paikallisessa pilotissa voidaan käyttää yhdistelmäkomentoa:

```bash
multiproject-mcp start --config multiproject-mcp.yaml
```

`start` käynnistää refresh controllerin ja MCP-runtimen, mutta ne säilyvät
sisäisesti eri komponentteina ja käyttävät eri työhakemistoja.

### 4.1 Esimerkkikonfiguraatio

```yaml
schema_version: 1

service:
  instance_id: internal-documentation
  default_channel: production

refresh:
  mode: webhook                 # webhook | poll | ci | manual
  debounce_seconds: 30
  poll_interval_seconds: 300    # vain poll-tilassa
  max_parallel_jobs: 4

documentation:
  workspace_root: ./.multiproject/workspaces
  history_backend: local_git    # local_git | internal_git | object_versions
  update_mode: ai_with_review   # ai_with_review | ai_auto | manual
  publish_policy: approved      # approved | validated
  vnetcon_docs_package: "1.12.0"

projects:
  - project_id: customer-frontend
    display_name: Customer Frontend
    repository:
      url: ssh://git.example/teams/frontend.git
      credentials_secret: git/frontend-reader
    refs:
      default: main
      include:
        - main
        - release/*
      feature_branches: on_demand
    documentation:
      mode: managed
      workspace_template: default
      include:
        - johdanto.md
        - liiketoimintaprosessit/**/*.md
        - jarjestelmaprosessit/**/*.md
        - moduulit/**/*.md
        - datamallit/**/*.md
      exclude:
        - tiketit/**
        - metodi/**
        - tila/**
    authorization_domain: customer-platform-readers
    retention:
      feature_days: 30
      release_days: 365

  - project_id: customer-api
    display_name: Customer API
    repository:
      url: ssh://git.example/teams/customer-api.git
      credentials_secret: git/customer-api-reader
    refs:
      default: main
      include: [main, release/*]
      feature_branches: on_demand
    documentation:
      mode: repository
      source_path: vnetcon-docs
      include:
        - johdanto.md
        - liiketoimintaprosessit/**/*.md
        - jarjestelmaprosessit/**/*.md
        - moduulit/**/*.md
        - datamallit/**/*.md
    authorization_domain: customer-platform-readers

interfaces:
  source: directory
  path: ./interfaces

channels:
  - channel_id: production
    update_policy: manual_promotion
    project_refs:
      customer-frontend: main
      customer-api: main
  - channel_id: staging
    update_policy: latest_validated
    project_refs:
      customer-frontend: development
      customer-api: development
```

Salaisuuksia ei kirjoiteta konfiguraatioon. `credentials_secret` on viittaus
paikalliseen credential storeen tai tuotannossa esimerkiksi AWS Secrets
Manageriin.

`history_backend: local_git` tarkoittaa julkaisupalvelun omalla pysyvällä
levyllä olevaa managed-mallin dokumentaation Git-historiaa. Sitä ei pushata
lähdekoodin Git-palveluun. Tuotannossa levy tarvitsee varmistuksen;
vaihtoehtoisesti voidaan käyttää erillistä sisäistä Git-palvelua tai versioitua
objektitallennusta. Repository-mallissa dokumentaation historia on valmiiksi
lähderepositoryn historiassa eikä erillistä työtilahistoriaa muodosteta.

Konfiguraatiolle julkaistaan JSON Schema, jota CLI, CI ja editorit käyttävät.
`interfaces/` saa olla aluksi tyhjä. Rajapintatietueet eivät ole yhden projektin
dokumentoinnin tai paikallisen MCP-pilotin käynnistämisen edellytys.

### 4.2 Nykytila ja tavoitetila

Tässä dokumentissa kuvatut `multiproject-mcp`-komennot ovat toteutettavan
tuotteen rajapinta, eivät vielä nykyisen repositoryn olemassa olevia komentoja.
Nykyinen `vnetcon-docs` osaa:

- asentaa dokumentaatiomenetelmän yhteen projektiin;
- kartoittaa ja kalibroida yhden projektin;
- käynnistää dokumentointiagentin;
- tarkistaa linkkejä ja lähdeviitteitä;
- generoida HTML-julkaisun.

Nykyinen repository ei vielä sisällä moniprojektirekisteriä, haarakohtaisten
managed-työtilojen hallintaa, snapshot-publisheria eikä MCP-runtimea. Tavoite on
toteuttaa nämä samaan `vnetcon-docs`-tuotteeseen siten, että yksi klooni riittää
paikallisen pilotin käynnistämiseen.

Nykyiset menetelmäohjeet käyttävät osittain `git -C ..` -oletusta. Paikallinen
MVP säilyttää yhteensopivuuden sijoittamalla managed-työtilan julkaisupuolen
checkout-kopion sisään. Myöhemmin täysin vapaasti sijoitettava ulkoinen työtila
edellyttää kaikkien työkalujen ja agenttiohjeiden yhdenmukaistamista käyttämään
`projekti.juuri`-asetusta.

### 4.3 Paikallinen quickstart tavoitetilassa

Käyttäjän tavoiteltu aloituspolku on:

```bash
# 1. Työkalun lähdekoodi
git clone https://github.com/vnetcon/vnetcon-docs.git
cd vnetcon-docs

# 2. Asenna MCP:n riippuvuudet ja luo erillinen moniprojektityötila
#    (lähderepossa vnetcon-docs-hakemiston sisältö on dist/-hakemistossa)
npm ci --prefix dist/tyokalut/mcp
./dist/tyokalut/vnetcon-ai/vnetcon-ai mcp init ../oma-dokumentaatiopalvelu
cd ../oma-dokumentaatiopalvelu

# 3. Lisää paikallinen managed-projekti
./multiproject-mcp add-project \
  --id customer-frontend \
  --path ../customer-frontend \
  --refs main,development \
  --docs-mode managed

# 4. Lisää projekti, jonka omassa repossa on vnetcon-docs
./multiproject-mcp add-project \
  --id customer-api \
  --path ../customer-api \
  --refs main,development \
  --docs-mode repository \
  --docs-path vnetcon-docs

# 5. Muodosta paikallinen julkaisukanava
./multiproject-mcp channel create local-development
./multiproject-mcp channel set-ref \
  local-development customer-frontend development
./multiproject-mcp channel set-ref \
  local-development customer-api development

# 6. Tarkista ennen muutoksia
./multiproject-mcp doctor
./multiproject-mcp plan refresh --all

# 7. Luo työtilat ja generoi ensimmäinen dokumentaatio
./multiproject-mcp bootstrap --all
./multiproject-mcp document --project customer-frontend --ref development
./multiproject-mcp review --project customer-frontend --ref development

# 8. Julkaise hyväksytty paikallinen kanava
./multiproject-mcp publish --channel local-development
./multiproject-mcp status

# 9. Käynnistä ja testaa paikallinen MCP
./multiproject-mcp serve --profile local
# toisessa terminaalissa:
./multiproject-mcp smoke-test --channel local-development --profile local
```

Windowsissa `init` luo vastaavan `multiproject-mcp.cmd`-käynnistimen. Varsinainen
toteutus on Node.js:llä, joten Bashia ei vaadita.

`init` ei kirjoita käyttäjän projektirepositoryihin. Se luo uuden
hallintatyötilan, esimerkiksi:

```text
oma-dokumentaatiopalvelu/
  multiproject-mcp.yaml
  multiproject-mcp.local.yaml
  multiproject-mcp.server.example.yaml
  interfaces/
  .multiproject/
    workspaces/
    publications/
    catalog/
    jobs/
  multiproject-mcp
  multiproject-mcp.cmd
```

`.multiproject/` on ajonaikaista paikallista tilaa eikä sitä lähtökohtaisesti
versionhallita. Konfiguraatio, rajapintatietueet ja mahdolliset
palvelinprofiilien mallipohjat voidaan versionhallita erikseen.

### 4.4 Konfigurointia helpottavat komennot

YAML-tiedostoa voi muokata käsin, mutta tavallisen käyttöönoton ei pidä vaatia
sen rakenteen tuntemista. CLI tarjoaa vähintään seuraavat komennot:

#### Työtilan alustus

```bash
multiproject-mcp init <hakemisto> [--non-interactive]
```

Luo konfiguraation, paikallisen profiilin, hakemistorakenteen ja alustavat
käynnistimet. Interaktiivinen ajo kysyy tallennuspolun, käytettävän agentin ja
paikallisen MCP-transportin.

#### Projektien löytäminen

```bash
multiproject-mcp discover --root ../projektit
multiproject-mcp inspect-project --path ../projekti
```

`discover` etsii Git-repositoryja ja tulostaa ehdotuksen, mutta ei muuta
konfiguraatiota. `inspect-project` näyttää ainakin:

- ehdotetun `project_id`:n;
- remote-osoitteen ja oletushaaran;
- löydetyt branchit ja tagit;
- löytyykö valitusta refistä `vnetcon-docs/`;
- suosituksen `repository`- tai `managed`-mallista;
- puuttuvat käyttöoikeudet tai työkalut.

Omistajuusmallia ei hyväksytä automaattisesti pelkän löydöksen perusteella.
Käyttäjä vahvistaa sen `add-project`-komennossa tai interaktiivisessa kyselyssä.

#### Projektin lisääminen ja muuttaminen

```bash
multiproject-mcp add-project --id <id> --path <polku> --refs <refit> \
  --docs-mode <managed|repository>
multiproject-mcp add-project --id <id> --url <git-url> --refs <refit> \
  --docs-mode <managed|repository>
multiproject-mcp project set-refs <id> main development 'release/*'
multiproject-mcp project set-docs-mode <id> managed
multiproject-mcp remove-project <id> --plan
```

Poistaminen näyttää oletuksena suunnitelman. Työtilan tai julkaisujen
varsinainen poistaminen vaatii erillisen vahvistuksen ja noudattaa retention-
politiikkaa.

Jos `vnetcon-docs/` on vain osassa projektin refejä, projektille voidaan antaa
refikohtainen override:

```yaml
documentation:
  mode: managed
  ref_overrides:
    - pattern: development
      mode: repository
      source_path: vnetcon-docs
```

Jokaisella `(project_id, ref)`-parilla on edelleen vain yksi dokumentaation
totuuden lähde.

#### Kanavien muodostaminen

```bash
multiproject-mcp channel create local-development
multiproject-mcp channel set-ref local-development customer-frontend development
multiproject-mcp channel set-ref local-development customer-api development
multiproject-mcp channel show local-development
```

`channel show` ratkaisee refit senhetkisiksi SHA-arvoiksi ja näyttää etukäteen,
mitkä snapshotit samaan pakettiin tulisivat.

#### Konfiguraation tarkistaminen

```bash
multiproject-mcp config validate
multiproject-mcp config show --effective --profile local
multiproject-mcp doctor [--project <id>] [--ref <ref>]
multiproject-mcp plan refresh --all
```

`doctor` tarkistaa vähintään Node- ja Git-versiot, repositoryjen saavutettavuuden,
refit, projektitunnisteiden yksikäsitteisyyden, omistajuusmallit,
`vnetcon-docs`-pakettiversion, agentin saatavuuden, tallennustilan ja sen, ettei
salaisuuksia ole kirjoitettu konfiguraatioon. `plan` ei muuta työtiloja.

#### Dokumentoinnin ohjaaminen

```bash
multiproject-mcp bootstrap --project customer-frontend --ref development
multiproject-mcp refresh --project customer-frontend --ref development
multiproject-mcp document --project customer-frontend --ref development
multiproject-mcp document --project customer-frontend --ref development \
  --module checkout
multiproject-mcp review --project customer-frontend --ref development
multiproject-mcp approve --project customer-frontend --ref development \
  --revision <documentation-revision>
multiproject-mcp publish --channel local-development
```

`bootstrap` luo ensimmäisen managed-työtilan, asentaa siihen valitun
`vnetcon-docs`-pakettiversion ja valmistelee ensimmäisen kartoituksen.
Repository-mallissa se tarkistaa valitun refin mukana tulevan asennuksen ja
pakettiversion. `refresh` hakee lähdekoodin ja muodostaa päivitystyön.
Managed-mallissa
`document` käynnistää valitun `vnetcon-docs`-agenttityönkulun oikeassa
projekti- ja refikohtaisessa työtilassa. Repository-mallissa `document` ei
kirjoita lähderepositoryyn, vaan raportoi päivitystarpeen tai tuottaa erikseen
pyydettäessä muutosehdotuksen.

`refresh --all` ei saa huomaamatta julkaista keskeneräistä AI-päivitystä.
Julkaistava revision pitää täyttää konfiguroitu `publish_policy`.

Toistettavaa paikallista pilottia varten tarjotaan lisäksi ohjaava komento:

```bash
multiproject-mcp pilot --channel local-development
```

`pilot` ajaa `doctor`- ja `plan`-tarkistukset, bootstraptaa puuttuvat työtilat,
virkistää lähteet ja näyttää dokumentointi- ja hyväksyntäjonon. Se saa pysähtyä
käyttäjän hyväksyntää vaativaan vaiheeseen, mutta ei saa ohittaa sitä.

### 4.5 Paikalliset ja palvelinkohtaiset asetukset

Projektit, ref-politiikat, dokumentaation omistajuusmallit, kanavat ja
rajapintatietueet ovat ympäristöstä riippumatonta peruskonfiguraatiota.
Tallennus, kuunteluosoite, tunnelit, salaisuudet ja ajonaikaiset polut ovat
profiili- tai ympäristökohtaisia asetuksia.

Suositeltu jako:

```text
multiproject-mcp.yaml                 # yhteinen, siirrettävä konfiguraatio
multiproject-mcp.local.yaml           # paikalliset polut ja filesystem-storage
multiproject-mcp.server.yaml          # S3, jonot, HTTP ja palvelinpolut
credentials / Secrets Manager         # ei koskaan YAML-tiedostoihin
```

Paikallisen profiilin esimerkki:

```yaml
profile: local
storage:
  type: filesystem
  root: ./.multiproject/publications
runtime:
  transport: stdio
refresh:
  mode: manual
```

Palvelinprofiilin esimerkki:

```yaml
profile: server
storage:
  type: s3
  prefix: s3://org-docs/multiproject-mcp/
runtime:
  transport: http
  listen: 127.0.0.1:8793
refresh:
  mode: webhook
```

Profiilit yhdistetään skeeman tuntevalla konfiguraatiolukijalla. Tuntematon
avain, väärä tyyppi tai ristiriitainen override on virhe eikä hiljainen ohitus.

Paikalliseen konfiguraatioon voidaan käyttää `repository.path`-arvoa. Ennen
palvelinsiirtoa jokaisella projektilla pitää olla palvelimelta saavutettava
`repository.url`, ellei palvelin käytä valmiiksi peilattua repositorya.

### 4.6 Siirto paikalliselta koneelta palvelimelle

Siirto tehdään hallittuna vientinä eikä kopioimalla koko paikallista
työhakemistoa käsin:

```bash
# Paikallisella koneella
multiproject-mcp deploy check --profile server
multiproject-mcp export \
  --config \
  --interfaces \
  --managed-workspaces \
  --approvals \
  --output multiproject-export.tar

# Palvelimella
multiproject-mcp import multiproject-export.tar
multiproject-mcp doctor --profile server
multiproject-mcp plan refresh --all --profile server
multiproject-mcp refresh --all --profile server
multiproject-mcp publish --channel staging --profile server
multiproject-mcp smoke-test --channel staging --profile server
```

Vienti sisältää tarkistussummilla varustetun manifestin ja formaattiversion.
Se ei sisällä Git-, AI- tai tunnelisalaisuuksia. Salaisuudet asetetaan
palvelimella uudelleen esimerkiksi Secrets Manageriin.

Repository-mallin dokumentaatio voidaan rakentaa palvelimella uudelleen Gitistä.
Managed-mallin työtilat ovat sen sijaan itsenäistä, arvokasta tilaa, joten niiden
dokumentaatiorevisiot, baselinet ja hyväksyntähistoria täytyy viedä tai säilyttää
palvelimen saavuttamassa sisäisessä versionhallinnassa. Pelkän YAML-
konfiguraation siirtäminen ei riitä managed-projektille.

Snapshotit ja hakuindeksit voidaan joko viedä mukana tai muodostaa palvelimella
uudelleen samoista lähde-SHA- ja dokumentaatiorevisioista. Aktiivista
production-kanavaa ei vaihdeta ennen palvelimen `doctor`-, refresh- ja
smoke-test-vaiheiden onnistumista.

Palvelimelle siirtymisessä on kaksi käyttöönottotasoa:

1. **Runtime-only:** dokumentaatio generoidaan ja hyväksytään edelleen
   paikallisesti tai CI:ssä. Palvelimelle siirretään vain konfiguraatio,
   rajapintatietueet ja hyväksytyt snapshotit. MCP-runtime ei tarvitse Git- tai
   AI-tunnuksia. Tämä on suositeltu ensimmäinen palvelinpilotti.
2. **Self-refreshing:** palvelimella ajetaan lisäksi refresh controller,
   managed-työtilat ja dokumentointiagentti. Palvelin tarvitsee repositoryjen
   lukuoikeudet, pysyvän ja varmistetun työtilatallennuksen sekä valitun
   AI-tarjoajan tunnistuksen. Julkaisuportit säilyvät samoina kuin paikallisesti.

Työkalun oma ohjelmaversio ei kuulu dataexporttiin. Palvelimella käytetään samaan
versioon lukittua `vnetcon-docs`-checkoutia, julkaistua pakettia tai konttikuvaa
kuin paikallisessa hyväksytyssä pilotissa. `import` tarkistaa formaatti- ja
työkaluversioiden yhteensopivuuden ennen tilan käyttöönottoa.

## 5. Virkistyminen Git-muutoksista

Palvelu tukee neljää laukaisutapaa samalla julkaisuputkella:

1. **CI:** projektin oma CI ilmoittaa refresh controllerille projektin, refin ja
   tarkan commit-SHA:n. Lähdeprojekti ei julkaise dokumentaatiota itse.
2. **Webhook:** Git-palvelun allekirjoitettu push- tai pull request -webhook
   lisää refresh-työn jonoon.
3. **Poll:** controller tarkistaa refien commit-SHA:t määräajoin. Sopii pilottiin
   ja ympäristöihin, joissa webhookia ei voi käyttää.
4. **Manual:** ylläpitäjä käynnistää päivityksen CLI:llä tai hallintarajapinnasta.

Kaikki laukaisutavat suorittavat saman tilakoneen:

```text
muutos havaittu
  -> ref sallittu?
  -> täysi commit-SHA ratkaistu
  -> eristetty tilapäinen lähdekoodin checkout
  -> dokumentaation omistajuusmalli?
       repository:
         -> vnetcon-docs luetaan samasta lähdecommitista
       managed:
         -> refin dokumentaatiotyötila lukittu päivityksen ajaksi
         -> baseline-SHA ja uusi lähde-SHA verrattu
         -> päivitystarve määritetty Git-diffistä
         -> vnetcon-docs päivittää työtilan dokumentit paikallaan
         -> muutos tallennettu työtilan omaan historiaan
         -> sisältöhyväksyntä päivityspolitiikan mukaan
  -> vnetcon-docs-aineiston validointi
  -> dokumenttien normalisointi
  -> projektikohtaisen indeksin muodostus
  -> tarkistussummat ja manifesti
  -> upload muuttumattomaan release-polkuun
  -> snapshot merkitään valmiiksi
  -> staging-kanavan paketti rakennetaan tarvittaessa
  -> runtime saa katalogin versionvaihtoilmoituksen
  -> tilapäinen lähdekoodin checkout hävitetään
```

Epäonnistunut julkaisu ei muuta aktiivista kanavaa. Sama
`(project_id, source_commit_sha, documentation_revision, schema_version)` on
idempotentti: saman dokumentaatiorevision uudelleenajo joko palauttaa jo valmiin
snapshotin tai rakentaa puuttuvan snapshotin loppuun.

### 5.1 Managed-dokumentaation päivittämisen tila

Lähdekoodimuutoksen havaitseminen ja dokumentaation sisällöllinen päivittäminen
ovat eri asioita. Nykyinen `vnetcon-docs` osaa tunnistaa Git-diffin vaikutuksia,
mutta sisällön luotettava päivittäminen voi vaatia AI-agentin tai ihmisen
hyväksynnän. Refresh-työllä on siksi vähintään tilat:

```text
detected -> updating -> review_required -> approved -> published
                       \-> failed
```

`manual`-tilassa järjestelmä valmistelee diffin ja työjonon. `ai_with_review`-
tilassa agentti päivittää dokumentaatiotyötilan, mutta julkaisu odottaa
hyväksyntää. `ai_auto` voidaan sallia erikseen vain projekteille ja
muutostyypeille, joiden riski hyväksytään. Validoinnin läpäiseminen ei yksin
todista dokumentaation sisällöllistä oikeellisuutta.

Repository-mallissa tätä sisällönpäivitystilakonetta ei ajeta. Palvelu julkaisee
lähdecommitissa olevan dokumentaation sellaisenaan validoinnin jälkeen. Havaittu
puute raportoidaan projektin kehitysprosessiin, jossa dokumentaatiomuutos tehdään
ja hyväksytään normaalina Git-muutoksena.

### 5.2 Uuden managed-haaran dokumentaatiotila

Kun refille ei vielä ole työtilaa, se alustetaan seuraavassa järjestyksessä:

1. määritetään lähdehaaran merge-base oletushaaraan;
2. etsitään oletushaaran viimeisin hyväksytty dokumentaatiorevisio, jonka
   lähde-SHA on merge-basen kanssa yhteensopiva;
3. haaran työtila forkataan tästä dokumentaatiorevisiosta;
4. dokumentaatio synkronoidaan merge-basesta haaran nykyiseen SHA:han;
5. jos sopivaa lähtötilaa ei ole, tehdään projektin täydellinen ensimmäinen
   kartoitus.

Force-push tai muu historiaa uudelleenkirjoittava muutos havaitaan siitä, ettei
uusi SHA ole työtilan baselinen jälkeläinen. Tällöin inkrementaalista päivitystä
ei jatketa sokkona, vaan työtila palautetaan yhteiseen esi-isään tai rakennetaan
uudelleen hyväksytystä lähtötilasta.

### 5.3 Merkittävästi eriytyneet haarat

Pitkäikäisiä haaroja, kuten `master`, `development` ja `release/*`, käsitellään
itsenäisinä dokumentaatioversioina. Järjestelmä ei oleta, että niiden moduulit,
rajapinnat, tietomallit, konfiguraatiot tai edes dokumenttirakenne ovat samat.

Repository-mallissa dokumentaatio luetaan aina samasta tarkasta commitista kuin
haaran lähdekoodi. `development`-haaran `vnetcon-docs/`-hakemistoa ei täydennetä
`master`-haaran dokumenteilla eikä päinvastoin.

Managed-mallissa jokaisella refillä on oma pitkäikäinen työtila:

```text
(project_id, master)      -> oma baseline ja dokumentaatiorevisio
(project_id, development) -> oma baseline ja dokumentaatiorevisio
(project_id, release/3.2) -> oma baseline ja dokumentaatiorevisio
```

Oletushaaran dokumentaatiota käytetään uuden haaran siemenenä vain työtilan
ensimmäisessä luonnissa ja vain, jos yhteensopiva merge-base voidaan osoittaa.
Tämän jälkeen haaran työtilaa päivitetään sen omasta baselinesta eikä sitä
automaattisesti ylikirjoiteta oletushaaran dokumentaatiolla. Jos haarat olivat
jo ennen käyttöönottoa eriytyneet merkittävästi eikä luotettavaa yhteistä
dokumentaatiolähtötilaa ole, haaralle tehdään erillinen täydellinen kartoitus.

Kun feature- tai development-haara yhdistetään kohdehaaraan, kohdehaaran
dokumentaatio päivitetään kohdehaaran todellisesta merge-commitista. Lähdehaaran
dokumentaatiotyötilaa ei kopioida sellaisenaan kohdehaaran työtilaksi.

Palvelutason turvallisuus- ja julkaisupolitiikka tulee keskitetystä
`multiproject-mcp.yaml`-konfiguraatiosta. Haarassa oleva projektikohtainen
`vnetcon.config.yaml` saa kuvata kyseisen haaran rakennetta ja dokumentointia,
mutta se ei saa laajentaa omia ref-, käyttöoikeus- tai julkaisuoikeuksiaan.

Yhdessä julkaisupaketissa on enintään yksi snapshot kustakin `project_id`:stä.
Eri ympäristöt kuvataan eri paketteina tai kanavina, esimerkiksi:

```text
production -> frontend@main + api@main
staging    -> frontend@development + api@development
```

Näin oletushaku ei voi yhdistää saman projektin `master`- ja `development`-
aineistoa. Muun haaran dokumentaatioon siirrytään eksplisiittisellä kanava-,
ref- tai `release_id`-valinnalla. Valinta ratkaistaan pyynnön alussa tarkaksi
snapshotiksi ja säilyy samana koko pyynnön ajan.

Poistetun haaran viimeinen snapshot ja managed-työtila säilytetään haaratyypin
retention-politiikan ajan. Tagijulkaisuja käsitellään muuttumattomina; saman
tagin siirtäminen toiseen committiin hylätään tai vaatii erillisen ylläpitäjän
poikkeuskäsittelyn.

### 5.4 Katalogin virkistäminen

Runtime ei korvaa aktiivista dataansa tiedosto kerrallaan. Se:

1. lukee uuden katalogi- tai kanavaversion;
2. validoi manifestin ja tarkistussummat;
3. avaa uudet projektikohtaiset indeksit rinnakkain vanhojen kanssa;
4. vaihtaa aktiivisen `bundle_id`:n atomisesti;
5. vapauttaa vanhat indeksit vasta keskeneräisten pyyntöjen valmistuttua.

Käyttäjäpyyntö näkee koko käsittelynsä ajan yhden ja saman `bundle_id`:n.

## 6. Projektien eristäminen

Projektien eristys ei perustu AI-mallille annettuun ohjeeseen. Se toteutetaan
palvelimen tietomallissa, indekseissä ja MCP-työkaluissa.

MCP-palvelin voi taata, ettei yksittäinen projektihaku palauta toisen projektin
aineistoa. Se ei voi täysin estää AI-clienttiä tekemästä virheellistä päätelmää,
jos käyttäjä hakee samaan keskusteluun aineistoa useasta projektista. Siksi
palvelu palauttaa aina alkuperätiedot, pitää haut yksiprojektisina ja tarjoaa
projektien väliset yhteydet vain hyväksyttyinä rajapintatietueina. AI-clientille
annettavat työkalu- ja sovellusohjeet täydentävät näitä teknisiä rajoja, mutta
niitä ei käsitellä varsinaisena eristys- tai tietoturvamekanismina.

### 6.1 Fyysinen tai vahva looginen ositus

Jokaisella snapshotilla on oma dokumenttijoukkonsa ja oma indeksinsä:

```text
projects/<project_id>/releases/<release_id>/
  manifest.json
  documents/
  search-index/
  checksums.json
```

Ensimmäisessä versiossa eri projektien dokumentteja ei tallenneta samaan
vektori- tai kokotekstikokoelmaan. Tämä tekee puuttuvasta suodattimesta
mahdottoman vuotoreitin.

Jos myöhemmin käytetään jaettua hakupalvelua, `project_id`, `release_id` ja
`authorization_domain` ovat pakollinen palvelinpuolinen esisuodatus. Pelkkää
hakutulosten jälkisuodatusta ei hyväksytä.

### 6.2 Projekti on pakollinen hakuskooppi

Normaali dokumenttihaku kohdistuu aina tasan yhteen projektiin:

```text
search(project_id, query, version?)
fetch(project_id, release_id, document_id)
```

Palvelu ei tarjoa oletusarvoista "hae kaikkialta ja yhdistä" -toimintoa.
Jos käyttäjä ei ole valinnut projektia, palvelu palauttaa projektivalinnan tai
listan sallituista projekteista sen sijaan, että hakisi kaikista.

`fetch` tarkistaa, että pyydetty dokumentti kuuluu sekä annettuun projektiin
että aktiivisen julkaisupaketin valitsemaan snapshotiin. Pelkkä arvattava
dokumenttitunniste tai S3-polku ei riitä.

### 6.3 Hakutuloksen pakollinen alkuperä

Jokainen tulos sisältää vähintään:

```json
{
  "project_id": "customer-api",
  "release_id": "customer-api-<full-sha>",
  "ref": "main",
  "source_commit_sha": "<full-sha>",
  "document_path": "moduulit/orders/yleiskuvaus.md",
  "section_id": "order-creation",
  "source_references": ["src/orders/service.ts#..."],
  "content": "..."
}
```

Runtime ei koskaan poista alkuperätietoa ennen kuin tulos palautetaan
AI-clientille.

### 6.4 Nimet eivät yhdistä käsitteitä

Kahdessa projektissa esiintyvä sama nimi, kuten `Customer`, `Order` tai
`Payment`, ei tarkoita samaa käsitettä. Palvelu ei yhdistä entiteettejä nimen,
samankaltaisuuden tai embedding-etäisyyden perusteella.

Projektien välinen vastaavuus on olemassa vain, jos se on kirjattu hyväksyttyyn
rajapintakuvaukseen eksplisiittisillä osapuolilla ja lähteillä.

## 7. Projektien välisten rajapintojen mallintaminen

Projektien välinen tieto säilytetään omassa `interfaces`-nimiavaruudessa. Sitä
ei sijoiteta kummankaan projektin sisäiseksi totuudeksi eikä generoida
automaattisesti hakutuloksia yhdistelemällä.

Suositus on oma versionhallittu integraatiorepository. Pienessä käyttöönotossa
rajapintatietueet voivat olla myös tämän palvelun konfiguraation yhteydessä,
mutta niillä pitää silti olla oma hyväksyntäprosessi.

### 7.1 Rajapintatietue

```yaml
schema_version: 1
interface_id: customer-order-api-v2
display_name: Customer order API
status: active

provider:
  project_id: customer-api
  role: HTTP API provider
  contract:
    type: openapi
    source: openapi/customer-api.yaml
    version: "2.4"

consumers:
  - project_id: customer-frontend
    role: HTTP API consumer
    source_references:
      - src/api/orders-client.ts

transport:
  protocol: HTTPS
  authentication: OAuth2 client credentials

data_mappings:
  - provider_type: customer-api:OrderResponse
    consumer_type: customer-frontend:Order
    description: Frontend käyttää vain tunnistetta, tilaa ja yhteenvetosummaa.

compatibility:
  policy: backward-compatible-within-major
  validated_at: "2026-10-03T10:15:00Z"

documentation:
  - project_id: customer-api
    path: moduulit/orders/rajapinta.md
  - project_id: customer-frontend
    path: moduulit/orders/api-client.md
```

Tietue ilmaisee suunnan ja roolit. Se ei väitä, että providerin ja consumerin
tietomallit olisivat sama malli.

### 7.2 Rajapinnan julkaiseminen

Rajapintatietue hyväksytään julkaisupakettiin vain, jos:

- kaikki viitatut `project_id`:t ovat olemassa;
- viitatut projektisnapshotit kuuluvat samaan julkaisupakettiin;
- dokumentti- ja sopimuslähteet löytyvät valituista snapshoteista;
- mahdolliset OpenAPI-, AsyncAPI- tai skeemaversiot täsmäävät;
- rajapinnan validointi on onnistunut;
- käyttöoikeusalue sallii kaikkien osapuolten näyttämisen käyttäjälle.

Automaattinen analyysi saa ehdottaa uusia rajapintoja tai muutoksia, mutta se ei
saa julkaista pääteltyä projektien välistä yhteyttä ilman hyväksyttyä tietuetta.

### 7.3 Rajapintahaku

Projektidokumentaation ja integraatioiden työkalut pidetään erillään:

- `list_interfaces(project_id?)`
- `get_interface(interface_id)`
- `search_interfaces(query, project_id?)`

Rajapintahaku palauttaa rajapintatietueen sekä lähdeviitteet. Se ei tee vapaata
hakua kaikkien osapuolten sisäisestä dokumentaatiosta.

Jos AI-clientti tarvitsee yksityiskohtia, se hakee ne tämän jälkeen erikseen
asianomaisesta projektista `search`- tai `fetch`-työkalulla. Näin myös mallille
näkyy, milloin konteksti vaihtuu projektista toiseen.

## 8. MCP-työkalurajapinta

Ensimmäisen version työkalut:

### `list_projects`

Palauttaa vain käyttäjän turvallisuusalueelle sallitut projektit sekä niiden
näyttönimet. Ei palauta dokumenttisisältöä.

### `get_project_version`

Palauttaa aktiivisen kanavan valitseman refin, täyden commit-SHA:n,
snapshot-julkaisun ajan ja `vnetcon-docs`-työkaluversion.

### `search`

Pakolliset argumentit:

- `project_id`
- `query`

Valinnaiset argumentit:

- `release_id` tai sallittu versioalias;
- dokumenttityyppi;
- tulosmäärä.

Palauttaa projektin sisäisiä, alkuperätiedoilla varustettuja osumia. Ei hae
muista projekteista.

### `fetch`

Pakolliset argumentit:

- `project_id`
- `release_id`
- `document_id` tai palvelimen palauttama opaque-tunniste.

Palauttaa yhden dokumentin tai rajatun osan siitä.

### `list_interfaces`

Listaa julkaistut rajapinnat, joissa valittu projekti on provider tai consumer.

### `get_interface`

Palauttaa yhden hyväksytyn rajapintatietueen, osapuolten roolit ja lähteet.

### `search_interfaces`

Hakee vain hyväksytyistä rajapintatietueista. Se ei hae osapuolten sisäisistä
projektidokumenteista eikä muodosta uusia yhteyksiä hakutulosten perusteella.

Ensimmäiseen versioon ei toteuteta yleistä `search_all_projects`-työkalua.
Jos sille myöhemmin löytyy todellinen tarve, tulokset palautetaan projekteittain
ryhmiteltyinä, ei yhdeksi relevance-listaksi yhdistettyinä.

## 9. Käyttöoikeudet

Palvelin tarkistaa jokaisessa työkalukutsussa:

1. käyttäjän tai sovellusinstanssin turvallisuusalueen;
2. sallitut `project_id`:t;
3. sallitut julkaisukanavat ja versiot;
4. kuuluuko pyydetty objekti sallittuun projektiin ja snapshotiin;
5. saako käyttäjä nähdä rajapinnan kaikki osapuolet.

Projektin nimi, promptissa ilmoitettu käyttäjä tai MCP-argumenttina annettu
ryhmä eivät ole valtuutuksen lähteitä.

Jos AI-clientin kautta ei välity luotettavaa käyttäjä- tai ryhmäidentiteettiä,
eri näkyvyysalueille julkaistaan erilliset MCP-instanssit, tunnelit ja kanavat.
Ensimmäisen tuotantoversion ei pidä rakentaa käyttäjäkohtaista valtuutusta
epävarman identiteetin varaan.

## 10. Julkaisuformaatti

Projektisnapshot sisältää vähintään:

```text
manifest.json
documents.jsonl
documents/<normalisoidut dokumentit>
search-index/<projektikohtainen indeksi>
checksums.json
```

Manifestissa ovat vähintään:

- `project_id`;
- repositoryn tunniste, ei välttämättä salassa pidettävää kloonausosoitetta;
- alkuperäinen ref;
- lähdekoodin täysi commit-SHA;
- dokumentaatiotyötilan revision täysi SHA tai sisältötiiviste;
- dokumentaation viimeisin synkronointibaseline;
- snapshotin `release_id`;
- `docs_schema_version`;
- käytetty `vnetcon_docs_version`;
- luontiaika;
- validointitulokset;
- dokumenttien määrä;
- indeksi- ja formaattiversiot;
- tiedostojen tarkistussummat;
- CI-ajon tai muun provenance-tiedon tunniste.

Lyhyttä Git-hashia voidaan näyttää käyttöliittymässä, mutta sitä ei käytetä
identiteettinä, tallennusavaimena tai auditointitietona.

## 11. Hakutekniikka

Ensimmäisessä versiossa käytetään projektikohtaista determinististä
kokotekstihakua, esimerkiksi SQLite FTS5 -indeksiä.

Dokumentit pilkotaan otsikkorakenteen perusteella. Jokainen osa säilyttää:

- projektin;
- snapshotin;
- dokumenttipolun;
- otsikkopolun;
- lähdeviitteet;
- dokumenttityypin;
- sisällön.

Vektorihakua ei tarvita ensimmäiseen versioon. Se voidaan lisätä mitatun
hakulaadun perusteella myöhemmin, mutta indeksit pidetään edelleen projekti- ja
snapshotkohtaisina. Embedding-samankaltaisuus ei koskaan muodosta projektien
välistä rajapintaa.

## 12. Tietoturvainvarianssit

- Runtime on vain lukeva eikä sillä ole Git-tunnuksia.
- Refresh- ja päivityskomponentit käyttävät vähimmän oikeuden
  repositorykohtaisia lukutunnuksia.
- Dokumentaatiotyötila ei anna kirjoitusoikeutta lähdekoodirepositoryyn.
- Checkoutit ovat tilapäisiä ja ajokohtaisesti eristettyjä.
- Ref ratkaistaan täydeksi SHA:ksi ennen checkoutia ja julkaisua.
- Ref- ja dokumenttipolkuja ei käytetä tarkistamattomina tiedostopolkuna.
- Publisher ei seuraa dokumenttijuuren ulkopuolelle johtavia symlinkkejä.
- Runtime palauttaa vain manifestissa lueteltuja tiedostoja.
- Artefaktien tarkistussummat validoidaan ennen aktivointia.
- Käyttäjän syötettä ei käytetä tallennusavaimen tai paikallisen polun osana.
- Dokumentin sisältämää kehotetta käsitellään datana, ei palvelimen ohjeena.
- Pyyntö-, dokumentti- ja vastauskoot rajataan.
- Välimuistin avain sisältää turvallisuusalueen, `bundle_id`:n, `project_id`:n
  ja `release_id`:n.
- Lokeihin ei kirjoiteta salaisuuksia, kokonaisia dokumentteja tai käyttäjän
  koko kysymystä.

## 13. AWS-tuotantomalli

Suositeltu tuotantomalli:

```text
projektien CI:t tai refresh worker
  -> tilapäinen checkout
  -> pysyvä projektin ja refin dokumentaatiotyötila
  -> hyväksyntä
  -> S3 snapshotit ja indeksit
  -> katalogi / julkaisupaketit

AWS VPC, yksityinen subnet
  ECS Fargate
    MCP runtime
    OpenAI tunnel-client
      -> ulospäin avattu HTTPS-yhteys
```

Tukipalvelut:

- ECR konttikuville;
- S3 snapshot-artefakteille;
- DynamoDB tai yksittäinen ehdollisesti päivitettävä katalogiobjekti kanavien
  atomiseen vaihtoon;
- SQS refresh-töiden jonolle;
- EventBridge poll- ja retention-ajoille;
- Secrets Manager Git- ja tunnelisalaisuuksille;
- CloudWatch lokeille, metriikoille ja hälytyksille.

Pienessä käyttöönotossa katalogi voidaan tallentaa S3:een. Usean samanaikaisen
julkaisijan tapauksessa kanavaosoittimen päivitys tarvitsee optimistic locking-
tarkistuksen tai DynamoDB:n ehdollisen kirjoituksen.

## 14. Ensimmäisen version rajaus

Ensimmäinen toteutus sisältää:

- YAML-konfiguraation ja sen JSON Scheman;
- yhdestä `vnetcon-docs`-kloonista toimivan `init`-komennon ja
  alustariippumattomat käynnistimet;
- `discover`, `inspect-project`, `add-project`, `channel`, `config validate`,
  `doctor` ja `plan` -komennot konfiguraation muodostamiseen ja tarkistamiseen;
- `bootstrap`, `refresh`, `document`, `review`, `approve`, `publish`, `serve`,
  `status` ja `smoke-test` -komennot paikalliseen end-to-end-pilottiin;
- paikallisen filesystem-profiilin ja palvelimen S3-profiilin;
- versionoidut `export`- ja `import`-komennot managed-työtilojen turvalliseen
  siirtämiseen;
- sekä `repository`- että `managed`-omistajuusmallin;
- lähderepositoryt, joissa voi olla `vnetcon-docs/`-hakemisto mutta joissa sitä
  ei vaadita;
- yhden Git-palvelun vain lukevan kloonaustavan;
- projektin ja refin pysyvät dokumentaatiotyötilat sekä niiden oman historian;
- manual-, poll- ja CI-triggerit;
- `main`- ja `release/*`-refit;
- muuttumattomat snapshotit;
- projektikohtaisen tekstihakemiston;
- julkaisupaketin ja `development`/`production`-kanavat;
- MCP:n `list_projects`, `get_project_version`, `search`, `fetch`,
  `list_interfaces`, `get_interface` ja `search_interfaces` -työkalut;
- versionhallittujen rajapintatietueiden validoinnin;
- paikallisen tiedostovaraston ja S3-tallennuksen;
- Docker-kuvan;
- auditointiin riittävät tekniset lokit.

Ensimmäiseen versioon eivät kuulu:

- automaattisesti päätellyt ja julkaistut projektien väliset yhteydet;
- vapaa kaikkien projektien yhteishaku;
- vektorihaku;
- dokumentaation täysin automaattinen sisällöllinen kirjoittaminen ja julkaisu
  ilman määriteltyä hyväksyntäporttia;
- käyttäjän prompttiin perustuva valtuutus;
- MCP-runtimen suorittamat Git-operaatiot tuotannossa;
- julkaiseminen epäonnistuneen validoinnin jälkeen.

## 15. Hyväksymiskriteerit

### Paikallinen käyttöönotto ja siirrettävyys

- Puhdas `vnetcon-docs`-klooni pystyy alustamaan erillisen
  moniprojektityötilan yhdellä `init`-komennolla.
- Kahden paikallisen Git-projektin lisääminen, refien valinta ja paikallisen
  kanavan muodostaminen onnistuvat CLI-komennoilla ilman YAML:n käsinmuokkausta.
- `doctor` ja `plan` löytävät puuttuvan refin, väärän dokumentaatiomallin,
  puuttuvan agentin ja saavuttamattoman repositoryn ennen dokumentointia.
- Managed-työtila toimii julkaisupuolen checkout-kopiossa nykyisten
  `vnetcon-docs`-työnkulkujen kanssa, mutta ei näy lähderepositoryn Git-tilassa
  eikä voi tulla pushatuksi siihen.
- Paikallisesta pilotista voidaan julkaista ja hakea vähintään kahden projektin
  dokumentaatiota paikallisella MCP-runtimella.
- Versionoitu export/import säilyttää managed-dokumentaatiorevision, baselinen,
  hyväksyntätiedon ja snapshotin tarkistussummat.
- Runtime-only-palvelin voidaan käynnistää ilman Git- tai AI-tunnuksia
  hyväksytyistä snapshot-artefakteista.
- Self-refreshing-palvelin tuottaa samasta lähde-SHA:n ja
  dokumentaatiorevision yhdistelmästä saman julkaisutunnisteen kuin paikallinen
  ympäristö.
- Linux-, macOS- ja Windows-käynnistimet käyttävät samaa Node.js-toteutusta.

### Virkistyminen

- Uusi sallittuun refiin tehty commit tuottaa uuden snapshotin.
- Lähderepository pysyy muuttumattomana eikä siihen lisätä
  `vnetcon-docs/`-hakemistoa managed-mallissa.
- Repository-mallissa julkaistaan täsmälleen valitussa lähdecommitissa oleva
  `vnetcon-docs`-aineisto.
- Jokaisella seurattavalla managed-refillä on oma baseline ja
  dokumentaatiotyötila.
- `master`- ja `development`-haaroissa voi olla samanniminen dokumentti eri
  sisällöllä ilman, että sisältö tai hakuindeksi vuotaa haarasta toiseen.
- Haaran haku palauttaa aina valitun refin ja täyden source commit-SHA:n.
- Eri haarojen snapshotteja ei yhdistetä samaan projektikontekstiin tai
  välimuistiavaimeen.
- Kohdehaaran dokumentaatio muodostetaan merge-commitin todellisesta tilasta,
  ei kopioimalla lähdehaaran dokumentaatiotyötilaa.
- Sama lähdecommitin ja dokumentaatiorevision yhdistelmä ei tuota kahta
  ristiriitaista julkaisua.
- Epäonnistunut build ei muuta aktiivista kanavaa.
- Yhden projektin refresh ei vaihda toisen projektin snapshotia.
- Yksi käyttäjäpyyntö käyttää alusta loppuun samaa `bundle_id`:tä.

### Projektieristys

- Haku projektiin A ei voi palauttaa projektin B dokumenttia.
- Projektin B dokumenttitunnistetta ei voi hakea projektin A `fetch`-kutsulla.
- Sama käsitteen nimi kahdessa projektissa tuottaa kaksi erillistä tulosta vain,
  jos kumpaankin projektiin tehdään erillinen haku.
- Hakuvälimuisti ei palauta toisen projektin, version tai turvallisuusalueen
  tulosta.
- Tuloksesta voidaan aina todentaa projekti, commit ja dokumenttipolku.

### Rajapinnat

- Rajapinta näkyy vain hyväksytyn rajapintatietueen perusteella.
- Rajapinnan provider ja consumer säilyvät erillisinä rooleina.
- Rajapinta ei aktivoidu, jos viitattu projekti tai lähde puuttuu paketista.
- Sisäisiä tietomalleja ei merkitä samoiksi ilman eksplisiittistä mappingia.
- Käyttäjä, jolla ei ole oikeutta johonkin osapuoleen, ei näe rajapinnan kautta
  salattua tietoa tästä osapuolesta.

### Jäljitettävyys

- Jokainen vastaus voidaan jäljittää täyteen Git-SHA:han.
- Julkaisupaketti voidaan palauttaa myöhemmin samoilla snapshoteilla.
- Kanava voidaan palauttaa aikaisempaan pakettiin ilman uudelleenindeksointia.

## 16. Ehdotettu toteutusjärjestys

1. Määritellään dokumentaatiotyötilan, projektisnapshotin, julkaisupaketin ja
   rajapinnan JSON Schemat.
2. Toteutetaan konfiguraatiomalli sekä `init`, `add-project`, `channel`,
   `config validate`, `doctor` ja `plan` -komennot.
3. Toteutetaan repository-mallin lukeminen suoraan tarkasta lähdecommitista.
4. Toteutetaan managed-mallin Gitissä ohitettu dokumentaatiotyötila
   julkaisupuolen refikohtaisen checkout-kopion sisään.
5. Testataan nykyiset `vnetcon-docs`-työnkulut managed-checkoutissa sekä
   repository-mallissa.
6. Toteutetaan refresh controller sekä projektin ja refin työtilanhallinta.
7. Toteutetaan managed-haaran ensimmäisen työtilan forkkaus ja force-pushin
   käsittely.
8. Toteutetaan managed-dokumentaation päivitys- ja hyväksyntätilakone.
9. Toteutetaan publisher paikalliselle tiedostovarastolle.
10. Toteutetaan projektikohtainen tekstihakemisto.
11. Toteutetaan MCP-runtime yhdelle projektille.
12. Lisätään toinen projekti ja todistetaan eristys automaattisilla testeillä.
13. Toteutetaan julkaisupaketti ja atominen kanavanvaihto.
14. Toteutetaan paikallinen `pilot`-komento ja end-to-end-smoke-test.
15. Toteutetaan versioitu managed-tilan export/import.
16. Toteutetaan versionhallittu rajapintarekisteri ja sen MCP-työkalut.
17. Lisätään webhook-, poll- ja CI-triggerit.
18. Lisätään S3, refresh worker ja AWS-ajomalli.
19. Varmistetaan ChatGPT Enterprise -tunnelin jakelu- ja identiteettimalli.
20. Pilotoidaan rajatulla käyttäjäryhmällä ennen uusien repositoryjen liittämistä.

## 17. Avoimet päätökset

- Onko rajapintarekisteri aina oma repository vai voiko se olla osana jotakin
  arkkitehtuuriprojektia?
- Kuka hyväksyy projektien välisen rajapintatietueen muutoksen?
- Rakennetaanko julkaisupaketit manuaalisella promotionilla vai voiko staging
  seurata automaattisesti projektien uusimpia validoituja snapshoteja?
- Mitkä dokumenttiryhmät julkaistaan oletuksena AI-clienteille?
- Käytetäänkö paikalliseen indeksiin SQLite FTS5:tä vai muuta upotettua
  hakumoottoria?
- Mikä Git-palvelu toteutetaan ensimmäisenä webhook- ja tunnistusintegraatioksi?
- Näkevätkö kaikki ensimmäisen käyttöönoton käyttäjät saman korpuksen vai
  tarvitaanko heti useita turvallisuusalueita?
- Välittääkö valittu AI-client luotettavan identiteetin MCP:lle, vai tarvitaanko
  erilliset MCP-instanssit käyttäjäryhmittäin?
- Miten pitkään feature-, release- ja production-snapshotit säilytetään?
- Säilytetäänkö dokumentaatiotyötilojen historia paikallisessa Gitissä,
  sisäisessä Git-palvelussa vai versioidussa objektitallennuksessa?
- Mitkä muutokset voidaan julkaista automaattisesti ja mitkä vaativat ihmisen
  sisältöhyväksynnän?
- Sallitaanko repository-mallissa palvelun tuottaa vain raportteja vai myös
  erikseen hyväksyttäviä patch- tai pull request -ehdotuksia?

## 18. Päätösehdotus

Toteutetaan valmis `multiproject-mcp`-palvelu, joka osaa konfiguraation
perusteella havaita lähderepositoryjen Git-muutoksia, ylläpitää projektin ja
refin omia julkaisupuolen `vnetcon-docs`-työtiloja silloin, kun projekti käyttää
managed-mallia, ja lukea dokumentaation suoraan lähdecommitista silloin, kun
projekti käyttää repository-mallia. Lähderepositoryyn ei vaadita
`vnetcon-docs/`-hakemistoa eikä palvelulla ole siihen automaattista
kirjoitusoikeutta. Palvelu toimitetaan yhtenä tuotteena, mutta tuotannossa
Git-luku, managed-dokumentaation päivitys, julkaiseminen ja vain lukeva
MCP-runtime erotetaan eri prosesseiksi ja eri oikeusrooleihin.

Projektit pidetään erillisinä snapshotteina ja indekseinä. Normaali haku vaatii
aina yhden `project_id`:n. Projektien välinen tieto julkaistaan vain erillisen,
versionhallittavan ja hyväksyttävän rajapintatietueen kautta. Näin AI-clientti
voi käyttää useaa järjestelmää samassa keskustelussa ilman, että palvelu esittää
niiden sisäiset käsitteet tai dokumentit yhtenä fuusioituna järjestelmänä.
