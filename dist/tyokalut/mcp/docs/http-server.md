# HTTP server and deployment

> 🇫🇮 [Suomeksi](http-palvelin.md) · [Back to the main guide](../README.en.md) ·
> [Authentication](authentication.md) · [Refresh](refresh.md) · [AI clients](clients.md)

The server implements MCP Streamable HTTP. The same published data and MCP
tools are available over both stdio and HTTP.

## Local trial

Publish a channel before starting the server, then configure loopback-only HTTP:

```bash
./multiproject-mcp server configure-http \
  --listen 127.0.0.1:8793 \
  --channel local
./multiproject-mcp auth set-mode none
./multiproject-mcp doctor --http
./multiproject-mcp serve --transport http
```

Endpoints:

| URL | Purpose |
|-----|---------|
| `http://127.0.0.1:8793/mcp` | Default channel MCP connection |
| `http://127.0.0.1:8793/channels/<channel>/mcp` | Explicit channel MCP connection |
| `http://127.0.0.1:8793/healthz` | Process liveness |
| `http://127.0.0.1:8793/readyz` | Default publication readiness |
| `POST http://127.0.0.1:8793/hooks/git` | Protected refresh notification in webhook mode |

`server status` shows the effective server configuration. For one run, you can
override it with `serve --transport http --channel local`.
`server configure-http` only stores the address (default `127.0.0.1:8799`, the
same as `ui`); it does not change the default transport, so stdio clients keep
working. Start HTTP with `serve --transport http` or `ui`, or run
`server set-transport http` once to make plain `serve` start HTTP.
When refresh mode is `poll` or `webhook`, the same process also starts the
debounced queue worker. It never starts AI or publishes a channel.

## LAN or server deployment

`0.0.0.0` makes the process listen on every IPv4 interface. It is not an address
given to clients. A client uses the machine's real DNS name or IP address, such
as `https://docs-mcp.intra.example/mcp`.

```bash
./multiproject-mcp server configure-http \
  --listen 0.0.0.0:8793 \
  --channel production \
  --allow-network \
  --allowed-hosts docs-mcp.intra.example,10.20.30.40
./multiproject-mcp auth set-mode bearer
./multiproject-mcp auth token create \
  --name docs-client \
  --channels production \
  --projects billing,customers
./multiproject-mcp doctor --http
./multiproject-mcp serve --transport http
```

`--allow-network` is required when configuring a non-loopback listener. It
permits listening but does not bypass authentication. `--allowed-hosts` limits
accepted Host headers as DNS rebinding protection.

For organisation deployments, bearer can be replaced with OIDC. See
[Authentication and authorization](authentication.md).

## TLS and reverse proxy

The current process listens over HTTP. On a server, put a TLS-terminating reverse
proxy, ingress, or load balancer in front of it:

```text
AI client
  -> HTTPS / organisation network
  -> reverse proxy or ingress
  -> http://127.0.0.1:8793/mcp
  -> multiproject-mcp
```

Restrict the backend port to the proxy. Never send Basic credentials over an
unencrypted network. A bearer token is also a bearer secret, so external traffic
needs TLS or a protected tunnel in either mode.

## Sessions and snapshots

The implementation is a stateful Streamable HTTP server. The client receives a
session identifier during initialization and sends it on later requests. The
session is bound to its authenticated principal and channel.

Every new MCP connection pins the immutable bundle that the channel currently
references. If `publish` advances the channel:

- existing connections keep using their old bundle
- new connections receive the new bundle
- one conversation never mixes material from two publication moments.

## ChatGPT tunnel

A private server does not need public ingress for ChatGPT. When OpenAI Secure
MCP Tunnel is available in the organisation, store the tunnel id once and print
the commands:

```bash
./multiproject-mcp tunnel configure openai --tunnel-id tunnel_<32 characters>
./multiproject-mcp tunnel install openai
./multiproject-mcp tunnel prepare openai
```

`tunnel install` installs `tunnel-client` inside the MCP workspace
(`.multiproject/tunnel-client/`, outside git): it downloads the OpenAI release
and verifies its SHA-256, or copies a local one with
`--from <zip|directory|file>`. Profiles are stored in the same directory
(`--profile-dir`), so nothing goes to PATH or the home directory.
`tunnel uninstall openai`, or deleting the directory, removes everything.

`tunnel configure` stores the id and the `tunnel-client` profile (default
`vnetcon-docs-<parent project>`, change with `--client-profile`) in the machine
profile; `tunnel remove openai` removes them and prints a restore command.
`tunnel prepare` does not create cloud resources.
It prints `tunnel-client init`, `doctor`, and `run` commands based on the stored
HTTP endpoint (or the `ui` default). The management UI shows the same steps
with their status on the Process tab under *Yhteys AI-clienteihin*. Tunnel and ChatGPT connector setup require the relevant
OpenAI-side permissions. See [AI client compatibility](clients.md).

## Deliberately open network service

Open mode is possible but intentionally requires two explicit steps:

```bash
./multiproject-mcp server configure-http \
  --listen 0.0.0.0:8793 \
  --channel local \
  --allow-network
./multiproject-mcp auth set-mode none --allow-unauthenticated-network
```

Anyone who can reach the service can then access all channel content. Use this
only in a verified isolated test network. `doctor --http` always warns about it.

## Deployment checklist

1. `publish` and `smoke-test` pass for the selected channel.
2. `doctor --http` reports no errors.
3. A non-loopback service uses bearer or basic unless open access is a deliberate
   test decision.
4. `allowed_hosts` contains every client-facing DNS name or IP address.
5. Traffic outside the host uses TLS or a protected tunnel.
6. The firewall allows only the required source networks.
7. Credentials are restricted to the channels and projects they need.
