# Pinoprofiili: yleinen (kaikki projektit)

Nämä haut toimivat kielestä riippumatta. `/vnetcon-init` yhdistää nämä
kielikohtaisiin profiileihin ja kirjoittaa tuloksen tiedostoon
[`../kartoitus.md`](../kartoitus.md).

Kaikki komennot ajetaan `vnetcon-docs/`-hakemistosta; `-C ..` osoittaa projektin
juureen. Käytä `git grep`iä, ei `grep -r`:ää — se rajaa automaattisesti
versioituihin tiedostoihin.

> **Käytä aina `-E`-lippua vuorottelussa.** `git grep 'a\|b'` käyttää
> perusregexiä, joka **ei tue `\|`-vuorottelua** kaikissa
> git-konfiguraatioissa — se palauttaa hiljaisen nollan, joka näyttää
> katvealueelta. Nolla osumaa väärästä lipusta on pahin mahdollinen virhe tässä
> menettelyssä, koska se on erottamaton aidosta katveesta. Kirjoita
> `git grep -nE 'a|b'`. Sama koskee jokaista hakua, jonka kirjoitat itse
> `kartoitus.md`:hen: **testaa se ja varmista että se tuottaa osumia.**

## Laajuus ja rakenne

```bash
git -C .. ls-files | wc -l
git -C .. ls-files | sed 's|/.*||' | sort | uniq -c | sort -rn | head -40
git -C .. ls-files | grep -oE '\.[a-z0-9]+$' | sort | uniq -c | sort -rn | head -25
git -C .. ls-files '<moduuli>/**' | sort
```

## Moduulien tunnistus (monorepo)

```bash
git -C .. ls-files | grep -E '(package\.json|pom\.xml|build\.gradle(\.kts)?|pyproject\.toml|go\.mod|[^/]+\.csproj|composer\.json|Cargo\.toml|Gemfile)$'
```

Jokainen osuma = moduuliehdokas (sen hakemisto). Jos osumia on vain juuressa,
projekti on yksi sovellus → moduulit muodostetaan lähdehakemistoista.

## Sisääntulopisteet (kieliriippumattomat vihjeet)

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

## Tietokanta ja tallennus

```bash
git -C .. ls-files | grep -iE 'migrat|schema|\.sql$'
git -C .. grep -niE 'SELECT |INSERT INTO|UPDATE .* SET|DELETE FROM|CREATE TABLE' -- '<moduuli>'
git -C .. grep -niE 'redis|elastic|opensearch|s3|blob|bucket|minio' -- '<moduuli>'
```

## Ulkoiset kutsut

```bash
git -C .. grep -niE 'https?://' -- '<moduuli>' | grep -viE 'schema|xmlns|license|example\.com'
git -C .. grep -niE 'base_?url|endpoint|host|_URI' -- '<moduuli>'
```

## Konfiguraatio ja ominaisuusliput

```bash
git -C .. ls-files | grep -iE '\.(env\.example|ya?ml|toml|ini|properties|edn|json)$' | grep -viE 'package-lock|node_modules'
git -C .. grep -niE 'process\.env|os\.environ|System\.getenv|getenv\(' -- '<moduuli>'
```

## Testit ja build

```bash
git -C .. ls-files | grep -iE '(^|/)(test|tests|spec|__tests__)/|\.(test|spec)\.[a-z]+$' | head -30
git -C .. ls-files | grep -iE '^(Makefile|justfile|Taskfile|.*\.sh)$'
git -C .. ls-files '.github/workflows/*' '.gitlab-ci.yml' 'azure-pipelines.yml'
```

CI-konfiguraatio on paras lähde sille, mitkä komennot **oikeasti** ajetaan.

## Muutoshistoria (kun etsit "miksi")

```bash
git -C .. log --oneline -20 -- '<moduuli>'
git -C .. log -S'<tunniste>' --oneline -- '<moduuli>'   # milloin tunniste lisättiin/poistettiin
```

## Ohita nämä

Generoitu koodi, riippuvuudet ja tuotokset — ne eivät kuulu dokumentaatioon:
`node_modules/`, `dist/`, `build/`, `target/`, `vendor/`, `.venv/`, `generated/`,
lock-tiedostot, minifoidut niput, snapshot-testien tulokset.
