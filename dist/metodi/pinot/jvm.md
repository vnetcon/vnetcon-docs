# Pinoprofiili: JVM (Java / Kotlin, Spring / Quarkus / Micronaut)

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<m>` = moduulin polku.

## Manifesti ja moduulirakenne

```bash
git -C .. ls-files '*pom.xml' '*build.gradle' '*build.gradle.kts' 'settings.gradle*'
git -C .. show HEAD:settings.gradle           # monirepon moduulit
git -C .. grep -n '<module>' -- 'pom.xml'     # Maven-alimoduulit
```

## Sisääntulopisteet

```bash
# Spring MVC / WebFlux
git -C .. grep -nE '@(RestController|Controller|RequestMapping|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)' -- '<m>'
# JAX-RS (Quarkus, Jersey)
git -C .. grep -nE '@(Path|GET|POST|PUT|DELETE|Produces|Consumes)' -- '<m>'
# Viestinvälitys
git -C .. grep -nE '@(KafkaListener|RabbitListener|JmsListener|SqsListener|Incoming|Outgoing)' -- '<m>'
# Ajastukset ja käynnistys
git -C .. grep -nE '@(Scheduled|EnableScheduling|PostConstruct)|CommandLineRunner|ApplicationRunner' -- '<m>'
# GraphQL
git -C .. grep -nE '@(QueryMapping|MutationMapping|SchemaMapping)' -- '<m>'
```

## Datan muodon määrittelijät

bash (macOS, Linux, WSL, Git Bash):

```bash
# DTO:t ja validointi (= rajapintasopimus)
git -C .. grep -nE '@(Valid|NotNull|NotBlank|Size|Pattern|JsonProperty|JsonIgnore)' -- '<m>'
git -C .. ls-files '<m>/**/dto/**' '<m>/**/*Dto*' '<m>/**/*Request*' '<m>/**/*Response*'
# Entiteetit
git -C .. grep -nE '@(Entity|Table|Column|Id|ManyToOne|OneToMany|Embeddable)' -- '<m>'
# Kotlin data classit
git -C .. grep -nE '^\s*data class ' -- '<m>'
# OpenAPI-määrittely
git -C .. ls-files '**/openapi*.y*ml' '**/*.json' | grep -i -E 'openapi|swagger'
```

PowerShell (Windows ilman bashia):

```powershell
# DTO:t ja validointi (= rajapintasopimus)
git -C .. grep -nE '@(Valid|NotNull|NotBlank|Size|Pattern|JsonProperty|JsonIgnore)' -- '<m>'
git -C .. ls-files '<m>/**/dto/**' '<m>/**/*Dto*' '<m>/**/*Request*' '<m>/**/*Response*'
# Entiteetit
git -C .. grep -nE '@(Entity|Table|Column|Id|ManyToOne|OneToMany|Embeddable)' -- '<m>'
# Kotlin data classit
git -C .. grep -nE '^\s*data class ' -- '<m>'
# OpenAPI-määrittely
git -C .. ls-files '**/openapi*.y*ml' '**/*.json' | Select-String 'openapi|swagger'
```

## Tietokanta

```bash
git -C .. ls-files '**/db/migration/**' '**/db/changelog/**' '**/*.sql'   # Flyway / Liquibase
git -C .. grep -nE '@(Query|Modifying)|JdbcTemplate|EntityManager|createQuery|jooq' -- '<m>'
git -C .. grep -nE 'interface \w+Repository' -- '<m>'                     # Spring Data
```

Spring Data -repositoriot: metodin **nimi** on kysely — kirjaa nimi, älä kuvittele
SQL:ää. Migraatiot (Flyway `V<n>__*.sql`) ovat datarakenteiden totuus.

## Ulkoiset kutsut

```bash
git -C .. grep -nE 'RestTemplate|WebClient|@FeignClient|HttpClient|OkHttp' -- '<m>'
git -C .. grep -nE 'KafkaTemplate|RabbitTemplate|SqsTemplate|S3Client' -- '<m>'
```

## Konfiguraatio ja komennot

```bash
git -C .. ls-files '<m>/src/main/resources/application*'
git -C .. grep -nE '@(Value|ConfigurationProperties|ConfigProperty)' -- '<m>'
```

Testikomento: `mvn -pl <m> test` / `./gradlew :<m>:test`. Tarkista CI:stä.

## Huomiot

- **Annotaatiot ovat sisääntulon totuus** — reitit eivät ole yhdessä
  reititystiedostossa vaan hajallaan controllereissa.
- Rajapinta + toteutus on erillään: seuraa `interface` → `@Service`-luokka.
- AOP, interceptorit ja filtterit lisäävät vaiheita, jotka eivät näy
  controllerissa: etsi `@Aspect`, `Filter`, `HandlerInterceptor`, ja merkitse ne
  prosessikuvauksen vaiheiksi.
- `target/`, `build/`, generoidut MapStruct-/QueryDSL-luokat eivät ole kohteita.
