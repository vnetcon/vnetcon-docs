import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  defaultConfig,
  defaultLocalProfile,
  defaultServerProfile,
  getChannel,
  getProject,
  loadConfig,
  saveBase,
  saveProfile,
  validateConfig,
  writeYaml,
} from './config.mjs';
import {
  accessFromFlags,
  addBasicUser,
  authConfig,
  createBearerToken,
  createWebhookToken,
  readAuthSecrets,
  removeBasicUser,
  revokeBearerToken,
  revokeWebhookToken,
} from './auth.mjs';
import { UserError } from './errors.mjs';
import { inspectRepository, resolveRef, revisionKey, separateDocs } from './git.mjs';
import { serveStdio } from './mcp-server.mjs';
import { isLoopback, serveHttp } from './http-server.mjs';
import { calculateDocumentationRevision, loadChannel, publishChannel } from './publisher.mjs';
import {
  detectChanges,
  enqueueRefresh,
  listRefreshJobs,
  refreshSettings,
  runRefreshJobs,
  startRefreshController,
} from './refresh.mjs';
import { fetchDocument, listProjects, searchProject } from './search.mjs';
import {
  approveWorkspace,
  bootstrapProject,
  packageRoot,
  readWorkspaceState,
  stateFilename,
} from './workspace.mjs';
import {
  ensureDirectory,
  listFilesRecursive,
  parseArgs,
  readJson,
  requireFlag,
  run,
  safeChannelId,
  safeProjectId,
  writeFileAtomic,
} from './util.mjs';

const THIS_PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function out(value = '') {
  process.stdout.write(`${value}\n`);
}

function info(value) {
  process.stderr.write(`${value}\n`);
}

export async function main(argv) {
  try {
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    if (nodeMajor < 18) throw new UserError(`Node.js 18 tai uudempi vaaditaan (nykyinen ${process.version}).`);
    await dispatch(argv);
  } catch (error) {
    if (error instanceof UserError) {
      process.stderr.write(`Virhe: ${error.message}\n`);
      process.exitCode = error.exitCode;
      return;
    }
    throw error;
  }
}

async function dispatch(argv) {
  const command = argv[0] || 'help';
  const rest = argv.slice(1);
  if (command === 'help' || command === '--help' || command === '-h') return help();
  if (command === 'init') return initCommand(rest);

  const { flags } = parseArgs(rest);
  const loaded = loadConfig({ explicit: flags.config || '', profile: flags.profile || 'local' });
  switch (command) {
    case 'discover': return discoverCommand(rest, loaded);
    case 'inspect-project': return inspectProjectCommand(rest, loaded);
    case 'add-project': return addProjectCommand(rest, loaded);
    case 'remove-project': return removeProjectCommand(rest, loaded);
    case 'project': return projectCommand(rest, loaded);
    case 'channel': return channelCommand(rest, loaded);
    case 'config': return configCommand(rest, loaded);
    case 'doctor': return doctorCommand(rest, loaded);
    case 'plan': return planCommand(rest, loaded);
    case 'bootstrap': return bootstrapCommand(rest, loaded, command);
    case 'refresh': return refreshCommand(rest, loaded);
    case 'document': return documentCommand(rest, loaded);
    case 'review': return reviewCommand(rest, loaded);
    case 'approve': return approveCommand(rest, loaded);
    case 'publish': return publishCommand(rest, loaded);
    case 'status': return statusCommand(loaded);
    case 'server': return serverCommand(rest, loaded);
    case 'auth': return authCommand(rest, loaded);
    case 'tunnel': return tunnelCommand(rest, loaded);
    case 'serve': return serveCommand(rest, loaded);
    case 'ui': return uiCommand(rest, loaded);
    case 'smoke-test': return smokeTestCommand(rest, loaded);
    case 'pilot': return pilotCommand(rest, loaded);
    default: throw new UserError(`Tuntematon komento: ${command}. Aja multiproject-mcp help.`);
  }
}

function help() {
  out(`multiproject-mcp — paikallinen moniprojektidokumentaation julkaisu ja MCP

Käyttö:
  multiproject-mcp init [<hakemisto>] [--emoprojekti | --ilman-emoprojektia]
  multiproject-mcp discover --root <hakemisto>
  multiproject-mcp inspect-project --path <repo>
  multiproject-mcp add-project --id <id> --path <repo> --refs main,development --docs-mode <managed|repository>
  multiproject-mcp add-project --id <id> --path <repo> --refs main --docs-mode separate --docs-repo <polku|url> [--docs-ref <ref>]
  multiproject-mcp channel create <id>
  multiproject-mcp channel set-ref <kanava> <projekti> <ref>
  multiproject-mcp config validate
  multiproject-mcp doctor
  multiproject-mcp plan refresh --all
  multiproject-mcp bootstrap --all
  multiproject-mcp refresh detect --all
  multiproject-mcp refresh run [--now]
  multiproject-mcp refresh configure-poll --interval 300 --debounce 900
  multiproject-mcp refresh configure-webhook --debounce 300
  multiproject-mcp document --project <id> --ref <ref> [--module <moduuli>]
  multiproject-mcp review --project <id> --ref <ref>
  multiproject-mcp approve --project <id> --ref <ref> [--revision <sha>]
  multiproject-mcp publish --channel <id>
  multiproject-mcp server configure-http --listen 127.0.0.1:8793 [--channel <id>]
  multiproject-mcp server set-transport <stdio|http>
  multiproject-mcp server status
  multiproject-mcp auth set-mode <none|bearer|basic|oidc>
  multiproject-mcp auth configure-oidc --issuer <url> --audience <arvo> --resource <https-url>
  multiproject-mcp auth oidc-rule add --name <nimi> --claim <claim> --values <arvo,...> [--admin]
  multiproject-mcp auth status
  multiproject-mcp auth token create --name <nimi> [--channels <id,...>] [--projects <id,...>] [--admin]
  multiproject-mcp auth token list|revoke ...
  multiproject-mcp auth user add --username <nimi> [--password-stdin] [--admin]
  multiproject-mcp auth user list|remove ...
  multiproject-mcp tunnel prepare openai [--profile <nimi>] [--tunnel-id <id>]
  multiproject-mcp serve [--transport <stdio|http>] [--channel <id>]
  multiproject-mcp ui [--listen <host:port>]     HTTP-palvelin ja hallintakäyttöliittymä (/ui)
  multiproject-mcp smoke-test --channel <id>`);
}

async function initCommand(argv) {
  const { positional, flags } = parseArgs(argv);
  // Oletuksena työtila on vnetcon-docs-hakemiston sisällä, jolloin sen
  // konfiguraation voi versioida emoprojektin mukana.
  const root = path.resolve(positional[0] || path.join(packageRoot(), 'mcp-tyotila'));
  ensureDirectory(root);
  const configFile = path.join(root, 'multiproject-mcp.yaml');
  if (fs.existsSync(configFile)) throw new UserError(`Työtila on jo alustettu: ${configFile}`);
  const instanceId = path.basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'documentation';
  writeYaml(configFile, defaultConfig(instanceId));
  writeYaml(path.join(root, 'multiproject-mcp.local.yaml'), defaultLocalProfile());
  writeYaml(path.join(root, 'multiproject-mcp.server.example.yaml'), defaultServerProfile());
  ensureDirectory(path.join(root, 'interfaces'));
  createSharedGuidance(root);
  ensureDirectory(path.join(root, '.multiproject'));
  writeFileAtomic(path.join(root, '.gitignore'), '.multiproject/\nmultiproject-mcp.server.yaml\n');
  createLaunchers(root);
  out(`Alustettiin moniprojektityötila: ${root}`);

  const parent = detectParentProject();
  if (parent?.ignored && !parent.docsRepository) {
    // MCP julkaisee vain commitoidun dokumentaation. Gitin ulkopuolella olevaa
    // vnetcon-docsia ilman omaa repoa ei voi julkaista, ja rikkinäinen projekti
    // kaataisi bootstrapin.
    info(`Emoprojektia ${parent.name} ei lisätty: ${parent.docsDirectory}/ on gitin ulkopuolella `
      + '(.gitignore tai .git/info/exclude) eikä sillä ole omaa git-repoa, ja MCP julkaisee vain commitoidun dokumentaation.');
    info(`Luo ${parent.docsDirectory}-hakemistolle oma paikallinen repo ja lisää emoprojekti (aja ${parent.docsDirectory}-hakemistossa):`);
    info('  git init -b main && git add -A && git commit -m "vnetcon-docs"');
    info(`  vnetcon-ai mcp add-project --id <tunnus> --path .. --refs <haara> --docs-mode separate --docs-repo .`);
    out('Projekteja ei lisätty. Lisää ne komennolla add-project.');
  } else if (parent && await confirmParentProject(parent, flags, !positional[0])) {
    addParentProject(root, parent);
  } else {
    out('Projekteja ei lisätty. Lisää ne komennolla add-project.');
  }
  out(`Seuraavaksi: cd "${root}" && ${process.platform === 'win32' ? 'multiproject-mcp.cmd' : './multiproject-mcp'} doctor`);
}

// Yhteinen ohjaus ja sanasto kaikille työtilan projekteille. MCP tarjoaa ne
// get_shared_guidance-työkalulla, ja dokumentoivat agentit lukevat ne ennen kirjoittamista.
function createSharedGuidance(root) {
  const directory = path.join(root, 'yhteiset');
  ensureDirectory(directory);
  const files = {
    'ohjaus.md': '# Yhteinen ohjaus\n\nKaikkia tämän työtilan projekteja koskevat korjatut oletukset ja periaatteet.\n'
      + 'Muoto on sama kuin projektin `metodi/ohjaus.md`:ssä; tunnisteet `Y-001`, `Y-002` …\n\n_Ei merkintöjä._\n',
    'sanasto.md': '# Yhteinen sanasto\n\nKäsitteet, jotka esiintyvät useassa järjestelmässä. Kirjaa, mitä termi tarkoittaa\n'
      + 'kussakin järjestelmässä, jos merkitys eroaa. Sama nimi ei tarkoita samaa käsitettä.\n\n'
      + '| Termi | Merkitys | Järjestelmät | Huom |\n|---|---|---|---|\n',
  };
  for (const [name, content] of Object.entries(files)) {
    const filename = path.join(directory, name);
    if (!fs.existsSync(filename)) writeFileAtomic(filename, content);
  }
}

// Emoprojekti = Git-repository, jonka juureen tämä vnetcon-docs on asennettu.
// Lähderepon dist/-hakemistolla ei ole asennusversiota, joten sitä ei tarjota.
function detectParentProject() {
  const docsRoot = packageRoot();
  if (!fs.existsSync(path.join(docsRoot, '.vnetcon-docs-versio'))) return null;
  const projectRoot = path.dirname(docsRoot);
  let topLevel = '';
  try {
    topLevel = run('git', ['-C', projectRoot, 'rev-parse', '--show-toplevel']);
  } catch {
    return null;
  }
  if (!topLevel || fs.realpathSync(topLevel) !== fs.realpathSync(projectRoot)) return null;
  const docsDirectory = path.basename(docsRoot);
  const ignored = runOptional(() => run('git', ['-C', projectRoot, 'check-ignore', docsDirectory])) !== '';
  // vnetcon-docsilla voi olla oma paikallinen repo (yleensä emoprojektin gitin ulkopuolella).
  const docsTop = runOptional(() => run('git', ['-C', docsRoot, 'rev-parse', '--show-toplevel']));
  const docsRepository = Boolean(docsTop) && fs.realpathSync(docsTop) === fs.realpathSync(docsRoot);
  return { root: projectRoot, name: path.basename(projectRoot), docsRoot, docsDirectory, ignored, docsRepository };
}

// Oletussijainnin työtila (vnetcon-docs/mcp-tyotila) kuuluu emoprojektille, joten
// se lisätään myös ilman päätettä. Muualle luotuun työtilaan emoprojekti lisätään
// ilman päätettä vain pyydettäessä, jotta skriptit eivät saa yllättävää projektia.
async function confirmParentProject(parent, flags, defaultLocation) {
  if (flags['ilman-emoprojektia']) return false;
  if (flags.emoprojekti) return true;
  if (!process.stdin.isTTY) return defaultLocation;
  const { createInterface } = await import('node:readline/promises');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const model = parent.docsRepository ? ` (dokumentaatio ${parent.docsDirectory}-hakemiston omasta reposta)` : '';
    const answer = (await prompt.question(`Lisätäänkö emoprojekti ${parent.name} (${parent.root})${model} ensimmäiseksi projektiksi? [K/e] `))
      .trim().toLowerCase();
    return answer === '' || ['k', 'kyllä', 'y', 'yes'].includes(answer);
  } finally {
    prompt.close();
  }
}

function addParentProject(root, parent) {
  const loaded = loadConfig({ explicit: path.join(root, 'multiproject-mcp.yaml') });
  const ref = inspectRepository(parent.root).defaultRef;
  const candidate = parent.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 63);
  const projectId = /^[a-z0-9][a-z0-9._-]{1,62}$/.test(candidate) ? candidate : 'emoprojekti';
  if (parent.docsRepository && !parent.ignored) {
    info(`Vihje: ${parent.docsDirectory}/ on oma repo, mutta emoprojekti ei jätä sitä huomiotta. `
      + `Lisää emoprojektin juuressa rivi /${parent.docsDirectory}/ tiedostoon .git/info/exclude.`);
  }
  if (parent.docsRepository) {
    // vnetcon-docs on oma paikallinen repo, jota ei pushata emoprojektin mukana.
    addProjectCommand(['--id', projectId, '--path', parent.root, '--refs', ref, '--docs-mode', 'separate',
      '--docs-repo', parent.docsRoot, '--name', parent.name], loaded);
  } else {
    addProjectCommand(['--id', projectId, '--path', parent.root, '--refs', ref, '--docs-mode', 'repository',
      '--docs-path', parent.docsDirectory, '--name', parent.name], loaded);
  }
  channelCommand(['create', 'local'], loaded);
  channelCommand(['set-ref', 'local', projectId, ref], loaded);
  const committed = parent.docsRepository
    ? runOptional(() => run('git', ['-C', parent.docsRoot, 'rev-parse', '--verify', 'HEAD']))
    : runOptional(() => run('git', ['-C', parent.root, 'ls-tree', '--name-only', ref, '--', parent.docsDirectory]));
  if (!committed) {
    info(`Huom: ${parent.docsDirectory}/ ei ole vielä commitoituna${parent.docsRepository ? ' omaan repoonsa' : ` haaraan ${ref}`}. `
      + 'MCP julkaisee vain commitoidun dokumentaation, joten commitoi se ennen bootstrap-komentoa.');
  }
}

function runOptional(fn) {
  try {
    return fn();
  } catch {
    return '';
  }
}

// Käynnistimet osoittavat suhteellisella polulla tämän paketin bin-tiedostoon, jotta
// työtilan voi versioida emoprojektin mukana ja kloonata toiselle koneelle.
function createLaunchers(root) {
  const entry = path.join(THIS_PACKAGE, 'bin', 'multiproject-mcp.mjs');
  const relative = path.relative(root, entry);
  const posix = relative.split(path.sep).join('/');
  const windows = relative.split(path.sep).join('\\');
  const sh = '#!/usr/bin/env sh\n'
    + 'MULTIPROJECT_MCP_CONFIG="$(dirname -- "$0")/multiproject-mcp.yaml"; export MULTIPROJECT_MCP_CONFIG\n'
    + `exec node "$(dirname -- "$0")"/${shellQuote(posix)} "$@"\n`;
  writeFileAtomic(path.join(root, 'multiproject-mcp'), sh, { mode: 0o755 });
  try { fs.chmodSync(path.join(root, 'multiproject-mcp'), 0o755); } catch { /* Windows */ }
  writeFileAtomic(path.join(root, 'multiproject-mcp.cmd'),
    `@echo off\r\nsetlocal\r\nset "MULTIPROJECT_MCP_CONFIG=%~dp0multiproject-mcp.yaml"\r\nnode "%~dp0${windows}" %*\r\n`);
}

function discoverCommand(argv) {
  const { flags } = parseArgs(argv);
  const root = path.resolve(requireFlag(flags, 'root'));
  const candidates = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name);
    try {
      const inspection = inspectRepository(candidate);
      candidates.push({ path: candidate, ...inspection });
    } catch { /* ei git-repo */ }
  }
  out(YAML.stringify({ projects: candidates }, { lineWidth: 100 }));
}

function inspectProjectCommand(argv) {
  const { flags } = parseArgs(argv);
  const inspection = inspectRepository(requireFlag(flags, 'path'));
  const ref = flags.ref || inspection.defaultRef;
  const hasDocs = fs.existsSync(path.join(inspection.root, 'vnetcon-docs'));
  out(YAML.stringify({ ...inspection, inspected_ref: ref, vnetcon_docs_in_worktree: hasDocs,
    suggested_mode: hasDocs ? 'repository' : 'managed' }, { lineWidth: 100 }));
}

function addProjectCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const projectId = safeProjectId(requireFlag(flags, 'id'));
  if (loaded.base.projects.some((item) => item.project_id === projectId)) {
    throw new UserError(`Projekti on jo olemassa: ${projectId}`);
  }
  const mode = requireFlag(flags, 'docs-mode');
  if (!['managed', 'repository', 'separate'].includes(mode)) {
    throw new UserError('--docs-mode pitää olla managed, repository tai separate.');
  }
  const refs = String(requireFlag(flags, 'refs')).split(',').map((value) => value.trim()).filter(Boolean);
  if (!refs.length) throw new UserError('--refs on tyhjä.');
  const repository = {};
  let displayName = flags.name || projectId;
  if (flags.path) {
    const absolute = path.resolve(String(flags.path));
    const inspection = inspectRepository(absolute);
    repository.path = relativePortable(loaded.root, absolute);
    if (inspection.remote) repository.url = inspection.remote;
    displayName = flags.name || path.basename(absolute);
  } else if (flags.url) {
    repository.url = String(flags.url);
  } else {
    throw new UserError('--path tai --url puuttuu.');
  }
  let documentation;
  if (mode === 'repository') {
    documentation = { mode, source_path: flags['docs-path'] || 'vnetcon-docs' };
  } else if (mode === 'separate') {
    // Dokumentaatio omassa repositoryssaan, esim. vnetcon-docsin paikallinen repo.
    const docsRepo = requireFlag(flags, 'docs-repo');
    const docsRepository = {};
    let defaultRef = flags['docs-ref'] ? String(flags['docs-ref']) : '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(String(docsRepo)) || String(docsRepo).includes('@')) {
      docsRepository.url = String(docsRepo);
    } else {
      const absolute = path.resolve(String(docsRepo));
      const inspection = inspectRepository(absolute);
      docsRepository.path = relativePortable(loaded.root, absolute);
      defaultRef = defaultRef || inspection.defaultRef;
    }
    documentation = { mode, repository: docsRepository, source_path: flags['docs-path'] || '.' };
    if (defaultRef) documentation.default_ref = defaultRef;
  } else {
    documentation = { mode, workspace_template: 'default' };
  }
  loaded.base.projects.push({
    project_id: projectId,
    display_name: displayName,
    repository,
    refs: { default: refs[0], include: refs },
    documentation,
    authorization_domain: 'default',
  });
  saveBase(loaded);
  out(`Lisättiin projekti ${projectId} (${mode}), refit: ${refs.join(', ')}`);
}

function removeProjectCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const projectId = positional[0];
  if (!projectId) throw new UserError('Käyttö: remove-project <id> --plan');
  getProject(loaded.base, projectId);
  if (!flags.confirm) {
    out(`Suunnitelma: poistetaan ${projectId} konfiguraatiosta. Työtiloja tai julkaisuja ei poisteta.`);
    out('Suorita --confirm vahvistaaksesi.');
    return;
  }
  loaded.base.projects = loaded.base.projects.filter((item) => item.project_id !== projectId);
  for (const channel of loaded.base.channels) delete channel.project_refs?.[projectId];
  saveBase(loaded);
  out(`Poistettiin projekti konfiguraatiosta: ${projectId}`);
}

function projectCommand(argv, loaded) {
  const { positional } = parseArgs(argv);
  const action = positional[0];
  const projectId = positional[1];
  const project = getProject(loaded.base, projectId);
  if (action === 'set-refs') {
    const refs = positional.slice(2);
    if (!refs.length) throw new UserError('Anna vähintään yksi refi.');
    project.refs = { default: refs[0], include: refs };
  } else if (action === 'set-docs-mode') {
    const mode = positional[2];
    if (!['managed', 'repository'].includes(mode)) throw new UserError('Tila on managed tai repository.');
    project.documentation = mode === 'managed'
      ? { mode, workspace_template: 'default' }
      : { mode, source_path: 'vnetcon-docs' };
  } else {
    throw new UserError('Käyttö: project set-refs <id> <ref...> | project set-docs-mode <id> <tila>');
  }
  saveBase(loaded);
  out(`Päivitettiin projekti ${projectId}.`);
}

function channelCommand(argv, loaded) {
  const { positional } = parseArgs(argv);
  const action = positional[0];
  if (action === 'create') {
    const id = positional[1] ? safeChannelId(positional[1]) : '';
    if (!id) throw new UserError('Käyttö: channel create <id>');
    if (loaded.base.channels.some((item) => item.channel_id === id)) throw new UserError(`Kanava on jo olemassa: ${id}`);
    loaded.base.channels.push({ channel_id: id, update_policy: 'manual_promotion', project_refs: {} });
    if (loaded.base.channels.length === 1) loaded.base.service.default_channel = id;
    saveBase(loaded);
    out(`Luotiin kanava ${id}.`);
    return;
  }
  if (action === 'set-ref') {
    const [channelId, projectId, ref] = positional.slice(1);
    if (!channelId || !projectId || !ref) throw new UserError('Käyttö: channel set-ref <kanava> <projekti> <ref>');
    const channel = getChannel(loaded.base, channelId);
    const project = getProject(loaded.base, projectId);
    if (!refAllowed(project, ref)) throw new UserError(`${projectId}: ref ${ref} ei kuulu refs.include-sääntöihin.`);
    channel.project_refs = channel.project_refs || {};
    channel.project_refs[projectId] = ref;
    saveBase(loaded);
    out(`${channelId}: ${projectId}@${ref}`);
    return;
  }
  if (action === 'show') {
    const channel = getChannel(loaded.config, positional[1]);
    const result = { ...channel, resolved: {} };
    for (const [projectId, ref] of Object.entries(channel.project_refs || {})) {
      result.resolved[projectId] = { ref, source_commit_sha: resolveRef(getProject(loaded.config, projectId), ref, loaded) };
    }
    out(YAML.stringify(result, { lineWidth: 100 }));
    return;
  }
  throw new UserError('Käyttö: channel create|set-ref|show ...');
}

function configCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  if (positional[0] === 'validate') {
    validateConfig(loaded.config);
    out(`OK: ${loaded.filename} (profile=${loaded.profile})`);
  } else if (positional[0] === 'show') {
    out(YAML.stringify(flags.effective ? loaded.config : loaded.base, { lineWidth: 100 }));
  } else {
    throw new UserError('Käyttö: config validate | config show [--effective]');
  }
}

function doctorCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const selected = flags.project ? [getProject(loaded.config, String(flags.project))] : loaded.config.projects;
  let failures = 0;
  out(`Node ${process.version}`);
  try { out(`Git ${run('git', ['--version'])}`); } catch (error) { failures += 1; out(`VIRHE ${error.message}`); }
  out(`Konfiguraatio OK: ${loaded.filename}`);
  if (!selected.length) out('VAROITUS Projekteja ei ole lisätty.');
  for (const project of selected) {
    const refs = flags.ref ? [String(flags.ref)] : concreteRefs(project);
    for (const ref of refs) {
      try {
        const sha = resolveRef(project, ref, loaded);
        const docs = separateDocs(project, ref);
        const docsInfo = docs ? ` docs@${docs.ref} ${resolveRef(docs.project, docs.ref, loaded).slice(0, 12)}` : '';
        out(`OK ${project.project_id}@${ref} ${sha.slice(0, 12)}${docsInfo} (${project.documentation.mode})`);
      } catch (error) {
        failures += 1;
        out(`VIRHE ${project.project_id}@${ref}: ${error.message}`);
      }
    }
  }
  const refresh = refreshSettings(loaded);
  out(`Refresh mode=${refresh.mode} debounce=${refresh.debounce_seconds}s auto_apply=${refresh.auto_apply}`);
  if (refresh.mode === 'webhook' && (readAuthSecrets(loaded).webhook_tokens || []).length === 0) {
    failures += 1;
    out('VIRHE Webhook-tila on käytössä, mutta webhook-tokenia ei ole.');
  }
  if (refresh.mode === 'poll') {
    for (const project of selected.filter((item) => item.repository?.path)) {
      out(`VAROITUS ${project.project_id}: repository.path seuraa paikallista repositorya; palvelinkäytössä repository.url on suositeltu.`);
    }
  }
  if (flags.http || loaded.config.runtime?.transport === 'http') {
    const http = loaded.config.runtime?.http;
    if (!http) {
      failures += 1;
      out('VIRHE HTTP-transportilta puuttuu runtime.http-konfiguraatio.');
    } else {
      const mode = http.authentication?.mode || 'none';
      out(`HTTP http://${http.host || '127.0.0.1'}:${http.port || 8793}${http.path || '/mcp'} auth=${mode}`);
      if (!isLoopback(http.host || '127.0.0.1') && mode === 'none' && !http.authentication?.allow_unauthenticated_network) {
        failures += 1;
        out('VIRHE Ei-loopback HTTP ilman autentikointia ja tietoista sallintaa.');
      }
      if (!isLoopback(http.host || '127.0.0.1') && !(http.allowed_hosts || []).length) {
        out('VAROITUS HTTP allowed_hosts puuttuu; määritä sisäiset DNS-nimet DNS rebinding -suojaksi.');
      }
      const secrets = readAuthSecrets(loaded);
      if (mode === 'bearer' && secrets.bearer_tokens.length === 0) {
        failures += 1;
        out('VIRHE Bearer-autentikointi on käytössä, mutta tokeneita ei ole.');
      }
      if (mode === 'basic' && secrets.basic_users.length === 0) {
        failures += 1;
        out('VIRHE Basic-autentikointi on käytössä, mutta käyttäjiä ei ole.');
      }
      if (mode === 'oidc') {
        const oidc = http.authentication?.oidc || {};
        if (!oidc.issuer || !oidc.audience || !oidc.resource) {
          failures += 1;
          out('VIRHE OIDC vaatii issuer-, audience- ja resource-arvot.');
        } else {
          out(`OK OIDC issuer=${oidc.issuer} audience=${oidc.audience}`);
        }
      }
      if (mode === 'none') out('VAROITUS HTTP-palvelin ei tunnista käyttäjiä.');
    }
  }
  if (failures) throw new UserError(`doctor löysi ${failures} virhettä.`);
}

function planCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  if (positional[0] !== 'refresh') throw new UserError('MVP tukee komentoa: plan refresh --all');
  for (const { project, ref } of selectTargets(flags, loaded)) {
    const key = revisionKey(project, ref, loaded);
    const state = readWorkspaceState(loaded, project.project_id, ref);
    const action = !state ? 'bootstrap' : (state.revision_key || state.source_commit_sha) === key ? 'no-change' : 'refresh';
    out(`${action.padEnd(10)} ${project.project_id}@${ref} ${key.split('+').map((sha) => sha.slice(0, 12)).join('+')}`);
  }
}

function bootstrapCommand(argv, loaded, command) {
  const { flags } = parseArgs(argv);
  for (const { project, ref } of selectTargets(flags, loaded)) {
    const state = bootstrapProject(project, ref, loaded);
    out(`${command}: ${project.project_id}@${ref} ${state.source_commit_sha.slice(0, 12)} status=${state.status}`);
  }
}

async function refreshCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  if (!action || action.startsWith('--')) return bootstrapCommand(argv, loaded, 'refresh');
  if (action === 'detect') {
    const results = detectChanges(loaded, selectTargets(flags, loaded));
    for (const item of results) out(`${item.status.padEnd(10)} ${item.project_id}@${item.ref} ${item.source_commit_sha.slice(0, 12)}`);
    return;
  }
  if (action === 'queue') {
    out(YAML.stringify({ settings: refreshSettings(loaded), jobs: listRefreshJobs(loaded, { activeOnly: Boolean(flags.active) }) }, { lineWidth: 120 }));
    return;
  }
  if (action === 'run') {
    const results = runRefreshJobs(loaded, { dueOnly: !flags.now });
    if (!results.length) return out('Ei ajettavia refresh-töitä.');
    for (const item of results) out(`${item.status.padEnd(10)} ${item.project_id}@${item.ref}${item.error ? `: ${item.error}` : ''}`);
    if (results.some((item) => item.status === 'failed')) throw new UserError('Yksi tai useampi refresh-työ epäonnistui.');
    return;
  }
  if (action === 'notify') {
    const projectId = requireFlag(flags, 'project');
    const ref = requireFlag(flags, 'ref');
    const job = enqueueRefresh(loaded, projectId, ref, {
      sourceCommitSha: flags.sha ? String(flags.sha) : undefined,
      trigger: 'manual-notify',
    });
    out(`pending ${job.project_id}@${job.ref} job=${job.job_id} not_before=${job.not_before}`);
    return;
  }
  if (action === 'configure-poll') {
    loaded.profileConfig.refresh = {
      ...(loaded.profileConfig.refresh || {}),
      mode: 'poll',
      poll_interval_seconds: positiveInteger(flags.interval || 300, '--interval'),
      debounce_seconds: nonNegativeInteger(flags.debounce || 300, '--debounce'),
      auto_apply: !flags['detect-only'],
    };
    saveProfile(loaded);
    out(`Poll konfiguroitu: interval=${loaded.profileConfig.refresh.poll_interval_seconds}s debounce=${loaded.profileConfig.refresh.debounce_seconds}s auto_apply=${loaded.profileConfig.refresh.auto_apply}`);
    return;
  }
  if (action === 'configure-webhook') {
    loaded.profileConfig.refresh = {
      ...(loaded.profileConfig.refresh || {}),
      mode: 'webhook',
      debounce_seconds: nonNegativeInteger(flags.debounce || 300, '--debounce'),
      auto_apply: flags['detect-only'] ? false : true,
    };
    saveProfile(loaded);
    out(`Webhook konfiguroitu: POST /hooks/git, debounce=${loaded.profileConfig.refresh.debounce_seconds}s`);
    return;
  }
  if (action === 'set-manual') {
    loaded.profileConfig.refresh = { ...(loaded.profileConfig.refresh || {}), mode: 'manual' };
    saveProfile(loaded);
    out('Refresh-tila: manual');
    return;
  }
  if (action === 'webhook-token' && positional[1] === 'create') {
    const name = requireFlag(flags, 'name');
    const projects = flags.projects ? csvFlag(flags.projects) : undefined;
    for (const projectId of projects || []) getProject(loaded.config, projectId);
    const token = createWebhookToken(loaded, name, projects);
    out(`Webhook-token luotiin: ${name}`);
    out('Kopioi token nyt; arvoa ei näytetä uudelleen:');
    out(token);
    return;
  }
  if (action === 'webhook-token' && positional[1] === 'list') {
    const tokens = readAuthSecrets(loaded).webhook_tokens || [];
    out(YAML.stringify(tokens.map(({ name, created_at, projects }) => ({ name, created_at, projects }))));
    return;
  }
  if (action === 'webhook-token' && positional[1] === 'revoke') {
    revokeWebhookToken(loaded, positional[2] || requireFlag(flags, 'name'));
    out('Webhook-token poistettiin.');
    return;
  }
  if (action === 'watch') {
    if (refreshSettings(loaded).mode !== 'poll') throw new UserError('refresh watch vaatii refresh.mode=poll; aja ensin refresh configure-poll.');
    const controller = startRefreshController(loaded, { onError: (error) => info(`Refresh-virhe: ${error.message}`) });
    info('Refresh-pollaus käynnissä. Keskeytä Ctrl-C:llä.');
    await new Promise((resolve) => {
      const stop = () => { controller.stop(); resolve(); };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return;
  }
  throw new UserError('Käyttö: refresh detect|queue|run|notify|configure-poll|configure-webhook|set-manual|webhook-token|watch ...');
}

function documentCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const projectId = requireFlag(flags, 'project');
  const ref = requireFlag(flags, 'ref');
  const state = readWorkspaceState(loaded, projectId, ref);
  if (!state) throw new UserError(`Työtilaa ei ole: ${projectId}@${ref}. Aja bootstrap.`);
  if (state.documentation_mode === 'repository') {
    throw new UserError('Repository-mallissa document ei kirjoita lähderepositoryyn. Tee muutos projektin normaalissa Git-työnkulussa.');
  }
  if (state.documentation_mode === 'separate') {
    throw new UserError('Separate-mallissa dokumentoi omassa vnetcon-docs-hakemistossa ja commitoi sen omaan repositoryyn.');
  }
  const projectState = path.join(state.docs_root, 'tila', 'projekti.yaml');
  const uninitialised = !fs.existsSync(projectState) || fs.readFileSync(projectState, 'utf8').includes('TÄYTTÄMÄTÖN');
  const cli = path.join(state.docs_root, 'tyokalut', 'vnetcon-ai', 'vnetcon-ai.mjs');
  if (uninitialised) {
    info(`Käynnistetään /vnetcon-init työtilalle ${projectId}@${ref}.`);
    runInteractive(process.execPath, [cli, 'claude', '/vnetcon-init'], state.docs_root);
  } else {
    const args = [cli, 'dokumentoi'];
    if (flags.module) args.push(String(flags.module));
    runInteractive(process.execPath, args, state.docs_root);
  }
  reviewCommand(['--project', projectId, '--ref', ref], loaded);
}

function reviewCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const projectId = requireFlag(flags, 'project');
  const ref = requireFlag(flags, 'ref');
  const state = readWorkspaceState(loaded, projectId, ref);
  if (!state) throw new UserError(`Työtilaa ei ole: ${projectId}@${ref}`);
  const { documents, revision } = calculateDocumentationRevision(state.docs_root);
  out(YAML.stringify({ project_id: projectId, ref, status: state.status, source_commit_sha: state.source_commit_sha,
    documentation_revision: revision, approved: state.approved_revision === revision, documents: documents.length }, { lineWidth: 100 }));
  if (state.approved_revision !== revision) out(`Hyväksy: ./multiproject-mcp approve --project ${projectId} --ref ${ref} --revision ${revision}`);
}

function approveCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const projectId = requireFlag(flags, 'project');
  const ref = requireFlag(flags, 'ref');
  const state = readWorkspaceState(loaded, projectId, ref);
  if (!state) throw new UserError(`Työtilaa ei ole: ${projectId}@${ref}`);
  const current = calculateDocumentationRevision(state.docs_root).revision;
  const revision = flags.revision ? String(flags.revision) : current;
  if (revision !== current) throw new UserError('Annettu revision ei vastaa työtilan nykyistä sisältöä.');
  approveWorkspace(loaded, projectId, ref, revision);
  out(`Hyväksyttiin ${projectId}@${ref} ${revision}`);
}

function publishCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const channel = requireFlag(flags, 'channel');
  const bundle = publishChannel(channel, loaded);
  out(`Julkaistiin ${channel}: bundle ${bundle.bundle_id}, projekteja ${bundle.projects.length}`);
}

function statusCommand(loaded) {
  const root = path.join(loaded.root, '.multiproject', 'state');
  const files = listFilesRecursive(root, (file) => file.endsWith('.json'));
  if (!files.length) return out('Työtiloja ei ole alustettu.');
  for (const filename of files) {
    const state = readJson(filename);
    out(`${state.project_id}@${state.ref} ${state.source_commit_sha.slice(0, 12)} ${state.status}`);
  }
}

function serverCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  if (action === 'configure-http') {
    const listen = parseListen(String(flags.listen || '127.0.0.1:8793'));
    if (!isLoopback(listen.host) && !flags['allow-network']) {
      throw new UserError('Ei-loopback-kuuntelu vaatii tietoisen --allow-network-valitsimen.');
    }
    loaded.profileConfig.runtime = loaded.profileConfig.runtime || {};
    loaded.profileConfig.runtime.transport = 'http';
    const previous = loaded.profileConfig.runtime.http || {};
    loaded.profileConfig.runtime.http = {
      ...previous,
      host: listen.host,
      port: listen.port,
      path: flags.path ? String(flags.path) : (previous.path || '/mcp'),
      authentication: previous.authentication || { mode: 'none' },
    };
    if (flags['allowed-hosts']) {
      loaded.profileConfig.runtime.http.allowed_hosts = csvFlag(flags['allowed-hosts']);
    }
    if (flags.channel) {
      getChannel(loaded.base, String(flags.channel));
      loaded.base.service.default_channel = String(flags.channel);
      saveBase(loaded);
    }
    saveProfile(loaded);
    out(`HTTP konfiguroitu: http://${listen.host}:${listen.port}${loaded.profileConfig.runtime.http.path}`);
    if (!isLoopback(listen.host) && authConfig(loadConfig({ explicit: loaded.filename, profile: loaded.profile })).mode === 'none') {
      out('VAROITUS: ota bearer/basic käyttöön ennen serve-komentoa tai salli autentikoimaton verkko erikseen.');
    }
    return;
  }
  if (action === 'set-transport') {
    const transport = positional[1];
    if (!['stdio', 'http'].includes(transport)) throw new UserError('Transportin pitää olla stdio tai http.');
    loaded.profileConfig.runtime = loaded.profileConfig.runtime || {};
    loaded.profileConfig.runtime.transport = transport;
    saveProfile(loaded);
    out(`Transport: ${transport}`);
    return;
  }
  if (action === 'status') {
    out(YAML.stringify({ runtime: loaded.config.runtime || {}, default_channel: loaded.config.service.default_channel }, { lineWidth: 100 }));
    return;
  }
  throw new UserError('Käyttö: server configure-http|set-transport|status ...');
}

async function authCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const group = positional[0];
  const action = positional[1];
  if (group === 'set-mode') {
    const mode = positional[1];
    if (!['none', 'bearer', 'basic', 'oidc'].includes(mode)) throw new UserError('Autentikointitilan pitää olla none, bearer, basic tai oidc.');
    const http = ensureHttpProfile(loaded);
    const previousOidc = http.authentication?.oidc;
    http.authentication = { mode, ...(mode === 'oidc' && previousOidc ? { oidc: previousOidc } : {}) };
    if (mode === 'none' && flags['allow-unauthenticated-network']) {
      http.authentication.allow_unauthenticated_network = true;
    }
    if (mode === 'none' && !isLoopback(http.host || '127.0.0.1') && !flags['allow-unauthenticated-network']) {
      throw new UserError('Ei-loopback-osoitteessa none vaatii --allow-unauthenticated-network-valitsimen.');
    }
    saveProfile(loaded);
    out(`HTTP-autentikointi: ${mode}`);
    return;
  }
  if (group === 'configure-oidc') {
    const issuer = requireFlag(flags, 'issuer').replace(/\/$/, '');
    const resource = requireFlag(flags, 'resource').replace(/\/$/, '');
    validateHttpsUrl(issuer, 'issuer', flags['allow-insecure-http']);
    validateHttpsUrl(resource, 'resource', flags['allow-insecure-http']);
    const http = ensureHttpProfile(loaded);
    http.authentication = {
      mode: 'oidc',
      oidc: {
        issuer,
        audience: requireFlag(flags, 'audience'),
        resource,
        ...(flags['discovery-url'] ? { discovery_url: String(flags['discovery-url']) } : {}),
        ...(flags['jwks-uri'] ? { jwks_uri: String(flags['jwks-uri']) } : {}),
        ...(flags.scopes ? { required_scopes: csvFlag(flags.scopes) } : {}),
        ...(flags['principal-claim'] ? { principal_claim: String(flags['principal-claim']) } : {}),
        ...(flags['allow-insecure-http'] ? { allow_insecure_http: true } : {}),
      },
    };
    saveProfile(loaded);
    out(`OIDC konfiguroitu: issuer=${issuer} audience=${http.authentication.oidc.audience}`);
    out('Lisää tarvittaessa access_rules profiilin YAML-tiedostoon ja aja doctor --http.');
    return;
  }
  if (group === 'status') {
    const secrets = readAuthSecrets(loaded);
    out(YAML.stringify({
      mode: authConfig(loaded).mode || 'none',
      oidc: authConfig(loaded).mode === 'oidc' ? authConfig(loaded).oidc : undefined,
      bearer_tokens: secrets.bearer_tokens.map((item) => ({ name: item.name, channels: item.channels, projects: item.projects })),
      basic_users: secrets.basic_users.map((item) => ({ username: item.username, channels: item.channels, projects: item.projects })),
    }, { lineWidth: 100 }));
    return;
  }
  if (group === 'oidc-rule' && action === 'add') {
    requireAuthMode(loaded, 'oidc');
    const oidc = ensureOidcProfile(loaded);
    const name = requireFlag(flags, 'name');
    oidc.access_rules = oidc.access_rules || [];
    if (oidc.access_rules.some((rule) => rule.name === name)) throw new UserError(`OIDC-sääntö on jo olemassa: ${name}`);
    const access = validateAccess(accessFromFlags(flags), loaded);
    oidc.access_rules.push({
      name,
      claim: requireFlag(flags, 'claim'),
      values: csvFlag(requireFlag(flags, 'values')),
      ...access,
    });
    saveProfile(loaded);
    out(`OIDC-sääntö lisättiin: ${name}`);
    return;
  }
  if (group === 'oidc-rule' && action === 'list') {
    requireAuthMode(loaded, 'oidc');
    out(YAML.stringify(authConfig(loaded).oidc?.access_rules || []));
    return;
  }
  if (group === 'oidc-rule' && action === 'remove') {
    requireAuthMode(loaded, 'oidc');
    const name = positional[2] || requireFlag(flags, 'name');
    const oidc = ensureOidcProfile(loaded);
    const rules = oidc.access_rules || [];
    if (!rules.some((rule) => rule.name === name)) throw new UserError(`OIDC-sääntöä ei löydy: ${name}`);
    oidc.access_rules = rules.filter((rule) => rule.name !== name);
    saveProfile(loaded);
    out(`OIDC-sääntö poistettiin: ${name}`);
    return;
  }
  if (group === 'token' && action === 'create') {
    requireAuthMode(loaded, 'bearer');
    const name = requireFlag(flags, 'name');
    const access = validateAccess(accessFromFlags(flags), loaded);
    const token = createBearerToken(loaded, name, access);
    out(`Bearer-token luotiin: ${name}`);
    out('Kopioi token nyt; arvoa ei näytetä uudelleen:');
    out(token);
    return;
  }
  if (group === 'token' && action === 'revoke') {
    revokeBearerToken(loaded, positional[2] || requireFlag(flags, 'name'));
    out('Bearer-token poistettiin.');
    return;
  }
  if (group === 'token' && action === 'list') {
    const secrets = readAuthSecrets(loaded);
    out(YAML.stringify(secrets.bearer_tokens.map(({ name, created_at, channels, projects }) => ({ name, created_at, channels, projects }))));
    return;
  }
  if (group === 'user' && action === 'add') {
    requireAuthMode(loaded, 'basic');
    const username = requireFlag(flags, 'username');
    const password = flags['password-stdin'] ? fs.readFileSync(0, 'utf8').replace(/[\r\n]+$/, '') : await readSecret('Salasana: ');
    const access = validateAccess(accessFromFlags(flags), loaded);
    addBasicUser(loaded, username, password, access);
    out(`Käyttäjä lisättiin: ${username}`);
    return;
  }
  if (group === 'user' && action === 'remove') {
    removeBasicUser(loaded, positional[2] || requireFlag(flags, 'username'));
    out('Käyttäjä poistettiin.');
    return;
  }
  if (group === 'user' && action === 'list') {
    const secrets = readAuthSecrets(loaded);
    out(YAML.stringify(secrets.basic_users.map(({ username, created_at, channels, projects }) => ({ username, created_at, channels, projects }))));
    return;
  }
  throw new UserError('Käyttö: auth set-mode|configure-oidc|oidc-rule|status|token create|token revoke|token list|user add|user remove|user list ...');
}

function tunnelCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  if (positional[0] !== 'prepare' || positional[1] !== 'openai') {
    throw new UserError('Käyttö: tunnel prepare openai [--profile <nimi>] [--tunnel-id <id>]');
  }
  const http = loaded.config.runtime?.http;
  if (!http) throw new UserError('HTTP-palvelinta ei ole konfiguroitu.');
  const profile = flags.profile || 'vnetcon-docs';
  const tunnelId = flags['tunnel-id'] || '<TUNNEL_ID>';
  const host = isLoopback(http.host) ? http.host : '127.0.0.1';
  const url = `http://${host}:${http.port}${http.path || '/mcp'}`;
  out(`Paikallinen MCP URL: ${url}`);
  out('Aseta CONTROL_PLANE_API_KEY ympäristömuuttujaan ja suorita:');
  out(`tunnel-client init --profile ${profile} --tunnel-id ${tunnelId} --mcp-server-url ${url}`);
  out(`tunnel-client doctor --profile ${profile} --explain`);
  out(`tunnel-client run --profile ${profile}`);
}

async function serveCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const channel = flags.channel || loaded.config.service.default_channel;
  const transport = flags.transport || loaded.config.runtime?.transport || 'stdio';
  if (transport === 'stdio') {
    loadChannel(channel, loaded);
    return serveStdio(loaded, channel);
  }
  if (transport === 'http') return serveHttp(loaded, { channel });
  throw new UserError(`Tuntematon transport: ${transport}`);
}

// Hallintakäyttöliittymä: HTTP-palvelin, jossa /ui ja /mcp. Ilman HTTP-asetuksia
// kuunnellaan vain omaa konetta portissa 8799.
async function uiCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const http = loaded.config.runtime?.http || {};
  const listen = flags.listen ? parseListen(String(flags.listen)) : { host: http.host || '127.0.0.1', port: http.port || 8799 };
  return serveHttp(loaded, { host: listen.host, port: listen.port, channel: flags.channel });
}

function smokeTestCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const channel = requireFlag(flags, 'channel');
  const projects = listProjects(loaded, channel);
  if (!projects.length) throw new UserError('Kanavalla ei ole projekteja.');
  for (const project of projects) {
    const hits = searchProject(loaded, channel, project.project_id, project.display_name, 1);
    if (hits.some((hit) => hit.project_id !== project.project_id)) {
      throw new UserError(`Projektieristys rikkoutui haussa: ${project.project_id}`);
    }
  }
  out(`OK: ${channel}, bundle ${loadChannel(channel, loaded).bundle_id}, projekteja ${projects.length}`);
}

function pilotCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const channelId = requireFlag(flags, 'channel');
  const channel = getChannel(loaded.config, channelId);
  doctorCommand([], loaded);
  planCommand(['refresh', '--all'], loaded);
  for (const [projectId, ref] of Object.entries(channel.project_refs || {})) {
    const state = bootstrapProject(getProject(loaded.config, projectId), ref, loaded);
    out(`pilot: ${projectId}@${ref} status=${state.status}`);
  }
  out('Pilotin työtilat ovat valmiit. Dokumentoi ja hyväksy managed-projektit ennen publish-komentoa.');
}

function selectTargets(flags, loaded) {
  if (flags.project) {
    const project = getProject(loaded.config, String(flags.project));
    const refs = flags.ref ? [String(flags.ref)] : concreteRefs(project);
    return refs.map((ref) => ({ project, ref }));
  }
  if (!flags.all) throw new UserError('Anna --all tai --project <id> [--ref <ref>].');
  return loaded.config.projects.flatMap((project) => concreteRefs(project).map((ref) => ({ project, ref })));
}

function concreteRefs(project) {
  const refs = (project.refs?.include || []).filter((ref) => !ref.includes('*'));
  return refs.length ? refs : [project.refs.default];
}

function refAllowed(project, ref) {
  return (project.refs.include || []).some((pattern) => {
    const expression = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return expression.test(ref);
  });
}

function relativePortable(root, target) {
  const relative = path.relative(root, target).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function runInteractive(command, args, cwd) {
  const result = run(command, args, { cwd, stdio: 'inherit' });
  return result;
}

function ensureHttpProfile(loaded) {
  loaded.profileConfig.runtime = loaded.profileConfig.runtime || {};
  loaded.profileConfig.runtime.http = loaded.profileConfig.runtime.http || {
    host: '127.0.0.1', port: 8793, path: '/mcp', authentication: { mode: 'none' },
  };
  return loaded.profileConfig.runtime.http;
}

function requireAuthMode(loaded, expected) {
  const actual = authConfig(loaded).mode || 'none';
  if (actual !== expected) throw new UserError(`Autentikointitila on ${actual}; suorita ensin auth set-mode ${expected}.`);
}

function ensureOidcProfile(loaded) {
  const effective = authConfig(loaded).oidc;
  if (!effective) throw new UserError('OIDC-konfiguraatio puuttuu; aja ensin auth configure-oidc.');
  const http = ensureHttpProfile(loaded);
  http.authentication = http.authentication || { mode: 'oidc' };
  http.authentication.mode = 'oidc';
  http.authentication.oidc = http.authentication.oidc || structuredClone(effective);
  return http.authentication.oidc;
}

function validateAccess(access, loaded) {
  for (const channelId of access.channels || []) getChannel(loaded.config, channelId);
  for (const projectId of access.projects || []) getProject(loaded.config, projectId);
  return access;
}

function csvFlag(value) {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function parseListen(value) {
  const match = value.match(/^\[([^\]]+)]:(\d+)$/) || value.match(/^([^:]+):(\d+)$/);
  if (!match) throw new UserError('--listen pitää antaa muodossa host:port.');
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new UserError('Virheellinen portti.');
  return { host: match[1], port };
}

function validateHttpsUrl(value, name, allowInsecure) {
  let url;
  try { url = new URL(value); } catch { throw new UserError(`--${name} ei ole kelvollinen URL.`); }
  if (url.protocol !== 'https:' && !allowInsecure) throw new UserError(`--${name} pitää olla HTTPS-osoite.`);
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new UserError(`${flag} pitää olla positiivinen kokonaisluku.`);
  return number;
}

function nonNegativeInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new UserError(`${flag} pitää olla nolla tai positiivinen kokonaisluku.`);
  return number;
}

async function readSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new UserError('Salasana pitää antaa --password-stdin-valitsimella, kun interaktiivista terminaalia ei ole.');
  }
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stderr.write('\n');
      resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          process.stdin.setRawMode(false);
          process.stderr.write('\n');
          reject(new UserError('Keskeytetty.'));
          return;
        }
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}
