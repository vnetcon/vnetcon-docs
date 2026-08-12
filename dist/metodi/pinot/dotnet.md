# Pinoprofiili: .NET (C#, ASP.NET Core)

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<m>` = moduulin polku.

## Manifesti ja moduulirakenne

```bash
git -C .. ls-files '*.sln' '*.csproj' 'Directory.Build.props'
git -C .. grep -n 'ProjectReference' -- '<m>/*.csproj'    # moduulien väliset riippuvuudet
```

Solution + projektit antavat moduulijaon suoraan. Kirjaa myös kerrosjako
(Api / Application / Domain / Infrastructure), jos se on käytössä.

## Sisääntulopisteet

```bash
# Controllerit ja minimal API
git -C .. grep -nE '\[(ApiController|Route|HttpGet|HttpPost|HttpPut|HttpDelete)' -- '<m>'
git -C .. grep -nE 'app\.Map(Get|Post|Put|Delete|Group)\(' -- '<m>'
# Käynnistys ja rekisteröinnit (mikä palvelu kytkeytyy mihin)
git -C .. ls-files '<m>/Program.cs' '<m>/Startup.cs'
# Taustapalvelut ja ajastukset
git -C .. grep -nE ': (BackgroundService|IHostedService)|Hangfire|Quartz|RecurringJob' -- '<m>'
# Viestinvälitys
git -C .. grep -nE 'IConsumer<|MassTransit|ServiceBus|IEventHandler|Rebus' -- '<m>'
# Azure Functions
git -C .. grep -nE '\[Function|\[FunctionName|\[(Http|Queue|Timer|Blob)Trigger' -- '<m>'
```

## Datan muodon määrittelijät

```bash
git -C .. ls-files '<m>/**/*Dto*.cs' '<m>/**/*Request*.cs' '<m>/**/*Response*.cs'
git -C .. grep -nE 'public (record|class) \w+(Dto|Request|Response|Command|Query)' -- '<m>'
git -C .. grep -nE '\[(Required|MaxLength|Range|JsonPropertyName)|AbstractValidator<' -- '<m>'
```

FluentValidation-validaattorit ja data-annotaatiot ovat rajapintasopimus.
MediatR-projekteissa `Command`/`Query`-tyypit ovat prosessien sisääntulo.

## Tietokanta

```bash
git -C .. ls-files '<m>/**/Migrations/*.cs' '**/*.sql'
git -C .. grep -nE ': DbContext|DbSet<|OnModelCreating|HasColumnType|modelBuilder\.' -- '<m>'
git -C .. grep -nE '\.FromSqlRaw|Dapper|QueryAsync<|ExecuteAsync' -- '<m>'
```

EF Coren `OnModelCreating` + migraatiot ovat datarakenteiden totuus.
`HasColumnType("jsonb")` → avaa sisältörakenne ja linkitä datamalliin.

## Ulkoiset kutsut

```bash
git -C .. grep -nE 'HttpClient|IHttpClientFactory|AddHttpClient|Refit' -- '<m>'
git -C .. grep -nE 'BlobServiceClient|QueueClient|AmazonS3|IAmazon' -- '<m>'
```

## Konfiguraatio ja komennot

```bash
git -C .. ls-files '<m>/appsettings*.json'
git -C .. grep -nE 'IConfiguration|GetSection\(|Options>' -- '<m>'
```

Testikomento: `dotnet test`, tarkennettuna `dotnet test <m>.Tests`. Build:
`dotnet build`. Tarkista CI.

## Huomiot

- **Riippuvuusinjektio piilottaa toteutuksen:** `Program.cs`/`Startup.cs`:n
  `AddScoped<IFoo, Foo>()` kertoo, mikä luokka oikeasti ajetaan rajapinnan
  takana. Selvitä se ennen kuin viittaat.
- Middleware-putki (`app.Use…`) lisää vaiheita ennen controlleria.
- `partial`-luokat ja source generatorit: generoitu koodi (`obj/`, `*.g.cs`) ei
  ole dokumentoinnin kohde, mutta sen lähde (attribuutti/skeema) on.
