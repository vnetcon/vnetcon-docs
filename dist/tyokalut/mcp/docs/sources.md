# Source materials: documents outside the code

> 🇫🇮 [Suomeksi](lahdeaineistot.md) · [Back to the main guide](../README.en.md) ·
> [Export](export.md) · [Without code](without-code.md)

An organisation's knowledge is not only in the code. Specifications, contract
appendices, architecture and training decks and process descriptions live in
Word, PowerPoint, Excel and PDF files. They are maintained outside the project's Git,
for example on a network drive, in OneDrive or in SharePoint.

**Source materials** bring these documents into MCP and exports as a source of
their own:

- **A different kind of information.** Code documentation is verified against
  the code and bound to a commit. Source material is a human statement about how
  things should be or once were. It is always labelled: `kind: lahdeaineisto`,
  `verified_against_code: false`. The human-readable label depends on whether
  the source is linked to projects ([Labels](#labels)).
- **A different source.** Source material has no repository and no commit. The
  version is a per-file content hash, and the files stay where they are
  maintained. They are not copied into the project's Git.
- **Nothing without approval.** Source material may contain contracts, prices
  and personal data, so every file is approved before it is published.

## Supported formats

| Format | Conversion |
|---|---|
| Word (.docx) | Headings (including localised Word styles), paragraphs, lists, tables and footnotes. Tracked deletions are skipped |
| PowerPoint (.pptx) | Slides in order: title, text, tables and speaker notes |
| Excel (.xlsx) | Sheets, ranges and values (`xlsx-kartta.mjs`) |
| PDF (.pdf) | Text page by page (`## Sivu n`), as lines and paragraphs. See [PDF](#pdf) |
| Markdown (.md), text (.txt) | As is |

Images, charts, macros and embedded objects are skipped, and their count is
shown in the conversion header. Not supported: scanned documents and the old
.doc, .ppt, .xls and .xlsb formats. They appear in the file list as *ei tuettu*
(not supported) with the reason.

### PDF

PDFs are read with pdf.js (`pdfjs-dist`), which is loaded only when a PDF is
converted. The PDF's scripts and forms are not run, and fonts are not loaded.

- **Page numbers are kept.** Every page is a search section of its own, and
  `search_sources` results carry the field `page`.
- **Structure is not kept.** A PDF has no reliable heading or table structure,
  so the text is assembled into lines and paragraphs. Table rows stay rows. The
  conversion header says so, and shows the PDF's title, author and creation
  date when available.
- **A scanned PDF** (more than half of the pages are images without text) gets
  the state *ei tuettu*: text recognition (OCR) is not supported. From a
  partly scanned PDF the text is taken, and pages without text are listed in
  the header.
- **A password-protected or damaged PDF** gets the state *virhe* (error).
- **Limits:** up to 2000 pages and 60 seconds per file.
- **Quality depends on the producer**, for example multi-column layouts and
  headers and footers. Preview before approving.

A failed conversion is not retried on every scan. It is retried when the file
changes.

Limits: source file up to 50 MB, conversion up to 5 MB. They can be changed in
the configuration (`sources_defaults.max_file_bytes`, `max_converted_bytes`).

## Source types

| Type | When |
|---|---|
| `directory` | The files are in a directory the server can read: a network drive, a synced OneDrive or SharePoint folder |
| `upload` | The server cannot reach the source system. Files are uploaded in the admin UI or with `source upload` |

## Usage

### In the admin UI

1. Open the **Lähdeaineistot** tab and add a source: ID, name, type, directory,
   owner, classification and the projects it relates to.
2. `directory`: **Skannaa nyt** (scan). `upload`: drop files into the box or pick them.
3. Open **Tiedostot** (files). **Esikatsele** (preview) shows how the file will
   appear to AI clients. For a changed file, the difference to the approved
   version is shown too.
4. **Hyväksy** (approve) file by file, or **Hyväksy uudet ja muuttuneet**
   (approve new and changed) after previewing.
5. Add the source to a channel on **Kanavat ja julkaisu** and **Julkaise** (publish).

The *Lähdeaineistot* line on the Prosessi tab shows how many files await
approval and whether approved changes are unpublished.

### On the command line

bash (macOS, Linux, WSL, Git Bash):

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp source add --id specs --type directory --location /mnt/shared/specs --name "Customer portal specifications" --link parent --owner IT --classification Internal
./tyokalut/vnetcon-ai/vnetcon-ai mcp source scan specs
./tyokalut/vnetcon-ai/vnetcon-ai mcp source show specs
./tyokalut/vnetcon-ai/vnetcon-ai mcp source preview specs --file "Functional specification.docx"
./tyokalut/vnetcon-ai/vnetcon-ai mcp source approve specs --all-changed
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel add-source local specs
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
```

PowerShell (Windows):

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source add --id specs --type directory --location \\server\shared\specs --name "Customer portal specifications" --link parent --owner IT --classification Internal
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source scan specs
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source show specs
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source preview specs --file "Functional specification.docx"
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source approve specs --all-changed
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel add-source local specs
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
```

## File states

| State | Meaning |
|---|---|
| uusi (new) | Found, not approved |
| muuttunut (changed) | Content differs from the approved version. **The previously approved version stays published** until the new one is approved |
| hyväksytty (approved) | Published |
| hylätty (rejected) | The current version is not published. A previously approved version stays unless the approval is withdrawn (`source reject --withdraw`) |
| poistettu (removed) | An approved file is missing from the source. It is dropped from the next publication |
| ei tuettu (not supported) | Format not supported, reason given |
| virhe (error) | Conversion failed or the file is too large, reason given |

Scanning detects changes by content hash. When polling is enabled
(`refresh configure-poll`), directory sources are scanned at the same interval.
**Scanning never approves or publishes anything.**

## MCP

| Tool | What it does |
|---|---|
| `list_sources` | The channel's sources the user may see (optionally those linked to one project) |
| `search_sources` | Search within one source. Results carry `kind: lahdeaineisto` and `verified_against_code: false`, and for a PDF also `page` |
| `fetch_source_document` | One source document with its header |

Project search (`search`) never returns source material, and source search never
returns code documentation. The server instructions depend on the channel's
content:

- **Projects and sources:** the instructions tell the AI client to say when an
  answer is based on source material and, in a conflict, to rely on the code
  documentation for how the system is implemented.
- **Sources only:** the instructions say the knowledge base is approved source
  material, and tell the client to start with `list_sources` and to mention the
  source, file and page. See [Without code](without-code.md).

## Labels

| Source | Document header |
|---|---|
| Linked to projects | **Lähdeaineisto, ei tarkistettu koodia vasten** (source material, not verified against the code) |
| Not linked to projects | **Hyväksytty lähdeaineisto** (approved source material) |

The header also shows the source, file, modification date, approval date, owner,
classification and hash. The machine-readable field
`verified_against_code: false` is always present.

## Access control

- An unrestricted user sees all sources in their channels.
- A project-restricted user (`--projects`) sees a source if all of its projects are allowed.
- `--sources <id,…>` allows sources explicitly: `auth token create`,
  `auth user add` and `auth oidc-rule add`.
- An organisation-level source (no projects) is visible to a restricted user only with `--sources`.
- Managing sources, listing files and previewing require admin rights.

## References from code documentation

A code document can refer to source material in its `lahteet` field:

```yaml
lahteet:
  - src/orders/routes.ts
  - "lahde:specs/Functional specification.docx#9f3c1a2b"
```

Publishing records the references in the project release manifest and warns if
the file has changed since it was referenced. `source show` lists the references
to a source with their status. Link check:
`vnetcon-ai linkit --lahteet --lahdeaineistot <mcp-workspace>`.
See [`metodi/konventiot.md`](../../../metodi/konventiot.md) section 4 (Finnish).

## Export

`export create … --include-sources` adds the channel's sources linked to the
exported projects (or `--source <id,…>`). They are separate files
`70-lahdeaineisto-<source>.md`, labelled as in [Labels](#labels), and the
instructions include a rule for using them. `--source` without `--project`
exports source material only. A large source is split into parts by the
profile's file size limit. Original files are never exported. See
[Export](export.md).

## Storage

```text
<workspace>/.multiproject/sources/<source>/
  inventory.json            files, hashes, states and approvals
  converted/                conversions by hash
  uploads/                  files of an upload source
<storage.root>/sources/<source>/releases/<digest>/
  manifest.json, documents/, documents.jsonl
```

`source remove` moves the source to the trash. The source's own directory is
never touched.

## Commands

| Command | In the UI |
|---|---|
| `source add --id <id> --type <directory\|upload> [--location …] [--name …] [--link <project,…>] [--owner …] [--classification …] [--include <glob,…>] [--exclude <glob,…>]` | Lisää lähde |
| `source set <id> …` | Muokkaa |
| `source list [--json]` / `source show <id> [--json]` | Source list, Tiedostot |
| `source scan <id> \| --all` | Skannaa nyt |
| `source upload <id> --file <path> [--name …]` | Drop files |
| `source preview <id> --file <file> [--diff]` | Esikatsele |
| `source approve <id> (--file <file> \| --all-changed)` | Hyväksy |
| `source reject <id> --file <file> [--withdraw]` | Hylkää, Peru hyväksyntä |
| `source remove-file <id> --file <file> --confirm` | Poista tiedosto |
| `source remove <id> [--confirm] [--purge]` | Poista |
| `channel add-source <channel> <id>` / `channel remove-source …` | Kanavat ja julkaisu |
