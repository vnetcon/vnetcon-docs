import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveRootPath } from './config.mjs';
import { convertFile, supportStatus } from './convert.mjs';
import { UserError } from './errors.mjs';
import { splitMarkdownSections, storageRoot } from './publisher.mjs';
import { assertInside, ensureDirectory, listFilesRecursive, nowIso, readJson, sha256, writeFileAtomic, writeJson } from './util.mjs';

// Lähdeaineistot: koodin ulkopuoliset dokumentit (Word, PowerPoint, Excel,
// Markdown, teksti), joita ylläpidetään muualla kuin projektin Gitissä. Lähde
// on oma käsitteensä projektien rinnalla: sillä ei ole refiä eikä committia,
// vaan versio on tiedostokohtainen sisältötiiviste. Mikään tiedosto ei päädy
// julkaisuun ilman ihmisen hyväksyntää, ja jokainen julkaistu osa merkitään
// tietolajilla lahdeaineisto (ei tarkistettu koodia vasten).

export const SOURCE_KIND = 'lahdeaineisto';
export const SAFE_SOURCE_ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const DEFAULT_EXCLUDE = ['**/~$*', '**/.*', '**/Thumbs.db'];

export function sourceLimits(loaded) {
  const defaults = loaded.config.sources_defaults || {};
  return {
    max_file_bytes: defaults.max_file_bytes || 50 * 1024 * 1024,
    max_converted_bytes: defaults.max_converted_bytes || 5 * 1024 * 1024,
  };
}

// --- Konfiguraatio ja sijainnit ---------------------------------------------

export function getSource(config, sourceId) {
  const source = (config.sources || []).find((item) => item.source_id === sourceId);
  if (!source) throw new UserError(`Tuntematon lähde: ${sourceId}`);
  return source;
}

export function sourceRuntimeRoot(loaded, sourceId) {
  if (!SAFE_SOURCE_ID.test(String(sourceId))) throw new UserError(`Virheellinen source_id: ${sourceId}`);
  return path.join(loaded.root, '.multiproject', 'sources', sourceId);
}

export function sourceFilesRoot(loaded, source) {
  if (source.type === 'upload') return path.join(sourceRuntimeRoot(loaded, source.source_id), 'uploads');
  if (!source.location) throw new UserError(`${source.source_id}: location puuttuu.`);
  return resolveRootPath(loaded, source.location);
}

function inventoryFilename(loaded, sourceId) {
  return path.join(sourceRuntimeRoot(loaded, sourceId), 'inventory.json');
}

export function readInventory(loaded, sourceId) {
  return readJson(inventoryFilename(loaded, sourceId), { schema_version: 1, source_id: sourceId, scanned_at: null, files: {} });
}

function writeInventory(loaded, inventory) {
  writeJson(inventoryFilename(loaded, inventory.source_id), inventory);
}

// Välimuistin avaimessa on myös pääte: sama sisältö eri päätteellä muunnetaan eri tavalla.
function convertedFilename(loaded, sourceId, sha, filePath) {
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new UserError('Virheellinen tiiviste.');
  const extension = path.extname(filePath).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return path.join(sourceRuntimeRoot(loaded, sourceId), 'converted', `${sha}${extension}.json`);
}

export function readConverted(loaded, sourceId, sha, filePath) {
  return readJson(convertedFilename(loaded, sourceId, sha, filePath));
}

// --- Polkusuodatus -------------------------------------------------------------

function globToRegex(glob) {
  let pattern = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      if (glob[index + 2] === '/') { pattern += '(?:.*/)?'; index += 2; } else { pattern += '.*'; index += 1; }
    } else if (char === '*') pattern += '[^/]*';
    else if (char === '?') pattern += '[^/]';
    else pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${pattern}$`, 'i');
}

function matcher(source) {
  const include = (source.include?.length ? source.include : ['**/*']).map(globToRegex);
  const exclude = [...DEFAULT_EXCLUDE, ...(source.exclude || [])].map(globToRegex);
  return (relative) => include.some((rx) => rx.test(relative)) && !exclude.some((rx) => rx.test(relative));
}

// --- Skannaus -------------------------------------------------------------------

function fileSha(filename) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filename));
  return hash.digest('hex');
}

function deriveStatus(entry) {
  if (entry.missing) return 'poistettu';
  if (entry.error) return entry.unsupported ? 'ei-tuettu' : 'virhe';
  if (entry.approved_sha256 === entry.sha256) return 'hyvaksytty';
  if (entry.rejected_sha256 === entry.sha256) return 'hylatty';
  return entry.approved_sha256 ? 'muuttunut' : 'uusi';
}

// Päivittää inventaarion lähteen nykytilasta. Ei hyväksy eikä julkaise mitään.
export async function scanSource(loaded, source) {
  const root = sourceFilesRoot(loaded, source);
  if (!fs.existsSync(root)) {
    if (source.type === 'upload') ensureDirectory(root);
    else throw new UserError(`${source.source_id}: hakemistoa ei ole: ${root}`);
  }
  const limits = sourceLimits(loaded);
  const accept = matcher(source);
  const inventory = readInventory(loaded, source.source_id);
  const seen = new Set();
  for (const filename of listFilesRecursive(root)) {
    assertInside(root, filename);
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (!accept(relative)) continue;
    seen.add(relative);
    const stat = fs.statSync(filename);
    const previous = inventory.files[relative] || {};
    const entry = { ...previous, path: relative, size: stat.size, mtime: new Date(stat.mtimeMs).toISOString() };
    delete entry.missing;
    const unchanged = previous.sha256 && previous.size === stat.size && previous.mtime === entry.mtime && !previous.error;
    delete entry.error;
    delete entry.unsupported;
    const support = supportStatus(relative);
    if (!support.supported) {
      entry.sha256 = previous.size === stat.size && previous.mtime === entry.mtime ? previous.sha256 || '' : '';
      entry.error = support.reason;
      entry.unsupported = true;
    } else if (stat.size > limits.max_file_bytes) {
      entry.error = `Tiedosto on ${Math.ceil(stat.size / 1024 / 1024)} Mt, raja on ${Math.round(limits.max_file_bytes / 1024 / 1024)} Mt.`;
    } else {
      entry.sha256 = unchanged ? previous.sha256 : fileSha(filename);
      const cached = convertedFilename(loaded, source.source_id, entry.sha256, relative);
      if (fs.existsSync(cached)) {
        delete entry.failed_sha256;
      } else if (previous.failed_sha256 === entry.sha256 && previous.error) {
        // Sama sisältö epäonnistui jo: ei muunneta uudelleen joka skannauksella.
        entry.error = previous.error;
        if (previous.unsupported) entry.unsupported = true;
      } else {
        try {
          const converted = await convertFile(filename);
          if (Buffer.byteLength(converted.markdown) > limits.max_converted_bytes) {
            throw new UserError(`Muunnos on yli ${Math.round(limits.max_converted_bytes / 1024 / 1024)} Mt.`);
          }
          writeJson(cached, { schema_version: 1, sha256: entry.sha256, converted_at: nowIso(), ...converted });
          delete entry.failed_sha256;
        } catch (error) {
          entry.error = error.message;
          if (error.unsupported) entry.unsupported = true;
          entry.failed_sha256 = entry.sha256;
        }
      }
    }
    entry.status = deriveStatus(entry);
    inventory.files[relative] = entry;
  }
  for (const [relative, entry] of Object.entries(inventory.files)) {
    if (seen.has(relative)) continue;
    // Hyväksymätön ja kadonnut tiedosto poistuu inventaariosta; hyväksytty jää
    // näkyviin tilassa poistettu, jotta poistuminen julkaisusta näkyy.
    if (!entry.approved_sha256) { delete inventory.files[relative]; continue; }
    entry.missing = true;
    entry.status = deriveStatus(entry);
  }
  inventory.scanned_at = nowIso();
  writeInventory(loaded, inventory);
  return summarise(inventory);
}

export function summarise(inventory) {
  const counts = { uusi: 0, muuttunut: 0, hyvaksytty: 0, hylatty: 0, poistettu: 0, 'ei-tuettu': 0, virhe: 0 };
  for (const entry of Object.values(inventory.files)) counts[entry.status] = (counts[entry.status] || 0) + 1;
  return { source_id: inventory.source_id, scanned_at: inventory.scanned_at, counts, pending: counts.uusi + counts.muuttunut };
}

// --- Hyväksyntä ---------------------------------------------------------------

function entryFor(inventory, file) {
  const entry = inventory.files[file];
  if (!entry) throw new UserError(`Tiedostoa ei ole inventaariossa: ${file}. Aja ensin source scan.`);
  return entry;
}

export function approveFiles(loaded, source, files, approvedBy) {
  const inventory = readInventory(loaded, source.source_id);
  const approved = [];
  for (const file of files) {
    const entry = entryFor(inventory, file);
    if (!['uusi', 'muuttunut', 'hylatty'].includes(entry.status)) {
      if (entry.status === 'hyvaksytty') continue;
      throw new UserError(`${file}: tilaa ${entry.status} ei voi hyväksyä${entry.error ? ` (${entry.error})` : ''}.`);
    }
    if (!readConverted(loaded, source.source_id, entry.sha256, entry.path)) throw new UserError(`${file}: muunnos puuttuu. Aja source scan.`);
    Object.assign(entry, { approved_sha256: entry.sha256, approved_at: nowIso(), approved_by: approvedBy });
    delete entry.rejected_sha256;
    entry.status = deriveStatus(entry);
    approved.push(file);
  }
  writeInventory(loaded, inventory);
  return approved;
}

export function pendingFiles(loaded, sourceId) {
  return Object.values(readInventory(loaded, sourceId).files).filter((entry) => ['uusi', 'muuttunut'].includes(entry.status)).map((entry) => entry.path);
}

// Hylkäys koskee nykyistä versiota. Aiemmin hyväksytty versio pysyy julkaistuna,
// ellei withdraw poista hyväksyntää kokonaan.
export function rejectFile(loaded, source, file, { withdraw = false } = {}) {
  const inventory = readInventory(loaded, source.source_id);
  const entry = entryFor(inventory, file);
  if (entry.sha256) entry.rejected_sha256 = entry.sha256;
  if (withdraw) {
    delete entry.approved_sha256;
    delete entry.approved_at;
    delete entry.approved_by;
  }
  if (entry.missing && !entry.approved_sha256) delete inventory.files[file];
  else entry.status = deriveStatus(entry);
  writeInventory(loaded, inventory);
}

// --- Upload ---------------------------------------------------------------------

export function cleanFileName(name) {
  const base = path.basename(String(name || '').replace(/\\/g, '/')).normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '-').replace(/^[.\s-]+/, '').trim().slice(0, 150);
  if (!base || !path.extname(base)) throw new UserError('Tiedostonimi puuttuu tai siitä puuttuu pääte.');
  return base;
}

export function uploadFile(loaded, source, filename, originalName) {
  if (source.type !== 'upload') throw new UserError(`${source.source_id} ei ole upload-lähde. Lisää tiedosto lähteen hakemistoon.`);
  const limits = sourceLimits(loaded);
  const stat = fs.statSync(filename);
  if (stat.size > limits.max_file_bytes) throw new UserError(`Tiedosto on liian suuri (raja ${Math.round(limits.max_file_bytes / 1024 / 1024)} Mt).`);
  const name = cleanFileName(originalName || filename);
  const root = sourceFilesRoot(loaded, source);
  const destination = path.join(root, name);
  assertInside(root, destination);
  ensureDirectory(root);
  fs.copyFileSync(filename, destination);
  return name;
}

export function removeUploadedFile(loaded, source, file) {
  if (source.type !== 'upload') throw new UserError('Tiedostoja voi poistaa vain upload-lähteestä. Poista tiedosto lähteen hakemistosta.');
  const root = sourceFilesRoot(loaded, source);
  const target = path.join(root, file);
  assertInside(root, target);
  if (!fs.existsSync(target)) throw new UserError(`Tiedostoa ei ole: ${file}`);
  fs.rmSync(target);
}

// --- Esikatselu -------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function skippedText(skipped = {}) {
  const parts = [];
  if (skipped.images) parts.push(`kuvia ${skipped.images}`);
  if (skipped.objects) parts.push(`kaavioita tai upotettuja objekteja ${skipped.objects}`);
  if (skipped.other) parts.push('makrot');
  return parts.join(', ');
}

// Lähde, joka on linkitetty projekteihin, kuvaa järjestelmiä, joiden
// dokumentaatio on tarkistettu koodia vasten: silloin merkintä erottaa tietolajit.
// Ilman linkitystä koodia ei ole, ja merkintä kertoo hyväksynnän.
export function linkedToCode(source) {
  return Boolean(source.linked_projects?.length);
}

export function sourceLabel(source) {
  return linkedToCode(source) ? 'Lähdeaineisto, ei tarkistettu koodia vasten' : 'Hyväksytty lähdeaineisto';
}

export function documentHeader(source, entry, sha, converted = {}) {
  const skippedLine = skippedText(converted.skipped);
  // Hyväksyntä näytetään vain hyväksytystä versiosta, ei esikatselussa.
  const approved = entry.approved_sha256 === sha && entry.approved_at ? ` · Hyväksytty ${formatDate(entry.approved_at)}` : '';
  return [
    `> **${sourceLabel(source)}** · Lähde: ${source.display_name || source.source_id} (\`${source.source_id}\`)`,
    `> Tiedosto: \`${entry.path}\` · Muokattu ${formatDate(entry.mtime)}${approved}${source.owner ? ` · Omistaja: ${source.owner}` : ''}`
      + `${source.classification ? ` · Tietoluokka: ${source.classification}` : ''} · Tiiviste: \`${sha.slice(0, 12)}\``,
    ...(skippedLine ? [`> Ohitettu: ${skippedLine}`] : []),
    ...(converted.notes || []).map((note) => `> ${note}`),
  ].join('\n');
}

export function renderSourceDocument(source, entry, sha, converted) {
  return `# ${path.posix.basename(entry.path)}\n\n${documentHeader(source, entry, sha, converted)}\n\n${converted.markdown.trim()}\n`;
}

export function previewFile(loaded, source, file) {
  const inventory = readInventory(loaded, source.source_id);
  const entry = entryFor(inventory, file);
  const current = entry.sha256 ? readConverted(loaded, source.source_id, entry.sha256, entry.path) : null;
  const approved = entry.approved_sha256 && entry.approved_sha256 !== entry.sha256 ? readConverted(loaded, source.source_id, entry.approved_sha256, entry.path) : null;
  return {
    entry,
    markdown: current ? renderSourceDocument(source, entry, entry.sha256, current) : '',
    skipped: current?.skipped || null,
    diff: current && approved ? lineDiff(approved.markdown, current.markdown) : null,
  };
}

// Rivitason ero (LCS). Suurille tiedostoille palautetaan vain tieto erosta.
export function lineDiff(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 4_000_000) return { truncated: true, lines: [] };
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { lines.push({ op: ' ', text: a[i] }); i += 1; j += 1; }
    else if (j < b.length && (i === a.length || lengths[i][j + 1] >= lengths[i + 1][j])) { lines.push({ op: '+', text: b[j] }); j += 1; }
    else { lines.push({ op: '-', text: a[i] }); i += 1; }
  }
  return { truncated: false, lines };
}

// --- Julkaisu -------------------------------------------------------------------

export function approvedDocuments(loaded, source) {
  const inventory = readInventory(loaded, source.source_id);
  return Object.values(inventory.files)
    .filter((entry) => entry.approved_sha256 && !entry.missing)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((entry) => {
      const converted = readConverted(loaded, source.source_id, entry.approved_sha256, entry.path);
      if (!converted) throw new UserError(`${source.source_id}/${entry.path}: hyväksytyn version muunnos puuttuu.`);
      return { entry, sha256: entry.approved_sha256, converted };
    });
}

export function sourceDigest(source, documents) {
  return sha256([
    // Otsakkeen sisältö (merkintä ja hyväksyntäpäivä) kuuluu digestiin, koska
    // julkaisu on muuttumaton.
    source.source_id, source.display_name || '', source.owner || '', source.classification || '', sourceLabel(source),
    ...documents.map((document) => `${document.entry.path}\0${document.sha256}\0${document.entry.approved_at || ''}`),
  ].join('\0'));
}

export function publishSource(loaded, source) {
  const documents = approvedDocuments(loaded, source);
  const digest = sourceDigest(source, documents);
  const releaseRoot = path.join(storageRoot(loaded), 'sources', source.source_id, 'releases', digest);
  const documentRoot = path.join(releaseRoot, 'documents');
  const chunks = [];
  const files = [];
  for (const { entry, sha256: sha, converted } of documents) {
    const documentPath = `${entry.path}.md`;
    const destination = path.join(documentRoot, ...documentPath.split('/'));
    assertInside(documentRoot, destination);
    const content = renderSourceDocument(source, entry, sha, converted);
    writeFileAtomic(destination, content);
    const documentId = sha256(`${source.source_id}\0${digest}\0${entry.path}`).slice(0, 32);
    const isPdf = /\.pdf$/i.test(entry.path);
    splitMarkdownSections(content).forEach(({ heading, content: section }, index) => chunks.push({
      ...(isPdf && /^Sivu \d+$/.test(heading) ? { page: Number(heading.slice(5)) } : {}),
      document_id: documentId,
      section_id: sha256(`${entry.path}\0${heading}\0${index}`).slice(0, 24),
      kind: SOURCE_KIND,
      verified_against_code: false,
      source_id: source.source_id,
      release_id: digest,
      path: entry.path,
      modified: entry.mtime,
      sha256: sha,
      heading,
      content: section,
    }));
    files.push({ path: entry.path, sha256: sha, modified: entry.mtime, document_id: documentId });
  }
  ensureDirectory(releaseRoot);
  writeFileAtomic(path.join(releaseRoot, 'documents.jsonl'), chunks.length ? `${chunks.map((chunk) => JSON.stringify(chunk)).join('\n')}\n` : '');
  const manifest = {
    schema_version: 1,
    kind: SOURCE_KIND,
    source_id: source.source_id,
    display_name: source.display_name || source.source_id,
    owner: source.owner || '',
    classification: source.classification || '',
    linked_projects: source.linked_projects || [],
    digest,
    release_id: digest,
    created_at: nowIso(),
    document_count: documents.length,
    chunk_count: chunks.length,
    files,
  };
  writeJson(path.join(releaseRoot, 'manifest.json'), manifest);
  return manifest;
}

export function sourceReleaseRoot(loaded, sourceId, releaseId) {
  return path.join(storageRoot(loaded), 'sources', sourceId, 'releases', releaseId);
}

// --- Käyttöoikeudet -------------------------------------------------------------

// Rajaamaton principal näkee kaiken. sources-rajaus sallii luetellut lähteet;
// projektirajattu näkee lähteen, jonka kaikki linkitetyt projektit ovat sallittuja.
// Projektiton (organisaatiotason) lähde vaatii rajatulta erillisen luvan.
export function sourceAllowed(access, source) {
  if (!access || (!access.projects && !access.sources)) return true;
  if (access.sources?.includes(source.source_id)) return true;
  const linked = source.linked_projects || [];
  return Boolean(access.projects && linked.length && linked.every((projectId) => access.projects.includes(projectId)));
}

export function assertSourceAccess(access, source) {
  if (!sourceAllowed(access, source)) throw new UserError(`Käyttöoikeus lähteeseen puuttuu: ${source.source_id}`, 403);
}
