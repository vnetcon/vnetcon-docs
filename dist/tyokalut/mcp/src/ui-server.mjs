import fs from 'node:fs';
import os from 'node:os';
import express from 'express';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { authConfig, authenticateRequest } from './auth.mjs';
import { loadConfig, resolveRootPath } from './config.mjs';
import { revisionKey, separateDocs } from './git.mjs';
import { loadChannel } from './publisher.mjs';
import { refreshSettings } from './refresh.mjs';
import { fetchDocument, listInterfaces, readSharedGuidance, searchProject } from './search.mjs';
import { packageRoot, readWorkspaceState } from './workspace.mjs';
import { COMMANDS, matchCommand } from './commands.mjs';
import { computeProcess } from './process.mjs';
import { tunnelCommands } from './tunnel.mjs';
import { jobDetails, listJobs } from './agent.mjs';
import { listTrash } from './manage.mjs';
import { detectParentProject } from './parent.mjs';
import { exportInstructions, exportProfiles, exportSummary, exportZip, listExports, readExport, selectedExportSources } from './exporter.mjs';
import { getSource, previewFile, readInventory, sourceAllowed, sourceLimits, summarise } from './sources.mjs';

// Hallintakäyttöliittymä. Lukunäkymät kootaan prosessin sisällä; muutokset ajetaan
// samalla CLI:llä kuin päätteessä, jotta validointi ja logiikka eivät kahdennu.
// Tunnistus on sama kuin MCP:llä. Muutokset vaativat admin-oikeuden sekä
// X-Vnetcon-UI-otsakkeen, jota toinen sivusto ei voi lähettää ilman CORS-lupaa.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(HERE, '..', 'ui');
const CLI = path.join(HERE, '..', 'bin', 'multiproject-mcp.mjs');
const STATIC = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;

function serveStatic(app, base, csp) {
  app.get('/', (_req, res) => res.redirect(`${base}/`));
  for (const [route, [file, type]] of Object.entries(STATIC)) {
    app.get(`${base}${route}`, (req, res) => {
      // Express ei erota osoitteita /ui ja /ui/; suhteelliset polut toimivat vain jälkimmäisessä.
      if (route === '/' && !req.originalUrl.split('?')[0].endsWith('/')) return res.redirect(`${base}/`);
      res.set({
        'Content-Type': type,
        'Content-Security-Policy': csp(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      return res.send(fs.readFileSync(path.join(UI_DIR, file)));
    });
  }
}

// OIDC-selainkirjautuminen hakee tunnistuspalvelun tiedot ja tokenin selaimesta,
// joten tunnistuspalvelun osoite sallitaan connect-src-säännössä.
function contentSecurityPolicy(loaded) {
  const oidc = authConfig(loaded).mode === 'oidc' ? authConfig(loaded).oidc || {} : {};
  const origins = [oidc.issuer, ...(oidc.ui_connect_src || [])].filter(Boolean).map((value) => {
    try { return new URL(value).origin; } catch { return ''; }
  }).filter(Boolean);
  return `default-src 'self'; connect-src 'self' ${origins.join(' ')}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.replace(/\s+;/g, ';');
}

// Kirjautumissivulle annettavat julkiset OIDC-tiedot (ei salaisuuksia).
function oidcPublic(loaded) {
  const configuration = authConfig(loaded);
  if (configuration.mode !== 'oidc') return undefined;
  const oidc = configuration.oidc || {};
  return { issuer: oidc.issuer, client_id: oidc.ui_client_id || null, scopes: oidc.ui_scopes || 'openid', resource: oidc.resource };
}

// Aloitustila: työtilaa ei ole vielä. Vain työtilan luonti, ja vain omalta koneelta.
export function registerSetupUi(app, options) {
  const base = options.path;
  serveStatic(app, base, () => "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const parentInfo = () => {
    const parent = detectParentProject();
    if (!parent) return null;
    const addable = !(parent.ignored && !parent.docsRepository);
    return {
      name: parent.name,
      root: parent.root,
      addable,
      note: addable ? '' : `${parent.docsDirectory}/ on gitin ulkopuolella eikä sillä ole omaa git-repoa (git init vnetcon-docs-hakemistossa).`,
    };
  };
  app.get(`${base}/api/session`, (_req, res) => res.json({ setup: { default_root: path.join(packageRoot(), 'mcp-tyotila'), parent: parentInfo() } }));
  app.post(`${base}/api/setup/init`, async (req, res) => {
    if (req.get('x-vnetcon-ui') !== '1' || !sameOrigin(req)) return res.status(403).json({ error: 'Pyyntö ei tullut hallintakäyttöliittymästä.' });
    const flag = req.body?.emoprojekti ? '--emoprojekti' : '--ilman-emoprojektia';
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, 'init', flag], { cwd: packageRoot(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      child.on('close', (code) => resolve({ ok: code === 0, output }));
    });
    res.json({ ...result, args: ['init', flag] });
    if (result.ok) setTimeout(() => options.onInitialised().catch((error) => process.stderr.write(`${error.message}\n`)), 200);
    return undefined;
  });
}

export function registerUi(app, loaded, options) {
  const base = options.path;
  let queue = Promise.resolve();
  serveStatic(app, base, () => contentSecurityPolicy(loaded));

  const api = (method, route, handler, { write = false } = {}) => {
    app[method](`${base}/api${route}`, async (req, res) => {
      try {
        const principal = await authenticateRequest(req, loaded, { loopback: options.loopback });
        if (!principal) return res.status(401).json({ error: 'Kirjautuminen vaaditaan.', auth_mode: authMode(loaded), oidc: oidcPublic(loaded) });
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

  const cli = async (args, stdin, principal) => {
    const result = await runCli(loaded, args, stdin, principal);
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

  api('get', '/process', (_req, principal) => computeProcess(loaded, principal, { host: options.host, port: options.port, path: options.mcpPath }));
  api('get', '/commands', () => ({ commands: COMMANDS }));
  api('get', '/jobs', (_req, principal) => ({ jobs: listJobs(loaded).filter((job) => !principal.projects || principal.projects.includes(job.project_id)) }));
  api('get', '/jobs/:id', (req, principal) => {
    const job = jobDetails(loaded, req.params.id);
    allowProject(principal, job.project_id);
    return job;
  });
  api('get', '/trash', () => ({ entries: listTrash(loaded) }));
  api('get', '/guide', (req) => readGuide(String(req.query.name || '')));

  // Kaikki muutokset: yksi rekisteröity CLI-komento kerrallaan, samat argumentit
  // kuin päätteessä. Agenttiajot käynnistetään aina taustalle.
  api('post', '/run', async (req, principal) => {
    const args = Array.isArray(req.body?.args) ? req.body.args.map(String) : [];
    const command = matchCommand(args);
    if (!command || !command.ui) throw httpError(400, `Komento ei ole sallittu käyttöliittymästä: ${args.slice(0, 3).join(' ')}`);
    if (args.some((value) => value === '--config' || value === '--profile' || value.startsWith('--config=') || value.startsWith('--profile='))) {
      throw httpError(400, 'Valitsimet --config ja --profile asettaa palvelin.');
    }
    if (command.path[0] === 'agent' && ['run', 'answer'].includes(command.path[1]) && !args.includes('--background')) args.push('--background');
    if (command.path[0] === 'export') allowExportArgs(loaded, principal, command.path[1], args);
    const result = await cli(args, typeof req.body?.stdin === 'string' ? req.body.stdin : undefined, principal);
    return { ...result, args };
  }, { write: true });

  // Viennit sisältävät koko dokumentaation, joten niiden luku vaatii admin-oikeuden
  // ja projektirajatulle näkyvät vain viennit, joiden kaikki projektit ovat sallittuja.
  const exportFor = (req, principal) => {
    requireAdmin(principal);
    const id = String(req.params.id || '');
    if (!SAFE_EXPORT.test(id)) throw httpError(400, 'Virheellinen vienti_id.');
    const record = readExport(loaded, id);
    if (!exportVisible(principal, record)) throw httpError(403, 'Käyttöoikeus viennin projekteihin puuttuu.');
    return record;
  };
  api('get', '/export-profiles', (_req, principal) => {
    requireAdmin(principal);
    return { profiles: Object.values(exportProfiles(loaded)) };
  });
  api('get', '/exports', (_req, principal) => {
    requireAdmin(principal);
    return { exports: listExports(loaded).filter((record) => exportVisible(principal, record)).map((record) => exportSummary(loaded, record)) };
  });
  api('get', '/exports/:id', (req, principal) => {
    const record = exportFor(req, principal);
    return { ...exportSummary(loaded, record), instructions: exportInstructions(loaded, record.export_id) };
  });
  // Lähdeaineistot: tiedostoluettelo ja esikatselu vaativat admin-oikeuden, koska
  // ne näyttävät hyväksymätöntä sisältöä.
  const sourceFor = (req, principal) => {
    requireAdmin(principal);
    const id = String(req.params.id || '');
    if (!SAFE_SOURCE.test(id)) throw httpError(400, 'Virheellinen source_id.');
    const source = getSource(loaded.config, id);
    if (!sourceAllowed(principal, source)) throw httpError(403, `Käyttöoikeus lähteeseen puuttuu: ${id}`);
    return source;
  };
  const channelsOf = (sourceId) => loaded.config.channels.filter((channel) => (channel.sources || []).includes(sourceId)).map((channel) => channel.channel_id);
  api('get', '/sources', (_req, principal) => {
    requireAdmin(principal);
    return {
      sources: (loaded.config.sources || []).filter((source) => sourceAllowed(principal, source))
        .map((source) => ({ ...source, channels: channelsOf(source.source_id), ...summarise(readInventory(loaded, source.source_id)) })),
      limits: sourceLimits(loaded),
    };
  });
  api('get', '/sources/:id', (req, principal) => {
    const source = sourceFor(req, principal);
    const inventory = readInventory(loaded, source.source_id);
    return { source, channels: channelsOf(source.source_id), ...summarise(inventory), files: Object.values(inventory.files).sort((a, b) => a.path.localeCompare(b.path)) };
  });
  api('get', '/sources/:id/preview', (req, principal) => {
    const source = sourceFor(req, principal);
    return previewFile(loaded, source, String(req.query.file || ''));
  });
  // Tiedoston lataus: raakadata väliaikaistiedostoon, sitten sama CLI-komento kuin päätteessä.
  // Tunnistus ja oikeudet tarkistetaan ennen kuin runko luetaan muistiin.
  const uploadGate = async (req, res, next) => {
    try {
      const principal = await authenticateRequest(req, loaded, { loopback: options.loopback });
      if (!principal) return res.status(401).json({ error: 'Kirjautuminen vaaditaan.', auth_mode: authMode(loaded), oidc: oidcPublic(loaded) });
      if (req.get('x-vnetcon-ui') !== '1' || !sameOrigin(req)) return res.status(403).json({ error: 'Pyyntö ei tullut hallintakäyttöliittymästä.' });
      req.vnetconPrincipal = principal;
      req.vnetconSource = sourceFor(req, principal);
      return next();
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }
  };
  const rawBody = express.raw({ type: 'application/octet-stream', limit: sourceLimits(loaded).max_file_bytes });
  const readBody = (req, res, next) => rawBody(req, res, (error) => (error
    ? res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.type === 'entity.too.large' ? 'Tiedosto on liian suuri.' : error.message })
    : next()));
  app.post(`${base}/api/sources/:id/upload`, uploadGate, readBody, async (req, res) => {
    let temp = '';
    try {
      const principal = req.vnetconPrincipal;
      const source = req.vnetconSource;
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw httpError(400, 'Tiedosto puuttuu (Content-Type: application/octet-stream).');
      let name = '';
      try { name = decodeURIComponent(String(req.get('x-file-name') || '')); } catch { throw httpError(400, 'Virheellinen tiedostonimi.'); }
      if (!name || name.startsWith('--')) throw httpError(400, 'Tiedostonimi puuttuu (X-File-Name).');
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vnetcon-upload-'));
      const filename = path.join(temp, 'tiedosto');
      fs.writeFileSync(filename, req.body);
      const args = ['source', 'upload', source.source_id, '--file', filename, '--name', name];
      const result = queue.then(() => cli(args, undefined, principal));
      queue = result.catch(() => {});
      const output = await result;
      return res.json({ ...output, args: ['source', 'upload', source.source_id, '--file', name] });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    } finally {
      if (temp) fs.rmSync(temp, { recursive: true, force: true });
    }
  });

  app.get(`${base}/api/exports/:id/download`, async (req, res) => {
    try {
      const principal = await authenticateRequest(req, loaded, { loopback: options.loopback });
      if (!principal) return res.status(401).json({ error: 'Kirjautuminen vaaditaan.', auth_mode: authMode(loaded), oidc: oidcPublic(loaded) });
      const record = exportFor(req, principal);
      const zip = exportZip(loaded, record.export_id);
      // Vain metatiedot lokiin, ei sisältöä.
      process.stderr.write(`vienti ladattu: ${record.export_id} ${principal.id} ${new Date().toISOString()}\n`);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="vnetcon-vienti-${record.export_id}.zip"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.send(zip);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message });
    }
  });
}

const SAFE_EXPORT = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const SAFE_SOURCE = /^[a-z0-9][a-z0-9._-]{1,62}$/;

function requireAdmin(principal) {
  if (!principal.admin) throw httpError(403, 'Viennit vaativat admin-oikeuden.');
}

// Projektirajattu ylläpitäjä saa viedä vain sallittuja projekteja.
function allowExportArgs(loaded, principal, action, args) {
  if (!principal.projects && !principal.sources) return;
  let projects = [];
  if (action === 'plan' || action === 'create') {
    const index = args.findIndex((value) => value === '--project' || value.startsWith('--project='));
    const value = index === -1 ? '' : args[index].startsWith('--project=') ? args[index].slice(10) : args[index + 1] || '';
    projects = value.split(',').map((item) => item.trim()).filter(Boolean);
  } else if (['recreate', 'remove'].includes(action) && SAFE_EXPORT.test(String(args[2] || ''))) {
    try { projects = readExport(loaded, args[2]).manifest.projects.map((project) => project.project_id); } catch { return; }
  }
  const denied = principal.projects ? projects.filter((projectId) => !principal.projects.includes(projectId)) : [];
  if (denied.length) throw httpError(403, `Käyttöoikeus projektiin puuttuu: ${denied.join(', ')}`);
  if ((action === 'plan' || action === 'create') && (args.includes('--include-sources') || args.some((value) => value === '--source' || value.startsWith('--source=')))) {
    const index = args.findIndex((value) => value === '--source' || value.startsWith('--source='));
    const listed = index === -1 ? [] : (args[index].startsWith('--source=') ? args[index].slice(9) : args[index + 1] || '').split(',').map((item) => item.trim()).filter(Boolean);
    const channelIndex = args.indexOf('--channel');
    const channelId = channelIndex === -1 ? loaded.config.service.default_channel : args[channelIndex + 1];
    let candidates = listed;
    if (!listed.length) {
      try { candidates = selectedExportSources(loaded, { include_sources: true, channel_id: channelId, projects }); } catch { candidates = []; }
    }
    const blocked = candidates.filter((sourceId) => {
      const source = (loaded.config.sources || []).find((item) => item.source_id === sourceId);
      return !source || !sourceAllowed(principal, source);
    });
    if (blocked.length) throw httpError(403, `Käyttöoikeus lähteeseen puuttuu: ${blocked.join(', ')}`);
  }
}

function exportVisible(principal, record) {
  if (!principal.projects) return true;
  return record.manifest.projects.every((project) => principal.projects.includes(project.project_id));
}

const GUIDES = ['README.md', 'tyokalut/mcp/README.md'];

function guideList() {
  const root = packageRoot();
  const docs = path.join(root, 'tyokalut', 'mcp', 'docs');
  const metodi = path.join(root, 'metodi');
  const list = (dir, prefix) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort().map((name) => `${prefix}${name}`) : []);
  return [...GUIDES, ...list(docs, 'tyokalut/mcp/docs/'), ...list(metodi, 'metodi/')];
}

function readGuide(name) {
  const guides = guideList();
  if (!name) return { guides };
  if (!guides.includes(name)) throw httpError(404, `Ohjetta ei ole: ${name}`);
  return { guides, name, content: fs.readFileSync(path.join(packageRoot(), ...name.split('/')), 'utf8') };
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
          sources: (bundle.sources || []).map((item) => ({ source_id: item.source_id, digest: item.digest, document_count: item.document_count })),
        };
      } catch { /* ei julkaistu */ }
      return { channel_id: channel.channel_id, project_refs: channel.project_refs || {}, sources: channel.sources || [], published };
    });
  const http = loaded.config.runtime?.http || {};
  const mcpUrl = `http://${options.host}:${options.port}${options.mcpPath}`;
  return {
    instance_id: loaded.config.service.instance_id,
    default_channel: loaded.config.service.default_channel,
    projects,
    channels,
    sources: (loaded.config.sources || []).filter((source) => sourceAllowed(principal, source)).map((source) => source.source_id),
    refresh: refreshSettings(loaded),
    connection: {
      mcp_url: mcpUrl,
      ui_url: `http://${options.host}:${options.port}${options.path}/`,
      auth_mode: authMode(loaded),
      tunnel: tunnelCommands(loaded, { running: { host: options.host, port: options.port, path: options.mcpPath } }),
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

// Käyttöliittymän käyttäjä välitetään komennolle (esim. viennin tekijä).
function runCli(loaded, args, stdin, principal) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args, '--config', loaded.filename, '--profile', loaded.profile], {
      cwd: loaded.root,
      stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', ...(principal ? { VNETCON_UI_PRINCIPAL: principal.id } : {}) },
    });
    if (stdin !== undefined) child.stdin.end(stdin);
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

