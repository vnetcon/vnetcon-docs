# Git change detection and refresh

> 🇫🇮 [Suomeksi](virkistys.md) · [Back to the main guide](../README.en.md) ·
> [HTTP server](http-server.md)

Refresh is split into three stages:

```text
change detection
  -> debounced queue
  -> source workspace refresh
  -> separate documentation, approval, and publication
```

A Git event neither starts an AI agent nor changes an MCP channel publication.

## Manual refresh

The existing direct workflow remains available:

```bash
./multiproject-mcp plan refresh --all
./multiproject-mcp refresh --all
```

The queue-based equivalent is:

```bash
./multiproject-mcp refresh detect --all
./multiproject-mcp refresh queue --active
./multiproject-mcp refresh run --now
```

`detect` compares current ref commit SHAs with the last processed workspace
state. It does not clone, document, or publish.

## Polling

Polling is a good first server deployment because the Git service needs no
changes:

```bash
./multiproject-mcp refresh configure-poll \
  --interval 300 \
  --debounce 900
```

The HTTP server starts the polling controller with the normal `serve` command.
Without HTTP, run the controller as a separate process:

```bash
./multiproject-mcp refresh watch
```

This example checks refs every five minutes and gives a detected change a
15-minute debounce. Another push postpones the same project/ref job, combining
a push burst into one refresh.

Use `--detect-only` when checkout updates must remain manual:

```bash
./multiproject-mcp refresh configure-poll \
  --interval 300 \
  --debounce 900 \
  --detect-only
```

An administrator then processes the queue with `refresh run`.

## Webhook or CI notification

Enable the generic endpoint and create a random credential:

```bash
./multiproject-mcp refresh configure-webhook --debounce 900
./multiproject-mcp refresh webhook-token create \
  --name git-service \
  --projects billing,customers
./multiproject-mcp serve
```

Send notifications to `POST /hooks/git`:

```bash
curl -X POST https://docs-mcp.intra.example/hooks/git \
  -H 'Content-Type: application/json' \
  -H 'X-Multiproject-Webhook-Token: hook_...' \
  -d '{
    "project_id": "billing",
    "ref": "development",
    "source_commit_sha": "<full commit SHA>"
  }'
```

The server also resolves the ref itself and rejects a request whose SHA does not
match the current source. A token can be restricted to selected projects.

```bash
./multiproject-mcp refresh webhook-token list
./multiproject-mcp refresh webhook-token revoke git-service
```

The endpoint is provider-neutral. Native GitHub, GitLab, Bitbucket, and Azure
DevOps payload signatures can be added later as adapters. The current endpoint
works directly from CI, a self-hosted Git server hook, or a small relay script.

## Choosing the repository source

Use `repository.url` for automatic server operation. The service resolves refs
from the Git service and runs `fetch --prune origin` in its own checkout.

`repository.path` makes that local Git repository the source of truth. This is
convenient on a developer machine, but it sees external changes only after the
local repository itself has been updated.

The tool does not run a merging `git pull`. Each workspace is force-checked out
in detached mode at one exact commit SHA.

## Effect on documentation

- In `repository` mode, the new `vnetcon-docs` comes from the same source
  commit. Publication still requires a separate `publish` command.
- In `managed` mode, source is updated and the workspace becomes
  `needs_documentation`. AI generation, review, approval, and publication remain
  separate steps.

This prevents every push from starting unnecessary AI work or publishing
unreviewed output.
