#!/usr/bin/env node
// Claude Coden apiKeyHelper: tulostaa Anthropic-tunnisteen stdoutiin.
//
// Käyttö .claude/settings.json:issa (toimii sekä macOS/Linux että Windows):
//   { "apiKeyHelper": "node ./tyokalut/vnetcon-ai/hae-token.mjs" }
//
// Tunniste luetaan konfiguraation osoittamasta paikasta
// (vnetcon.config.yaml → agentit.claude.token_lahde), oletuksena
// ~/.vnetcon/credentials.env. Tunnistetta ei koskaan tulosteta lokiin.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const TAALLA = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(TAALLA, 'vnetcon-ai.mjs'), 'token', 'claude'], {
  stdio: ['ignore', 'inherit', 'inherit'],
});
process.exit(r.status === null ? 1 : r.status);
