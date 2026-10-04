# AI-clienttien MCP-yhteensopivuus

> 🇬🇧 [English](clients.md) · [Takaisin pääohjeeseen](../README.md) ·
> [HTTP-palvelin](http-palvelin.md)

Tilanne on tarkistettu 3.10.2026. Tässä HTTP tarkoittaa MCP:n Streamable HTTP
-siirtotapaa. Tuoteominaisuudet, tilivaatimukset ja organisaation käytännöt
voivat muuttua, joten tarkista linkitetyt valmistajaohjeet ennen tuotantoonvientiä.

| AI-client | stdio | Streamable HTTP | Yksityinen HTTP-palvelin | Käyttöönoton huomio |
|-----------|-------|-----------------|--------------------------|---------------------|
| ChatGPT | Ei suoraan | Kyllä | Secure MCP Tunnelin kautta | Developer mode ja workspacen oikeudet voivat rajata connectorin käyttöönottoa |
| Codex CLI / IDE | Kyllä | Kyllä | Kyllä, jos käyttäjän ympäristö tavoittaa palvelimen; myös tunneli on mahdollinen | CLI ja IDE jakavat MCP-konfiguraation |
| Claude Code | Kyllä | Kyllä | Kyllä, jos käyttäjän kone tavoittaa palvelimen | HTTP-yhteys voi käyttää myös OAuthia |
| Claude Desktop | Kyllä | Remote connectorilla kyllä | Paikallisella organisaation `.mcpb`-sovittimella | Tavallinen remote connector lähtee Anthropicin pilvestä, ei käyttäjän koneelta |
| claude.ai | Ei | Remote connectorilla kyllä | Ei ilman Anthropicin pilvestä saavutettavaa ingressiä | Tämä on Clauden web-versio; localhost, VPN tai yksityinen DNS ei sellaisenaan toimi |
| Cursor | Kyllä | Kyllä | Kyllä, jos käyttäjän kone tavoittaa palvelimen | Tukee stdio-, SSE- ja Streamable HTTP -palvelimia |
| VS Code / GitHub Copilot | Kyllä | Kyllä | Kyllä, jos käyttäjän kone tavoittaa palvelimen | Organisaation MCP-politiikka tai sallittujen palvelinten lista voi estää yhteyden |
| GitHub Copilot CLI | Kyllä | Kyllä | Kyllä, jos käyttäjän kone tavoittaa palvelimen | Streamable HTTP on ensisijainen; SSE on yhteensopivuustila |
| Microsoft 365 Copilot | Ei paikallisena prosessina | Federated connector -mallilla | Tenant- ja ylläpitäjäkohtainen | Ei tavallinen loppukäyttäjän lisäämä localhost-yhteys; ylläpitäjä julkaisee connectorin |

## Käytännön valinta

- Kehittäjän omalla koneella stdio on yksinkertaisin, jos client tukee sitä.
- Työpöytäclientille sisäverkossa käytä suoraa HTTPS MCP -osoitetta, jos client
  tekee yhteyden käyttäjän koneelta.
- ChatGPT:lle yksityinen palvelu välitetään Secure MCP Tunnelilla.
- `claude.ai`:n remote connector tarvitsee Anthropicin pilvestä saavutettavan
  osoitteen. Pelkkä HTTPS ei auta, jos osoite ei reitity Anthropicin verkosta.
- Microsoft 365 Copilotissa tarvitaan tenantin ylläpitämä federated connector;
  se ei ole ChatGPT:n tunnelin kaltainen loppukäyttäjän paikallinen asetus.

## Claude Desktop ja claude.ai ovat eri tapauksia

Claude Desktop voi käyttää paikallista desktop extensionia:

```text
Claude Desktop
  -> organisaation hallittu .mcpb-extension
  -> sisäverkon HTTP/HTTPS MCP
  -> multiproject-mcp
```

Extension toimii käyttäjän koneella, joten se voi hyödyntää koneen VPN- tai
sisäverkkoyhteyttä. Organisaatio voi jakaa sen keskitetysti tai yhden
napsautuksen asennuksena. Ensimmäinen tällainen toteutus tarvitsee pienen
`.mcpb`-sovittimen, joka välittää MCP-kutsut ja tunnistustiedot sisäiseen
palveluun.

`claude.ai` on web-versio. Sen remote connector avaa yhteyden Anthropicin
pilvestä, joten sama paikallinen sovitin ei tuo yksityistä palvelua web-versioon.

## ChatGPT:n yksityinen yhteys

ChatGPT ei käynnistä tämän repositoryn stdio-prosessia käyttäjän koneella.
Yksityinen HTTP-palvelu voidaan pitää lähiverkossa ja välittää OpenAI Secure MCP
Tunnelin avulla. Aloita palvelun puolella komennolla:

```bash
./multiproject-mcp tunnel prepare openai
```

ChatGPT Workspacessa connectorin lisääminen voi edellyttää Developer modea ja
ylläpitäjän oikeuksia tai hyväksyntää. Älä julkaise palvelua avoimeen internetiin
vain connectorin muodostamiseksi.

## Microsoft 365 Copilot

Microsoft 365 Copilotin MCP-polku on hallittu federated connector. Käytännössä
tenantin ylläpitäjä määrittää ja julkaisee yhteyden, käyttöoikeudet ja
organisaation politiikat. Siksi suora Streamable HTTP on teknisesti mahdollinen,
mutta käyttöönotto vaatii enemmän hallintakonfiguraatiota kuin Cursorissa,
Claude Codessa tai VS Codessa.

## Lähteet

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
