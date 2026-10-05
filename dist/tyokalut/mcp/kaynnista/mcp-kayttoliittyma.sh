#!/bin/sh
# Linux: käynnistää vnetcon-docsin MCP-hallintakäyttöliittymän ja avaa selaimen.
cd "$(dirname "$0")" && exec node kaynnista.mjs "$@"
