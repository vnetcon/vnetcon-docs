# Pinoprofiili: Node / TypeScript / JavaScript

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<m>` = moduulin polku.

## Manifesti ja moduulirakenne

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files '*package.json' | grep -v node_modules
git -C .. show HEAD:<m>/package.json        # scripts, dependencies, workspaces
git -C .. ls-files 'pnpm-workspace.yaml' 'lerna.json' 'nx.json' 'turbo.json'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files '*package.json' | Select-String -CaseSensitive -NotMatch 'node_modules'
git -C .. show HEAD:<m>/package.json        # scripts, dependencies, workspaces
git -C .. ls-files 'pnpm-workspace.yaml' 'lerna.json' 'nx.json' 'turbo.json'
```

`workspaces`/`pnpm-workspace.yaml` kertoo monorepon moduulijaon suoraan.

## Sisääntulopisteet kehyksen mukaan

bash (macOS, Linux, WSL, Git Bash):

```bash
# Express / Fastify / Koa
git -C .. grep -nE '\b(app|router|fastify)\.(get|post|put|patch|delete|all)\(' -- '<m>'
# NestJS
git -C .. grep -nE '@(Controller|Get|Post|Put|Patch|Delete|MessagePattern|EventPattern|Cron)\(' -- '<m>'
# Next.js / Remix (tiedostopohjainen reititys)
git -C .. ls-files '<m>/pages/api/**' '<m>/app/**/route.ts' '<m>/app/**/+server.ts'
# tRPC / GraphQL
git -C .. grep -nE '\.(query|mutation)\(|createTRPCRouter|typeDefs|@Resolver' -- '<m>'
# AWS Lambda / serverless
git -C .. grep -nE 'export (const|async function) handler|exports\.handler' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
# Express / Fastify / Koa
git -C .. grep -nE '\b(app|router|fastify)\.(get|post|put|patch|delete|all)\(' -- '<m>'
# NestJS
git -C .. grep -nE '@(Controller|Get|Post|Put|Patch|Delete|MessagePattern|EventPattern|Cron)\(' -- '<m>'
# Next.js / Remix (tiedostopohjainen reititys)
git -C .. ls-files '<m>/pages/api/**' '<m>/app/**/route.ts' '<m>/app/**/+server.ts'
# tRPC / GraphQL
git -C .. grep -nE '\.(query|mutation)\(|createTRPCRouter|typeDefs|@Resolver' -- '<m>'
# AWS Lambda / serverless
git -C .. grep -nE 'export (const|async function) handler|exports\.handler' -- '<m>'
```

## Datan muodon määrittelijät

bash (macOS, Linux, WSL, Git Bash):

```bash
# Validointiskeemat = tosiasiallinen rajapintasopimus
git -C .. grep -nE 'z\.object\(|Joi\.object\(|yup\.object\(|TypeBox|ajv|class-validator|@Is[A-Z]' -- '<m>'
# Tyypit ja rajapinnat
git -C .. grep -nE '^export (interface|type) ' -- '<m>'
# DTO:t
git -C .. ls-files '<m>/**/*dto*' '<m>/**/*.d.ts'
```

PowerShell (Windows ilman bashia):

```powershell
# Validointiskeemat = tosiasiallinen rajapintasopimus
git -C .. grep -nE 'z\.object\(|Joi\.object\(|yup\.object\(|TypeBox|ajv|class-validator|@Is[A-Z]' -- '<m>'
# Tyypit ja rajapinnat
git -C .. grep -nE '^export (interface|type) ' -- '<m>'
# DTO:t
git -C .. ls-files '<m>/**/*dto*' '<m>/**/*.d.ts'
```

Priorisoi **runtime-validointiskeemat** (zod/Joi/class-validator) TypeScript-
tyyppien edelle: tyypit katoavat käännöksessä, skeemat vaikuttavat käytökseen.

## Tietokanta

bash (macOS, Linux, WSL, Git Bash):

```bash
# Prisma / Drizzle / TypeORM / Sequelize / Knex / Mongoose
git -C .. ls-files '**/schema.prisma' '**/drizzle/**' '**/migrations/**' '**/*.entity.ts' '**/models/**'
git -C .. grep -nE 'prisma\.[a-z]+\.(find|create|update|delete)|db\.(select|insert|update)|createQueryBuilder|knex\(|\.aggregate\(' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
# Prisma / Drizzle / TypeORM / Sequelize / Knex / Mongoose
git -C .. ls-files '**/schema.prisma' '**/drizzle/**' '**/migrations/**' '**/*.entity.ts' '**/models/**'
git -C .. grep -nE 'prisma\.[a-z]+\.(find|create|update|delete)|db\.(select|insert|update)|createQueryBuilder|knex\(|\.aggregate\(' -- '<m>'
```

Prisma/Drizzle-skeema on paras datamallilähde (`datamalli-tyonkulku.md`).

## Ulkoiset kutsut

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -nE 'axios\.|fetch\(|got\(|undici|new HttpService|@nestjs/axios' -- '<m>'
git -C .. grep -nE 'new (SQSClient|SNSClient|S3Client|Kafka)|amqplib|bullmq|ioredis' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -nE 'axios\.|fetch\(|got\(|undici|new HttpService|@nestjs/axios' -- '<m>'
git -C .. grep -nE 'new (SQSClient|SNSClient|S3Client|Kafka)|amqplib|bullmq|ioredis' -- '<m>'
```

## Konfiguraatio ja komennot

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -nE 'process\.env\.[A-Z_]+' -- '<m>' | grep -oE '[A-Z_]{3,}' | sort -u
git -C .. show HEAD:<m>/package.json | grep -A20 '"scripts"'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -nE 'process\.env\.[A-Z_]+' -- '<m>' | Select-String -CaseSensitive -AllMatches '[A-Z_]{3,}' | ForEach-Object { $_.Matches.Value } | Sort-Object -Unique
git -C .. show HEAD:<m>/package.json | Select-String '"scripts"' -Context 0,20
```

Testikomento löytyy yleensä `scripts.test`; monorepossa myös juuresta
(`npm test -w <m>` / `pnpm --filter <m> test`).

## Huomiot

- **Kaksi rinnakkaista sukupolvea** (`-v2`, `-legacy`) on tavallinen: tarkista
  onko `src` identtinen (`git -C .. diff --stat a/src b/src`) — jos on, kirjoita
  viittaussivu, älä duplikoi dokumentaatiota.
- Barrel-tiedostot (`index.ts`) piilottavat toteutuksen — seuraa re-exportit
  läpi todelliseen tiedostoon ennen kuin viittaat.
- Rakennettu tuotos (`dist/`, `.next/`) ei ole dokumentoinnin kohde.
