# multiproject-mcp — user guide

> 🇫🇮 [Suomeksi](README.md) · [Repository overview](../README.en.md) ·
> [Architecture and implementation specification (Finnish)](../multiproject-mcp.md)

`multiproject-mcp` publishes documentation from multiple Git projects and
branches as controlled snapshots and serves it to MCP clients. It can run as a
local stdio process or as a shared Streamable HTTP server.

## Implemented capabilities

- Every `project_id` + Git ref pair has a separate checkout and documentation
  workspace.
- In `repository` mode, the selected branch's `vnetcon-docs` is published as-is.
- In `managed` mode, documentation lives in the publication-side clone; the
  tool does not commit or push it to the source repository.
- A publication pins exact commits and documentation revisions.
- MCP search always requires one `project_id`; project content is never merged
  into a single search corpus.
- Each MCP connection is pinned to the bundle that was current when it opened.
- Cross-project relationships come only from explicit `interfaces/` records.
- HTTP supports unauthenticated, bearer-token, basic, and OIDC authentication, with
  optional channel and project restrictions.
- Git changes can be detected manually, by polling, or through a protected
  webhook; the debounced queue never starts AI or publication by itself.

Filesystem storage, manual/poll/webhook refresh, stdio, Streamable HTTP, and an
OIDC resource server are implemented. Cloud storage, native Git-provider
payload adapters, and a management UI are not yet part of this version.

## Prerequisites

- Git
- Node.js 18 or newer
- npm for initial installation
- an AI agent only when generating `managed` documentation

## Quick start

Run from this source repository's root:

```bash
npm install --prefix multiproject-mcp
node tyokalut/multiproject-mcp.mjs init ../my-documentation-service
cd ../my-documentation-service
./multiproject-mcp help
```

On Windows, use the generated `multiproject-mcp.cmd` launcher.

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

In `repository` mode, the ref's documentation is now ready for publication. In
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
./multiproject-mcp serve
```

The MCP endpoint is then `http://127.0.0.1:8793/mcp`. Use authentication and
TLS on a LAN or server deployment. The service refuses unauthenticated
non-loopback listening unless it is explicitly allowed.

Focused guides:

- [HTTP server and deployment](docs/http-server.md)
- [Authentication and authorization](docs/authentication.md)
- [Git change detection and refresh](docs/refresh.md)
- [AI client compatibility](docs/clients.md)

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
| `server configure-http` | Create the HTTP configuration |
| `server set-transport` | Select stdio or HTTP as the default transport |
| `auth set-mode` / `auth configure-oidc` | Select and configure authentication |
| `auth token ...` / `auth user ...` | Manage credentials and access scopes |
| `refresh configure-poll/configure-webhook` | Configure automatic change detection |
| `refresh detect/queue/run/watch` | Manage the debounced queue and controller |
| `tunnel prepare openai` | Print Secure MCP Tunnel setup commands |
| `serve` | Start the selected MCP transport |

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

## Management workspace layout

```text
multiproject-mcp.yaml                 Shared base configuration
multiproject-mcp.local.yaml           Local profile
multiproject-mcp.server.example.yaml  Server profile template
interfaces/                           Cross-project interface records
.multiproject/workspaces/             Ref-specific checkouts and documentation
.multiproject/publications/           Immutable releases and bundles
.multiproject/secrets/auth.json       Hashed HTTP credentials, never committed
.multiproject/state/                  Local workspace state
multiproject-mcp[.cmd]                Generated launcher
```

## Development and testing

```bash
npm test --prefix multiproject-mcp
node tyokalut/testaa.mjs
```

The first command includes a real Streamable HTTP client and every
authentication mode. The second runs the repository-wide smoke test.
