# Pinoprofiili: yleinen (kaikki projektit)

Nämä haut toimivat kielestä riippumatta. `/vnetcon-init` yhdistää nämä
kielikohtaisiin profiileihin ja kirjoittaa tuloksen tiedostoon
[`../kartoitus.md`](../kartoitus.md).

Kaikki komennot ajetaan `vnetcon-docs/`-hakemistosta; `-C ..` osoittaa projektin
juureen. Käytä `git grep`iä, ei `grep -r`:ää — se rajaa automaattisesti
versioituihin tiedostoihin.

Jokaisessa osiossa on kaksi lohkoa. Valitse ne **kuoren**, ei käyttöjärjestelmän
mukaan: bash-lohko pätee macOS:llä, Linuxilla, WSL:ssä ja Git Bashissa,
PowerShell-lohko silloin kun bashia ei ole käytettävissä.

> **Käytä aina `-E`-lippua vuorottelussa.** `git grep 'a\|b'` käyttää
> perusregexiä, joka **ei tue `\|`-vuorottelua** kaikissa
> git-konfiguraatioissa — se palauttaa hiljaisen nollan, joka näyttää
> katvealueelta. Nolla osumaa väärästä lipusta on pahin mahdollinen virhe tässä
> menettelyssä, koska se on erottamaton aidosta katveesta. Kirjoita
> `git grep -nE 'a|b'`. Sama koskee jokaista hakua, jonka kirjoitat itse
> `kartoitus.md`:hen: **testaa se ja varmista että se tuottaa osumia.**

> **`Select-String` on oletuksena kirjainkoosta piittaamaton.** Se vastaa
> `grep -i`:tä, ei `grep`iä. Kun bash-rivillä lukee `grep -E`, kirjoita
> `Select-String -CaseSensitive`. Muuten saat ylimääräisiä osumia, jotka
> näyttävät aidoilta — sama hiljainen virhe toisin päin kuin yllä.

## Laajuus ja rakenne

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files | wc -l
git -C .. ls-files | sed 's|/.*||' | sort | uniq -c | sort -rn | head -40
git -C .. ls-files | grep -oE '\.[a-z0-9]+$' | sort | uniq -c | sort -rn | head -25
git -C .. ls-files '<moduuli>/**' | sort
```

PowerShell (Windows ilman bashia), ilman putkityökaluja:

```powershell
(git -C .. ls-files).Count
git -C .. ls-files | ForEach-Object { ($_ -split '/')[0] } | Group-Object | Sort-Object Count -Descending | Select-Object -First 40 Count, Name
git -C .. ls-files | ForEach-Object { [IO.Path]::GetExtension($_) } | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 25 Count, Name
git -C .. ls-files '<moduuli>/**' | Sort-Object
```

## Moduulien tunnistus (monorepo)

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files | grep -E '(package\.json|pom\.xml|build\.gradle(\.kts)?|pyproject\.toml|go\.mod|[^/]+\.csproj|composer\.json|Cargo\.toml|Gemfile)$'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files | Select-String -CaseSensitive '(package\.json|pom\.xml|build\.gradle(\.kts)?|pyproject\.toml|go\.mod|[^/]+\.csproj|composer\.json|Cargo\.toml|Gemfile)$'
```

Jokainen osuma = moduuliehdokas (sen hakemisto). Jos osumia on vain juuressa,
projekti on yksi sovellus → moduulit muodostetaan lähdehakemistoista.

## Sisääntulopisteet (kieliriippumattomat vihjeet)

bash (macOS, Linux, WSL, Git Bash):

```bash
# HTTP-verbit ja polkumerkkijonot
git -C .. grep -nE '"(GET|POST|PUT|PATCH|DELETE)"|/(api|v[0-9])/' -- '<moduuli>'
# Ajastukset
git -C .. grep -niE 'cron|schedule|@Scheduled|setInterval|rrule' -- '<moduuli>'
# Viestijonot ja tapahtumat
git -C .. grep -niE 'queue|topic|subscribe|consumer|producer|kafka|rabbit|sqs|sns|pubsub' -- '<moduuli>'
# Serverless-määrittelyt
git -C .. ls-files | grep -iE 'serverless\.y|template\.ya?ml|function\.json|\.tf$'
```

PowerShell (Windows ilman bashia):

```powershell
# HTTP-verbit ja polkumerkkijonot
git -C .. grep -nE '"(GET|POST|PUT|PATCH|DELETE)"|/(api|v[0-9])/' -- '<moduuli>'
# Ajastukset
git -C .. grep -niE 'cron|schedule|@Scheduled|setInterval|rrule' -- '<moduuli>'
# Viestijonot ja tapahtumat
git -C .. grep -niE 'queue|topic|subscribe|consumer|producer|kafka|rabbit|sqs|sns|pubsub' -- '<moduuli>'
# Serverless-määrittelyt
git -C .. ls-files | Select-String 'serverless\.y|template\.ya?ml|function\.json|\.tf$'
```

## Tietokanta ja tallennus

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files | grep -iE 'migrat|schema|\.sql$'
git -C .. grep -niE 'SELECT |INSERT INTO|UPDATE .* SET|DELETE FROM|CREATE TABLE' -- '<moduuli>'
git -C .. grep -niE 'redis|elastic|opensearch|s3|blob|bucket|minio' -- '<moduuli>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files | Select-String 'migrat|schema|\.sql$'
git -C .. grep -niE 'SELECT |INSERT INTO|UPDATE .* SET|DELETE FROM|CREATE TABLE' -- '<moduuli>'
git -C .. grep -niE 'redis|elastic|opensearch|s3|blob|bucket|minio' -- '<moduuli>'
```

## Ulkoiset kutsut

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -niE 'https?://' -- '<moduuli>' | grep -viE 'schema|xmlns|license|example\.com'
git -C .. grep -niE 'base_?url|endpoint|host|_URI' -- '<moduuli>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -niE 'https?://' -- '<moduuli>' | Select-String -NotMatch 'schema|xmlns|license|example\.com'
git -C .. grep -niE 'base_?url|endpoint|host|_URI' -- '<moduuli>'
```

## Konfiguraatio ja ominaisuusliput

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files | grep -iE '\.(env\.example|ya?ml|toml|ini|properties|edn|json)$' | grep -viE 'package-lock|node_modules'
git -C .. grep -niE 'process\.env|os\.environ|System\.getenv|getenv\(' -- '<moduuli>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files | Select-String '\.(env\.example|ya?ml|toml|ini|properties|edn|json)$' | Select-String -NotMatch 'package-lock|node_modules'
git -C .. grep -niE 'process\.env|os\.environ|System\.getenv|getenv\(' -- '<moduuli>'
```

## Testit ja build

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files | grep -iE '(^|/)(test|tests|spec|__tests__)/|\.(test|spec)\.[a-z]+$' | head -30
git -C .. ls-files | grep -iE '^(Makefile|justfile|Taskfile|.*\.sh)$'
git -C .. ls-files '.github/workflows/*' '.gitlab-ci.yml' 'azure-pipelines.yml'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files | Select-String '(^|/)(test|tests|spec|__tests__)/|\.(test|spec)\.[a-z]+$' | Select-Object -First 30
git -C .. ls-files | Select-String '^(Makefile|justfile|Taskfile|.*\.sh)$'
git -C .. ls-files '.github/workflows/*' '.gitlab-ci.yml' 'azure-pipelines.yml'
```

CI-konfiguraatio on paras lähde sille, mitkä komennot **oikeasti** ajetaan.

## Muutoshistoria (kun etsit "miksi")

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. log --oneline -20 -- '<moduuli>'
git -C .. log -S'<tunniste>' --oneline -- '<moduuli>'   # milloin tunniste lisättiin/poistettiin
```

PowerShell (Windows ilman bashia) — `-S` erotetaan välilyönnillä, muuten
PowerShell katkaisee argumentin lainausmerkkiin:

```powershell
git -C .. log --oneline -20 -- '<moduuli>'
git -C .. log -S '<tunniste>' --oneline -- '<moduuli>'   # milloin tunniste lisättiin/poistettiin
```

## Ohita nämä

Generoitu koodi, riippuvuudet ja tuotokset — ne eivät kuulu dokumentaatioon:
`node_modules/`, `dist/`, `build/`, `target/`, `vendor/`, `.venv/`, `generated/`,
lock-tiedostot, minifoidut niput, snapshot-testien tulokset.
