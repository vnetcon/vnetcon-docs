# Pinoprofiili: Go

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<m>` = moduulin polku.

## Manifesti ja moduulirakenne

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files '*go.mod' 'go.work'
git -C .. show HEAD:<m>/go.mod
git -C .. ls-files '<m>/cmd/**'      # yksi binääri per cmd/-alihakemisto = moduuliehdokas
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files '*go.mod' 'go.work'
git -C .. show HEAD:<m>/go.mod
git -C .. ls-files '<m>/cmd/**'      # yksi binääri per cmd/-alihakemisto = moduuliehdokas
```

`cmd/<nimi>/main.go` on Go-projektin luonnollinen moduulijako; `internal/`
on jaettu koodi, joka ei ole oma moduuli.

## Sisääntulopisteet

bash (macOS, Linux, WSL, Git Bash):

```bash
# net/http, chi, gin, echo, fiber, gorilla
git -C .. grep -nE '\.(GET|POST|PUT|PATCH|DELETE|Handle|HandleFunc)\(' -- '<m>'
git -C .. grep -nE 'http\.ListenAndServe|Router\(\)|gin\.New|echo\.New|fiber\.New' -- '<m>'
# gRPC
git -C .. ls-files '**/*.proto'
git -C .. grep -nE 'RegisterServer|grpc\.NewServer' -- '<m>'
# Viestikuuntelijat ja ajastukset
git -C .. grep -niE 'Consume|Subscribe|ReceiveMessage|cron\.|time\.Ticker' -- '<m>'
# main-funktiot
git -C .. grep -n 'func main()' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
# net/http, chi, gin, echo, fiber, gorilla
git -C .. grep -nE '\.(GET|POST|PUT|PATCH|DELETE|Handle|HandleFunc)\(' -- '<m>'
git -C .. grep -nE 'http\.ListenAndServe|Router\(\)|gin\.New|echo\.New|fiber\.New' -- '<m>'
# gRPC
git -C .. ls-files '**/*.proto'
git -C .. grep -nE 'RegisterServer|grpc\.NewServer' -- '<m>'
# Viestikuuntelijat ja ajastukset
git -C .. grep -niE 'Consume|Subscribe|ReceiveMessage|cron\.|time\.Ticker' -- '<m>'
# main-funktiot
git -C .. grep -n 'func main()' -- '<m>'
```

## Datan muodon määrittelijät

bash (macOS, Linux, WSL, Git Bash):

```bash
# Structit + tagit = rajapintasopimus (json/db-nimet)
git -C .. grep -nE 'json:"|db:"|validate:"' -- '<m>'
git -C .. grep -nE '^type \w+ struct' -- '<m>'
# protobuf / OpenAPI
git -C .. ls-files '**/*.proto' '**/openapi*.y*ml'
```

PowerShell (Windows ilman bashia):

```powershell
# Structit + tagit = rajapintasopimus (json/db-nimet)
git -C .. grep -nE 'json:"|db:"|validate:"' -- '<m>'
git -C .. grep -nE '^type \w+ struct' -- '<m>'
# protobuf / OpenAPI
git -C .. ls-files '**/*.proto' '**/openapi*.y*ml'
```

Structin **tagit** ovat tärkeämmät kuin kenttänimet: `json:"order_id"` kertoo
rajapinnan nimen, `db:"…"` sarakkeen. Kirjaa molemmat.

## Tietokanta

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files '**/migrations/*.sql' '**/*.sql'
git -C .. grep -nE 'sqlx?\.|QueryRow|Exec\(|gorm|ent\.|pgx' -- '<m>'
git -C .. ls-files '**/queries.sql' '**/sqlc.yaml'   # sqlc: SQL on totuus
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files '**/migrations/*.sql' '**/*.sql'
git -C .. grep -nE 'sqlx?\.|QueryRow|Exec\(|gorm|ent\.|pgx' -- '<m>'
git -C .. ls-files '**/queries.sql' '**/sqlc.yaml'   # sqlc: SQL on totuus
```

## Ulkoiset kutsut

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -nE 'http\.(Get|Post|NewRequest)|http\.Client' -- '<m>'
git -C .. grep -nE 'aws-sdk-go|kafka|amqp|redis\.' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -nE 'http\.(Get|Post|NewRequest)|http\.Client' -- '<m>'
git -C .. grep -nE 'aws-sdk-go|kafka|amqp|redis\.' -- '<m>'
```

## Konfiguraatio ja komennot

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -nE 'os\.Getenv|envconfig|viper\.' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -nE 'os\.Getenv|envconfig|viper\.' -- '<m>'
```

Testikomento: `go test ./...` (moduulissa `go test ./<m>/...`). Build:
`go build ./...`.

## Huomiot

- **Rajapinnat (`interface`) ja toteutukset ovat erillään** — etsi rakentaja
  (`NewX(...)`) nähdäksesi mikä toteutus kytketään.
- `context.Context` kulkee läpi kaiken; peruutus- ja aikakatkaisukäytös kuuluu
  prosessikuvauksen virhetilanteisiin.
- Goroutinet ja kanavat: jos prosessi haarautuu rinnakkaiseksi, merkitse se
  sekvenssikaavioon (`par`-lohko) eikä peräkkäisenä.
- Generoitu koodi (`*_pb.go`, `*_gen.go`, `mocks/`) ei ole dokumentoinnin kohde.
