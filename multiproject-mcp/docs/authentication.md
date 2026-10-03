# Authentication and authorization

> 🇫🇮 [Suomeksi](autentikointi.md) · [Back to the main guide](../README.en.md) ·
> [HTTP server](http-server.md)

The HTTP server supports `none`, `bearer`, `basic`, and `oidc`. A stdio connection is a
local child process and does not use these HTTP credentials.

## `none`

For a local trial:

```bash
./multiproject-mcp auth set-mode none
```

This is useful on a loopback address. On a non-loopback address, the server
refuses to start unless open network access is explicitly accepted:

```bash
./multiproject-mcp auth set-mode none --allow-unauthenticated-network
```

Open mode provides neither user-level auditing nor content restriction.

## Bearer token

Bearer is the recommended first authentication method for automated clients:

```bash
./multiproject-mcp auth set-mode bearer
./multiproject-mcp auth token create --name cursor-alice
```

The token is shown only once. The client sends it as:

```http
Authorization: Bearer mcp_...
```

Optionally restrict a credential:

```bash
./multiproject-mcp auth token create \
  --name finance-team \
  --channels production \
  --projects billing,ledger
```

Manage tokens with:

```bash
./multiproject-mcp auth token list
./multiproject-mcp auth token revoke finance-team
```

## Username and password

Basic works with clients that can send HTTP Basic credentials:

```bash
./multiproject-mcp auth set-mode basic
./multiproject-mcp auth user add \
  --username alice \
  --channels production \
  --projects billing,ledger
```

The command prompts without echo. A script can supply the password over stdin
instead of placing it in a command-line argument:

```bash
printf '%s\n' "$MCP_SETUP_PASSWORD" | \
  ./multiproject-mcp auth user add --username alice --password-stdin
```

Passwords must contain at least 12 characters. Basic encodes but does not
encrypt its credentials; use it across a network only inside HTTPS or a
protected tunnel.

Manage users with:

```bash
./multiproject-mcp auth user list
./multiproject-mcp auth user remove alice
```

## Channel and project restrictions

`--channels` limits the HTTP endpoints a credential may open. `--projects`
limits the projects that MCP tools show and accept. Unknown identifiers are
rejected when the credential is created.

Without either flag, the credential can access every configured channel and
project. An interface record is visible only when all its parties belong to the
credential's allowed projects.

## OAuth 2.0 / OpenID Connect

OIDC mode validates access tokens from an organisation identity provider. It
works with Microsoft Entra ID, Entrust IDaaS, Keycloak, Okta, Auth0, and other
providers exposing standard OIDC discovery and JWKS endpoints.

```bash
./multiproject-mcp auth configure-oidc \
  --issuer https://id.example.com/tenant \
  --audience vnetcon-docs-mcp \
  --resource https://docs-mcp.intra.example/mcp \
  --scopes docs.read
```

Use `--discovery-url` or `--jwks-uri` for non-default endpoint locations. The
server validates signature, issuer, audience, expiry, algorithm, and required
scopes. Signing-key rotation is handled through JWKS.
Login and token issuance remain at the identity provider; `multiproject-mcp`
acts as the OAuth protected resource and stores no OIDC client secret.

Add a claim rule with a command:

```bash
./multiproject-mcp auth oidc-rule add \
  --name finance-team \
  --claim groups \
  --values <Entra group object ID> \
  --channels production \
  --projects billing,ledger
```

The equivalent profile YAML is:

```yaml
runtime:
  http:
    authentication:
      mode: oidc
      oidc:
        issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
        audience: <API application client ID>
        resource: https://docs-mcp.intra.example/mcp
        required_scopes: [docs.read]
        principal_claim: oid
        access_rules:
          - name: finance-team
            claim: groups
            values: [<Entra group object ID>]
            channels: [production]
            projects: [billing, ledger]
```

Without `access_rules`, every accepted token can access all configured content.
When rules exist but none match, access is denied.

## Secret storage

Credentials are stored in the management workspace at:

```text
.multiproject/secrets/auth.json
```

- the file is created with mode `0600` where supported
- only a SHA-256 digest of a high-entropy bearer token is stored
- passwords use a random salt and scrypt digest
- raw tokens and passwords cannot be read back
- `.multiproject/` is in the generated workspace's `.gitignore`.

If a token is lost, create a replacement and revoke the old token. To change a
password, remove and recreate the user.

## Verification

```bash
./multiproject-mcp auth status
./multiproject-mcp doctor --http
```

`auth status` shows the mode, credential names, and access scopes, but no
secrets. `doctor` fails when bearer mode has no token or basic mode has no user.

Built-in bearer and basic modes suit small controlled deployments. OIDC is the
recommended organisation option for centralized lifecycle, groups, application
roles, and single sign-on.

References:

- [MCP authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization)
- [Microsoft Entra access-token validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [Microsoft Entra claims validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation)
- [Entrust IDaaS OIDC discovery](https://api.managed.entrust.com/pki/1.5/Use-discovery-endpoint.html)
