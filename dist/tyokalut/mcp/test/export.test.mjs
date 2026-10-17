import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, readZip, writeZip } from '../src/zip.mjs';

// Vienti: julkaistu kanava tiedostoina AI-clientin kontekstiksi.

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

// Projekti, jossa on johdanto, järjestelmäprosessi ja kaksi moduulia.
function createProject(root, name, word) {
  const repo = path.join(root, name);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'Test']);
  write(path.join(repo, 'src', 'index.js'), `export const value = '${word}';\n`);
  const docs = path.join(repo, 'vnetcon-docs');
  write(path.join(docs, 'johdanto.md'), `---\ntila: valmis\nlahteet:\n  - src/index.js\n---\n# ${name}\n\nJohdanto: ${word}. Ks. [tilaukset](moduulit/tilaukset/yleiskuvaus.md).\n`);
  write(path.join(docs, 'jarjestelmaprosessit', 'kulku.md'), '# Kulku\n\nTilauksesta laskuksi.\n');
  write(path.join(docs, 'moduulit', 'tilaukset', 'yleiskuvaus.md'), '# Tilaukset\n\n## Prosessi\n\nKs. [laskutus](../laskutus/yleiskuvaus.md#vaihe) ja `src/index.js`.\n\n```\n# ei otsikko\n```\n');
  write(path.join(docs, 'moduulit', 'laskutus', 'yleiskuvaus.md'), '# Laskutus\n\n## Vaihe\n\nLasku.\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'initial']);
  return repo;
}

function setup(prefix) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const repoA = createProject(temp, 'portaali', 'portaalisana');
  const repoB = createProject(temp, 'laskutus', 'laskutussana');
  const workspace = path.join(temp, 'control');
  command(temp, ['init', workspace]);
  command(workspace, ['add-project', '--id', 'portaali', '--name', 'Asiakasportaali', '--path', repoA, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['add-project', '--id', 'laskutus', '--path', repoB, '--refs', 'main', '--docs-mode', 'repository']);
  command(workspace, ['channel', 'create', 'local']);
  command(workspace, ['channel', 'set-ref', 'local', 'portaali', 'main']);
  command(workspace, ['channel', 'set-ref', 'local', 'laskutus', 'main']);
  write(path.join(workspace, 'interfaces', 'molemmat.yaml'),
    'schema_version: 1\ninterface_id: molemmat\nstatus: active\nprovider:\n  project_id: portaali\nconsumers:\n  - project_id: laskutus\n');
  write(path.join(workspace, 'interfaces', 'oma.yaml'),
    'schema_version: 1\ninterface_id: oma\nstatus: active\nprovider:\n  project_id: portaali\n');
  write(path.join(workspace, 'interfaces', 'luonnos.yaml'),
    'schema_version: 1\ninterface_id: luonnos\nstatus: draft\nprovider:\n  project_id: portaali\n');
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  return { temp, workspace, repoA, repoB };
}

function exportDir(workspace, id) {
  return path.join(workspace, '.multiproject', 'publications', 'exports', id);
}

function createExport(workspace, args) {
  const output = command(workspace, ['export', 'create', '--channel', 'local', ...args]).stdout;
  return output.match(/Vienti (\S+) muodostettiin/)[1];
}

test('zip: CRC32 ja kirjoitus–luku-kierros', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entries = [{ name: 'a/ä.md', data: 'sisältö\n'.repeat(50) }, { name: 'tyhja.txt', data: '' }];
  const read = readZip(writeZip(entries));
  assert.deepEqual(read.map((entry) => [entry.name, entry.data.toString('utf8')]), entries.map((entry) => [entry.name, entry.data]));
  assert.throws(() => writeZip([{ name: '../pako.md', data: 'x' }]));
  assert.throws(() => readZip(writeZip(entries), { maxBytes: 10 }));
});

test('vienti muodostetaan julkaisusta alkuperätietoineen', () => {
  const { workspace, repoA } = setup('multiproject-export-');
  const sha = git(repoA, ['rev-parse', 'HEAD']);
  const id = createExport(workspace, ['--project', 'portaali', '--target', 'chatgpt-projekti', '--label', 'Testi ../../etc', '--classification', 'Sisäinen']);
  const dir = exportDir(workspace, id);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'sisalto', 'manifest.json'), 'utf8'));

  // Tiedostot ja alkuperä
  const uploads = manifest.files.filter((file) => file.path.startsWith('tiedostot/')).map((file) => file.path);
  assert.deepEqual(uploads, [
    'tiedostot/portaali-00-yleiskuva.md',
    'tiedostot/portaali-20-jarjestelmaprosessit.md',
    'tiedostot/portaali-30-moduuli-laskutus.md',
    'tiedostot/portaali-30-moduuli-tilaukset.md',
    'tiedostot/60-rajapinnat.md',
  ]);
  assert.equal(manifest.projects[0].source_commit_sha, sha);
  assert.equal(manifest.label, 'Testi ../../etc');
  for (const file of uploads) {
    const content = fs.readFileSync(path.join(dir, 'sisalto', ...file.split('/')), 'utf8');
    if (file.includes('portaali-')) {
      assert.match(content, new RegExp(sha));
      assert.match(content, new RegExp(manifest.projects[0].release_id));
      assert.match(content, /Tietoluokka: Sisäinen/);
    }
  }
  const tilaukset = fs.readFileSync(path.join(dir, 'sisalto', 'tiedostot', 'portaali-30-moduuli-tilaukset.md'), 'utf8');
  assert.match(tilaukset, /^### Tilaukset$/m);
  assert.match(tilaukset, /^# ei otsikko$/m, 'koodilohkon sisältö säilyy');
  assert.match(tilaukset, /laskutus \(ks\. `moduulit\/laskutus\/yleiskuvaus\.md` tiedostossa `portaali-30-moduuli-laskutus\.md`\)/);
  assert.match(tilaukset, /`src\/index\.js`/, 'lähdeviite säilyy');
  const overview = fs.readFileSync(path.join(dir, 'sisalto', 'tiedostot', 'portaali-00-yleiskuva.md'), 'utf8');
  assert.match(overview, /```yaml\ntila: valmis\nlahteet:\n {2}- src\/index\.js\n```/);

  // Rajapinnoista vain active, jonka kaikki osapuolet ovat viennissä.
  assert.deepEqual(manifest.interfaces.included, ['oma']);
  const instructions = fs.readFileSync(path.join(dir, 'sisalto', 'ohjeet.md'), 'utf8');
  assert.match(instructions, /portaali@main/);
  assert.match(instructions, /Yhteinen ohjaus/);
  assert.equal(manifest.guidance.mode, 'instructions');

  // Tarkistussummat ja zip vastaavat sisältöä.
  for (const file of manifest.files) {
    const data = fs.readFileSync(path.join(dir, 'sisalto', ...file.path.split('/')));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), file.sha256, file.path);
  }
  const zipped = readZip(fs.readFileSync(path.join(dir, 'paketti.zip')));
  assert.equal(zipped.length, manifest.files.length + 1);
  for (const entry of zipped) assert.deepEqual(entry.data, fs.readFileSync(path.join(dir, 'sisalto', ...entry.name.split('/'))), entry.name);

  // Julkaisematon muutos ei päädy vientiin.
  fs.appendFileSync(path.join(repoA, 'vnetcon-docs', 'moduulit', 'tilaukset', 'yleiskuvaus.md'), '\nJulkaisematon-sana.\n');
  git(repoA, ['commit', '-qam', 'julkaisematon']);
  command(workspace, ['bootstrap', '--all']);
  const second = createExport(workspace, ['--project', 'portaali', '--target', 'chatgpt-projekti']);
  const secondText = fs.readFileSync(path.join(exportDir(workspace, second), 'sisalto', 'tiedostot', 'portaali-30-moduuli-tilaukset.md'), 'utf8');
  assert.doesNotMatch(secondText, /Julkaisematon-sana/);

  // Polut eivät tule käyttäjän syötteestä.
  assert.deepEqual(fs.readdirSync(path.join(workspace, '.multiproject', 'publications', 'exports')).sort(), [id, second].sort());
  command(workspace, ['export', 'show', '../x'], 1);
  command(workspace, ['export', 'write', id, '--out', path.join(workspace, 'kopio.zip')]);
  assert.equal(readZip(fs.readFileSync(path.join(workspace, 'kopio.zip'))).length, zipped.length);
});

test('moniprojektivienti vaatii valinnan, ryhmittely ja tiedostoraja', () => {
  const { workspace } = setup('multiproject-export-multi-');
  const refused = command(workspace, ['export', 'plan', '--project', 'portaali,laskutus', '--target', 'chatgpt-projekti'], 1);
  assert.match(refused.stderr, /--multi-project/);
  const multi = JSON.parse(command(workspace, ['export', 'plan', '--project', 'portaali,laskutus', '--multi-project', '--target', 'chatgpt-projekti', '--json']).stdout);
  assert.deepEqual(multi.manifest.interfaces.included, ['molemmat', 'oma']);
  assert.ok(multi.manifest.warnings.some((warning) => warning.includes('useita projekteja')));
  assert.match(multi.instructions, /Nimeä aina, mitä järjestelmää/);

  fs.appendFileSync(path.join(workspace, 'multiproject-mcp.yaml'),
    'exports:\n  profiles:\n    pieni:\n      label: Pieni\n      grouping: merged\n      max_files: 4\n      instructions_chars: 900\n');
  command(workspace, ['config', 'validate']);
  const small = JSON.parse(command(workspace, ['export', 'plan', '--project', 'portaali', '--target', 'pieni', '--no-interfaces', '--json']).stdout);
  const uploads = small.manifest.files.filter((file) => file.path.startsWith('tiedostot/')).map((file) => file.path);
  assert.ok(uploads.includes('tiedostot/portaali-30-moduulit-1.md'), uploads.join(','));
  assert.ok(uploads.includes('tiedostot/50-ohjaus-ja-sanasto.md'), 'ohjaus ei mahdu ohjetekstiin');
  assert.equal(small.manifest.guidance.mode, 'file');
  assert.ok(small.manifest.warnings.some((warning) => warning.includes('koottiin ryhmiin')));

  const perDocument = JSON.parse(command(workspace, ['export', 'plan', '--project', 'portaali', '--target', 'yleinen', '--json']).stdout);
  assert.ok(perDocument.manifest.files.some((file) => file.path === 'tiedostot/portaali/moduulit/tilaukset/yleiskuvaus.md'));

  fs.appendFileSync(path.join(workspace, 'multiproject-mcp.yaml'), '    virhe:\n      tuntematon: 1\n');
  command(workspace, ['config', 'validate'], 1);
});

test('vanhentuminen, uudelleenmuodostus ja roskakori', () => {
  const { workspace, repoA } = setup('multiproject-export-stale-');
  const id = createExport(workspace, ['--project', 'portaali', '--target', 'chatgpt-projekti']);
  const status = () => JSON.parse(command(workspace, ['export', 'list', '--json']).stdout).exports;
  assert.equal(status()[0].status, 'ajan-tasalla');
  assert.match(command(workspace, ['process']).stdout, /Viennit asiakkaille: 1 vientiä, kaikki ajan tasalla/);

  fs.appendFileSync(path.join(repoA, 'vnetcon-docs', 'moduulit', 'laskutus', 'yleiskuvaus.md'), '\nUusi.\n');
  git(repoA, ['commit', '-qam', 'muutos']);
  command(workspace, ['bootstrap', '--all']);
  command(workspace, ['publish', '--channel', 'local']);
  const stale = status().find((item) => item.export_id === id);
  assert.equal(stale.status, 'vanhentunut');
  assert.match(stale.reasons[0], /uudempi julkaisu/);
  assert.match(command(workspace, ['process']).stdout, /1 vanhentunut/);

  fs.appendFileSync(path.join(workspace, 'yhteiset', 'sanasto.md'), '| Uusi | x | y | |\n');
  const recreated = command(workspace, ['export', 'recreate', id]).stdout.match(/Vienti (\S+) muodostettiin/)[1];
  assert.equal(status().find((item) => item.export_id === recreated).status, 'ajan-tasalla');
  fs.appendFileSync(path.join(workspace, 'yhteiset', 'sanasto.md'), '| Toinen | x | y | |\n');
  assert.ok(status().find((item) => item.export_id === recreated).reasons.some((reason) => reason.includes('ohjaus')));

  assert.match(command(workspace, ['export', 'remove', id]).stdout, /--confirm/);
  assert.ok(fs.existsSync(exportDir(workspace, id)));
  const entry = command(workspace, ['export', 'remove', id, '--confirm']).stdout.match(/roskakoriin: (\S+)/)[1];
  assert.ok(!fs.existsSync(exportDir(workspace, id)));
  command(workspace, ['trash', 'restore', entry]);
  assert.ok(fs.existsSync(path.join(exportDir(workspace, id), 'paketti.zip')));

  command(workspace, ['remove-project', 'portaali', '--confirm', '--purge']);
  assert.equal(status().length, 0);
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
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return { child, log: () => stderr };
    } catch { /* käynnistyy */ }
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

test('hallintakäyttöliittymä: vienti, lataus ja käyttöoikeudet', async () => {
  const { workspace } = setup('multiproject-export-ui-');
  const port = await freePort();
  const base = `http://127.0.0.1:${port}/ui/api`;
  command(workspace, ['server', 'configure-http', '--listen', `127.0.0.1:${port}`, '--channel', 'local']);
  command(workspace, ['auth', 'set-mode', 'bearer']);
  const token = (args) => command(workspace, ['auth', 'token', 'create', ...args]).stdout.trim().split('\n').at(-1);
  const admin = `Bearer ${token(['--name', 'yllapitaja', '--admin'])}`;
  const reader = `Bearer ${token(['--name', 'lukija'])}`;
  const limited = `Bearer ${token(['--name', 'rajattu', '--admin', '--projects', 'laskutus'])}`;
  const call = async (route, authorization, body) => {
    const response = await fetch(`${base}${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: authorization, ...(body ? { 'Content-Type': 'application/json', 'X-Vnetcon-UI': '1' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, response };
  };
  const ui = await startUi(workspace, port);
  try {
    const created = await call('/run', admin, { args: ['export', 'create', '--channel', 'local', '--project', 'portaali', '--target', 'chatgpt-projekti', '--label', 'UI-testi'] });
    const result = await created.response.json();
    assert.equal(result.ok, true, result.output);
    const id = result.output.match(/Vienti (\S+) muodostettiin/)[1];

    const list = await (await call('/exports', admin)).response.json();
    assert.equal(list.exports[0].export_id, id);
    assert.equal(list.exports[0].created_by, 'ui:token:yllapitaja');
    const detail = await (await call(`/exports/${id}`, admin)).response.json();
    assert.match(detail.instructions, /Asiakasportaali/);

    const download = await call(`/exports/${id}/download`, admin);
    assert.equal(download.status, 200);
    assert.equal(download.response.headers.get('content-type'), 'application/zip');
    assert.match(download.response.headers.get('content-disposition'), new RegExp(`vnetcon-vienti-${id}\\.zip`));
    const entries = readZip(Buffer.from(await download.response.arrayBuffer()));
    assert.ok(entries.some((entry) => entry.name === 'ohjeet.md'));
    assert.match(ui.log(), new RegExp(`vienti ladattu: ${id} token:yllapitaja`));

    // Lukija ei näe vientejä, projektirajattu ylläpitäjä vain omiensa.
    assert.equal((await call('/exports', reader)).status, 403);
    assert.equal((await call(`/exports/${id}/download`, reader)).status, 403);
    assert.equal((await (await call('/exports', limited)).response.json()).exports.length, 0);
    assert.equal((await call(`/exports/${id}/download`, limited)).status, 403);
    assert.equal((await call('/run', limited, { args: ['export', 'create', '--channel', 'local', '--project', 'portaali', '--target', 'yleinen'] })).status, 403);
    assert.equal((await call('/run', limited, { args: ['export', 'remove', id, '--confirm'] })).status, 403);
    assert.equal((await call('/exports/..%2Fx/download', admin)).status, 400);
    assert.equal((await call('/run', admin, { args: ['export', 'write', id, '--out', '/tmp/x.zip'] })).status, 400, 'write ei ole UI-komento');
  } finally {
    await stop(ui.child);
  }
});
