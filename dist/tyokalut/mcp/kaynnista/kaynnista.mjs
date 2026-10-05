#!/usr/bin/env node
// Käynnistää hallintakäyttöliittymän ilman päätettä: asentaa tarvittaessa MCP:n
// riippuvuudet, käynnistää palvelimen ja avaa selaimen. Tuplaklikattavat
// käynnistimet (.command, .cmd, .sh) kutsuvat tätä.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MCP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.resolve(MCP, '..', '..');
const WIN = process.platform === 'win32';

if (!fs.existsSync(path.join(MCP, 'node_modules', '@modelcontextprotocol', 'sdk'))) {
  console.log('Asennetaan MCP:n riippuvuudet (kerran)…');
  const npm = spawnSync(WIN ? 'npm.cmd' : 'npm', ['ci', '--prefix', MCP], { stdio: 'inherit', shell: WIN });
  if (npm.status !== 0) {
    console.error('Riippuvuuksien asennus epäonnistui. Tarvitaan Node.js 18+ ja npm.');
    process.exit(1);
  }
}

const server = spawn(process.execPath, [path.join(MCP, 'bin', 'multiproject-mcp.mjs'), 'ui', ...process.argv.slice(2)],
  { cwd: DOCS, stdio: ['inherit', 'inherit', 'pipe'] });
let opened = false;
server.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  const url = String(chunk).match(/https?:\/\/\S+\/ui\/?/);
  if (url && !opened) {
    opened = true;
    const target = url[0].endsWith('/') ? url[0] : `${url[0]}/`;
    const opener = WIN ? ['cmd', ['/c', 'start', '', target]] : process.platform === 'darwin' ? ['open', [target]] : ['xdg-open', [target]];
    spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
    console.log(`Hallintakäyttöliittymä: ${target}  (sulje tämä ikkuna pysäyttääksesi palvelimen)`);
  }
});
server.on('close', (code) => process.exit(code ?? 0));
