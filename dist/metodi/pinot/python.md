# Pinoprofiili: Python (FastAPI / Django / Flask)

Käytä yhdessä [`yleinen.md`](yleinen.md):n kanssa. `<m>` = moduulin polku.

## Manifesti ja moduulirakenne

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. ls-files '*pyproject.toml' '*requirements*.txt' '*setup.py' '*Pipfile'
git -C .. show HEAD:<m>/pyproject.toml     # riippuvuudet + skriptit + työkalut
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. ls-files '*pyproject.toml' '*requirements*.txt' '*setup.py' '*Pipfile'
git -C .. show HEAD:<m>/pyproject.toml     # riippuvuudet + skriptit + työkalut
```

## Sisääntulopisteet

bash (macOS, Linux, WSL, Git Bash):

```bash
# FastAPI / Flask
git -C .. grep -nE '@(app|router|api|bp)\.(get|post|put|patch|delete|route)\(' -- '<m>'
# Django
git -C .. ls-files '<m>/**/urls.py'
git -C .. grep -nE 'path\(|re_path\(|include\(' -- '<m>/**/urls.py'
git -C .. grep -nE 'class \w+(View|ViewSet|Serializer)\b' -- '<m>'
# Taustatyöt ja ajastukset
git -C .. grep -nE '@(shared_task|task|celery\.task|periodic_task)|CELERY_BEAT|APScheduler' -- '<m>'
# CLI / lambdat
git -C .. grep -nE 'if __name__ == .__main__.|@click\.|typer\.|def (handler|lambda_handler)\(' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
# FastAPI / Flask
git -C .. grep -nE '@(app|router|api|bp)\.(get|post|put|patch|delete|route)\(' -- '<m>'
# Django
git -C .. ls-files '<m>/**/urls.py'
git -C .. grep -nE 'path\(|re_path\(|include\(' -- '<m>/**/urls.py'
git -C .. grep -nE 'class \w+(View|ViewSet|Serializer)\b' -- '<m>'
# Taustatyöt ja ajastukset
git -C .. grep -nE '@(shared_task|task|celery\.task|periodic_task)|CELERY_BEAT|APScheduler' -- '<m>'
# CLI / lambdat
git -C .. grep -nE 'if __name__ == .__main__.|@click\.|typer\.|def (handler|lambda_handler)\(' -- '<m>'
```

## Datan muodon määrittelijät

bash (macOS, Linux, WSL, Git Bash):

```bash
# Pydantic / dataclass / TypedDict = rajapintasopimus
git -C .. grep -nE 'class \w+\((BaseModel|Schema|TypedDict)\)|@dataclass|Field\(' -- '<m>'
# DRF-serializerit
git -C .. grep -nE 'class \w+Serializer|serializers\.' -- '<m>'
# Skeematiedostot
git -C .. ls-files '**/openapi*.y*ml' '**/*.json' | grep -iE 'openapi|schema'
```

PowerShell (Windows ilman bashia):

```powershell
# Pydantic / dataclass / TypedDict = rajapintasopimus
git -C .. grep -nE 'class \w+\((BaseModel|Schema|TypedDict)\)|@dataclass|Field\(' -- '<m>'
# DRF-serializerit
git -C .. grep -nE 'class \w+Serializer|serializers\.' -- '<m>'
# Skeematiedostot
git -C .. ls-files '**/openapi*.y*ml' '**/*.json' | Select-String 'openapi|schema'
```

Pydantic-mallit ja DRF-serializerit ovat tosiasiallinen rajapintasopimus — ne
validoivat ja muuntavat, joten kirjaa ne datarakenteiksi/datamalleiksi.

## Tietokanta

bash (macOS, Linux, WSL, Git Bash):

```bash
# Django ORM / SQLAlchemy / Alembic
git -C .. ls-files '<m>/**/migrations/*.py' '**/alembic/versions/*.py' '**/*.sql'
git -C .. grep -nE 'class Meta:|models\.(CharField|ForeignKey|JSONField)|Column\(|relationship\(' -- '<m>'
git -C .. grep -nE '\.objects\.(filter|get|create|update)|session\.(query|execute)|text\(' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
# Django ORM / SQLAlchemy / Alembic
git -C .. ls-files '<m>/**/migrations/*.py' '**/alembic/versions/*.py' '**/*.sql'
git -C .. grep -nE 'class Meta:|models\.(CharField|ForeignKey|JSONField)|Column\(|relationship\(' -- '<m>'
git -C .. grep -nE '\.objects\.(filter|get|create|update)|session\.(query|execute)|text\(' -- '<m>'
```

`JSONField`/`JSONB`-kentät: avaa sisältörakenne ja linkitä datamalliin — älä jätä
"dict"-tyypiksi.

## Ulkoiset kutsut

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -nE 'requests\.|httpx\.|aiohttp|urllib' -- '<m>'
git -C .. grep -nE 'boto3|kafka|pika|redis|celery' -- '<m>'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -nE 'requests\.|httpx\.|aiohttp|urllib' -- '<m>'
git -C .. grep -nE 'boto3|kafka|pika|redis|celery' -- '<m>'
```

## Konfiguraatio ja komennot

bash (macOS, Linux, WSL, Git Bash):

```bash
git -C .. grep -nE 'os\.(environ|getenv)|BaseSettings|django\.conf.*settings' -- '<m>'
git -C .. ls-files '<m>/**/settings*.py' '<m>/.env.example'
```

PowerShell (Windows ilman bashia):

```powershell
git -C .. grep -nE 'os\.(environ|getenv)|BaseSettings|django\.conf.*settings' -- '<m>'
git -C .. ls-files '<m>/**/settings*.py' '<m>/.env.example'
```

Testikomento: `pytest`, `python -m pytest`, `./manage.py test`. Tarkista
`pyproject.toml`:n `[tool.pytest]` ja CI.

## Huomiot

- **Django-signaalit** (`post_save`, `pre_delete`) ja middleware lisäävät
  näkymättömiä vaiheita: `git -C .. grep -nE '@receiver|MIDDLEWARE'` ja merkitse
  ne prosessiin.
- Dynaaminen tyypitys: mäppien kenttäjoukko voi vaihdella ajonaikaisesti. Kuvaa
  se mikä on validoitu (Pydantic/serializer) ja merkitse loput
  `> TODO: dynaaminen`.
- Async ja sync rinnakkain (`async def` vs `def`) vaikuttaa kutsuketjuun —
  mainitse jos prosessi on asynkroninen.
