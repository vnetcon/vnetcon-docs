# AI client MCP compatibility

> 🇫🇮 [Suomeksi](asiakkaat.md) · [Back to the main guide](../README.en.md) ·
> [HTTP server](http-server.md)

Reviewed on 3 October 2026. Here HTTP means MCP Streamable HTTP. Product
features, account requirements, and organisation policy can change; verify the
linked vendor documentation before production deployment.

| AI client | stdio | Streamable HTTP | Private HTTP server | Setup consideration |
|-----------|-------|-----------------|---------------------|---------------------|
| ChatGPT | Not directly | Yes | Through Secure MCP Tunnel | Developer mode and workspace permissions may restrict connector setup |
| Codex CLI / IDE | Yes | Yes | Yes when the user's environment can reach it; tunnel is also possible | CLI and IDE share MCP configuration |
| Claude Code | Yes | Yes | Yes when the user's machine can reach it | HTTP can also use OAuth |
| Claude Desktop | Yes | Yes through a remote connector | Through a local organisation-provided `.mcpb` adapter | An ordinary remote connector originates in Anthropic's cloud, not on the user's machine |
| claude.ai | No | Yes through a remote connector | Not without ingress reachable from Anthropic's cloud | This is Claude's web version; localhost, VPN, or private DNS alone is insufficient |
| Cursor | Yes | Yes | Yes when the user's machine can reach it | Supports stdio, SSE, and Streamable HTTP |
| VS Code / GitHub Copilot | Yes | Yes | Yes when the user's machine can reach it | Organisation MCP policy or an allowlist may block it |
| GitHub Copilot CLI | Yes | Yes | Yes when the user's machine can reach it | Streamable HTTP is preferred; legacy SSE remains a compatibility option |
| Microsoft 365 Copilot | Not as a local process | Through a federated connector | Tenant- and administrator-specific | Not an ordinary end-user localhost connection; an administrator publishes the connector |

## Practical selection

- On a developer workstation, stdio is simplest when the client supports it.
- For a desktop client on an internal network, use a direct HTTPS MCP endpoint
  when the client connects from the user's machine.
- For ChatGPT, carry a private service through Secure MCP Tunnel.
- A `claude.ai` remote connector needs an endpoint reachable from Anthropic's
  cloud. HTTPS alone does not help if the address is not routable from there.
- Microsoft 365 Copilot requires a tenant-administered federated connector; it
  is not an end-user local setting comparable to the ChatGPT tunnel.

## Claude Desktop and claude.ai differ

Claude Desktop can use a local desktop extension:

```text
Claude Desktop
  -> organisation-managed .mcpb extension
  -> internal HTTP/HTTPS MCP
  -> multiproject-mcp
```

The extension runs on the user's machine and can therefore use its VPN or
internal network connection. An organisation can distribute it centrally or as
a one-click install. The first implementation needs a small `.mcpb` adapter to
forward MCP calls and credentials to the internal service.

`claude.ai` is the web version. Its remote connector opens connections from
Anthropic's cloud, so the same local adapter does not expose a private service
to the web version.

## Private ChatGPT connection

ChatGPT does not start this repository's stdio process on the user's machine. A
private HTTP service can remain internal and be carried through OpenAI Secure
MCP Tunnel. Start on the service side with:

```bash
./multiproject-mcp tunnel prepare openai
```

Adding the connector in a ChatGPT workspace may require Developer mode and
administrator permission or approval. Do not expose the service to the public
internet merely to establish the connector.

## Microsoft 365 Copilot

Microsoft 365 Copilot uses an administrator-managed federated connector path.
In practice, a tenant administrator configures and publishes the connection,
permissions, and organisation policies. Direct Streamable HTTP is therefore
technically available but requires more administration than Cursor, Claude
Code, or VS Code.

## Sources

- [OpenAI: Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [OpenAI: MCP client setup](https://developers.openai.com/learn/docs-mcp)
- [Anthropic: remote MCP connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Anthropic: MCP in Claude products](https://docs.anthropic.com/en/docs/mcp)
- [Anthropic: enterprise desktop extensions](https://support.claude.com/en/articles/12702546-deploying-enterprise-grade-mcp-servers-with-desktop-extensions)
- [Anthropic: local MCP servers in Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
- [Cursor: Model Context Protocol](https://docs.cursor.com/context/model-context-protocol)
- [VS Code: MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [GitHub: MCP servers in Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)
- [Microsoft: Microsoft 365 Copilot connectors](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-copilot-connector)
