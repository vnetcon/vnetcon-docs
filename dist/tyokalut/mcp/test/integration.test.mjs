import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { loadConfig } from '../src/config.mjs';
import { fetchDocument, listProjects, searchProject } from '../src/search.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(PACKAGE_ROOT, 'bin', 'multiproject-mcp.mjs');

function command(cwd, args, expected = 0, options = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', ...options });
  assert.equal(result.status, expected, `${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startHttp(cwd, port) {
  const child = spawn(process.execPath, [CLI, 'serve'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`HTTP-palvelin päättyi: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return child;
    } catch { /* käynnistyy */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM');
  throw new Error(`HTTP-palvelin ei käynnistynyt: ${stderr}`);
}

async function stopHttp(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

async function connectHttp(url, authorization = '') {
  const client = new Client({ name: 'http-integration-test', version: '1.0.0' });
  const headers = authorization ? { Authorization: authorization } : undefined;
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
  await client.connect(transport);
  return { client, transport };
}

async function startOidcIssuer(port) {
  const issuer = `http://127.0.0.1:${port}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/.well-known/openid-configuration') {
      res.end(JSON.stringify({ issuer, jwks_uri: `${issuer}/jwks`, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token` }));
    } else if (req.url === '/jwks') {
      res.end(JSON.stringify({ keys: [jwk] }));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });
  await new Promise((resolve, reject) => server.listen(port, '127.0.0.1', resolve).once('error', reject));
  return {
    issuer,
    async token(claims = {}, audience = 'mcp-test') {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject('test-user')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

function createRepository(root, name, uniqueWord, withDocs = true) {
  const repo = path.join(root, name);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'Test']);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'index.js'), `export const value = '${uniqueWord}';\n`);
  if (withDocs) {
    fs.mkdirSync(path.join(repo, 'vnetcon-docs', 'moduulit', name), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'vnetcon-docs', 'moduulit', name, 'yleiskuvaus.md'),
      `# ${name}\n\nTämän projektin yksilöllinen sana on ${uniqueWord}.\n`,
    );
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'initial']);
  return repo;
}

function createDocumentationBranch(repo, name, branch, uniqueWord) {
  git(repo, ['checkout', '-qb', branch]);
  fs.writeFileSync(
    path.join(repo, 'vnetcon-docs', 'moduulit', name, 'yleiskuvaus.md'),
    `# ${name} ${branch}\n\nTämän haaran yksilöllinen sana on ${uniqueWord}.\n`,
  );
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', branch]);
  git(repo, ['checkout', '-q', 'main']);
}

test('repository-projektit julkaistaan ja haetaan erillään', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-test-'));
  const repoA = createRepository(temp, 'project-a', 'ananas-salaisuus');
  const repoB = createRepository(temp, 'project-b', 'banaani-salaisuus');
  createDocumentationBranch(repoA, 'project-a', 'development', 'dragonfruit-development');
  const workspace = path.join(temp, 'control');

  command(temp, ['init', workspace]);
  fs.copyFileSync(
    path.join(workspace, 'multiproject-mcp.server.example.yaml'),
    path.join(workspace, 'multiproject-mcp.server.yaml'),
  );
  command(workspace, ['config', 'validate', '--profile', 'server']);
  const launcher = spawnSync(path.join(workspace, 'multiproject-mcp'), ['help'], { cwd: workspace, encoding: 'utf8' });
  assert.equal(launcher.status, 0, launcher.stderr);
  assert.match(launcher.stdout, /multiproject-mcp/);
  command(workspace, ['channel', 'create', '../escape'], 1);
  command(workspace, ['add-project', '--id', 'project-a', '--path', repoA, '--refs', 'main,development', '--docs-mode', 'repository']);
  command(workspace, ['add-project', '--id', 'project-b', '--path', repoB, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'project-a', 'main']);
  command(workspace, ['channel', 'set-ref', 'local', 'project-b', 'main']);
  command(workspace, ['channel', 'create', 'development']);
  command(workspace, ['channel', 'set-ref', 'development', 'project-a', 'development']);
  command(workspace, ['channel', 'set-ref', 'development', 'project-b', 'main']);
  command(workspace, ['doctor']);
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  command(workspace, ['publish', '--channel', 'development']);
  command(workspace, ['smoke-test', '--channel', 'local']);

  const loaded = loadConfig({ cwd: workspace, profile: 'local' });
  assert.equal(listProjects(loaded, 'local').length, 2);
  const ownHits = searchProject(loaded, 'local', 'project-a', 'ananas-salaisuus');
  assert.equal(ownHits.length, 1);
  assert.equal(ownHits[0].project_id, 'project-a');
  assert.equal(searchProject(loaded, 'local', 'project-a', 'banaani-salaisuus').length, 0);
  assert.equal(searchProject(loaded, 'local', 'project-a', 'dragonfruit-development').length, 0);
  const developmentHits = searchProject(loaded, 'development', 'project-a', 'dragonfruit-development');
  assert.equal(developmentHits.length, 1);
  assert.equal(developmentHits[0].ref, 'development');
  assert.notEqual(developmentHits[0].source_commit_sha, ownHits[0].source_commit_sha);
  assert.throws(() => fetchDocument(loaded, 'local', 'project-b', ownHits[0].document_id));

  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI, 'serve', '--channel', 'local'],
    cwd: workspace,
    stderr: 'pipe',
  });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === 'search'));
  const response = await client.callTool({
    name: 'search',
    arguments: { project_id: 'project-a', query: 'ananas-salaisuus' },
  });
  assert.equal(response.isError, undefined);
  assert.equal(response.structuredContent.project_id, 'project-a');
  assert.equal(response.structuredContent.results[0].project_id, 'project-a');
  await client.close();
});

test('separate-malli julkaisee dokumentaation omasta reposta ja havaitsee sen muutokset', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-separate-'));
  const code = createRepository(temp, 'koodi', 'koodisana', false);
  const docs = path.join(temp, 'koodi-docs');
  fs.mkdirSync(path.join(docs, 'moduulit', 'koodi'), { recursive: true });
  git(docs, ['init', '-q', '-b', 'main']);
  git(docs, ['config', 'user.email', 'test@example.invalid']);
  git(docs, ['config', 'user.name', 'Test']);
  const doc = path.join(docs, 'moduulit', 'koodi', 'yleiskuvaus.md');
  fs.writeFileSync(doc, '# koodi\n\nErillisen dokumentaation sana on separatealfa.\n');
  git(docs, ['add', '-A']);
  git(docs, ['commit', '-qm', 'docs']);

  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  command(workspace, ['add-project', '--id', 'koodi', '--path', code, '--refs', 'main', '--docs-mode', 'separate', '--docs-repo', docs]);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'koodi', 'main']);
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);

  let loaded = loadConfig({ cwd: workspace, profile: 'local' });
  let hits = searchProject(loaded, 'local', 'koodi', 'separatealfa', 5);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].source_commit_sha, git(code, ['rev-parse', 'HEAD']));
  const stateDir = path.join(workspace, '.multiproject', 'state', 'koodi');
  const state = JSON.parse(fs.readFileSync(path.join(stateDir, fs.readdirSync(stateDir)[0]), 'utf8'));
  assert.equal(state.documentation_mode, 'separate');
  assert.equal(state.docs_commit_sha, git(docs, ['rev-parse', 'HEAD']));
  assert.equal(git(state.source_root, ['status', '--porcelain']), '');
  assert.match(command(workspace, ['plan', 'refresh', '--all']).stdout, /no-change/);

  // Pelkkä dokumentaatiorepon commit on muutos, ja uusi julkaisu sisältää sen.
  fs.writeFileSync(doc, '# koodi\n\nErillisen dokumentaation sana on separatebeeta.\n');
  git(docs, ['commit', '-qam', 'docs 2']);
  assert.match(command(workspace, ['plan', 'refresh', '--all']).stdout, /^refresh/m);
  command(workspace, ['refresh', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  loaded = loadConfig({ cwd: workspace, profile: 'local' });
  hits = searchProject(loaded, 'local', 'koodi', 'separatebeeta', 5);
  assert.ok(hits.length > 0);
  command(workspace, ['document', '--project', 'koodi', '--ref', 'main'], 1);
});

test('integraatioluonnokset piilotetaan ja yhteinen ohjaus tarjotaan', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-guidance-'));
  const repo = createRepository(temp, 'tilaukset', 'tilaussana');
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  assert.ok(fs.existsSync(path.join(workspace, 'yhteiset', 'ohjaus.md')));
  fs.writeFileSync(path.join(workspace, 'yhteiset', 'sanasto.md'), '# Yhteinen sanasto\n\nAsiakas tarkoittaa sopimusasiakasta.\n');
  fs.writeFileSync(path.join(workspace, 'interfaces', 'hyvaksytty.yaml'),
    'schema_version: 1\ninterface_id: hyvaksytty\nstatus: active\nprovider:\n  project_id: tilaukset\n');
  fs.writeFileSync(path.join(workspace, 'interfaces', 'luonnos.yaml'),
    'schema_version: 1\ninterface_id: luonnos\nstatus: draft\nprovider:\n  project_id: tilaukset\n');
  command(workspace, ['add-project', '--id', 'tilaukset', '--path', repo, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'tilaukset', 'main']);
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);

  const client = new Client({ name: 'guidance-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [CLI, 'serve', '--transport', 'stdio', '--channel', 'local'], cwd: workspace,
  }));
  const interfaces = JSON.parse((await client.callTool({ name: 'list_interfaces', arguments: {} })).content[0].text).interfaces;
  assert.deepEqual(interfaces.map((item) => item.interface_id), ['hyvaksytty']);
  const guidance = JSON.parse((await client.callTool({ name: 'get_shared_guidance', arguments: {} })).content[0].text).documents;
  assert.ok(guidance.some((item) => item.path === 'sanasto.md' && item.content.includes('sopimusasiakasta')));
  await client.close();
});

async function startUi(cwd, port) {
  const child = spawn(process.execPath, [CLI, 'ui', '--listen', `127.0.0.1:${port}`], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`UI-palvelin päättyi: ${stderr}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return child;
    } catch { /* käynnistyy */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill('SIGTERM');
  throw new Error(`UI-palvelin ei käynnistynyt: ${stderr}`);
}

async function uiCall(base, route, { method = 'GET', body, authorization, ui = true } = {}) {
  const headers = {};
  if (authorization) headers.Authorization = authorization;
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    if (ui) headers['X-Vnetcon-UI'] = '1';
  }
  const response = await fetch(`${base}/ui/api${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}

test('hallintakäyttöliittymä alustaa, julkaisee ja hallitsee ohjausta ilman komentoriviä', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-ui-'));
  const repo = createRepository(temp, 'kayttoliittyma', 'uisana');
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  const port = await freePort();
  const child = await startUi(workspace, port);
  const base = `http://127.0.0.1:${port}`;
  try {
    const page = await fetch(`${base}/ui/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(await page.text(), /vnetcon/);
    assert.equal((await uiCall(base, '/session')).data.principal.admin, true);

    // Muutos vaatii hallintakäyttöliittymän otsakkeen.
    assert.equal((await uiCall(base, '/channels', { method: 'POST', body: { id: 'local' }, ui: false })).status, 403);

    assert.equal((await uiCall(base, '/projects', { method: 'POST', body: { id: 'kayttoliittyma', path: repo, refs: 'main', docs_mode: 'repository' } })).data.ok, true);
    assert.equal((await uiCall(base, '/channels', { method: 'POST', body: { id: 'local' } })).data.ok, true);
    assert.equal((await uiCall(base, '/channels/local/refs', { method: 'POST', body: { project_id: 'kayttoliittyma', ref: 'main' } })).data.ok, true);
    assert.equal((await uiCall(base, '/bootstrap', { method: 'POST', body: {} })).data.ok, true);
    const published = await uiCall(base, '/publish', { method: 'POST', body: { channel: 'local' } });
    assert.equal(published.data.ok, true, published.data.output);

    const overview = (await uiCall(base, '/overview')).data;
    assert.equal(overview.projects[0].refs[0].action, 'no-change');
    assert.ok(overview.channels[0].published.bundle_id);
    const hits = (await uiCall(base, '/search?channel=local&project_id=kayttoliittyma&q=uisana')).data.results;
    assert.ok(hits.length > 0);
    const documentView = (await uiCall(base, `/document?channel=local&project_id=kayttoliittyma&document_id=${hits[0].document_id}`)).data;
    assert.match(documentView.content, /uisana/);

    assert.equal((await uiCall(base, '/guidance/sanasto.md', { method: 'PUT', body: { content: '# Sanasto\n\nTilaus = myyntitilaus.\n' } })).data.ok, true);
    assert.ok((await uiCall(base, '/guidance')).data.documents.some((doc) => doc.content.includes('myyntitilaus')));
    assert.equal((await uiCall(base, '/guidance/..%2Fohi.md', { method: 'PUT', body: { content: 'x' } })).status, 400);

    const yaml = 'schema_version: 1\ninterface_id: tilaus-crm-v1\nstatus: draft\nprovider:\n  project_id: kayttoliittyma\n';
    assert.equal((await uiCall(base, '/interfaces/tilaus-crm-v1', { method: 'PUT', body: { yaml } })).data.ok, true);
    assert.equal((await uiCall(base, '/interfaces/toinen-id', { method: 'PUT', body: { yaml } })).status, 400);
    const listed = (await uiCall(base, '/interfaces')).data.interfaces;
    assert.equal(listed[0].status, 'draft');
  } finally {
    await stopHttp(child);
  }

  // Tunnistettu käyttö: luku ilman admin-oikeutta, muutokset vain adminilla.
  command(workspace, ['server', 'configure-http', '--listen', `127.0.0.1:${port}`, '--channel', 'local']);
  command(workspace, ['auth', 'set-mode', 'bearer']);
  const reader = command(workspace, ['auth', 'token', 'create', '--name', 'lukija']).stdout.trim().split('\n').at(-1);
  const admin = command(workspace, ['auth', 'token', 'create', '--name', 'yllapitaja', '--admin']).stdout.trim().split('\n').at(-1);
  const secured = await startUi(workspace, port);
  try {
    assert.equal((await uiCall(base, '/session')).status, 401);
    const readerSession = await uiCall(base, '/session', { authorization: `Bearer ${reader}` });
    assert.equal(readerSession.data.principal.admin, false);
    assert.equal((await uiCall(base, '/bootstrap', { method: 'POST', body: {}, authorization: `Bearer ${reader}` })).status, 403);
    assert.equal((await uiCall(base, '/bootstrap', { method: 'POST', body: {}, authorization: `Bearer ${admin}` })).data.ok, true);
  } finally {
    await stopHttp(secured);
  }
});

test('managed-projekti alustetaan lähderepositoryn ulkopuolelle', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-managed-'));
  const repo = createRepository(temp, 'managed-source', 'managed-word', false);
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  command(workspace, ['add-project', '--id', 'managed-source', '--path', repo, '--refs', 'main', '--docs-mode', 'managed']);
  command(workspace, ['bootstrap', '--all']);
  const loaded = loadConfig({ cwd: workspace, profile: 'local' });
  const stateFiles = fs.readdirSync(path.join(workspace, '.multiproject', 'state', 'managed-source'));
  const state = JSON.parse(fs.readFileSync(path.join(workspace, '.multiproject', 'state', 'managed-source', stateFiles[0]), 'utf8'));
  assert.equal(state.documentation_mode, 'managed');
  assert.equal(state.status, 'needs_documentation');
  assert.ok(fs.existsSync(path.join(state.docs_root, 'vnetcon.config.yaml')));
  const docsConfig = fs.readFileSync(path.join(state.docs_root, 'vnetcon.config.yaml'), 'utf8');
  const yhteiset = docsConfig.match(/yhteiset: (.+)/)?.[1]?.trim();
  assert.ok(yhteiset && fs.existsSync(path.resolve(state.docs_root, yhteiset, 'ohjaus.md')));
  assert.ok(fs.existsSync(path.join(state.docs_root, 'metodi', 'ohjaus.md')));
  assert.ok(!state.docs_root.startsWith(repo));
  assert.ok(state.docs_root.startsWith(state.source_root));
  assert.equal(git(state.source_root, ['status', '--porcelain']), '');
  assert.equal(loaded.config.projects[0].project_id, 'managed-source');
});

test('Streamable HTTP, paikalliset autentikointitilat ja Git-refresh toimivat', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-http-'));
  const repoA = createRepository(temp, 'http-a', 'http-ananas');
  const repoB = createRepository(temp, 'http-b', 'http-banaani');
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  command(workspace, ['add-project', '--id', 'http-a', '--path', repoA, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['add-project', '--id', 'http-b', '--path', repoB, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'http-a', 'main']);
  command(workspace, ['channel', 'set-ref', 'local', 'http-b', 'main']);
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  const port = await freePort();
  command(workspace, ['server', 'configure-http', '--listen', `0.0.0.0:${port}`, '--channel', 'local'], 1);
  command(workspace, ['server', 'configure-http', '--listen', `127.0.0.1:${port}`, '--channel', 'local']);
  command(workspace, ['doctor', '--http']);

  let server = await startHttp(workspace, port);
  let connection = await connectHttp(`http://127.0.0.1:${port}/mcp`);
  let projects = await connection.client.callTool({ name: 'list_projects', arguments: {} });
  assert.equal(projects.structuredContent.projects.length, 2);
  fs.appendFileSync(
    path.join(repoA, 'vnetcon-docs', 'moduulit', 'http-a', 'yleiskuvaus.md'),
    '\nUuden julkaisun sana on http-uusi-julkaisu.\n',
  );
  git(repoA, ['add', '-A']);
  git(repoA, ['commit', '-qm', 'new publication']);
  command(workspace, ['refresh', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  const pinned = await connection.client.callTool({
    name: 'search', arguments: { project_id: 'http-a', query: 'http-uusi-julkaisu' },
  });
  assert.equal(pinned.structuredContent.results.length, 0);
  await connection.client.close();
  connection = await connectHttp(`http://127.0.0.1:${port}/mcp`);
  const advanced = await connection.client.callTool({
    name: 'search', arguments: { project_id: 'http-a', query: 'http-uusi-julkaisu' },
  });
  assert.equal(advanced.structuredContent.results.length, 1);
  await connection.client.close();
  await stopHttp(server);

  command(workspace, ['auth', 'set-mode', 'bearer']);
  command(workspace, [
    'auth', 'token', 'create', '--name', 'invalid', '--projects', 'unknown-project',
  ], 1);
  const tokenResult = command(workspace, [
    'auth', 'token', 'create', '--name', 'limited', '--channels', 'local', '--projects', 'http-a',
  ]);
  command(workspace, ['doctor', '--http']);
  const token = tokenResult.stdout.trim().split('\n').at(-1);
  assert.match(token, /^mcp_/);
  server = await startHttp(workspace, port);
  const unauthorized = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(unauthorized.status, 401);
  connection = await connectHttp(`http://127.0.0.1:${port}/mcp`, `Bearer ${token}`);
  projects = await connection.client.callTool({ name: 'list_projects', arguments: {} });
  assert.deepEqual(projects.structuredContent.projects.map((item) => item.project_id), ['http-a']);
  const denied = await connection.client.callTool({
    name: 'search', arguments: { project_id: 'http-b', query: 'http-banaani' },
  });
  assert.equal(denied.isError, true);
  await connection.client.close();
  await stopHttp(server);

  command(workspace, ['auth', 'set-mode', 'basic']);
  command(workspace, ['auth', 'user', 'add', '--username', 'reader', '--password-stdin'], 0, {
    input: 'a-long-test-password\n',
  });
  command(workspace, ['doctor', '--http']);
  server = await startHttp(workspace, port);
  const basic = Buffer.from('reader:a-long-test-password').toString('base64');
  connection = await connectHttp(`http://127.0.0.1:${port}/channels/local/mcp`, `Basic ${basic}`);
  projects = await connection.client.callTool({ name: 'list_projects', arguments: {} });
  assert.equal(projects.structuredContent.projects.length, 2);
  await connection.client.close();
  await stopHttp(server);

  command(workspace, ['refresh', 'configure-webhook', '--debounce', '300']);
  const hookResult = command(workspace, [
    'refresh', 'webhook-token', 'create', '--name', 'git-service', '--projects', 'http-b',
  ]);
  const hookToken = hookResult.stdout.trim().split('\n').at(-1);
  fs.appendFileSync(
    path.join(repoB, 'vnetcon-docs', 'moduulit', 'http-b', 'yleiskuvaus.md'),
    '\nWebhook-version sana on webhook-paivitys.\n',
  );
  git(repoB, ['add', '-A']);
  git(repoB, ['commit', '-qm', 'webhook publication']);
  server = await startHttp(workspace, port);
  const rejectedHook = await fetch(`http://127.0.0.1:${port}/hooks/git`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project_id: 'http-b', ref: 'main' }),
  });
  assert.equal(rejectedHook.status, 401);
  const acceptedHook = await fetch(`http://127.0.0.1:${port}/hooks/git`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-multiproject-webhook-token': hookToken },
    body: JSON.stringify({ project_id: 'http-b', ref: 'main', source_commit_sha: git(repoB, ['rev-parse', 'HEAD']) }),
  });
  assert.equal(acceptedHook.status, 202);
  command(workspace, ['refresh', 'run', '--now']);
  const refreshed = loadConfig({ cwd: workspace, profile: 'local' });
  const refreshedHits = searchProjectAfterPublish(workspace, refreshed, 'http-b', 'webhook-paivitys');
  assert.equal(refreshedHits.length, 1);
  await stopHttp(server);

  command(workspace, ['refresh', 'configure-poll', '--interval', '300', '--debounce', '0']);
  fs.appendFileSync(
    path.join(repoA, 'vnetcon-docs', 'moduulit', 'http-a', 'yleiskuvaus.md'),
    '\nPolling-version sana on poll-paivitys.\n',
  );
  git(repoA, ['add', '-A']);
  git(repoA, ['commit', '-qm', 'poll publication']);
  server = await startHttp(workspace, port);
  const pollLoaded = loadConfig({ cwd: workspace, profile: 'local' });
  const pollHits = searchProjectAfterPublish(workspace, pollLoaded, 'http-a', 'poll-paivitys');
  assert.equal(pollHits.length, 1);
  await stopHttp(server);

  const secrets = path.join(workspace, '.multiproject', 'secrets', 'auth.json');
  const secretText = fs.readFileSync(secrets, 'utf8');
  assert.ok(!secretText.includes(token));
  assert.ok(!secretText.includes('a-long-test-password'));
  assert.ok(!secretText.includes(hookToken));
});

test('OIDC validoi JWT:n ja soveltaa claim-pohjaiset projektioikeudet', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'multiproject-mcp-oidc-'));
  const repoA = createRepository(temp, 'oidc-a', 'oidc-ananas');
  const repoB = createRepository(temp, 'oidc-b', 'oidc-banaani');
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  command(workspace, ['add-project', '--id', 'oidc-a', '--path', repoA, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['add-project', '--id', 'oidc-b', '--path', repoB, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'oidc-a', 'main']);
  command(workspace, ['channel', 'set-ref', 'local', 'oidc-b', 'main']);
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  const port = await freePort();
  const issuerPort = await freePort();
  const issuer = await startOidcIssuer(issuerPort);
  command(workspace, ['server', 'configure-http', '--listen', `127.0.0.1:${port}`, '--channel', 'local']);
  command(workspace, [
    'auth', 'configure-oidc', '--issuer', issuer.issuer, '--audience', 'mcp-test',
    '--resource', `http://127.0.0.1:${port}/mcp`, '--scopes', 'docs.read', '--allow-insecure-http',
  ]);
  command(workspace, [
    'auth', 'oidc-rule', 'add', '--name', 'finance', '--claim', 'groups', '--values', 'finance',
    '--channels', 'local', '--projects', 'oidc-a',
  ]);
  command(workspace, ['config', 'validate']);
  command(workspace, ['doctor', '--http']);

  const server = await startHttp(workspace, port);
  const metadata = await fetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource/mcp`);
  assert.equal(metadata.status, 200);
  assert.equal((await metadata.json()).authorization_servers[0], issuer.issuer);
  const validToken = await issuer.token({ groups: ['finance'], scp: 'docs.read' });
  const connection = await connectHttp(`http://127.0.0.1:${port}/mcp`, `Bearer ${validToken}`);
  const projects = await connection.client.callTool({ name: 'list_projects', arguments: {} });
  assert.deepEqual(projects.structuredContent.projects.map((item) => item.project_id), ['oidc-a']);
  await connection.client.close();
  const wrongAudience = await issuer.token({ groups: ['finance'], scp: 'docs.read' }, 'wrong-audience');
  const rejected = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${wrongAudience}` },
    body: '{}',
  });
  assert.equal(rejected.status, 401);
  assert.match(rejected.headers.get('www-authenticate'), /resource_metadata=.*oauth-protected-resource\/mcp/);
  await stopHttp(server);
  await issuer.close();
});

function searchProjectAfterPublish(workspace, loaded, projectId, query) {
  command(workspace, ['publish', '--channel', 'local']);
  return searchProject(loaded, 'local', projectId, query);
}
