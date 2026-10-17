import fs from 'node:fs';
import path from 'node:path';
import { getProject, saveBase } from './config.mjs';
import { UserError } from './errors.mjs';
import { createdByDefault } from './exporter.mjs';
import { moveToTrash, trashRoot } from './manage.mjs';
import { storageRoot } from './publisher.mjs';
import {
  approveFiles,
  getSource,
  pendingFiles,
  previewFile,
  readInventory,
  rejectFile,
  removeUploadedFile,
  SAFE_SOURCE_ID,
  scanSource,
  sourceRuntimeRoot,
  summarise,
  uploadFile,
} from './sources.mjs';
import { nowIso, parseArgs, readJson, requireFlag } from './util.mjs';

// source-komennot: lähdeaineistojen lisäys, skannaus, hyväksyntä ja poisto.
// Hallintakäyttöliittymä ajaa samat komennot.

function out(value = '') {
  process.stdout.write(`${value}\n`);
}

const STATUS_TEXT = {
  uusi: 'uusi', muuttunut: 'muuttunut', hyvaksytty: 'hyväksytty', hylatty: 'hylätty',
  poistettu: 'poistettu', 'ei-tuettu': 'ei tuettu', virhe: 'virhe',
};

function csv(value) {
  if (value === undefined || value === true) return undefined;
  if (String(value) === 'none') return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function relativePortable(root, target) {
  const relative = path.relative(root, target).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function applyFields(loaded, source, flags) {
  const changes = [];
  if (flags.name !== undefined && flags.name !== true) { source.display_name = String(flags.name); changes.push('nimi'); }
  if (flags.location !== undefined && flags.location !== true) {
    if (source.type !== 'directory') throw new UserError('--location koskee vain directory-lähdettä.');
    const absolute = path.resolve(String(flags.location));
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) throw new UserError(`Hakemistoa ei ole: ${absolute}`);
    source.location = relativePortable(loaded.root, absolute);
    changes.push('sijainti');
  }
  if (flags.link !== undefined) {
    const linked = csv(flags.link) || [];
    for (const projectId of linked) getProject(loaded.base, projectId);
    if (linked.length) source.linked_projects = linked; else delete source.linked_projects;
    changes.push('projektit');
  }
  for (const [flag, key] of [['owner', 'owner'], ['classification', 'classification']]) {
    if (flags[flag] !== undefined && flags[flag] !== true) {
      if (String(flags[flag])) source[key] = String(flags[flag]); else delete source[key];
      changes.push(flag === 'owner' ? 'omistaja' : 'tietoluokka');
    }
  }
  for (const key of ['include', 'exclude']) {
    if (flags[key] !== undefined) {
      const values = csv(flags[key]) || [];
      if (values.length) source[key] = values; else delete source[key];
      changes.push(key);
    }
  }
  return changes;
}

function sourceChannels(loaded, sourceId) {
  return loaded.config.channels.filter((channel) => (channel.sources || []).includes(sourceId)).map((channel) => channel.channel_id);
}

function printSummary(summary) {
  const counts = Object.entries(summary.counts).filter(([, value]) => value).map(([key, value]) => `${STATUS_TEXT[key]} ${value}`);
  out(`${summary.source_id}: ${counts.join(', ') || 'ei tiedostoja'}`);
  if (summary.pending) out(`Odottaa hyväksyntää: ${summary.pending}. Esikatsele: source preview ${summary.source_id} --file <tiedosto>; hyväksy: source approve ${summary.source_id} --all-changed`);
}

export async function sourceCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];

  if (action === 'add') {
    const id = requireFlag(flags, 'id');
    if (!SAFE_SOURCE_ID.test(id)) throw new UserError('source_id saa sisältää pieniä kirjaimia, numeroita sekä ._- merkkejä (2–63 merkkiä).');
    const type = requireFlag(flags, 'type');
    if (!['directory', 'upload'].includes(type)) throw new UserError('--type pitää olla directory tai upload.');
    loaded.base.sources = loaded.base.sources || [];
    if (loaded.base.sources.some((item) => item.source_id === id)) throw new UserError(`Lähde on jo olemassa: ${id}`);
    if (type === 'directory' && (flags.location === undefined || flags.location === true)) throw new UserError('directory-lähde tarvitsee --location <hakemisto>.');
    const source = { source_id: id, display_name: id, type };
    applyFields(loaded, source, flags);
    loaded.base.sources.push(source);
    saveBase(loaded);
    out(`Lisättiin lähde ${id} (${type}).`);
    return out(type === 'upload' ? `Lisää tiedostot: source upload ${id} --file <polku> tai hallintakäyttöliittymän Lähdeaineistot-välilehti.` : `Seuraavaksi: source scan ${id}`);
  }

  if (action === 'list') {
    const sources = (loaded.config.sources || []).map((source) => ({
      ...source,
      channels: sourceChannels(loaded, source.source_id),
      ...summarise(readInventory(loaded, source.source_id)),
    }));
    if (flags.json) return out(JSON.stringify({ sources }, null, 2));
    if (!sources.length) return out('Lähdeaineistoja ei ole. Lisää: source add --id <id> --type <directory|upload>');
    for (const source of sources) {
      out(`${source.source_id}  ${source.type}  ${source.location || '(ladatut tiedostot)'}  odottaa ${source.pending}  kanavat ${source.channels.join(',') || '—'}`);
    }
    return undefined;
  }

  if (action === 'scan' && flags.all) {
    for (const source of loaded.config.sources || []) printSummary(await scanSource(loaded, source));
    return undefined;
  }

  const sourceId = String(positional[1] || '');
  if (!SAFE_SOURCE_ID.test(sourceId)) throw new UserError('Anna lähteen tunnus.');

  if (action === 'set') {
    const source = getSource(loaded.base, sourceId);
    const changes = applyFields(loaded, source, flags);
    if (!changes.length) throw new UserError('Ei muutettavaa. Anna --name, --location, --link, --owner, --classification, --include tai --exclude.');
    saveBase(loaded);
    out(`Päivitettiin lähde ${sourceId}: ${changes.join(', ')}.`);
    if (changes.some((change) => ['nimi', 'omistaja', 'tietoluokka', 'projektit'].includes(change))) out('Julkaise kanavat, jotta muutos näkyy AI-clienteille.');
    return undefined;
  }

  const source = getSource(loaded.config, sourceId);

  if (action === 'show') {
    const inventory = readInventory(loaded, sourceId);
    const summary = summarise(inventory);
    const files = Object.values(inventory.files).sort((a, b) => a.path.localeCompare(b.path));
    const references = sourceReferenceStatus(loaded, sourceId);
    if (flags.json) return out(JSON.stringify({ source, channels: sourceChannels(loaded, sourceId), ...summary, files, references }, null, 2));
    out(`${source.display_name || sourceId} (${sourceId}), ${source.type}: ${source.type === 'upload' ? 'ladatut tiedostot' : source.location}`);
    if (source.owner) out(`Omistaja: ${source.owner}`);
    if (source.classification) out(`Tietoluokka: ${source.classification}`);
    out(`Projektit: ${(source.linked_projects || []).join(', ') || '— (organisaatiotason lähde)'}`);
    out(`Kanavat: ${sourceChannels(loaded, sourceId).join(', ') || '—'}`);
    out(`Skannattu: ${inventory.scanned_at || 'ei vielä'}`);
    for (const entry of files) {
      out(`  ${(STATUS_TEXT[entry.status] || entry.status).padEnd(11)} ${entry.path}${entry.error ? `  (${entry.error})` : ''}`);
    }
    if (references.length) {
      out('Viittaukset koodidokumentaatiosta:');
      for (const item of references) out(`  ${item.ok ? 'ok ' : '!! '} ${item.project_id}: ${item.document} → ${item.reference}${item.ok ? '' : `  (${item.problem})`}`);
    }
    return printSummary(summary);
  }

  if (action === 'scan') return printSummary(await scanSource(loaded, source));

  if (action === 'upload') {
    const filename = path.resolve(requireFlag(flags, 'file'));
    if (!fs.existsSync(filename)) throw new UserError(`Tiedostoa ei ole: ${filename}`);
    const name = uploadFile(loaded, source, filename, flags.name && flags.name !== true ? String(flags.name) : path.basename(filename));
    out(`Lisättiin ${name} lähteeseen ${sourceId}.`);
    return printSummary(await scanSource(loaded, source));
  }

  if (action === 'preview') {
    const file = requireFlag(flags, 'file');
    const preview = previewFile(loaded, source, file);
    if (flags.json) return out(JSON.stringify(preview, null, 2));
    if (preview.entry.error) out(`Tila: ${STATUS_TEXT[preview.entry.status]} (${preview.entry.error})`);
    if (flags.diff && preview.diff) {
      if (preview.diff.truncated) return out('Ero on liian suuri näytettäväksi riveittäin.');
      for (const line of preview.diff.lines.filter((item) => item.op !== ' ')) out(`${line.op} ${line.text}`);
      return undefined;
    }
    return process.stdout.write(preview.markdown || '(ei muunnosta)\n');
  }

  if (action === 'approve') {
    const files = flags['all-changed'] ? pendingFiles(loaded, sourceId) : [requireFlag(flags, 'file')];
    if (!files.length) return out('Ei hyväksyttävää: uusia tai muuttuneita tiedostoja ei ole.');
    const approved = approveFiles(loaded, source, files, createdByDefault());
    for (const file of approved) out(`Hyväksyttiin ${file}`);
    const channels = sourceChannels(loaded, sourceId);
    return out(channels.length ? `Julkaise, jotta muutos näkyy AI-clienteille: ${channels.map((channel) => `publish --channel ${channel}`).join(', ')}` : `Lisää lähde kanavaan: channel add-source <kanava> ${sourceId}`);
  }

  if (action === 'reject') {
    const file = requireFlag(flags, 'file');
    rejectFile(loaded, source, file, { withdraw: Boolean(flags.withdraw) });
    return out(flags.withdraw
      ? `${file}: hyväksyntä peruttiin. Tiedosto poistuu seuraavasta julkaisusta.`
      : `${file}: nykyinen versio hylättiin. Aiemmin hyväksytty versio (jos on) pysyy julkaistuna; --withdraw poistaa sen.`);
  }

  if (action === 'remove-file') {
    const file = requireFlag(flags, 'file');
    if (!flags.confirm) {
      out(`Suunnitelma: ${file} poistetaan lähteestä ${sourceId} ja seuraavasta julkaisusta.`);
      return out('Suorita --confirm vahvistaaksesi.');
    }
    removeUploadedFile(loaded, source, file);
    out(`Poistettiin ${file}.`);
    return printSummary(await scanSource(loaded, source));
  }

  if (action === 'remove') {
    const channels = sourceChannels(loaded, sourceId);
    const releases = path.join(storageRoot(loaded), 'sources', sourceId);
    if (!flags.confirm) {
      out(`Suunnitelma: lähde ${sourceId} poistetaan konfiguraatiosta${channels.length ? ` ja kanavista ${channels.join(', ')}` : ''}.`);
      out(flags.purge
        ? `--purge poistaa pysyvästi myös inventaarion, muunnokset${source.type === 'upload' ? ', ladatut tiedostot' : ''} ja julkaisut. Lähteen hakemistoon ei kosketa.`
        : 'Lähde siirtyy roskakoriin, josta sen voi palauttaa. Lähteen hakemistoon ei kosketa.');
      return out('Suorita --confirm vahvistaaksesi.');
    }
    const config = getSource(loaded.base, sourceId);
    const runtime = sourceRuntimeRoot(loaded, sourceId);
    // Tiedostot siirretään ensin: jos siirto epäonnistuu, konfiguraatio jää ennalleen.
    let dir = null;
    if (!flags.purge && fs.existsSync(runtime)) {
      dir = `${nowIso().replace(/[:.]/g, '-')}-source-${sourceId}.d`;
      fs.mkdirSync(trashRoot(loaded), { recursive: true });
      fs.renameSync(runtime, path.join(trashRoot(loaded), dir));
    }
    loaded.base.sources = loaded.base.sources.filter((item) => item.source_id !== sourceId);
    for (const channel of loaded.base.channels) {
      if (channel.sources) channel.sources = channel.sources.filter((item) => item !== sourceId);
      if (channel.sources && !channel.sources.length) delete channel.sources;
    }
    saveBase(loaded);
    if (flags.purge) {
      fs.rmSync(runtime, { recursive: true, force: true });
      fs.rmSync(releases, { recursive: true, force: true });
      out(`Poistettiin lähde ${sourceId} pysyvästi.`);
    } else {
      const entry = moveToTrash(loaded, 'source', sourceId, { source: config, channels, dir });
      out(`Lähde ${sourceId} siirrettiin roskakoriin: ${entry}`);
      out(`Palauta: trash restore ${entry}`);
    }
    if (channels.length) out(`Julkaise kanavat uudelleen, jotta lähde poistuu AI-clienteilta: ${channels.join(', ')}`);
    return undefined;
  }

  throw new UserError('Käyttö: source add|set|list|show|scan|upload|preview|approve|reject|remove-file|remove … (ks. help)');
}

export function restoreSource(loaded, item) {
  loaded.base.sources = loaded.base.sources || [];
  if (loaded.base.sources.some((source) => source.source_id === item.id)) throw new UserError(`Lähde on jo olemassa: ${item.id}`);
  const projectIds = new Set(loaded.base.projects.map((project) => project.project_id));
  const source = { ...item.source };
  if (source.linked_projects) source.linked_projects = source.linked_projects.filter((projectId) => projectIds.has(projectId));
  loaded.base.sources.push(source);
  for (const channelId of item.channels || []) {
    const channel = loaded.base.channels.find((candidate) => candidate.channel_id === channelId);
    if (channel) channel.sources = [...new Set([...(channel.sources || []), item.id])].sort();
  }
  saveBase(loaded);
  if (item.dir) {
    const from = path.join(trashRoot(loaded), path.basename(String(item.dir)));
    const runtime = sourceRuntimeRoot(loaded, item.id);
    if (fs.existsSync(from) && !fs.existsSync(runtime)) {
      fs.mkdirSync(path.dirname(runtime), { recursive: true });
      fs.renameSync(from, runtime);
    }
  }
}

// --- Viittausten tarkistus ------------------------------------------------------

// Koodidokumentaation lahde:-viitteiden tila oletuskanavan julkaisussa.
export function sourceReferenceStatus(loaded, sourceId = '', bundle = null) {
  let current = bundle;
  if (!current) {
    const filename = path.join(storageRoot(loaded), 'channels', `${loaded.config.service.default_channel}.json`);
    current = readJson(filename);
    if (!current) return [];
  }
  const result = [];
  for (const release of current.projects || []) {
    const manifest = readJson(path.join(storageRoot(loaded), 'projects', release.project_id, 'releases', release.release_id, 'manifest.json'));
    for (const reference of manifest?.source_references || []) {
      if (sourceId && reference.source_id !== sourceId) continue;
      result.push({ project_id: release.project_id, ...reference, ...checkReference(loaded, reference, current) });
    }
  }
  return result;
}

function checkReference(loaded, reference, bundle) {
  const source = (loaded.config.sources || []).find((item) => item.source_id === reference.source_id);
  if (!source) return { ok: false, problem: 'lähdettä ei ole' };
  const entry = readInventory(loaded, reference.source_id).files[reference.path];
  if (!entry || entry.missing) return { ok: false, problem: 'tiedostoa ei ole lähteessä' };
  if (!entry.approved_sha256) return { ok: false, problem: 'tiedostoa ei ole hyväksytty' };
  if (reference.sha256_prefix && !entry.approved_sha256.startsWith(reference.sha256_prefix)) {
    return { ok: false, problem: `tiedosto on muuttunut viittauksen jälkeen (hyväksytty ${entry.approved_sha256.slice(0, 12)})` };
  }
  if (bundle && !(bundle.sources || []).some((item) => item.source_id === reference.source_id)) {
    return { ok: false, problem: `lähde ei ole kanavassa ${bundle.channel_id}` };
  }
  return { ok: true };
}

export function staleSourceReferences(loaded, bundle) {
  return sourceReferenceStatus(loaded, '', bundle).filter((item) => !item.ok)
    .map((item) => `${item.project_id}/${item.document}: ${item.reference}: ${item.problem}`);
}

