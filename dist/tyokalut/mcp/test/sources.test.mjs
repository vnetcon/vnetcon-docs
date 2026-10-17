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
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { convertFile, supportStatus } from '../src/convert.mjs';
import { sourceAllowed } from '../src/sources.mjs';
import { writeDocx, writePptx, writeXlsx } from './office-fixtures.mjs';

// Lähdeaineistot: koodin ulkopuoliset dokumentit omana lähteenään.

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(PACKAGE_ROOT, 'bin', 'multiproject-mcp.mjs');

function command(cwd, args, expected = 0) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  assert.equal(result.status, expected, `${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(filename, content) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

function createProject(root, name, word, extraDoc = '') {
  const repo = path.join(root, name);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'Test']);
  write(path.join(repo, 'src', 'index.js'), `export const value = '${word}';\n`);
  write(path.join(repo, 'vnetcon-docs', 'moduulit', name, 'yleiskuvaus.md'), `# ${name}\n\nKoodisana ${word}.\n`);
  if (extraDoc) write(path.join(repo, 'vnetcon-docs', 'moduulit', name, 'viitteet.md'), extraDoc);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'initial']);
  return repo;
}

function setup(prefix, { reference = '' } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const docs = path.join(temp, 'maarittelyt');
  writeDocx(path.join(docs, 'Toiminnallinen määrittely.docx'), {
    paragraphs: [{ style: 'Otsikko1', text: 'Tilausmäärittely' }, { text: 'Määrittelysana tilauskanava.' }],
  });
  writePptx(path.join(docs, 'esitykset', 'arkkitehtuuri.pptx'), [{ title: 'Arkkitehtuuri', bullets: ['Esityssana integraatioalusta'] }]);
  write(path.join(docs, 'vanha.doc'), 'binääri');
  write(path.join(docs, 'rikki.docx'), 'ei zip');
  write(path.join(docs, '~$lukko.docx'), 'lukko');
  const repoA = createProject(temp, 'portaali', 'portaalisana', reference);
  const repoB = createProject(temp, 'laskutus', 'laskutussana');
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  command(workspace, ['add-project', '--id', 'portaali', '--path', repoA, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['add-project', '--id', 'laskutus', '--path', repoB, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'portaali', 'main']);
  command(workspace, ['channel', 'set-ref', 'local', 'laskutus', 'main']);
  command(workspace, ['source', 'add', '--id', 'maar', '--type', 'directory', '--location', docs,
    '--name', 'Määrittelyt', '--link', 'portaali', '--owner', 'Tietohallinto', '--classification', 'Sisäinen']);
  command(workspace, ['bootstrap', '--all']);
  return { temp, docs, workspace, repoA };
}

const files = (workspace, id) => Object.fromEntries(JSON.parse(command(workspace, ['source', 'show', id, '--json']).stdout).files.map((entry) => [entry.path, entry]));

async function connectStdio(workspace) {
  const client = new Client({ name: 'sources-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [CLI, 'serve', '--transport', 'stdio', '--channel', 'local'], cwd: workspace }));
  return client;
}

const call = async (client, name, args) => (await client.callTool({ name, arguments: args })).structuredContent;

test('muunnokset: Word, PowerPoint, Excel ja tukemattomat muodot', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sources-convert-'));
  const docx = path.join(temp, 'm.docx');
  writeDocx(docx, {
    paragraphs: [{ style: 'Otsikko1', text: 'Määrittely' }, { text: 'Asiakas &amp; tilaus.' }, { text: 'Kohta', list: 0 }, { text: 'Alakohta', list: 1 }],
    table: [['Kenttä', 'Pakollinen'], ['Nimi', 'Kyllä | aina']],
    extraBody: '<w:p><w:r><w:t>Jää</w:t></w:r><w:del><w:r><w:delText>poistettu</w:delText></w:r></w:del><w:r><w:drawing/></w:r></w:p>',
  });
  const word = await convertFile(docx);
  assert.match(word.markdown, /^## Määrittely$/m, 'suomenkielinen tyylitunniste Otsikko1 → heading 1');
  assert.match(word.markdown, /Asiakas & tilaus\./);
  assert.match(word.markdown, /^- Kohta\n {2}- Alakohta$/m);
  assert.match(word.markdown, /\| Nimi \| Kyllä \\\| aina \|/);
  assert.doesNotMatch(word.markdown, /poistettu/);
  assert.equal(word.skipped.images, 1);

  const pptx = path.join(temp, 'e.pptx');
  writePptx(pptx, [{ title: 'Johdanto', bullets: ['Tavoite'], notes: 'Muistiinpano' }, { title: 'Loppu', bullets: ['Kiitos'], picture: true }]);
  const slides = await convertFile(pptx);
  assert.ok(slides.markdown.indexOf('## Dia 1: Johdanto') < slides.markdown.indexOf('## Dia 2: Loppu'), 'järjestys presentation.xml:stä');
  assert.match(slides.markdown, /\*\*Puhujan muistiinpanot:\*\*\n\nMuistiinpano/);
  assert.equal(slides.skipped.images, 1);

  const xlsx = path.join(temp, 'h.xlsx');
  writeXlsx(xlsx, [['Tuote', 'Hinta'], ['Pilotti', 800]]);
  assert.match((await convertFile(xlsx)).markdown, /A2="Pilotti" {2}B2=800/);

  assert.equal(supportStatus('a.doc').supported, false);
  assert.equal(supportStatus('a.pdf').supported, true);
  write(path.join(temp, 'rikki.docx'), 'ei zip');
  await assert.rejects(() => convertFile(path.join(temp, 'rikki.docx')), /kelvollinen Office/);
});

test('inventaario, hyväksyntä, julkaisu ja erillinen haku', async () => {
  const { docs, workspace } = setup('sources-flow-');
  command(workspace, ['source', 'scan', 'maar']);
  let state = files(workspace, 'maar');
  assert.equal(state['Toiminnallinen määrittely.docx'].status, 'uusi');
  assert.equal(state['esitykset/arkkitehtuuri.pptx'].status, 'uusi');
  assert.equal(state['vanha.doc'].status, 'ei-tuettu');
  assert.equal(state['rikki.docx'].status, 'virhe');
  assert.equal(state['~$lukko.docx'], undefined, 'Officen lukkotiedosto ohitetaan');

  command(workspace, ['channel', 'add-source', 'local', 'maar']);
  command(workspace, ['publish', '--channel', 'local']);
  let client = await connectStdio(workspace);
  let hits = (await call(client, 'search_sources', { source_id: 'maar', query: 'tilauskanava' })).results;
  assert.equal(hits.length, 0, 'hyväksymätön ei näy');
  await client.close();
  command(workspace, ['source', 'approve', 'maar', '--file', 'vanha.doc'], 1);

  command(workspace, ['source', 'approve', 'maar', '--all-changed']);
  const before = JSON.parse(fs.readFileSync(path.join(workspace, '.multiproject', 'publications', 'channels', 'local.json'), 'utf8')).bundle_id;
  command(workspace, ['publish', '--channel', 'local']);
  const after = JSON.parse(fs.readFileSync(path.join(workspace, '.multiproject', 'publications', 'channels', 'local.json'), 'utf8')).bundle_id;
  assert.notEqual(before, after, 'hyväksyntä vaihtaa paketin tunnisteen');

  client = await connectStdio(workspace);
  const sources = (await call(client, 'list_sources', {})).sources;
  assert.deepEqual(sources.map((item) => [item.source_id, item.document_count, item.verified_against_code]), [['maar', 2, false]]);
  hits = (await call(client, 'search_sources', { source_id: 'maar', query: 'tilauskanava' })).results;
  assert.equal(hits[0].kind, 'lahdeaineisto');
  assert.equal(hits[0].verified_against_code, false);
  assert.equal(hits[0].path, 'Toiminnallinen määrittely.docx');
  const document = await call(client, 'fetch_source_document', { source_id: 'maar', document_id: hits[0].document_id });
  assert.match(document.content, /Lähdeaineisto, ei tarkistettu koodia vasten/);
  assert.match(document.content, /Omistaja: Tietohallinto/);
  // Haut pysyvät erillään.
  assert.equal((await call(client, 'search', { project_id: 'portaali', query: 'tilauskanava' })).results.length, 0);
  assert.equal((await call(client, 'search_sources', { source_id: 'maar', query: 'portaalisana' })).results.length, 0);
  assert.equal((await call(client, 'list_sources', { project_id: 'laskutus' })).sources.length, 0);
  await client.close();

  // Muutos: vanha hyväksytty versio pysyy julkaistuna, kunnes uusi hyväksytään.
  writeDocx(path.join(docs, 'Toiminnallinen määrittely.docx'), { paragraphs: [{ style: 'Otsikko1', text: 'Tilausmäärittely' }, { text: 'Uusisana tilausportaali.' }] });
  command(workspace, ['source', 'scan', 'maar']);
  assert.equal(files(workspace, 'maar')['Toiminnallinen määrittely.docx'].status, 'muuttunut');
  assert.match(command(workspace, ['source', 'preview', 'maar', '--file', 'Toiminnallinen määrittely.docx', '--diff']).stdout, /^\+ Uusisana tilausportaali\.$/m);
  command(workspace, ['publish', '--channel', 'local']);
  client = await connectStdio(workspace);
  assert.equal((await call(client, 'search_sources', { source_id: 'maar', query: 'tilauskanava' })).results.length, 1);
  assert.equal((await call(client, 'search_sources', { source_id: 'maar', query: 'tilausportaali' })).results.length, 0);
  await client.close();
  command(workspace, ['source', 'reject', 'maar', '--file', 'Toiminnallinen määrittely.docx']);
  assert.equal(files(workspace, 'maar')['Toiminnallinen määrittely.docx'].status, 'hylatty');
  command(workspace, ['source', 'approve', 'maar', '--file', 'Toiminnallinen määrittely.docx']);
  command(workspace, ['publish', '--channel', 'local']);
  client = await connectStdio(workspace);
  assert.equal((await call(client, 'search_sources', { source_id: 'maar', query: 'tilausportaali' })).results.length, 1);
  await client.close();

  // Poistettu tiedosto putoaa seuraavasta julkaisusta.
  fs.rmSync(path.join(docs, 'esitykset', 'arkkitehtuuri.pptx'));
  command(workspace, ['source', 'scan', 'maar']);
  assert.equal(files(workspace, 'maar')['esitykset/arkkitehtuuri.pptx'].status, 'poistettu');
  command(workspace, ['publish', '--channel', 'local']);
  client = await connectStdio(workspace);
  assert.equal((await call(client, 'search_sources', { source_id: 'maar', query: 'integraatioalusta' })).results.length, 0);
  await client.close();

  // Prosessi kertoo julkaisemattomat hyväksynnät.
  writePptx(path.join(docs, 'uusi.pptx'), [{ title: 'Uusi', bullets: ['x'] }]);
  command(workspace, ['source', 'scan', 'maar']);
  assert.match(command(workspace, ['process']).stdout, /Lähdeaineistot: lähteitä 1, hyväksyntää odottaa 1 tiedosto/);

  // Symlinkki lähteen ulkopuolelle ohitetaan.
  write(path.join(path.dirname(docs), 'ulkona.md'), '# salainen\n');
  fs.symlinkSync(path.join(path.dirname(docs), 'ulkona.md'), path.join(docs, 'linkki.md'));
  command(workspace, ['source', 'scan', 'maar']);
  assert.equal(files(workspace, 'maar')['linkki.md'], undefined);

  // Roskakori: poisto ja palautus säilyttävät hyväksynnät.
  const entry = command(workspace, ['source', 'remove', 'maar', '--confirm']).stdout.match(/roskakoriin: (\S+)/)[1];
  command(workspace, ['config', 'validate']);
  assert.doesNotMatch(fs.readFileSync(path.join(workspace, 'multiproject-mcp.yaml'), 'utf8'), /maar/);
  command(workspace, ['trash', 'restore', entry]);
  assert.equal(files(workspace, 'maar')['Toiminnallinen määrittely.docx'].status, 'hyvaksytty');
  assert.match(fs.readFileSync(path.join(workspace, 'multiproject-mcp.yaml'), 'utf8'), /sources:\n\s+- maar/);
});

test('lahde:-viitteet koodidokumentaatiosta ja vienti', () => {
  const reference = '---\nlahteet:\n  - src/index.js\n  - "lahde:maar/Toiminnallinen määrittely.docx#000000"\n---\n# Viitteet\n';
  const { workspace } = setup('sources-refs-', { reference });
  command(workspace, ['source', 'scan', 'maar']);
  command(workspace, ['source', 'approve', 'maar', '--all-changed']);
  command(workspace, ['channel', 'add-source', 'local', 'maar']);
  const published = command(workspace, ['publish', '--channel', 'local']).stdout;
  assert.match(published, /lähteitä 1 \(2 hyväksyttyä dokumenttia\)/);
  assert.match(published, /Huom: portaali\/moduulit\/portaali\/viitteet\.md: lahde:maar\/Toiminnallinen määrittely\.docx#000000: tiedosto on muuttunut/);
  const references = JSON.parse(command(workspace, ['source', 'show', 'maar', '--json']).stdout).references;
  assert.equal(references.length, 1);
  assert.equal(references[0].ok, false);

  // Vienti vain erikseen valittuna, merkittynä ja vanhentuvana.
  const plain = JSON.parse(command(workspace, ['export', 'plan', '--project', 'portaali', '--target', 'chatgpt-projekti', '--json']).stdout);
  assert.ok(!plain.manifest.files.some((file) => file.path.includes('lahdeaineisto')));
  const created = command(workspace, ['export', 'create', '--project', 'portaali', '--target', 'chatgpt-projekti', '--include-sources']).stdout;
  const id = created.match(/Vienti (\S+) muodostettiin/)[1];
  const dir = path.join(workspace, '.multiproject', 'publications', 'exports', id, 'sisalto');
  const sourceFile = fs.readFileSync(path.join(dir, 'tiedostot', '70-lahdeaineisto-maar.md'), 'utf8');
  assert.match(sourceFile, /Tietolaji: lähdeaineisto, ei tarkistettu koodia vasten/);
  assert.match(sourceFile, /Määrittelysana tilauskanava/);
  assert.match(fs.readFileSync(path.join(dir, 'ohjeet.md'), 'utf8'), /70-lahdeaineisto-\*/);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sources[0].source_id, 'maar');
  assert.equal(manifest.files.find((file) => file.path.endsWith('70-lahdeaineisto-maar.md')).kind, 'lahdeaineisto');
  // laskutus-projektiin ei ole linkitetty lähteitä.
  const other = JSON.parse(command(workspace, ['export', 'plan', '--project', 'laskutus', '--target', 'chatgpt-projekti', '--include-sources', '--json']).stdout);
  assert.ok(other.manifest.warnings.some((warning) => warning.includes('lähdeaineistoja')));

  command(workspace, ['source', 'reject', 'maar', '--file', 'esitykset/arkkitehtuuri.pptx', '--withdraw']);
  command(workspace, ['publish', '--channel', 'local']);
  const status = JSON.parse(command(workspace, ['export', 'list', '--json']).stdout).exports.find((item) => item.export_id === id);
  assert.equal(status.status, 'vanhentunut');
  assert.ok(status.reasons.some((reason) => reason.includes('Lähdeaineisto maar')));
});

test('käyttöoikeudet: projektirajaus, sources-lupa ja organisaatiotason lähde', () => {
  const linked = { source_id: 'a', linked_projects: ['p1', 'p2'] };
  const org = { source_id: 'org' };
  assert.equal(sourceAllowed({}, linked), true);
  assert.equal(sourceAllowed({ projects: ['p1'] }, linked), false);
  assert.equal(sourceAllowed({ projects: ['p1', 'p2'] }, linked), true);
  assert.equal(sourceAllowed({ projects: ['p1', 'p2'] }, org), false);
  assert.equal(sourceAllowed({ projects: ['p1'], sources: ['org'] }, org), true);
  assert.equal(sourceAllowed({ sources: ['org'] }, linked), false);
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

test('hallintakäyttöliittymä ja MCP HTTP: lataus, esikatselu ja rajaukset', async () => {
  const { temp, workspace } = setup('sources-ui-');
  command(workspace, ['source', 'add', '--id', 'liitteet', '--type', 'upload', '--name', 'Liitteet', '--link', 'laskutus']);
  fs.appendFileSync(path.join(workspace, 'multiproject-mcp.yaml'), 'sources_defaults:\n  max_file_bytes: 20000\n');
  command(workspace, ['config', 'validate']);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  command(workspace, ['server', 'configure-http', '--listen', `127.0.0.1:${port}`, '--channel', 'local']);
  command(workspace, ['auth', 'set-mode', 'bearer']);
  const token = (args) => `Bearer ${command(workspace, ['auth', 'token', 'create', ...args]).stdout.trim().split('\n').at(-1)}`;
  const admin = token(['--name', 'yllapitaja', '--admin']);
  const reader = token(['--name', 'lukija']);
  const portaali = token(['--name', 'portaali', '--projects', 'portaali']);
  const vain = token(['--name', 'vain-liitteet', '--sources', 'liitteet']);
  const docx = path.join(temp, 'sopimus.docx');
  writeDocx(docx, { paragraphs: [{ style: 'Otsikko1', text: 'Sopimusliite' }, { text: 'Liitesana palvelutaso.' }] });
  const upload = (authorization, name, body, ui = true) => fetch(`${base}/ui/api/sources/liitteet/upload`, {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name), ...(ui ? { 'X-Vnetcon-UI': '1' } : {}) },
    body,
  });
  const json = async (route, authorization) => {
    const response = await fetch(`${base}/ui/api${route}`, { headers: { Authorization: authorization } });
    return { status: response.status, data: await response.json() };
  };
  const ui = await startUi(workspace, port);
  try {
    // Lataus: vain admin, vain käyttöliittymästä, nimi puhdistetaan, kokoraja pitää.
    assert.equal((await upload(reader, 'sopimus.docx', fs.readFileSync(docx))).status, 403);
    assert.equal((await upload(admin, 'sopimus.docx', fs.readFileSync(docx), false)).status, 403);
    const ok = await upload(admin, '../../sopimus.docx', fs.readFileSync(docx));
    const okData = await ok.json();
    assert.equal(ok.status, 200, JSON.stringify(okData));
    assert.equal(okData.ok, true, okData.output);
    assert.ok(fs.existsSync(path.join(workspace, '.multiproject', 'sources', 'liitteet', 'uploads', 'sopimus.docx')));
    assert.equal((await upload(admin, 'iso.docx', Buffer.alloc(30000))).status, 413);

    const listed = await json('/sources', admin);
    assert.deepEqual(listed.data.sources.map((source) => source.source_id).sort(), ['liitteet', 'maar']);
    assert.equal(listed.data.sources.find((source) => source.source_id === 'liitteet').pending, 1);
    assert.equal((await json('/sources', reader)).status, 403);
    const preview = await json(`/sources/liitteet/preview?${new URLSearchParams({ file: 'sopimus.docx' })}`, admin);
    assert.match(preview.data.markdown, /Liitesana palvelutaso/);

    const run = (args) => fetch(`${base}/ui/api/run`, { method: 'POST', headers: { Authorization: admin, 'Content-Type': 'application/json', 'X-Vnetcon-UI': '1' }, body: JSON.stringify({ args }) }).then((response) => response.json());
    assert.equal((await run(['source', 'approve', 'liitteet', '--all-changed'])).ok, true);
    assert.equal((await run(['source', 'scan', 'maar'])).ok, true);
    assert.equal((await run(['source', 'approve', 'maar', '--all-changed'])).ok, true);
    assert.equal((await run(['channel', 'add-source', 'local', 'liitteet'])).ok, true);
    assert.equal((await run(['channel', 'add-source', 'local', 'maar'])).ok, true);
    assert.equal((await run(['publish', '--channel', 'local'])).ok, true);
  } finally {
    await stop(ui);
  }

  // MCP HTTP: rajaukset näkyvät list_sources-työkalussa ja estävät haun.
  const server = spawn(process.execPath, [CLI, 'serve', '--transport', 'http'], { cwd: workspace, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i += 1) {
      try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* käynnistyy */ }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const sourcesFor = async (authorization) => {
      const client = new Client({ name: 'sources-http', version: '1.0.0' });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: authorization } } }));
      const ids = (await call(client, 'list_sources', {})).sources.map((source) => source.source_id).sort();
      const denied = await client.callTool({ name: 'search_sources', arguments: { source_id: 'liitteet', query: 'palvelutaso' } });
      await client.close();
      return { ids, deniedLiitteet: Boolean(denied.isError) };
    };
    assert.deepEqual(await sourcesFor(reader), { ids: ['liitteet', 'maar'], deniedLiitteet: false });
    assert.deepEqual(await sourcesFor(portaali), { ids: ['maar'], deniedLiitteet: true });
    assert.deepEqual(await sourcesFor(vain), { ids: ['liitteet'], deniedLiitteet: false });
  } finally {
    await stop(server);
  }
});
