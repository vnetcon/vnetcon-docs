# Pinoprofiili: PHP (Laravel / Symfony)

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<m>` = moduulin polku.

## Manifesti ja moduulirakenne

```bash
git -C .. ls-files '*composer.json'
git -C .. show HEAD:composer.json          # riippuvuudet + autoload-nimiavaruudet
```

## Sisääntulopisteet

```bash
# Laravel: reitit ovat keskitetysti
git -C .. ls-files 'routes/*.php'
git -C .. grep -nE 'Route::(get|post|put|patch|delete|resource|apiResource)' -- 'routes'
# Symfony: attribuutit tai yaml
git -C .. grep -nE '#\[Route\(|@Route\(' -- '<m>'
git -C .. ls-files 'config/routes*' 'config/routes/**'
# Konsolikomennot ja ajastukset
git -C .. grep -nE 'extends Command|\$schedule->|#\[AsCommand' -- '<m>'
# Jonot, tapahtumat, kuuntelijat
git -C .. grep -nE 'implements ShouldQueue|dispatch\(|Event::|#\[AsEventListener\]|Listener' -- '<m>'
```

Laravelin `routes/`-tiedostot ovat paras yksittäinen lähde sisääntulopisteille.

## Datan muodon määrittelijät

```bash
# Laravel FormRequest -validointi = rajapintasopimus
git -C .. grep -nE 'extends FormRequest|public function rules\(\)' -- '<m>'
# API Resource -muunnokset (vastausmuoto)
git -C .. grep -nE 'extends JsonResource|extends ResourceCollection' -- '<m>'
# Symfony DTO + Validator
git -C .. grep -nE '#\[Assert\\\\|use Symfony.*Validator' -- '<m>'
```

`rules()`-metodit ja `JsonResource`-luokat määrittävät todellisen sisään- ja
ulostulomuodon — dokumentoi ne datarakenteina.

## Tietokanta

```bash
git -C .. ls-files 'database/migrations/*' '**/Migrations/*' '**/*.sql'
git -C .. grep -nE 'extends Model|\$fillable|\$casts|protected \$table' -- '<m>'   # Eloquent
git -C .. grep -nE '#\[ORM\\\\(Entity|Column)|@ORM\\\\' -- '<m>'                    # Doctrine
git -C .. grep -nE 'DB::(table|select|statement)|->where\(|createQueryBuilder' -- '<m>'
```

Eloquentin `$casts` (esim. `'meta' => 'array'`) paljastaa JSON-sarakkeet: avaa
niiden sisältörakenne ja linkitä datamalliin.

## Ulkoiset kutsut

```bash
git -C .. grep -nE 'Http::(get|post)|GuzzleHttp|curl_' -- '<m>'
git -C .. grep -nE 'Storage::|S3|Redis::|Queue::' -- '<m>'
```

## Konfiguraatio ja komennot

```bash
git -C .. ls-files 'config/*.php' '.env.example'
git -C .. grep -nE 'env\(|config\(' -- '<m>' | head -40
```

Testikomento: `php artisan test`, `./vendor/bin/phpunit`, `./vendor/bin/pest`.
Tarkista `composer.json`:n `scripts` ja CI.

## Huomiot

- **Middleware ja global scopet** lisäävät näkymättömiä vaiheita: etsi
  `app/Http/Middleware`, `booted()`, `addGlobalScope`.
- Observerit ja model-eventit (`creating`, `saved`) muuttavat dataa ilman
  näkyvää kutsua — merkitse ne prosessin vaiheiksi.
- `vendor/`, `storage/`, `public/build/` eivät ole dokumentoinnin kohteita.
