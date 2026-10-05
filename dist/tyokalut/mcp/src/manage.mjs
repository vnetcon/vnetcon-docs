import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { getChannel, getProject, resolveRootPath, saveBase } from './config.mjs';
import { UserError } from './errors.mjs';
import { inspectRepository } from './git.mjs';
import { listInterfaces } from './search.mjs';
import { storageRoot } from './publisher.mjs';
import { runtimeRoot } from './workspace.mjs';
import { ensureDirectory, nowIso, parseArgs, readJson, requireFlag, safeChannelId, writeFileAtomic, writeJson } from './util.mjs';

// Muokkaus-, poisto- ja palautuskomennot. Poisto siirtää kohteen roskakoriin
// (.multiproject/roskakori/), josta sen voi palauttaa; --purge poistaa myös datan
// eikä jätä palautettavaa.

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const SAFE_GUIDANCE = /^[a-z0-9][a-z0-9._-]{0,62}\.md$/;

function out(value = '') {
  process.stdout.write(`${value}\n`);
}

// --- Roskakori --------------------------------------------------------------

export function trashRoot(loaded) {
  return path.join(loaded.root, '.multiproject', 'roskakori');
}

function moveToTrash(loaded, kind, id, payload) {
  const entry = `${nowIso().replace(/[:.]/g, '-')}-${kind}-${id}`;
  writeJson(path.join(trashRoot(loaded), `${entry}.json`), { schema_version: 1, entry, kind, id, removed_at: nowIso(), ...payload });
  return entry;
}

export function listTrash(loaded) {
  const root = trashRoot(loaded);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((name) => name.endsWith('.json')).sort().reverse()
    .map((name) => readJson(path.join(root, name)))
    .filter(Boolean)
    .map(({ entry, kind, id, removed_at: removedAt }) => ({ entry, kind, id, removed_at: removedAt }));
}

export function trashCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  if (action === 'list') {
    const entries = listTrash(loaded);
    if (!entries.length) return out('Roskakori on tyhjä.');
    for (const item of entries) out(`${item.entry}  ${item.kind} ${item.id}  poistettu ${item.removed_at}`);
    return undefined;
  }
  if (action === 'restore') {
    const entry = positional[1] || requireFlag(flags, 'entry');
    const filename = path.join(trashRoot(loaded), `${path.basename(String(entry))}.json`);
    const item = readJson(filename);
    if (!item) throw new UserError(`Roskakorissa ei ole kohdetta: ${entry}`);
    restoreItem(loaded, item, Boolean(flags.force));
    fs.rmSync(filename);
    return out(`Palautettiin ${item.kind} ${item.id}.`);
  }
  if (action === 'empty') {
    const entries = listTrash(loaded);
    if (!flags.confirm) {
      out(`Suunnitelma: roskakorista poistetaan pysyvästi ${entries.length} kohdetta.`);
      return out('Suorita --confirm vahvistaaksesi.');
    }
    fs.rmSync(trashRoot(loaded), { recursive: true, force: true });
    return out(`Roskakori tyhjennettiin (${entries.length} kohdetta).`);
  }
  throw new UserError('Käyttö: trash list | trash restore <kohde> [--force] | trash empty [--confirm]');
}

function restoreItem(loaded, item, force) {
  if (item.kind === 'project') {
    if (loaded.base.projects.some((project) => project.project_id === item.id)) throw new UserError(`Projekti on jo olemassa: ${item.id}`);
    loaded.base.projects.push(item.project);
    for (const [channelId, ref] of Object.entries(item.channel_refs || {})) {
      const channel = loaded.base.channels.find((candidate) => candidate.channel_id === channelId);
      if (channel) channel.project_refs = { ...(channel.project_refs || {}), [item.id]: ref };
    }
    saveBase(loaded);
  } else if (item.kind === 'channel') {
    if (loaded.base.channels.some((channel) => channel.channel_id === item.id)) throw new UserError(`Kanava on jo olemassa: ${item.id}`);
    const projectIds = new Set(loaded.base.projects.map((project) => project.project_id));
    const projectRefs = Object.fromEntries(Object.entries(item.channel.project_refs || {}).filter(([projectId]) => projectIds.has(projectId)));
    loaded.base.channels.push({ ...item.channel, project_refs: projectRefs });
    saveBase(loaded);
  } else if (item.kind === 'interface' || item.kind === 'guidance') {
    const root = item.kind === 'interface' ? interfacesRoot(loaded) : guidanceRoot(loaded);
    const filename = path.join(root, item.file);
    if (fs.existsSync(filename) && !force) throw new UserError(`Tiedosto on jo olemassa: ${item.file}. Käytä --force korvataksesi.`);
    ensureDirectory(path.dirname(filename));
    writeFileAtomic(filename, item.content);
  } else {
    throw new UserError(`Tuntematon roskakorin kohde: ${item.kind}`);
  }
}

// --- Projektit ----------------------------------------------------------------

export function removeProjectCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const projectId = positional[0];
  if (!projectId) throw new UserError('Käyttö: remove-project <id> [--confirm] [--purge]');
  const project = getProject(loaded.base, projectId);
  const channelRefs = Object.fromEntries(loaded.base.channels
    .filter((channel) => channel.project_refs?.[projectId])
    .map((channel) => [channel.channel_id, channel.project_refs[projectId]]));
  const data = projectDataPaths(loaded, projectId);
  if (!flags.confirm) {
    out(`Suunnitelma: projekti ${projectId} poistetaan konfiguraatiosta${Object.keys(channelRefs).length ? ` ja kanavista ${Object.keys(channelRefs).join(', ')}` : ''}.`);
    out(flags.purge
      ? `--purge poistaa pysyvästi myös työtilat ja julkaisut:\n  ${data.filter((item) => fs.existsSync(item)).join('\n  ') || '(ei dataa)'}`
      : 'Projekti siirtyy roskakoriin, josta sen voi palauttaa (trash restore). Työtiloja ja julkaisuja ei poisteta.');
    return out('Suorita --confirm vahvistaaksesi.');
  }
  loaded.base.projects = loaded.base.projects.filter((item) => item.project_id !== projectId);
  for (const channel of loaded.base.channels) delete channel.project_refs?.[projectId];
  saveBase(loaded);
  if (flags.purge) {
    for (const item of data) fs.rmSync(item, { recursive: true, force: true });
    out(`Poistettiin projekti ${projectId} pysyvästi, myös työtilat ja julkaisut.`);
  } else {
    const entry = moveToTrash(loaded, 'project', projectId, { project, channel_refs: channelRefs });
    out(`Projekti ${projectId} siirrettiin roskakoriin: ${entry}`);
    out(`Palauta: trash restore ${entry}`);
  }
  if (Object.keys(channelRefs).length) out(`Julkaise kanavat uudelleen, jotta projekti poistuu AI-clienteilta: ${Object.keys(channelRefs).join(', ')}`);
  return undefined;
}

function projectDataPaths(loaded, projectId) {
  return [
    path.join(runtimeRoot(loaded), projectId),
    path.join(loaded.root, '.multiproject', 'state', projectId),
    path.join(storageRoot(loaded), 'projects', projectId),
  ];
}

// project set: muokkaa olemassa olevaa projektia. Vain annetut kentät muuttuvat.
export function projectSetCommand(argv, loaded) {
  const { flags } = parseArgs(argv);
  const projectId = requireFlag(flags, 'id');
  const project = getProject(loaded.base, projectId);
  const changes = [];
  if (flags.name) { project.display_name = String(flags.name); changes.push('nimi'); }
  if (flags.path || flags.url) {
    project.repository = flags.path
      ? { path: relativePortable(loaded.root, path.resolve(String(flags.path))) }
      : { url: String(flags.url) };
    if (flags.path) inspectRepository(path.resolve(String(flags.path)));
    changes.push('repository');
  }
  if (flags.refs) {
    const refs = String(flags.refs).split(',').map((value) => value.trim()).filter(Boolean);
    if (!refs.length) throw new UserError('--refs on tyhjä.');
    project.refs = { default: refs[0], include: refs };
    for (const channel of loaded.base.channels) {
      const ref = channel.project_refs?.[projectId];
      if (ref && !refs.includes(ref)) out(`Huom: kanava ${channel.channel_id} käyttää haaraa ${ref}, joka ei ole enää listalla.`);
    }
    changes.push('haarat');
  }
  if (flags['docs-mode'] || flags['docs-path'] || flags['docs-repo'] || flags['docs-ref']) {
    const mode = String(flags['docs-mode'] || project.documentation.mode);
    if (!['managed', 'repository', 'separate'].includes(mode)) throw new UserError('--docs-mode pitää olla managed, repository tai separate.');
    const previous = project.documentation.mode === mode ? project.documentation : {};
    if (mode === 'repository') {
      project.documentation = { mode, source_path: String(flags['docs-path'] || previous.source_path || 'vnetcon-docs') };
    } else if (mode === 'managed') {
      project.documentation = { mode, workspace_template: 'default' };
    } else {
      const documentation = { mode, source_path: String(flags['docs-path'] || previous.source_path || '.') };
      const docsRepo = flags['docs-repo'] ? String(flags['docs-repo']) : '';
      if (docsRepo) {
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(docsRepo) || docsRepo.includes('@')) {
          documentation.repository = { url: docsRepo };
        } else {
          const absolute = path.resolve(docsRepo);
          documentation.repository = { path: relativePortable(loaded.root, absolute) };
          documentation.default_ref = inspectRepository(absolute).defaultRef;
        }
      } else if (previous.repository) {
        documentation.repository = previous.repository;
        if (previous.default_ref) documentation.default_ref = previous.default_ref;
      } else {
        throw new UserError('separate-malli tarvitsee --docs-repo-valitsimen.');
      }
      if (flags['docs-ref']) documentation.default_ref = String(flags['docs-ref']);
      project.documentation = documentation;
    }
    changes.push('dokumentaatio');
  }
  if (!changes.length) throw new UserError('Ei muutettavaa. Anna --name, --path/--url, --refs tai --docs-*.');
  saveBase(loaded);
  out(`Päivitettiin projekti ${projectId}: ${changes.join(', ')}.`);
  if (changes.includes('repository') || changes.includes('dokumentaatio') || changes.includes('haarat')) out('Aja bootstrap, jotta muutos tulee voimaan.');
}

// --- Kanavat -------------------------------------------------------------------

export function channelManageCommand(action, positional, flags, loaded) {
  if (action === 'remove') {
    const channelId = positional[1];
    if (!channelId) throw new UserError('Käyttö: channel remove <id> [--confirm] [--purge]');
    const channel = getChannel(loaded.base, channelId);
    const published = path.join(storageRoot(loaded), 'channels', `${channelId}.json`);
    if (!flags.confirm) {
      out(`Suunnitelma: kanava ${channelId} poistetaan konfiguraatiosta, ja sen MCP-osoite lakkaa toimimasta.`);
      out(flags.purge ? '--purge poistaa pysyvästi myös kanavan julkaisuosoittimen.' : 'Kanava siirtyy roskakoriin, josta sen voi palauttaa.');
      return out('Suorita --confirm vahvistaaksesi.');
    }
    loaded.base.channels = loaded.base.channels.filter((item) => item.channel_id !== channelId);
    if (loaded.base.service.default_channel === channelId) {
      loaded.base.service.default_channel = loaded.base.channels[0]?.channel_id || 'local';
      out(`Oletuskanavaksi vaihtui ${loaded.base.service.default_channel}.`);
    }
    saveBase(loaded);
    if (flags.purge) {
      fs.rmSync(published, { force: true });
      return out(`Poistettiin kanava ${channelId} pysyvästi.`);
    }
    const entry = moveToTrash(loaded, 'channel', channelId, { channel });
    out(`Kanava ${channelId} siirrettiin roskakoriin: ${entry}`);
    return out(`Palauta: trash restore ${entry}`);
  }
  if (action === 'unset-ref') {
    const [channelId, projectId] = positional.slice(1);
    if (!channelId || !projectId) throw new UserError('Käyttö: channel unset-ref <kanava> <projekti>');
    const channel = getChannel(loaded.base, channelId);
    if (!channel.project_refs?.[projectId]) throw new UserError(`Kanavassa ${channelId} ei ole projektia ${projectId}.`);
    delete channel.project_refs[projectId];
    saveBase(loaded);
    out(`${channelId}: ${projectId} poistettiin kanavasta.`);
    return out('Julkaise kanava uudelleen, jotta muutos näkyy AI-clienteille.');
  }
  if (action === 'set-default') {
    const channelId = safeChannelId(String(positional[1] || ''));
    getChannel(loaded.base, channelId);
    loaded.base.service.default_channel = channelId;
    saveBase(loaded);
    return out(`Oletuskanava: ${channelId}`);
  }
  return null;
}

// --- Integraatiotietueet -------------------------------------------------------

function interfacesRoot(loaded) {
  return resolveRootPath(loaded, loaded.config.interfaces?.path || './interfaces');
}

function findInterface(loaded, id) {
  return listInterfaces(loaded, '', { includeDrafts: true }).find((item) => item.interface_id === id);
}

export function interfaceCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  if (action === 'list') {
    const items = listInterfaces(loaded, '', { includeDrafts: true });
    if (!items.length) return out('Integraatiotietueita ei ole.');
    for (const item of items) out(`${(item.status || '-').padEnd(10)} ${item.interface_id}  ${item.display_name || ''}`);
    return undefined;
  }
  const id = String(positional[1] || '');
  if (!SAFE_ID.test(id)) throw new UserError('Anna interface_id (pienet kirjaimet, numerot ja ._-).');
  if (action === 'show') {
    const item = findInterface(loaded, id);
    if (!item) throw new UserError(`Rajapintaa ei löytynyt: ${id}`);
    return process.stdout.write(fs.readFileSync(path.join(interfacesRoot(loaded), item._source), 'utf8'));
  }
  if (action === 'set') {
    const source = readContent(flags);
    let parsed;
    try { parsed = YAML.parse(source); } catch (error) { throw new UserError(`Virheellinen YAML: ${error.message}`); }
    if (parsed?.interface_id !== id) throw new UserError(`interface_id pitää olla ${id}.`);
    if (!['draft', 'active', 'deprecated'].includes(parsed.status)) throw new UserError('status pitää olla draft, active tai deprecated.');
    const existing = findInterface(loaded, id);
    const filename = path.join(interfacesRoot(loaded), existing?._source || `${id}.yaml`);
    ensureDirectory(path.dirname(filename));
    writeFileAtomic(filename, source.endsWith('\n') ? source : `${source}\n`);
    return out(`Tallennettiin interfaces/${path.basename(filename)} (${parsed.status}).`);
  }
  if (action === 'set-status') {
    const status = String(positional[2] || '');
    if (!['draft', 'active', 'deprecated'].includes(status)) throw new UserError('Tila on draft, active tai deprecated.');
    const item = findInterface(loaded, id);
    if (!item) throw new UserError(`Rajapintaa ei löytynyt: ${id}`);
    const filename = path.join(interfacesRoot(loaded), item._source);
    const document = YAML.parseDocument(fs.readFileSync(filename, 'utf8'));
    document.set('status', status);
    writeFileAtomic(filename, document.toString());
    return out(`${id}: tila ${status}.`);
  }
  if (action === 'remove') {
    const item = findInterface(loaded, id);
    if (!item) throw new UserError(`Rajapintaa ei löytynyt: ${id}`);
    return removeFile(loaded, flags, 'interface', id, interfacesRoot(loaded), item._source);
  }
  throw new UserError('Käyttö: interface list | show <id> | set <id> (--file <polku> | --stdin) | set-status <id> <draft|active|deprecated> | remove <id> [--confirm] [--purge]');
}

// --- Yhteinen ohjaus ja sanasto ------------------------------------------------

function guidanceRoot(loaded) {
  return resolveRootPath(loaded, loaded.config.guidance?.path || './yhteiset');
}

export function guidanceCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  const root = guidanceRoot(loaded);
  if (action === 'list') {
    const files = fs.existsSync(root) ? fs.readdirSync(root).filter((name) => name.endsWith('.md')).sort() : [];
    if (!files.length) return out('Yhteistä ohjausta ei ole.');
    for (const name of files) out(name);
    return undefined;
  }
  const name = String(positional[1] || '');
  if (!SAFE_GUIDANCE.test(name)) throw new UserError('Anna tiedoston nimi, esim. ohjaus.md tai sanasto.md.');
  const filename = path.join(root, name);
  if (action === 'show') {
    if (!fs.existsSync(filename)) throw new UserError(`Tiedostoa ei ole: yhteiset/${name}`);
    return process.stdout.write(fs.readFileSync(filename, 'utf8'));
  }
  if (action === 'set') {
    ensureDirectory(root);
    writeFileAtomic(filename, readContent(flags));
    return out(`Tallennettiin yhteiset/${name}.`);
  }
  if (action === 'remove') {
    if (!fs.existsSync(filename)) throw new UserError(`Tiedostoa ei ole: yhteiset/${name}`);
    return removeFile(loaded, flags, 'guidance', name.replace(/\.md$/, ''), root, name);
  }
  throw new UserError('Käyttö: guidance list | show <nimi.md> | set <nimi.md> (--file <polku> | --stdin) | remove <nimi.md> [--confirm] [--purge]');
}

function removeFile(loaded, flags, kind, id, root, file) {
  const filename = path.join(root, file);
  if (!flags.confirm) {
    out(`Suunnitelma: ${file} poistetaan.`);
    out(flags.purge ? '--purge poistaa sen pysyvästi.' : 'Tiedosto siirtyy roskakoriin, josta sen voi palauttaa.');
    return out('Suorita --confirm vahvistaaksesi.');
  }
  const content = fs.readFileSync(filename, 'utf8');
  fs.rmSync(filename);
  if (flags.purge) return out(`Poistettiin ${file} pysyvästi.`);
  const entry = moveToTrash(loaded, kind, id, { file, content });
  out(`${file} siirrettiin roskakoriin: ${entry}`);
  return out(`Palauta: trash restore ${entry}`);
}

function readContent(flags) {
  if (flags.stdin) return fs.readFileSync(0, 'utf8');
  if (flags.file) return fs.readFileSync(path.resolve(String(flags.file)), 'utf8');
  throw new UserError('Anna sisältö valitsimella --file <polku> tai --stdin.');
}

function relativePortable(root, target) {
  const relative = path.relative(root, target).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}


// --- Julkaisujen säilytys ----------------------------------------------------

// Säilytetään kanavien nykyiset julkaisut, --keep uusinta pakettia sekä projektien
// haarakohtaiset viimeisimmät julkaisut. Muut paketit ja julkaisut poistetaan.
// Avoin MCP-yhteys lukee oman pakettinsa julkaisuja, joten oletus säilyttää useamman.
export function publicationsCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  if (positional[0] !== 'prune') throw new UserError('Käyttö: publications prune [--keep <n>] [--confirm]');
  const keep = Number(flags.keep ?? loaded.config.storage?.retention?.keep_bundles ?? 3);
  if (!Number.isInteger(keep) || keep < 1) throw new UserError('--keep pitää olla vähintään 1.');
  const root = storageRoot(loaded);
  const bundlesDir = path.join(root, 'bundles');
  const bundles = fs.existsSync(bundlesDir)
    ? fs.readdirSync(bundlesDir).map((id) => readJson(path.join(bundlesDir, id, 'manifest.json'))).filter(Boolean)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    : [];
  const keptBundles = new Set(bundles.slice(0, keep).map((bundle) => bundle.bundle_id));
  const channelsDir = path.join(root, 'channels');
  for (const name of fs.existsSync(channelsDir) ? fs.readdirSync(channelsDir) : []) {
    const current = readJson(path.join(channelsDir, name));
    if (current?.bundle_id) keptBundles.add(current.bundle_id);
  }
  const keptReleases = new Set();
  for (const bundle of bundles.filter((item) => keptBundles.has(item.bundle_id))) {
    for (const release of bundle.projects || []) keptReleases.add(`${release.project_id}/${release.release_id}`);
  }
  const projectsDir = path.join(root, 'projects');
  const releaseDirs = [];
  for (const projectId of fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir) : []) {
    const refsDir = path.join(projectsDir, projectId, 'refs');
    for (const name of fs.existsSync(refsDir) ? fs.readdirSync(refsDir) : []) {
      const latest = readJson(path.join(refsDir, name));
      if (latest?.release_id) keptReleases.add(`${projectId}/${latest.release_id}`);
    }
    const releasesDir = path.join(projectsDir, projectId, 'releases');
    for (const releaseId of fs.existsSync(releasesDir) ? fs.readdirSync(releasesDir) : []) {
      if (!keptReleases.has(`${projectId}/${releaseId}`)) releaseDirs.push(path.join(releasesDir, releaseId));
    }
  }
  const bundleDirs = bundles.filter((bundle) => !keptBundles.has(bundle.bundle_id)).map((bundle) => path.join(bundlesDir, bundle.bundle_id));
  if (!flags.confirm) {
    out(`Suunnitelma: säilytetään ${keptBundles.size} pakettia ja ${keptReleases.size} julkaisua.`);
    out(`Poistetaan pysyvästi ${bundleDirs.length} pakettia ja ${releaseDirs.length} julkaisua.`);
    return out('Suorita --confirm vahvistaaksesi.');
  }
  for (const dir of [...bundleDirs, ...releaseDirs]) fs.rmSync(dir, { recursive: true, force: true });
  return out(`Poistettiin ${bundleDirs.length} pakettia ja ${releaseDirs.length} julkaisua. Säilytettiin ${keptBundles.size} pakettia.`);
}
