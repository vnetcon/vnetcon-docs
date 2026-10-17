# Source materials without code

> 🇫🇮 [Suomeksi](ilman-koodia.md) · [Back to the main guide](../README.en.md) ·
> [Source materials](sources.md) · [Export](export.md)

The core of vnetcon-docs is system documentation verified against the code. A
knowledge base can also start **without code**: from the organisation's approved
documents (Word, PowerPoint, Excel, PDF, Markdown, text). System documentation
can be added to the same knowledge base later.

## When this helps

vnetcon-docs does not replace the AI client. It brings approved material to the
client the organisation already uses (ChatGPT, Claude, Copilot). With documents
only, the benefit is greatest when the organisation has one of these:

- documents outside SharePoint, or no Copilot licences
- a need to decide what the AI may use: every file is approved, and the answer
  shows the source, file, owner and approval date
- several AI clients side by side
- a need to know when a document the AI uses has gone out of date

If all documents are already in SharePoint and Copilot licences are in place,
the added value is limited to approval, provenance and staleness detection.

## Setup

Prerequisites: Node.js 22.13 or newer and npm. Neither Git nor an AI agent is
needed.

1. Extract the `vnetcon-docs` package into any directory. No parent project is
   needed.
2. Install the dependencies and start the admin UI in the `vnetcon-docs`
   directory:

   bash (macOS, Linux, WSL, Git Bash):

   ```bash
   npm ci --prefix tyokalut/mcp
   ./tyokalut/vnetcon-ai/vnetcon-ai mcp ui
   ```

   PowerShell (Windows):

   ```powershell
   npm ci --prefix tyokalut\mcp
   tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp ui
   ```

3. Open `http://127.0.0.1:8799/ui/` and choose **Aloita lähdeaineistoista**
   (start from source materials). The workspace is created without a parent
   project, and the Lähdeaineistot tab opens.
4. **Lähdeaineistot:** add a source (ID, name, directory or upload, owner,
   classification). Leave the projects empty. Scan, preview and approve the
   files.
5. **Kanavat ja julkaisu:** create a channel, add the source to it and publish.
6. **Connection:**
   - ChatGPT through the tunnel: [ChatGPT connection step by step](chatgpt.md)
     (Finnish)
   - Claude, Codex, Cursor and VS Code: the **Yhteys** tab
   - if MCP cannot be used: [Export](#export)

The Prosessi tab shows the knowledge base as ready once a published source is
in the channel. Missing projects are not shown as unfinished.

### On the command line

bash (macOS, Linux, WSL, Git Bash):

```bash
npm ci --prefix tyokalut/mcp
./tyokalut/vnetcon-ai/vnetcon-ai mcp init --ilman-emoprojektia
./tyokalut/vnetcon-ai/vnetcon-ai mcp source add --id guides --type directory --location /mnt/shared/guides --name "Customer service guides" --owner "Customer service" --classification Internal
./tyokalut/vnetcon-ai/vnetcon-ai mcp source scan guides
./tyokalut/vnetcon-ai/vnetcon-ai mcp source preview guides --file "Guideline.pdf"
./tyokalut/vnetcon-ai/vnetcon-ai mcp source approve guides --all-changed
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel create local
./tyokalut/vnetcon-ai/vnetcon-ai mcp channel add-source local guides
./tyokalut/vnetcon-ai/vnetcon-ai mcp publish --channel local
./tyokalut/vnetcon-ai/vnetcon-ai mcp smoke-test --channel local
```

PowerShell (Windows):

```powershell
npm ci --prefix tyokalut\mcp
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp init --ilman-emoprojektia
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source add --id guides --type directory --location \\server\shared\guides --name "Customer service guides" --owner "Customer service" --classification Internal
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source scan guides
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source preview guides --file "Guideline.pdf"
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp source approve guides --all-changed
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel create local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp channel add-source local guides
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp publish --channel local
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp smoke-test --channel local
```

## What the AI client sees

- **Server instructions** say the knowledge base is approved source material:
  start with `list_sources`, mention the source, file and, for a PDF, the page,
  and say so when the information is not there.
- **Label:** the document header shows *Hyväksytty lähdeaineisto* (approved
  source material), the approval date, owner, classification and hash. The
  label "not verified against the code" is used only for sources linked to
  projects, because only they have code to compare with. The machine-readable
  field `verified_against_code: false` is always present.
- **PDF:** search results carry the page number (`page`). Headings and tables
  are not preserved; the text comes as lines and paragraphs. Scanned PDFs are
  not supported. See [Source materials](sources.md#pdf).
- `list_projects` returns an empty list.

## Export

When MCP cannot be used, the source material is exported as files and ready
instructions for an AI client project.

- **In the UI:** the **Vienti** tab. Choose *Ei projektia (vain lähdeaineisto)*
  (no project, source material only) and the sources.
- **On the command line:** `export create --channel local --source guides --target chatgpt-projekti`

The package has one file per source (`70-lahdeaineisto-<source>.md`). If a
source exceeds the profile's file size limit, it is split into parts
(`70-lahdeaineisto-<source>-1.md`, `-2.md` and so on). The export shows as stale
once a changed document is approved and published. See [Export](export.md).

## System documentation later

To add a system's documentation to the same knowledge base, add a project
(`add-project` or the **Projektit** tab) and link the sources to it
(`source set <id> --link <project>`). After that:

- the server instructions separate code documentation from source material
- linked sources are labelled "not verified against the code"
- in a conflict, the AI client relies on the code documentation for how the
  system is implemented.
