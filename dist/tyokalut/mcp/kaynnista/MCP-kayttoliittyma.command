#!/bin/sh
# macOS: tuplaklikkaa käynnistääksesi vnetcon-docsin MCP-hallintakäyttöliittymän.
cd "$(dirname "$0")" && exec node kaynnista.mjs "$@"
