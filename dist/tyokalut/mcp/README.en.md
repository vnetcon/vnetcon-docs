# multiproject-mcp — user guide

> 🇫🇮 [Suomeksi](README.md) · [vnetcon-docs guide (Finnish)](../../README.md) ·
> [Architecture and implementation specification (Finnish)](docs/arkkitehtuuri.md)

`multiproject-mcp` publishes documentation from multiple Git projects and
branches as controlled snapshots and serves it to MCP clients. It can run as a
local stdio process or as a shared Streamable HTTP server.

## Implemented capabilities

- Every `project_id` + Git ref pair has a separate checkout and documentation
  workspace.
- In `repository` mode, the selected branch's `vnetcon-docs` is published as-is.
- In `managed` mode, documentation lives in the publication-side clone; the
  tool does not commit or push it to the source repository.
- In `separate` mode, documentation lives in its own repository, for example the
  local repository of a `vnetcon-docs` directory that is never pushed. Code is
  read from the source repository, and a release binds both commits.
- A publication pins exact commits and documentation revisions.
- MCP search always requires one `project_id`; project content is never merged
  into a single search corpus.
- Each MCP connection is pinned to the bundle that was current when it opened.
- Cross-project relationships come only from explicit `interfaces/` records.
- HTTP supports unauthenticated, bearer-token, basic, and OIDC authentication, with
  optional channel and project restrictions.
- Git changes can be detected manually, by polling, or through a protected
  webhook; the debounced queue never starts AI or publication by itself.

Filesystem storage, manual/poll/webhook refresh, stdio, Streamable HTTP, an
OIDC resource server, the management UI (`/ui`) with OIDC browser sign-in, agent
runs, editing, removal and trash, and release retention are implemented. Cloud
storage and native Git-provider payload adapters are not yet part of this version.
OIDC browser sign-in is tested on the server side but not yet against a real
identity provider.

## Prerequisites

- Git
- Node.js 18 or newer
- npm for initial installation
- an AI agent only when generating `managed` documentation

## Quick start

The MCP ships inside the `vnetcon-docs` directory at `tyokalut/mcp/` and is used
through the `vnetcon-ai mcp` command. Install its dependencies once, only when you
start using the MCP. Run the commands in the `vnetcon-docs` directory.

bash (macOS, Linux, WSL, Git Bash):

```bash
npm ci --prefix tyokalut/mcp
./tyokalut/vnetcon-ai/vnetcon-ai mcp init
```

PowerShell (Windows):

```powershell
npm ci --prefix tyokalut\mcp
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp init
```

`init` creates the workspace in `vnetcon-docs/mcp-tyotila/`. If `vnetcon-docs` is
installed at the root of a Git project, `init` offers this **parent project** as
the first project: it is added on the current branch with the `repository`
model, or with the `separate` model if `vnetcon-docs` has its own Git
repository, and the `local` channel is created. Without the question:
`--emoprojekti` adds it and `--ilman-emoprojektia` skips it. In a
non-interactive run the parent project is added to a workspace in the default
location, but to a workspace elsewhere only with `--emoprojekti`.

Add 1–N other projects next to, or instead of, the parent project with
`add-project` (step 1 below). The MCP publishes only committed documentation,
including from the parent project.

**Without a parent project.** `vnetcon-docs` can also be a standalone directory
with no parent project, for example the package unpacked into its own folder for
a server. Then `init` suggests nothing and all 1–N projects are added with
`add-project`.

**`vnetcon-docs` kept out of Git.** If the parent project's `vnetcon-docs` is in
`.gitignore` or `.git/info/exclude` and has its own local Git repository, `init`
adds the parent project in `separate` mode: code from the parent project's
repository, documentation from the `vnetcon-docs` repository. Without its own
repository the documentation is not committed anywhere, so `init` skips the
parent project and explains how to create the repository. Instructions are in
the [vnetcon-docs guide (Finnish)](../../README.md#vnetcon-docs-gitin-ulkopuolelle).

Commands run as `vnetcon-ai mcp` target the `mcp-tyotila/` workspace
automatically. The workspace launchers `mcp-tyotila/multiproject-mcp` and
`multiproject-mcp.cmd` work from any directory. The examples below use
`./multiproject-mcp` in the workspace directory.

**Versioning the workspace.** Commit the `mcp-tyotila/` configuration
(`multiproject-mcp*.yaml`, `interfaces/`, launchers) to the parent project.
Project paths and launchers are relative, so the workspace also works in a
clone. Clones, workspaces and releases (`.multiproject/`) and the server
profile stay out of Git through the workspace's own `.gitignore`.

You can also create the workspace elsewhere: `vnetcon-ai mcp init <directory>`.

The `managed` model copies the method from this `vnetcon-docs` directory and the
project-specific files from the pristine install template
(`metodi/mallipohjat/asennuspohja/`). The parent project's state and documents
therefore never end up in other projects' workspaces.

### 1. Add projects

Inspect a repository first:

```bash
./multiproject-mcp inspect-project --path /path/to/project
```

When documentation is stored in the application repository:

```bash
./multiproject-mcp add-project \
  --id billing \
  --path /path/to/billing \
  --refs main,development \
  --docs-mode repository
```

When documentation is maintained only on the publication side:

```bash
./multiproject-mcp add-project \
  --id customers \
  --path /path/to/customers \
  --refs main,development \
  --docs-mode managed
```

When documentation lives in its own repository (for example a `vnetcon-docs`
kept out of the parent project's Git that has its own local repository):

```bash
./multiproject-mcp add-project \
  --id billing \
  --path /path/to/billing-repo \
  --refs main \
  --docs-mode separate \
  --docs-repo /path/to/billing-repo/vnetcon-docs
```

The documentation branch defaults to the documentation repository's current
branch and can be set with `--docs-ref`. A commit only in the documentation
repository is also detected as a change (`plan refresh`, `refresh detect`).

You may use `--url` instead of `--path`. `discover --root <directory>` lists
immediate child Git repositories to help build the configuration.

### 2. Create a publication channel

A channel selects exactly one ref from each project:

```bash
./multiproject-mcp channel create local
./multiproject-mcp channel set-ref local billing main
./multiproject-mcp channel set-ref local customers development
./multiproject-mcp channel show local
```

### 3. Bootstrap, document, and publish

```bash
./multiproject-mcp config validate
./multiproject-mcp doctor
./multiproject-mcp plan refresh --all
./multiproject-mcp bootstrap --all
```

In `repository` and `separate` mode, the ref's documentation is now ready for publication. In
`managed` mode, document and approve each ref:

```bash
./multiproject-mcp document --project customers --ref development
./multiproject-mcp review --project customers --ref development
./multiproject-mcp approve --project customers --ref development
```

Publish after review:

```bash
./multiproject-mcp publish --channel local
./multiproject-mcp smoke-test --channel local
```

## Choose a transport

Start a local stdio connection directly:

```bash
./multiproject-mcp serve --transport stdio --channel local
```

Safe local HTTP setup:

```bash
./multiproject-mcp server configure-http --listen 127.0.0.1:8793 --channel local
./multiproject-mcp auth set-mode none
./multiproject-mcp doctor --http
./multiproject-mcp serve --transport http
```

The MCP endpoint is then `http://127.0.0.1:8793/mcp`. Use authentication and
TLS on a LAN or server deployment. The service refuses unauthenticated
non-loopback listening unless it is explicitly allowed.

Focused guides:

- [HTTP server and deployment](docs/http-server.md)
- [Authentication and authorization](docs/authentication.md)
- [Git change detection and refresh](docs/refresh.md)
- [AI client compatibility](docs/clients.md)
- [ChatGPT connection step by step (Finnish)](docs/chatgpt.md)

## Management UI

Everything can be done either in the management UI or on the command line. Each
UI action runs one `vnetcon-ai mcp` command, and the same command is shown under
**Komentorivillä** (command line) for bash and PowerShell. The UI runs in the same
HTTP server as the MCP, at `/ui`.

### Starting

Double-click in `tyokalut/mcp/kaynnista/`: `MCP-kayttoliittyma.command` (macOS),
`MCP-kayttoliittyma.cmd` (Windows) or `mcp-kayttoliittyma.sh` (Linux). The launcher
installs dependencies when needed, starts the server and opens the browser. In a
terminal, in the `vnetcon-docs` directory:

bash (macOS, Linux, WSL, Git Bash):

```bash
./tyokalut/vnetcon-ai/vnetcon-ai mcp ui
```

PowerShell (Windows):

```powershell
tyokalut\vnetcon-ai\vnetcon-ai.cmd mcp ui
```

Without HTTP settings the address is `http://127.0.0.1:8799/ui/` (MCP:
`http://127.0.0.1:8799/mcp`); use `--listen <host:port>` for another one. If no MCP
workspace exists yet, the UI offers to create it (with or without the parent
project) and then switches to the full UI at the same address. An HTTP server
started with `serve` serves the UI at the same path; disable it with
`runtime.http.ui.enabled: false`.

### Tabs

| Tab | What it does | Command line |
|---|---|---|
| Prosessi (process) | Where each project is, what remains and how to do it; connecting AI clients (the ChatGPT chain step by step) | `process` |
| Projektit (projects) | Add, edit, remove; documentation changes and commit | `add-project`, `project set`, `remove-project`, `docs diff`, `docs commit` |
| Kanavat ja julkaisu (channels) | Channels, refs, default channel, publishing | `channel …`, `publish`, `smoke-test` |
| Agenttiajot (agent runs) | Setup, documentation, sync, review corrections and integrations with an agent | `agent run`, `agent answer`, `agent cancel` |
| Yhteinen ohjaus, Integraatiot | Shared guidance and glossary, interface records | `guidance …`, `interface …` |
| Haku (search) | The same search as AI clients | (MCP tools `search`, `fetch`) |
| Yhteys (connection) | MCP address, client settings, ChatGPT tunnel id and commands | `tunnel configure openai`, `tunnel prepare openai` |
| Asetukset (settings) | Authentication, tokens and users, HTTP, automatic refresh, retention | `auth …`, `server configure-http`, `refresh configure-…`, `publications prune` |
| Roskakori (trash) | Restoring removed items | `trash list`, `trash restore`, `trash empty` |
| Ohjeet (guides) | Process description, guides and all commands | `help` |

### Editing, removal and restore

Removal first shows a plan; `--confirm` carries it out. A removed project,
channel, interface record or guidance file moves to the trash
(`.multiproject/roskakori/`), from which `trash restore` brings it back as it was,
including the project's channel refs. `--purge` removes permanently and leaves
nothing to restore; for a project it also removes workspaces and releases. The UI
asks for a typed confirmation.

### Agent runs

`agent run` runs a documentation agent non-interactively with the agent installed
on the machine or server and its account (`vnetcon-ai`, settings `/agentit`). The
method's approval gates remain:

1. The agent follows the workflow. When it needs a decision, it writes its
   questions with proposals and stops (status *needs answers*).
2. A person answers (`agent answer`), and the run continues from the answers.
3. The agent does not commit. Changes are reviewed (`docs diff`) and committed
   (`docs commit`); managed documentation is approved (`approve`).

A run is possible when the documentation is editable locally: repository mode
with a local repository, separate mode with a local documentation repository, or
managed mode. The MCP never writes to a remote repository. A project can have one
run at a time. The UI runs agents in the background and shows the log.

### Authentication

The same as for the MCP. Reading requires sign-in and changes the **admin** right:

| Mode | Admin right |
|---|---|
| `none` | When the server listens only on the local machine. On a network without authentication, read only. |
| `bearer` | `auth token create --name <name> --admin` |
| `basic` | `auth user add --username <name> --password-stdin --admin` |
| `oidc` | `auth oidc-rule add … --admin` (for example by group claim) |

In OIDC mode the UI signs in to the identity provider in the browser
(authorization code + PKCE) when a public client is registered for it:
`auth configure-oidc … --ui-client-id <id> [--ui-scopes "openid api://…/.default"]`.
Register the UI address (for example `https://mcp.example/ui/`) as the redirect
URI; the token audience is the same as for the MCP. Without a client, sign in by
pasting a valid access token.

### Retention

`publications prune --keep <n>` removes old bundles and releases. Current channel
releases, the `n` newest bundles and the latest release per project ref are kept.
An open MCP connection reads its own bundle's releases, so keep `n` at least at
the default 3.

## Refresh after a Git change

```bash
./multiproject-mcp plan refresh --all
./multiproject-mcp refresh --all
# managed projects: document, review, and approve
./multiproject-mcp publish --channel local
./multiproject-mcp smoke-test --channel local
```

A new release never overwrites an old snapshot. The channel pointer moves only
after a successful `publish`. Existing MCP connections remain on their old
bundle, so a conversation's source material cannot change mid-session.

## Project and branch isolation

```text
project_id + ref
  -> separate checkout and documentation workspace
  -> source commit + documentation revision
  -> immutable project release
  -> bundle selected by a channel
  -> connection-level bundle pin
  -> MCP search scoped to one project_id
```

`main` and `development` do not share a checkout or documentation. Every search
result includes the project, ref, source commit, and release identifiers.
Cross-project dependencies are never inferred from similar prose.

Managed documentation is stored by default at:

```text
.multiproject/workspaces/<project_id>/<ref>/source/vnetcon-docs/
```

The directory is excluded through the clone's `.git/info/exclude`. Local
documentation changes survive ref refreshes and are neither committed nor
pushed to the source repository.

## Main commands

| Command | Purpose |
|---------|---------|
| `init <directory>` | Create a management workspace and launchers |
| `discover` / `inspect-project` | Help construct project configuration |
| `add-project` / `project ...` | Manage projects, refs, and documentation modes |
| `channel create/set-ref/show` | Manage versions in a publication channel |
| `doctor` / `config validate` | Check the environment and configuration |
| `bootstrap` / `refresh` | Create or update ref-specific workspaces |
| `document` / `review` / `approve` | Manage publication-side documentation |
| `publish` / `smoke-test` | Publish and verify an immutable bundle |
| `server configure-http` | Store the HTTP address (does not change the default transport) |
| `server set-transport` | Select stdio or HTTP as the default transport |
| `auth set-mode` / `auth configure-oidc` | Select and configure authentication |
| `auth token ...` / `auth user ...` | Manage credentials and access scopes |
| `refresh configure-poll/configure-webhook` | Configure automatic change detection |
| `refresh detect/queue/run/watch` | Manage the debounced queue and controller |
| `tunnel install/uninstall openai` | Install tunnel-client inside the MCP workspace (not on PATH) or remove it |
| `tunnel configure/remove openai` | Store or remove the tunnel id and tunnel-client profile |
| `tunnel prepare openai` | Print Secure MCP Tunnel setup commands |
| `serve` | Start the selected MCP transport |
| `ui` | Start the HTTP server and the management UI (`/ui`) |
| `process` | Process steps: what is done, what remains and with which command |
| `project set` / `remove-project` / `trash …` | Edit a project, remove to trash or permanently (`--purge`), restore |
| `channel unset-ref/set-default/remove` | Edit and remove channels |
| `agent run/answer/cancel/list/show` | Documentation agent runs with questions and answers |
| `docs diff` / `docs commit` | Documentation changes and commit (repository and separate mode) |
| `guidance …` / `interface …` | Shared guidance and interface records |
| `publications prune` | Remove old releases according to retention |

Run `./multiproject-mcp help` for all command forms.

## MCP tools

| Tool | Scope |
|------|-------|
| `list_projects` | Allowed channel projects and their exact versions |
| `get_project_version` | One project's ref, commit, and release identifiers |
| `search` | Search exactly one `project_id` |
| `fetch` | Fetch one result from that same project |
| `list_interfaces` | Explicitly maintained cross-project interfaces |
| `get_interface` | One explicit interface record |
| `get_shared_guidance` | Shared guidance and glossary for all projects (`yhteiset/`) |

Interface records and shared guidance are maintained by people. Records with
status `draft` are not shown to AI clients; they are drafted with
`/kuvaa-integraatio` and approved by changing the status to `active`. Both are
read directly from the workspace, so changes show without `publish`.

## Management workspace layout

```text
multiproject-mcp.yaml                 Shared base configuration
multiproject-mcp.local.yaml           Local profile
multiproject-mcp.server.example.yaml  Server profile template
interfaces/                           Cross-project interface records
yhteiset/                             Shared guidance and glossary (ohjaus.md, sanasto.md)
.multiproject/workspaces/             Ref-specific checkouts and documentation
.multiproject/publications/           Immutable releases and bundles
.multiproject/secrets/auth.json       Hashed HTTP credentials, never committed
.multiproject/state/                  Local workspace state
multiproject-mcp[.cmd]                Generated launcher
```

## Development and testing

```bash
npm test --prefix tyokalut/mcp
```

Run it in the `vnetcon-docs` directory. It includes a real Streamable HTTP client
and every authentication mode. In the vnetcon-docs source repository, the full
smoke test is `node tyokalut/testaa.mjs`.
