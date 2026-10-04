import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { authConfig, authenticateRequest } from './auth.mjs';
import { loadConfig, resolveRootPath } from './config.mjs';
import { revisionKey, separateDocs } from './git.mjs';
import { loadChannel } from './publisher.mjs';
import { refreshSettings } from './refresh.mjs';
import { fetchDocument, listInterfaces, readSharedGuidance, searchProject } from './search.mjs';
import { packageRoot, readWorkspaceState } from './workspace.mjs';
import { ensureDirectory, writeFileAtomic } from './util.mjs';

// Hallintakäyttöliittymä. Lukunäkymät kootaan prosessin sisällä; muutokset ajetaan
// samalla CLI:llä kuin päätteessä, jotta validointi ja logiikka eivät kahdennu.
// Tunnistus on sama kuin MCP:llä. Muutokset vaativat admin-oikeuden sekä
// X-Vnetcon-UI-otsakkeen, jota toinen sivusto ei voi lähettää ilman CORS-lupaa.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(HERE, '..', 'ui');
const CLI = path.join(HERE, '..', 'bin', 'multiproject-mcp.mjs');
const STATIC = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const SAFE_GUIDANCE = /^[a-z0-9][a-z0-9._-]{0,62}\.md$/;

export function registerUi(app, loaded, options) {
  const base = options.path;
  let queue = Promise.resolve();

  for (const [route, [file, type]] of Object.entries(STATIC)) {
    app.get(`${base}${route}`, (req, res) => {
      // Express ei erota osoitteita /ui ja /ui/; suhteelliset polut toimivat vain jälkimmäisessä.
      if (route === '/' && !req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(`${base}/`);
      res.set({
        'Content-Type': type,
        'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      res.send(fs.readFileSync(path.join(UI_DIR, file)));
    });
  }

  const api = (method, route, handler, { write = false } = {}) => {
    app[method](`${base}/api${route}`, async (req, res) => {
      try {
        const principal = await authenticateRequest(req, loaded, { loopback: options.loopback });
        if (!principal) return res.status(401).json({ error: 'Kirjautuminen vaaditaan.', auth_mode: authMode(loaded) });
        if (write) {
          if (req.get('x-vnetcon-ui') !== '1' || !sameOrigin(req)) return res.status(403).json({ error: 'Pyyntö ei tullut hallintakäyttöliittymästä.' });
          if (!principal.admin) return res.status(403).json({ error: 'Muutos vaatii admin-oikeuden.' });
          // Muutokset ajetaan yksi kerrallaan, koska ne kirjoittavat samaa työtilaa.
          const result = queue.then(() => handler(req, principal));
          queue = result.catch(() => {});
          return res.json(await result);
        }
        return res.json(await handler(req, principal));
      } catch (error) {
        return res.status(error.status || 400).json({ error: error.message });
      }
    });
  };

  const cli = async (args) => {
    const result = await runCli(loaded, args);
    Object.assign(loaded, loadConfig({ explicit: loaded.filename, profile: loaded.profile }));
    return result;
  };

  api('get', '/session', (_req, principal) => ({
    auth_mode: authMode(loaded),
    principal: { id: principal.id, admin: principal.admin, projects: principal.projects || null, channels: principal.channels || null },
    workspace: loaded.root,
    profile: loaded.profile,
  }));

  api('get', '/overview', (_req, principal) => overview(loaded, principal, options));

  api('get', '/review', (req, principal) => {
    const projectId = String(req.query.project_id || '');
    allowProject(principal, projectId);
    return { state: readWorkspaceState(loaded, projectId, String(req.query.ref || '')) || null };
  });

  api('get', '/search', (req, principal) => {
    const projectId = String(req.query.project_id || '');
    allowProject(principal, projectId);
    return { results: searchProject(loaded, channelFor(req, loaded), projectId, String(req.query.q || ''), 20) };
  });

  api('get', '/document', (req, principal) => {
    const projectId = String(req.query.project_id || '');
    allowProject(principal, projectId);
    return fetchDocument(loaded, channelFor(req, loaded), projectId, String(req.query.document_id || ''));
  });

  api('get', '/guidance', () => ({ documents: readSharedGuidance(loaded), directory: guidanceRoot(loaded) }));

  api('get', '/interfaces', (_req, principal) => ({
    interfaces: listInterfaces(loaded, '', { includeDrafts: true })
      .filter((item) => interfaceVisible(principal, item))
      .map((item) => ({ ...item, _yaml: fs.readFileSync(path.join(interfacesRoot(loaded), item._source), 'utf8') })),
    template: readTemplate(),
  }));

  api('post', '/projects', (req) => {
    const body = req.body || {};
    const args = ['add-project', '--id', text(body.id), '--refs', text(body.refs), '--docs-mode', text(body.docs_mode)];
    if (body.path) args.push('--path', path.resolve(loaded.root, text(body.path)));
    else args.push('--url', text(body.url));
    if (body.name) args.push('--name', text(body.name));
    if (body.docs_mode === 'separate') {
      const docsRepo = text(body.docs_repo);
      args.push('--docs-repo', /^[a-z][a-z0-9+.-]*:\/\//i.test(docsRepo) || docsRepo.includes('@') ? docsRepo : path.resolve(loaded.root, docsRepo));
      if (body.docs_ref) args.push('--docs-ref', text(body.docs_ref));
    }
    return cli(args);
  }, { write: true });

  api('post', '/channels', (req) => cli(['channel', 'create', text(req.body?.id)]), { write: true });
  api('post', '/channels/:id/refs', (req) => cli(['channel', 'set-ref', req.params.id, text(req.body?.project_id), text(req.body?.ref)]), { write: true });

  api('post', '/bootstrap', (req) => {
    const body = req.body || {};
    return cli(body.project_id
      ? ['bootstrap', '--project', text(body.project_id), ...(body.ref ? ['--ref', text(body.ref)] : [])]
      : ['bootstrap', '--all']);
  }, { write: true });

  api('post', '/approve', (req) => cli(['approve', '--project', text(req.body?.project_id), '--ref', text(req.body?.ref)]), { write: true });

  api('post', '/publish', async (req) => {
    const channel = text(req.body?.channel);
    const published = await cli(['publish', '--channel', channel]);
    if (!published.ok) return published;
    const smoke = await cli(['smoke-test', '--channel', channel]);
    return { ok: smoke.ok, output: `${published.output}${smoke.output}` };
  }, { write: true });

  api('put', '/guidance/:name', (req) => {
    const name = req.params.name;
    if (!SAFE_GUIDANCE.test(name)) throw httpError(400, 'Virheellinen tiedostonimi.');
    const directory = guidanceRoot(loaded);
    ensureDirectory(directory);
    writeFileAtomic(path.join(directory, name), String(req.body?.content ?? ''));
    return { ok: true, output: `Tallennettiin yhteiset/${name}\n` };
  }, { write: true });

  api('put', '/interfaces/:id', (req) => {
    const id = req.params.id;
    if (!SAFE_ID.test(id)) throw httpError(400, 'Virheellinen interface_id.');
    const source = String(req.body?.yaml ?? '');
    let parsed;
    try { parsed = YAML.parse(source); } catch (error) { throw httpError(400, `Virheellinen YAML: ${error.message}`); }
    if (parsed?.interface_id !== id) throw httpError(400, `interface_id pitää olla ${id}.`);
    if (!['draft', 'active', 'deprecated'].includes(parsed.status)) throw httpError(400, 'status pitää olla draft, active tai deprecated.');
    const existing = listInterfaces(loaded, '', { includeDrafts: true }).find((item) => item.interface_id === id);
    const filename = path.join(interfacesRoot(loaded), existing?._source || `${id}.yaml`);
    ensureDirectory(path.dirname(filename));
    writeFileAtomic(filename, source.endsWith('\n') ? source : `${source}\n`);
    return { ok: true, output: `Tallennettiin interfaces/${path.basename(filename)} (${parsed.status})\n` };
  }, { write: true });
}

function overview(loaded, principal, options) {
  const projects = loaded.config.projects
    .filter((project) => !principal.projects || principal.projects.includes(project.project_id))
    .map((project) => ({
      project_id: project.project_id,
      display_name: project.display_name || project.project_id,
      repository: project.repository,
      documentation: project.documentation,
      refs: concreteRefs(project).map((ref) => refStatus(loaded, project, ref)),
    }));
  const channels = loaded.config.channels
    .filter((channel) => !principal.channels || principal.channels.includes(channel.channel_id))
    .map((channel) => {
      let published = null;
      try {
        const bundle = loadChannel(channel.channel_id, loaded);
        published = {
          bundle_id: bundle.bundle_id,
          created_at: bundle.created_at || null,
          projects: (bundle.projects || []).map((item) => ({ project_id: item.project_id, ref: item.ref, source_commit_sha: item.source_commit_sha })),
        };
      } catch { /* ei julkaistu */ }
      return { channel_id: channel.channel_id, project_refs: channel.project_refs || {}, published };
    });
  const http = loaded.config.runtime?.http || {};
  const mcpUrl = `http://${options.host}:${options.port}${options.mcpPath}`;
  return {
    instance_id: loaded.config.service.instance_id,
    default_channel: loaded.config.service.default_channel,
    projects,
    channels,
    refresh: refreshSettings(loaded),
    connection: {
      mcp_url: mcpUrl,
      ui_url: `http://${options.host}:${options.port}${options.path}/`,
      auth_mode: authMode(loaded),
      tunnel: {
        bash: [
          'export CONTROL_PLANE_API_KEY="sk-..."',
          `tunnel-client init --profile vnetcon-docs --tunnel-id <TUNNEL_ID> --mcp-server-url ${mcpUrl}`,
          'tunnel-client doctor --profile vnetcon-docs --explain',
          'tunnel-client run --profile vnetcon-docs',
        ],
        powershell: [
          '$env:CONTROL_PLANE_API_KEY = "sk-..."',
          `tunnel-client init --profile vnetcon-docs --tunnel-id <TUNNEL_ID> --mcp-server-url ${mcpUrl}`,
          'tunnel-client doctor --profile vnetcon-docs --explain',
          'tunnel-client run --profile vnetcon-docs',
        ],
      },
      clients: {
        'Claude Code': `claude mcp add --transport http vnetcon-docs ${mcpUrl}`,
        'VS Code (.vscode/mcp.json)': JSON.stringify({ servers: { 'vnetcon-docs': { type: 'http', url: mcpUrl } } }, null, 2),
        'Cursor (.cursor/mcp.json)': JSON.stringify({ mcpServers: { 'vnetcon-docs': { url: mcpUrl } } }, null, 2),
      },
      configured_http: Boolean(loaded.config.runtime?.http),
      allowed_hosts: http.allowed_hosts || [],
    },
  };
}

function refStatus(loaded, project, ref) {
  const state = readWorkspaceState(loaded, project.project_id, ref);
  const docs = separateDocs(project, ref);
  let action = 'bootstrap';
  let error = null;
  try {
    const key = revisionKey(project, ref, loaded);
    if (state) action = (state.revision_key || state.source_commit_sha) === key ? 'no-change' : 'refresh';
  } catch (caught) {
    action = 'error';
    error = caught.message;
  }
  return {
    ref,
    docs_ref: docs?.ref || null,
    action,
    error,
    status: state?.status || null,
    source_commit_sha: state?.source_commit_sha || null,
    docs_commit_sha: state?.docs_commit_sha || null,
    approved: state ? state.approved_revision && state.approved_revision === state.documentation_revision : false,
    updated_at: state?.updated_at || null,
  };
}

function runCli(loaded, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args, '--config', loaded.filename, '--profile', loaded.profile], {
      cwd: loaded.root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolve({ ok: code === 0, output }));
    child.on('error', (error) => resolve({ ok: false, output: error.message }));
  });
}

function concreteRefs(project) {
  const refs = (project.refs?.include || []).filter((ref) => !ref.includes('*'));
  return refs.length ? refs : [project.refs.default];
}

function guidanceRoot(loaded) {
  return resolveRootPath(loaded, loaded.config.guidance?.path || './yhteiset');
}

function interfacesRoot(loaded) {
  return resolveRootPath(loaded, loaded.config.interfaces?.path || './interfaces');
}

function readTemplate() {
  const filename = path.join(packageRoot(), 'metodi', 'mallipohjat', 'integraatio.yaml');
  return fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
}

function channelFor(req, loaded) {
  return String(req.query.channel || loaded.config.service.default_channel);
}

function allowProject(principal, projectId) {
  getProjectSafe(projectId);
  if (principal.projects && !principal.projects.includes(projectId)) throw httpError(403, `Käyttöoikeus projektiin puuttuu: ${projectId}`);
}

function getProjectSafe(projectId) {
  if (!SAFE_ID.test(projectId)) throw httpError(400, 'Virheellinen project_id.');
}

function interfaceVisible(principal, item) {
  if (!principal.projects) return true;
  const parties = [item.provider?.project_id, ...(item.consumers || []).map((consumer) => consumer.project_id)].filter(Boolean);
  return parties.every((projectId) => principal.projects.includes(projectId));
}

function authMode(loaded) {
  return authConfig(loaded).mode || 'none';
}

function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

function text(value) {
  const result = String(value ?? '').trim();
  if (!result) throw httpError(400, 'Pakollinen kenttä puuttuu.');
  if (result.startsWith('--')) throw httpError(400, `Virheellinen arvo: ${result}`);
  return result;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

