import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { convertFile } from '../src/convert.mjs';
import { pageText } from '../src/pdf.mjs';
import { serverInstructions } from '../src/mcp-server.mjs';
import { writeDocx } from './office-fixtures.mjs';
import { writePdf } from './pdf-fixtures.mjs';

// PDF-lähdeaineistot ja käyttö ilman koodia: työtila, jossa on pelkkiä lähteitä.

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(PACKAGE_ROOT, 'bin', 'multiproject-mcp.mjs');

function command(cwd, args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, expected, `${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function write(filename, content) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

const files = (workspace, id) => Object.fromEntries(JSON.parse(command(workspace, ['source', 'show', id, '--json']).stdout).files.map((entry) => [entry.path, entry]));

const MANUAL = [
  { lines: ['Toimintaohje', 'Asiakaspalvelu vastaa yöllä päivystyssanaan.', '', 'Toinen kappale (ö) jatkuu.'] },
  { lines: ['Toinen sivu', 'Hinnoittelusana kuuluu sivulle kaksi.'] },
  { image: true },
];

function setup(prefix) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const docs = path.join(temp, 'ohjeet');
  writePdf(path.join(docs, 'Toimintaohje.pdf'), MANUAL, { title: 'Asiakaspalvelun ohje', author: 'Äijä Öljynen' });
  writePdf(path.join(docs, 'skannattu.pdf'), [{ image: true }, { image: true }]);
  write(path.join(docs, 'rikki.pdf'), '%PDF-1.4\nei oikea pdf');
  writeDocx(path.join(docs, 'Perehdytys.docx'), { paragraphs: [{ style: 'Otsikko1', text: 'Perehdytys' }, { text: 'Perehdytyssana ensimmäiselle päivälle.' }] });
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace, '--ilman-emoprojektia']);
  command(workspace, ['source', 'add', '--id', 'ohjeet', '--type', 'directory', '--location', docs, '--name', 'Asiakaspalvelun ohjeet', '--owner', 'Asiakaspalvelu']);
  command(workspace, ['channel', 'create', 'local']);
  return { temp, docs, workspace };
}

async function connectStdio(workspace) {
  const client = new Client({ name: 'codeless-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [CLI, 'serve', '--transport', 'stdio', '--channel', 'local'], cwd: workspace }));
  return client;
}

const call = async (client, name, args) => (await client.callTool({ name, arguments: args })).structuredContent;

test('PDF: sivut, ääkköset, tiedot ja tekstittömät sivut', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-convert-'));
  const filename = path.join(temp, 'ohje.pdf');
  writePdf(filename, MANUAL, { title: 'Asiakaspalvelun ohje', author: 'Äijä Öljynen' });
  const converted = await convertFile(filename);
  assert.equal(converted.pages, 3);
  assert.match(converted.markdown, /^## Sivu 1\n\nToimintaohje\nAsiakaspalvelu vastaa yöllä päivystyssanaan\.\n\nToinen kappale \(ö\) jatkuu\.$/m, 'rivit ja kappaleet');
  assert.ok(converted.markdown.indexOf('## Sivu 2') > converted.markdown.indexOf('päivystyssanaan'));
  assert.match(converted.markdown, /## Sivu 3\n\n_\(ei tekstiä\)_/);
  assert.ok(converted.notes.some((note) => /otsikot ja taulukot eivät säily/.test(note)));
  assert.ok(converted.notes.some((note) => note.includes('otsikko "Asiakaspalvelun ohje"') && note.includes('tekijä Äijä Öljynen')));
  assert.ok(converted.notes.includes('Sivut ilman tekstiä: 3.'));

  // Rivin alun # ei muutu otsikoksi, jotta sivujako säilyy.
  const text = pageText([
    { str: '# ei otsikko', transform: [12, 0, 0, 12, 72, 720], width: 60, hasEOL: true },
    { str: '1. Vastaanotto', transform: [12, 0, 0, 12, 72, 704], width: 60, hasEOL: false },
  ]);
  assert.equal(text, '\\# ei otsikko\n1. Vastaanotto');
});

test('PDF: skannattu ei tuettu, rikkinäinen virhe, eikä epäonnistunutta muunneta joka skannauksella', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-errors-'));
  const scanned = path.join(temp, 'skannattu.pdf');
  writePdf(scanned, [{ image: true }, { image: true }, { lines: ['Kansilehti, jossa on tekstiä.'] }]);
  await assert.rejects(() => convertFile(scanned), (error) => error.unsupported === true && /Skannattu PDF/.test(error.message));
  write(path.join(temp, 'rikki.pdf'), 'ei pdf');
  await assert.rejects(() => convertFile(path.join(temp, 'rikki.pdf')), (error) => !error.unsupported && /kelvollinen PDF/.test(error.message));

  const { workspace } = setup('pdf-scan-');
  command(workspace, ['source', 'scan', 'ohjeet']);
  const state = files(workspace, 'ohjeet');
  assert.equal(state['Toimintaohje.pdf'].status, 'uusi');
  assert.equal(state['skannattu.pdf'].status, 'ei-tuettu');
  assert.match(state['skannattu.pdf'].error, /tekstintunnistusta \(OCR\) ei tueta/i);
  assert.equal(state['rikki.pdf'].status, 'virhe');
  assert.equal(state['skannattu.pdf'].failed_sha256, state['skannattu.pdf'].sha256);
  // Toinen skannaus käyttää tallennettua tulosta: muunnosta ei yritetä uudelleen.
  const inventory = path.join(workspace, '.multiproject', 'sources', 'ohjeet', 'inventory.json');
  const saved = JSON.parse(fs.readFileSync(inventory, 'utf8'));
  saved.files['skannattu.pdf'].error = 'tallennettu syy';
  fs.writeFileSync(inventory, JSON.stringify(saved));
  command(workspace, ['source', 'scan', 'ohjeet']);
  assert.equal(files(workspace, 'ohjeet')['skannattu.pdf'].error, 'tallennettu syy');
  command(workspace, ['source', 'approve', 'ohjeet', '--file', 'skannattu.pdf'], 1);
});

test('ilman koodia: julkaisu, smoke-test, prosessi, MCP-ohje, sivunumero ja merkinnät', async () => {
  const { workspace } = setup('codeless-flow-');
  command(workspace, ['source', 'scan', 'ohjeet']);
  command(workspace, ['source', 'approve', 'ohjeet', '--all-changed']);
  command(workspace, ['channel', 'add-source', 'local', 'ohjeet']);
  command(workspace, ['publish', '--channel', 'local']);
  assert.match(command(workspace, ['smoke-test', '--channel', 'local']).stdout, /OK: local, .*projekteja 0, lähdeaineistoja 1/);

  const process = JSON.parse(command(workspace, ['process', '--json']).stdout);
  const step = (id) => process.workspace.find((item) => item.id === id);
  assert.equal(process.codeless, true);
  assert.equal(step('projektit').status, 'tieto');
  assert.equal(step('kanava').status, 'valmis');
  assert.match(step('kanava').detail, /lähde ohjeet/);
  assert.equal(step('lahdeaineistot').status, 'valmis');

  const client = await connectStdio(workspace);
  try {
    assert.match(client.getInstructions(), /^Tietopohja on organisaation hyväksyttyä lähdeaineistoa\. Aloita list_sources/);
    assert.doesNotMatch(client.getInstructions(), /list_projects/);
    assert.deepEqual((await call(client, 'list_projects', {})).projects, []);
    const hits = (await call(client, 'search_sources', { source_id: 'ohjeet', query: 'hinnoittelusana' })).results;
    assert.equal(hits[0].path, 'Toimintaohje.pdf');
    assert.equal(hits[0].page, 2);
    assert.equal(hits[0].heading, 'Sivu 2');
    const word = (await call(client, 'search_sources', { source_id: 'ohjeet', query: 'perehdytyssana' })).results;
    assert.equal(word[0].page, undefined, 'sivunumero vain PDF:lle');
    const document = await call(client, 'fetch_source_document', { source_id: 'ohjeet', document_id: hits[0].document_id });
    assert.equal(document.verified_against_code, false, 'koneluettava kenttä säilyy');
    assert.match(document.content, /\*\*Hyväksytty lähdeaineisto\*\*/);
    assert.match(document.content, /Hyväksytty \d+\.\d+\.\d{4}/);
    assert.match(document.content, /otsikot ja taulukot eivät säily/);
    assert.doesNotMatch(document.content, /koodia vasten/);
  } finally {
    await client.close();
  }

  // Ohje kanavan sisällön mukaan.
  assert.match(serverInstructions({ projects: [{}], sources: [] }), /^Valitse projekti list_projects/);
  assert.doesNotMatch(serverInstructions({ projects: [{}], sources: [] }), /Lähdeaineisto/);
  assert.match(serverInstructions({ projects: [{}], sources: [{}] }), /painota toteutuksen osalta koodidokumentaatiota/);
});

test('vienti pelkistä lähteistä: tiedostot, ohjeteksti, osiin jako ja vanhentuminen', () => {
  const { docs, workspace } = setup('codeless-export-');
  command(workspace, ['source', 'scan', 'ohjeet']);
  command(workspace, ['source', 'approve', 'ohjeet', '--all-changed']);
  command(workspace, ['channel', 'add-source', 'local', 'ohjeet']);
  command(workspace, ['publish', '--channel', 'local']);

  assert.match(command(workspace, ['export', 'plan', '--channel', 'local'], 1).stderr, /--source/);
  assert.match(command(workspace, ['export', 'plan', '--channel', 'local', '--include-sources'], 1).stderr, /--source <id,…>/);

  const created = command(workspace, ['export', 'create', '--channel', 'local', '--source', 'ohjeet', '--target', 'chatgpt-projekti']).stdout;
  assert.match(created, /Lähdeaineisto: ohjeet \(2 dokumenttia\)/);
  const id = created.match(/Vienti (\S+) muodostettiin/)[1];
  assert.match(id, /^\d{8}-ohjeet-[0-9a-f]{8}$/);
  const dir = path.join(workspace, '.multiproject', 'publications', 'exports', id, 'sisalto');
  const sourceFile = fs.readFileSync(path.join(dir, 'tiedostot', '70-lahdeaineisto-ohjeet.md'), 'utf8');
  assert.match(sourceFile, /Tietolaji: hyväksytty lähdeaineisto/);
  assert.doesNotMatch(sourceFile, /koodia vasten/);
  assert.match(sourceFile, /Hinnoittelusana kuuluu sivulle kaksi/);
  const instructions = fs.readFileSync(path.join(dir, 'ohjeet.md'), 'utf8');
  assert.match(instructions, /^Vastaa kysymyksiin liitetyn lähdeaineiston perusteella: Asiakaspalvelun ohjeet\./);
  assert.match(instructions, /PDF:stä sivu/);
  assert.doesNotMatch(instructions, /koodi/);
  const readme = fs.readFileSync(path.join(dir, 'LUE-MINUT.md'), 'utf8');
  assert.match(readme, /\| Asiakaspalvelun ohjeet \(`ohjeet`\) \| 2 \|/);
  assert.doesNotMatch(readme, /Lähdecommit|koodi muuttuu|Projektien eristys/);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.projects, []);
  assert.equal(manifest.sources[0].source_id, 'ohjeet');
  assert.match(command(workspace, ['export', 'list']).stdout, new RegExp(`${id}  ajan tasalla  chatgpt-projekti  lähde:ohjeet`));

  // Iso lähde jaetaan osiin profiilin tiedostokokorajan mukaan.
  fs.appendFileSync(path.join(workspace, 'multiproject-mcp.yaml'), 'exports:\n  profiles:\n    pieni:\n      label: Pieni\n      grouping: merged\n      max_file_bytes: 1200\n');
  command(workspace, ['config', 'validate']);
  const small = JSON.parse(command(workspace, ['export', 'plan', '--channel', 'local', '--source', 'ohjeet', '--target', 'pieni', '--json']).stdout);
  const parts = small.manifest.files.filter((file) => file.kind === 'lahdeaineisto').map((file) => file.path);
  assert.deepEqual(parts, ['tiedostot/70-lahdeaineisto-ohjeet-1.md', 'tiedostot/70-lahdeaineisto-ohjeet-2.md']);

  // Muuttunut ja hyväksytty dokumentti vanhentaa viennin.
  writeDocx(path.join(docs, 'Perehdytys.docx'), { paragraphs: [{ text: 'Uusi perehdytys.' }] });
  command(workspace, ['source', 'scan', 'ohjeet']);
  command(workspace, ['source', 'approve', 'ohjeet', '--all-changed']);
  command(workspace, ['publish', '--channel', 'local']);
  const status = JSON.parse(command(workspace, ['export', 'list', '--json']).stdout).exports.find((item) => item.export_id === id);
  assert.equal(status.status, 'vanhentunut');
  assert.deepEqual(status.sources.map((source) => source.source_id), ['ohjeet']);
});

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startUi(cwd, port) {
  const child = spawn(process.execPath, [CLI, 'ui', '--listen', `127.0.0.1:${port}`], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`UI-palvelin päättyi: ${stderr}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return child; } catch { /* käynnistyy */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM');
  throw new Error(`UI-palvelin ei käynnistynyt: ${stderr}`);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

test('käyttöliittymä: vienti pelkistä lähteistä ja lähderajattu ylläpitäjä', async () => {
  const { temp, workspace } = setup('codeless-ui-');
  const other = path.join(temp, 'sopimukset');
  writeDocx(path.join(other, 'Sopimus.docx'), { paragraphs: [{ text: 'Sopimussana.' }] });
  command(workspace, ['source', 'add', '--id', 'sopimukset', '--type', 'directory', '--location', other, '--name', 'Sopimukset']);
  for (const id of ['ohjeet', 'sopimukset']) {
    command(workspace, ['source', 'scan', id]);
    command(workspace, ['source', 'approve', id, '--all-changed']);
    command(workspace, ['channel', 'add-source', 'local', id]);
  }
  command(workspace, ['publish', '--channel', 'local']);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  command(workspace, ['server', 'configure-http', '--listen', `127.0.0.1:${port}`, '--channel', 'local']);
  command(workspace, ['auth', 'set-mode', 'bearer']);
  const token = (args) => `Bearer ${command(workspace, ['auth', 'token', 'create', ...args]).stdout.trim().split('\n').at(-1)}`;
  const admin = token(['--name', 'yllapitaja', '--admin']);
  const ohjeet = token(['--name', 'ohjeet-yllapitaja', '--admin', '--sources', 'ohjeet']);
  const run = (authorization, args) => fetch(`${base}/ui/api/run`, {
    method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json', 'X-Vnetcon-UI': '1' }, body: JSON.stringify({ args }),
  }).then(async (response) => ({ status: response.status, data: await response.json() }));
  const exportsOf = async (authorization) => (await (await fetch(`${base}/ui/api/exports`, { headers: { Authorization: authorization } })).json()).exports.map((item) => item.export_id);
  const ui = await startUi(workspace, port);
  try {
    const created = await run(admin, ['export', 'create', '--channel', 'local', '--source', 'sopimukset', '--target', 'chatgpt-projekti']);
    assert.equal(created.data.ok, true, created.data.output);
    const id = created.data.output.match(/Vienti (\S+) muodostettiin/)[1];
    assert.deepEqual(await exportsOf(admin), [id]);

    assert.equal((await run(ohjeet, ['export', 'plan', '--channel', 'local', '--source', 'sopimukset'])).status, 403);
    const own = await run(ohjeet, ['export', 'create', '--channel', 'local', '--source', 'ohjeet']);
    assert.equal(own.data.ok, true, own.data.output);
    const ownId = own.data.output.match(/Vienti (\S+) muodostettiin/)[1];
    assert.deepEqual(await exportsOf(ohjeet), [ownId], 'toisen lähteen vienti ei näy');
    assert.equal((await fetch(`${base}/ui/api/exports/${id}/download`, { headers: { Authorization: ohjeet } })).status, 403);
    assert.equal((await run(ohjeet, ['export', 'remove', id, '--confirm'])).status, 403);

    const overview = await (await fetch(`${base}/ui/api/overview`, { headers: { Authorization: ohjeet } })).json();
    assert.deepEqual(overview.sources, ['ohjeet']);
  } finally {
    await stop(ui);
  }
});
