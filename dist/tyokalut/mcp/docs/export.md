# Export: documentation as files for an AI client

> 🇫🇮 [Suomeksi](vienti.md) · [Back to the main guide](../README.en.md) ·
> [ChatGPT connection](chatgpt.md)

When the MCP connection cannot be used, an **export package** is created from a
published channel. It contains a few Markdown files and ready-made instructions
that the customer uploads to an AI client project, for example a ChatGPT Business
or Enterprise project. Typical reasons:

- Secure MCP Tunnel is not allowed, or Developer mode is blocked.
- Security approval for the MCP connection is still pending.
- A quick pilot is needed without installing anything on the customer side.

**An export is a fallback channel, not a replacement for MCP.** It is a copy of a
specific version and does not update when the code changes. The admin UI shows
when the channel has a newer release than the export.

> **Check first that the documentation may be processed in the AI client.** An
> export moves all of the selected documentation into the AI service's storage.
> Do not export documentation produced from a customer's code before the
> organisation's AI policy allows it.

## What is lost compared to MCP

| MCP guarantees | In an export | Mitigation |
|---|---|---|
| Freshness | A copy of a specific release | Commit SHA and date in every file and in the instructions. The export table shows stale exports. |
| Project isolation in search | The AI client's file search does not keep projects apart | One project per export by default. Several require `--multi-project`. |
| Hit-level traceability | Citation to a file, not always to a section | Every document starts with its path. Source references are kept. |
| Per-project and per-channel access control | Everyone with access to the AI client project sees everything | A separate export for each visibility scope |

## Quick start

### In the admin UI

1. Publish the channel (*Kanavat ja julkaisu → Julkaise*).
2. Open the **Vienti** tab.
3. Choose the channel, project and target. Enter the recipient and, if needed, a classification.
4. **Esikatsele** (preview): files, sizes and warnings about profile limits.
5. **Muodosta vienti** (create).
6. In the export table: **Lataa zip** (download) and deliver it, or **Kopioi ohjeteksti** (copy instructions).

The tab is visible only with admin rights, because an export contains all of the documentation.

### On the command line

bash (macOS, Linux, WSL, Git Bash):

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp export plan --channel local --project parent --target chatgpt-projekti
./tyokalut/vnetcon-ai/vnetcon-ai mcp export create --channel local --project parent --target chatgpt-projekti --label "Customer / IT"
./tyokalut/vnetcon-ai/vnetcon-ai mcp export list
./tyokalut/vnetcon-ai/vnetcon-ai mcp export write <export> --out export.zip
```

PowerShell (Windows):

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export plan --channel local --project parent --target chatgpt-projekti
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export create --channel local --project parent --target chatgpt-projekti --label "Customer / IT"
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export list
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp export write <export> --out export.zip
```

Use `--lang en` for English headers, instructions and README in the package. The
documents themselves are in the language they were written in.

## Package contents

```text
vnetcon-vienti-<export>.zip
  LUE-MINUT.md       for the recipient: version, setup, updating, limitations
  ohjeet.md          ready-made text for the AI client project instructions
  manifest.json      identifiers, profile, file checksums
  tiedostot/         upload these to the AI client project
    <project>-00-yleiskuva.md            introduction and document index
    <project>-10-liiketoimintaprosessit.md
    <project>-20-jarjestelmaprosessit.md
    <project>-30-moduuli-<module>.md     one per module, or grouped
    <project>-40-datamallit.md
    50-ohjaus-ja-sanasto.md              only if it does not fit the instructions
    60-rajapinnat.md                     approved interface records
    70-lahdeaineisto-<source>.md         only with --include-sources: source material
```

- **The source is always a published channel.** Unpublished workspace changes are
  not exported.
- **Every file starts with** the project, branch, full source commit, release ID,
  export date, kind and optional classification.
- **Every document** starts with its original path (`## moduulit/x/yleiskuvaus.md`).
  Headings are moved one level down, front matter is shown as a YAML block and
  links between documents become "see `path` in file `file.md`". Source
  references to the code are kept unchanged.
- **Shared guidance and glossary** are added to the instructions when they fit
  the profile's character limit. Otherwise they become `50-ohjaus-ja-sanasto.md`.
- **Interface records:** only `active` records whose parties are all in the export.
- **Source material** ([Source materials](sources.md)) is included only with
  `--include-sources` (in the UI *Lähdeaineisto*): the channel's sources linked
  to the exported projects, or `--source <id,…>`. The files are labelled "not
  verified against the code", and the instructions include a rule for using
  them. Original files are never exported.

## Target profiles

| Profile | Use | Files | File size | Instructions |
|---|---|---|---|---|
| `chatgpt-projekti` | ChatGPT project (Business, Enterprise, Edu, Pro) | 40 | 5 MB | 8000 characters |
| `custom-gpt` | Custom GPT Knowledge and Instructions | 20 | 5 MB | 8000 characters |
| `claude-projekti` | Claude project | no limit | 30 MB | no limit |
| `yleinen` | Copilot, Gemini, archiving; one file per document | no limit | no limit | no limit |

The limits were checked against the services' documentation on 17 October 2026:

- **ChatGPT project:** 40 files on Business, Enterprise, Edu and Pro, 25 on Plus
  and Go, 5 on Free. Up to 10 files can be uploaded at once. A file can be up to
  512 MB, and a text file up to 2 million tokens
  ([Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt),
  [File uploads FAQ](https://help.openai.com/en/articles/8555545-file-uploads-faq)).
  No official limit was found for project instructions, so the Custom GPT limit
  of 8000 characters is used.
- **Custom GPT:** 20 files over the GPT's lifetime, instructions up to 8000 characters.
- **Claude project:** files up to 30 MB, no limit on the number of files. When the
  content approaches the context limit, Claude switches to RAG search
  ([files](https://support.claude.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude),
  [RAG](https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects)).
- **5 MB** is a quality limit, not the service maximum. It keeps Finnish text
  well below 2 million tokens.

`export profiles` shows the limits and notes. The limits change in the services
and can be overridden in the configuration, for example `max_files: 25` for ChatGPT Plus:

```yaml
exports:
  language: en            # fi or en; default fi
  profiles:
    chatgpt-projekti:
      max_files: 25       # ChatGPT Plus
    own-profile:
      label: Organisation AI portal
      grouping: merged    # merged or per-document
      max_files: 10
      max_file_bytes: 2000000
      instructions_chars: 4000
```

If there are more modules than the file limit allows, they are merged into
evenly sized groups (`<project>-30-moduulit-1.md` …). If the limit is still
exceeded, the export is created and a warning is shown.

## Status and updating

| Status | Meaning |
|---|---|
| ajan tasalla (up to date) | The channel release, shared guidance and interfaces are the same as in the export |
| vanhentunut (stale) | The channel has a newer release, or guidance or interfaces have changed. The reason is shown in the table and in `export show` |
| kanava poistettu (channel removed) | The channel no longer exists or has not been published |

**Muodosta uudelleen** (`export recreate <export>`) creates a new export with the
same options from the channel's current release. The old export remains until
you remove it. Ask the customer to delete the old files from the AI client
project before uploading the new ones, otherwise the versions mix in search.

Stale exports are also shown on the Prosessi tab and in the `process` command on
the line *Viennit asiakkaille*.

## Access control and storage

- Creating, reading and downloading exports requires admin rights.
- A project-restricted administrator (`--projects`) only sees and exports allowed projects.
- Exports are stored next to the releases in `<storage.root>/exports/<export>/`
  (`record.json`, `paketti.zip`, `sisalto/`). They are self-contained:
  `publications prune` does not break them.
- The creator is recorded (`ui:<user>` or `cli:<username>`). Downloads are
  logged on the server as metadata only, never content.
- `export remove` moves the export to the trash. `remove-project --purge` also
  removes the project's exports.

## Commands

| Command | In the UI |
|---|---|
| `export profiles [--json]` | Target menu |
| `export plan --channel <c> --project <id>[,…] [--multi-project] --target <profile> [--label …] [--classification …] [--lang fi\|en] [--no-guidance] [--no-interfaces] [--include-sources] [--source <source,…>] [--json]` | Esikatsele |
| `export create …` (same options) | Muodosta vienti |
| `export list [--json]` | Export table |
| `export show <export> [--instructions] [--json]` | Tiedostot, Kopioi ohjeteksti |
| `export recreate <export>` | Muodosta uudelleen |
| `export write <export> --out <directory\|file.zip>` | Lataa zip |
| `export remove <export> [--confirm] [--purge]` | Poista |
