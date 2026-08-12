#!/usr/bin/env bash
# Claude Coden apiKeyHelper: tulostaa Anthropic-tunnisteen stdoutiin.
#
# Käyttö .claude/settings.json:issa:
#   { "apiKeyHelper": "./tyokalut/vnetcon-ai/hae-token.sh" }
#
# Tunniste luetaan konfiguraation osoittamasta paikasta
# (vnetcon.config.yaml → agentit.claude.token_lahde), oletuksena
# ~/.vnetcon/credentials.env. Tunnistetta ei koskaan tulosteta lokiin.
set -euo pipefail
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vnetcon-ai" token claude
