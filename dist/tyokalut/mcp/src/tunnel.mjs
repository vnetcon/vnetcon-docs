import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { UserError } from './errors.mjs';
import { packageRoot } from './workspace.mjs';

// HTTP-osoite ja OpenAI Secure MCP Tunnelin komennot. Yksi lähde CLI:lle
// (tunnel prepare), prosessille ja käyttöliittymälle, jotta kaikki näyttävät
// saman osoitteen ja samat komennot.

export const DEFAULT_HTTP = { host: '127.0.0.1', port: 8799, path: '/mcp' };

const ID_PATTERN = /^tunnel_[a-z0-9]{32}$/;
const PROFILE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const RELEASES = 'https://github.com/openai/tunnel-client/releases';

export function isLoopbackHost(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}

// MCP:n osoite. `running` on käynnissä olevan palvelimen osoite (käyttöliittymä
// tietää sen); muuten asetukset ja niiden puuttuessa käyttöliittymän oletus.
export function mcpEndpoint(loaded, running = null) {
  const http = loaded.config.runtime?.http || null;
  const host = running?.host || http?.host || DEFAULT_HTTP.host;
  const port = running?.port || http?.port || DEFAULT_HTTP.port;
  const mcpPath = running?.path || http?.path || DEFAULT_HTTP.path;
  // Tunneli ja paikalliset clientit ottavat yhteyden omalta koneelta.
  const local = isLoopbackHost(host) ? host : '127.0.0.1';
  return { host, port, path: mcpPath, url: `http://${local}:${port}${mcpPath}`, configured: Boolean(http) };
}

// tunnel-clientin profiilin oletusnimi: työtilan (emoprojektin) mukaan.
export function defaultTunnelProfile(loaded) {
  const root = path.resolve(loaded.root);
  const inDocs = path.basename(root) === 'mcp-tyotila' && path.basename(path.dirname(root)) === 'vnetcon-docs';
  const name = inDocs ? path.basename(path.dirname(path.dirname(root))) : path.basename(root);
  const slug = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return slug ? `vnetcon-docs-${slug}` : 'vnetcon-docs';
}

export function storedTunnel(loaded) {
  return loaded.config.runtime?.tunnel?.openai || null;
}

export function validateTunnelId(value) {
  if (value === true || value === undefined || value === null || value === '') {
    throw new UserError('Anna tunnelin tunniste: --tunnel-id <id> (OpenAI Platform → Settings → Organization → Tunnels).');
  }
  const id = String(value).trim();
  if (!ID_PATTERN.test(id)) throw new UserError(`Virheellinen tunnelin tunniste: ${id}. Muoto on tunnel_ ja 32 pientä kirjainta tai numeroa.`);
  return id;
}

export function validateTunnelProfile(value) {
  if (value === true || value === '') throw new UserError('Anna profiilin nimi: --client-profile <nimi>.');
  const profile = String(value).trim();
  if (!PROFILE_PATTERN.test(profile)) throw new UserError(`Virheellinen profiilin nimi: ${profile}`);
  return profile;
}

// --- tunnel-client MCP-työtilan sisällä -------------------------------------
// Ohjelma ja sen profiilit ovat työtilan .multiproject/tunnel-client-hakemistossa
// (gitin ulkopuolella). Mitään ei asenneta PATHiin tai kotihakemistoon, joten
// kaiken saa pois poistamalla hakemiston.

export function tunnelClientPaths(loaded, platform = process.platform) {
  const dir = path.join(loaded.root, '.multiproject', 'tunnel-client');
  const binary = path.join(dir, platform === 'win32' ? 'tunnel-client.exe' : 'tunnel-client');
  return { dir, binary, profiles: path.join(dir, 'profiles'), installed: fs.existsSync(binary) };
}

// Polku sellaisena kuin se kirjoitetaan komentoon vnetcon-docs-hakemistossa.
function shellPath(target, shell) {
  const relative = path.relative(packageRoot(), target);
  const inside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  const parts = inside ? relative.split(path.sep) : null;
  const text = shell === 'bash'
    ? (inside ? `./${parts.join('/')}` : target.split(path.sep).join('/'))
    : (inside ? `.\\${parts.join('\\')}` : target);
  return /^[A-Za-z0-9._/\\:-]+$/.test(text) ? text : (shell === 'bash' ? `'${text.replaceAll("'", `'\\''`)}'` : `'${text.replaceAll("'", "''")}'`);
}

// Komennot terminaaliin. Valitsimet menevät tallennettujen arvojen edelle.
export function tunnelCommands(loaded, { running = null, tunnelId, profile } = {}) {
  const stored = storedTunnel(loaded);
  const id = tunnelId || stored?.tunnel_id || '<TUNNEL_ID>';
  const name = profile || stored?.profile || defaultTunnelProfile(loaded);
  const endpoint = mcpEndpoint(loaded, running);
  const paths = tunnelClientPaths(loaded);
  const lines = (shell) => {
    const exe = shellPath(paths.binary.replace(/\.exe$/, ''), shell) + (shell === 'powershell' ? '.exe' : '');
    const dir = `--profile-dir ${shellPath(paths.profiles, shell)}`;
    // Terveystarkistuksen portti valitaan vapaasta, ettei se törmää muihin tunnel-client-ajoihin.
    return [
      `${exe} init --profile ${name} ${dir} --tunnel-id ${id} --mcp-server-url ${endpoint.url} --health-listen-addr 127.0.0.1:0 --force`,
      `${exe} doctor --profile ${name} ${dir} --explain`,
      `${exe} run --profile ${name} ${dir}`,
    ];
  };
  return {
    tunnel_id: stored?.tunnel_id || null,
    profile: name,
    mcp_url: endpoint.url,
    installed: paths.installed,
    directory: paths.dir,
    bash: ['export CONTROL_PLANE_API_KEY="sk-..."', ...lines('bash')],
    powershell: ['$env:CONTROL_PLANE_API_KEY = "sk-..."', ...lines('powershell')],
  };
}

function platformAsset(version) {
  const os_ = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform];
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
  if (!os_ || !arch) throw new UserError(`tunnel-clientia ei ole alustalle ${process.platform}/${process.arch}. Lataa se käsin: ${RELEASES}`);
  return `tunnel-client-${version}-${os_}-${arch}.zip`;
}

async function download(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new UserError(`Lataus epäonnistui (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function latestVersion() {
  const response = await fetch(`${RELEASES}/latest`, { redirect: 'manual' });
  const location = response.headers.get('location') || '';
  const match = location.match(/\/tag\/(v[0-9][^/]*)$/);
  if (!match) throw new UserError(`Uusinta versiota ei saatu selville. Anna versio: --version v0.0.15 (${RELEASES})`);
  return match[1];
}

function extractZip(zipFile, target) {
  const attempts = process.platform === 'win32'
    ? [['tar', ['-xf', zipFile, '-C', target]], ['powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${zipFile}' -DestinationPath '${target}'`]]]
    : [['unzip', ['-oq', zipFile, '-d', target]], ['tar', ['-xf', zipFile, '-C', target]]];
  for (const [command, args] of attempts) {
    const result = spawnSync(command, args, { stdio: 'ignore' });
    if (!result.error && result.status === 0) return;
  }
  throw new UserError('Zip-paketin purku epäonnistui (unzip tai tar puuttuu). Pura paketti käsin ja asenna --from <hakemisto>.');
}

// Asentaa tunnel-clientin työtilaan: OpenAI:n julkaisusta (tarkistussumma
// varmistetaan) tai paikallisesta zipistä, hakemistosta tai ohjelmatiedostosta.
export async function installTunnelClient(loaded, { from, version } = {}) {
  const paths = tunnelClientPaths(loaded);
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'vnetcon-tunnel-client-'));
  const lines = [];
  try {
    let source = staging;
    if (from) {
      const resolved = path.resolve(String(from));
      if (!fs.existsSync(resolved)) throw new UserError(`Lähdettä ei ole: ${resolved}`);
      if (fs.statSync(resolved).isDirectory()) source = resolved;
      else if (resolved.toLowerCase().endsWith('.zip')) extractZip(resolved, staging);
      else {
        fs.copyFileSync(resolved, path.join(staging, path.basename(paths.binary)));
        const companion = path.join(path.dirname(resolved), process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
        if (fs.existsSync(companion)) fs.copyFileSync(companion, path.join(staging, path.basename(companion)));
      }
      lines.push(`Lähde: ${resolved}`);
    } else {
      const tag = version ? String(version).replace(/^(?!v)/, 'v') : await latestVersion();
      const asset = platformAsset(tag);
      const base = `${RELEASES}/download/${tag}`;
      const sums = (await download(`${base}/SHA256SUMS.txt`)).toString('utf8');
      const expected = sums.split('\n').map((line) => line.trim().split(/\s+/)).find((parts) => parts[1] === asset)?.[0];
      if (!expected) throw new UserError(`Tarkistussummaa ei löytynyt: ${asset}`);
      const zip = await download(`${base}/${asset}`);
      const actual = crypto.createHash('sha256').update(zip).digest('hex');
      if (actual !== expected) throw new UserError(`Tarkistussumma ei täsmää: ${asset}`);
      const zipFile = path.join(staging, asset);
      fs.writeFileSync(zipFile, zip);
      extractZip(zipFile, staging);
      fs.rmSync(zipFile);
      lines.push(`Ladattu: ${base}/${asset} (SHA-256 tarkistettu)`);
    }
    const binaryName = path.basename(paths.binary);
    if (!fs.existsSync(path.join(source, binaryName))) throw new UserError(`Lähteestä puuttuu ${binaryName}.`);
    fs.mkdirSync(paths.dir, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const target = path.join(paths.dir, entry.name);
      fs.copyFileSync(path.join(source, entry.name), target);
      if (process.platform !== 'win32' && /^(tunnel-client|cloudflared)$/.test(entry.name)) fs.chmodSync(target, 0o755);
    }
    fs.mkdirSync(paths.profiles, { recursive: true });
    const check = spawnSync(paths.binary, ['--version'], { encoding: 'utf8' });
    lines.push(`Asennettu: ${paths.dir}`);
    if (check.status === 0) lines.push(`Versio: ${check.stdout.trim().split('\n')[0]}`);
    else lines.push('VAROITUS: tunnel-client --version ei onnistunut. Tarkista, että paketti on tälle alustalle.');
    if (process.platform === 'darwin') lines.push('Jos macOS estää ohjelman, salli se: Järjestelmäasetukset → Tietosuoja ja turvallisuus.');
    return lines;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

export function uninstallTunnelClient(loaded) {
  const paths = tunnelClientPaths(loaded);
  if (!fs.existsSync(paths.dir)) return false;
  fs.rmSync(paths.dir, { recursive: true, force: true });
  return true;
}
