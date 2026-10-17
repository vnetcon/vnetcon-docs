import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getChannel, getProject } from './config.mjs';
import { UserError } from './errors.mjs';
import { loadChannel, storageRoot } from './publisher.mjs';
import { listInterfaces, readSharedGuidance } from './search.mjs';
import { readPackageVersion } from './workspace.mjs';
import { readZip, writeZip } from './zip.mjs';
import { assertInside, ensureDirectory, listFilesRecursive, nowIso, readJson, sha256, writeFileAtomic, writeJson } from './util.mjs';

// Vientipaketti: julkaistun kanavan dokumentaatio tiedostoina AI-clientin
// kontekstiksi silloin, kun MCP-yhteyttä ei voida käyttää. Lähde on aina julkaistu
// snapshot, ei työtila, joten viennin sisältö on hyväksyttyä ja sen tunnisteet
// ovat samat kuin MCP-julkaisun. Vienti on varakanava: se kertoo, mistä versiosta
// se on tehty, ja export list näyttää, milloin kanavassa on uudempi julkaisu.

const require = createRequire(import.meta.url);
const MCP_VERSION = require('../package.json').version;

export const SAFE_EXPORT_ID = /^[a-z0-9][a-z0-9._-]{1,62}$/;
const KIND = 'koodidokumentaatio';
const UPLOAD_DIR = 'tiedostot';

// Rajat palveluiden ohjeista (tarkistettu 17.10.2026; checked + sources kertovat
// mistä). Ne vaihtelevat palvelun ja tilaustason mukaan, ja konfiguraatio voi
// korvata ne: exports.profiles.<nimi>.{max_files,max_file_bytes,instructions_chars,label,grouping}.
// max_file_bytes on laatuun perustuva raja, ei palvelun enimmäiskoko: ChatGPT
// lukee tekstitiedostosta enintään 2 miljoonaa tokenia, ja suomenkielinen teksti
// vie tokeneita enemmän kuin englanti, joten 5 Mt jättää varaa.
export const DEFAULT_PROFILES = {
  'chatgpt-projekti': {
    label: 'ChatGPT-projekti (Business, Enterprise, Edu, Pro): projektin tiedostot ja ohjeet',
    grouping: 'merged', max_files: 40, max_file_bytes: 5 * 1024 * 1024, instructions_chars: 8000,
    checked: '2026-10-17',
    notes: 'Plus ja Go: 25 tiedostoa, Free: 5 (aseta max_files). Kerralla voi ladata 10 tiedostoa. '
      + 'Tiedosto enintään 512 Mt ja 2 milj. tokenia. Projektin ohjekentän pituudelle ei löytynyt virallista rajaa; '
      + '8000 merkkiä on sama kuin Custom GPT:ssä.',
    sources: ['https://help.openai.com/en/articles/10169521-projects-in-chatgpt', 'https://help.openai.com/en/articles/8555545-file-uploads-faq'],
  },
  'custom-gpt': {
    label: 'Custom GPT: Knowledge-tiedostot ja Instructions',
    grouping: 'merged', max_files: 20, max_file_bytes: 5 * 1024 * 1024, instructions_chars: 8000,
    checked: '2026-10-17',
    notes: '20 tiedostoa GPT:n elinkaaren aikana, ohjeteksti enintään 8000 merkkiä. Tiedosto enintään 512 Mt ja 2 milj. tokenia.',
    sources: ['https://help.openai.com/en/articles/8555545-file-uploads-faq', 'https://help.openai.com/en/articles/8843948-knowledge-in-gpts'],
  },
  'claude-projekti': {
    label: 'Claude-projekti: projektin tiedostot ja ohjeet',
    grouping: 'merged', max_files: null, max_file_bytes: 30 * 1024 * 1024, instructions_chars: null,
    checked: '2026-10-17',
    notes: 'Tiedostojen määrää ei rajata, tiedosto enintään 30 Mt. Kun sisältö lähestyy kontekstin rajaa, Claude siirtyy RAG-hakuun.',
    sources: ['https://support.claude.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude', 'https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects'],
  },
  yleinen: {
    label: 'Yleinen: yksi tiedosto per dokumentti (Copilot, Gemini, arkistointi)',
    grouping: 'per-document', max_files: null, max_file_bytes: null, instructions_chars: null,
  },
};

// Tiedostojen numerointi: 00–40 projektin dokumentaatio, 50 yhteinen ohjaus,
// 60 rajapinnat. 70 on varattu koodin ulkopuoliselle lähdeaineistolle.
const GROUPS = [
  ['liiketoimintaprosessit', '10-liiketoimintaprosessit'],
  ['jarjestelmaprosessit', '20-jarjestelmaprosessit'],
  ['datamallit', '40-datamallit'],
];

const TEXT = {
  fi: {
    header: (p) => `> **vnetcon-docs-vienti** · Projekti: ${p.display_name} (\`${p.project_id}\`) · Haara: \`${p.ref}\``,
    headerVersion: (p, date) => `> Lähdecommit: \`${p.source_commit_sha}\` · Julkaisu: \`${p.release_id}\` · Viety: ${date}`,
    headerCopy: 'Tämä on kopio julkaistusta dokumentaatiosta. Ajantasainen versio on MCP-palvelussa.',
    kind: 'Tietolaji: koodidokumentaatio (tarkistettu koodia vasten, sidottu committiin)',
    classification: (value) => `Tietoluokka: ${value}`,
    overview: 'Yleiskuva',
    documents: 'Dokumentit',
    documentTable: '| Dokumentti | Otsikko | Tiedosto |\n|---|---|---|',
    businessProcesses: 'Liiketoimintaprosessit',
    systemProcesses: 'Järjestelmäprosessit',
    dataModels: 'Datamallit',
    module: (name) => `Moduuli ${name}`,
    modules: 'Moduulit',
    metadata: 'Metatiedot',
    seeAlso: (target, file) => `ks. \`${target}\`${file ? ` tiedostossa \`${file}\`` : ''}`,
    guidanceTitle: 'Yhteinen ohjaus ja sanasto',
    guidanceIntro: 'Ihmisen ylläpitämä ohjaus kaikille projekteille. Menee oman päättelyn edelle.',
    interfacesTitle: 'Projektien väliset rajapinnat',
    interfacesIntro: 'Vain hyväksytyt (active) rajapintatietueet, joiden kaikki osapuolet ovat tässä viennissä.',
    instructions: ({ projects, multi, guidanceMode, files, version }) => [
      `Vastaa kysymyksiin järjestelmän ${projects.map((p) => p.display_name).join(', ')} liitetyn dokumentaation perusteella.`,
      '',
      'Säännöt:',
      '- Käytä vain liitettyjä tiedostoja. Jos tietoa ei löydy, sano se suoraan äläkä arvaa.',
      '- Mainitse vastauksessa dokumentin polku (esim. `moduulit/x/yleiskuvaus.md`) ja viennin versio: '
        + `${version}.`,
      '- Dokumentit on tehty koodista, ja niiden lähdeviitteet osoittavat koodiin. Kun kysymys koskee toteutusta, kerro lähdeviite.',
      '- Tämä on kopio tietystä versiosta. Jos käyttäjä kysyy muutoksista tämän jälkeen, kerro että dokumentaatio voi olla vanhentunut.',
      ...(multi ? ['- Liitteenä on useita järjestelmiä. Nimeä aina, mitä järjestelmää vastaus koskee, äläkä yhdistä eri järjestelmien käsitteitä, vaikka niillä olisi sama nimi.'] : []),
      ...(guidanceMode === 'file' ? ['- Lue yhteinen ohjaus ja sanasto tiedostosta `50-ohjaus-ja-sanasto.md`. Se menee oman päättelyn edelle.'] : []),
      '',
      `Tiedostot: ${files.join(', ')}`,
    ].join('\n'),
    guidanceInline: 'Yhteinen ohjaus ja sanasto (menee oman päättelyn edelle):',
    readme: ({ label, classification, profile, projects, files, created, instructionsChars, guidanceMode, warnings, exportId }) => [
      '# vnetcon-docs-vienti',
      '',
      `Vienti \`${exportId}\`, muodostettu ${created}.${label ? ` Vastaanottaja: ${label}.` : ''}`,
      classification ? `Tietoluokka: **${classification}**.` : null,
      '',
      'Paketti sisältää julkaistun dokumentaation tiedostoina AI-clientin kontekstiksi. '
        + 'Se on kopio tietystä versiosta: dokumentaatio ei päivity, kun koodi muuttuu.',
      '',
      '## Versio',
      '',
      '| Projekti | Haara | Lähdecommit | Julkaisu |',
      '|---|---|---|---|',
      ...projects.map((p) => `| ${p.display_name} (\`${p.project_id}\`) | \`${p.ref}\` | \`${p.source_commit_sha}\` | \`${p.release_id}\` |`),
      '',
      `## Käyttöönotto: ${profile.label}`,
      '',
      '1. Luo uusi projekti (tai GPT). Käytä yhtä projektia per järjestelmä ja versio.',
      `2. Lataa kansion \`${UPLOAD_DIR}/\` kaikki tiedostot (${files.length} kpl) projektin tiedostoiksi.`,
      `3. Kopioi \`ohjeet.md\`:n sisältö projektin ohjekenttään (Instructions)${instructionsChars ? `. Pituus ${instructionsChars} merkkiä.` : '.'}`,
      guidanceMode === 'file' ? '   Yhteinen ohjaus ei mahtunut ohjekenttään, joten se on tiedostona `50-ohjaus-ja-sanasto.md`.' : null,
      '4. Kokeile: kysy jotain, mihin vastaus löytyy dokumentaatiosta, ja tarkista, että vastaus mainitsee dokumentin polun.',
      '',
      '## Päivitys',
      '',
      'Kun saat uuden viennin, poista projektista vanhat tiedostot ennen uusien lataamista. '
        + 'Muuten vanha ja uusi versio sekoittuvat haussa.',
      '',
      '## Mitä puuttuu MCP-yhteyteen verrattuna',
      '',
      '- Ajantasaisuus: MCP-palvelu päivittyy koodin mukana, tämä paketti ei.',
      '- Projektien eristys: AI-clientin tiedostohaku ei pidä järjestelmiä erillään, joten käytä yhtä projektia per järjestelmä.',
      '- Käyttöoikeudet: kaikki, joilla on pääsy AI-clientin projektiin, näkevät koko sisällön.',
      '',
      '`manifest.json` sisältää tunnisteet ja tiedostojen tarkistussummat.',
      ...(warnings.length ? ['', '## Varoitukset', '', ...warnings.map((item) => `- ${item}`)] : []),
      '',
    ].filter((line) => line !== null).join('\n'),
  },
  en: {
    header: (p) => `> **vnetcon-docs export** · Project: ${p.display_name} (\`${p.project_id}\`) · Branch: \`${p.ref}\``,
    headerVersion: (p, date) => `> Source commit: \`${p.source_commit_sha}\` · Release: \`${p.release_id}\` · Exported: ${date}`,
    headerCopy: 'This is a copy of the published documentation. The current version is in the MCP service.',
    kind: 'Kind: code documentation (verified against the code, bound to a commit)',
    classification: (value) => `Classification: ${value}`,
    overview: 'Overview',
    documents: 'Documents',
    documentTable: '| Document | Title | File |\n|---|---|---|',
    businessProcesses: 'Business processes',
    systemProcesses: 'System processes',
    dataModels: 'Data models',
    module: (name) => `Module ${name}`,
    modules: 'Modules',
    metadata: 'Metadata',
    seeAlso: (target, file) => `see \`${target}\`${file ? ` in file \`${file}\`` : ''}`,
    guidanceTitle: 'Shared guidance and glossary',
    guidanceIntro: 'Human-maintained guidance for all projects. Takes precedence over your own inference.',
    interfacesTitle: 'Interfaces between projects',
    interfacesIntro: 'Only approved (active) interface records whose parties are all included in this export.',
    instructions: ({ projects, multi, guidanceMode, files, version }) => [
      `Answer questions about the system ${projects.map((p) => p.display_name).join(', ')} based on the attached documentation.`,
      '',
      'Rules:',
      '- Use only the attached files. If the information is not there, say so and do not guess.',
      `- In every answer, mention the document path (e.g. \`moduulit/x/yleiskuvaus.md\`) and the export version: ${version}.`,
      '- The documents were produced from the code, and their source references point to the code. When the question is about the implementation, give the source reference.',
      '- This is a copy of a specific version. If the user asks about later changes, say that the documentation may be out of date.',
      ...(multi ? ['- Several systems are attached. Always name the system your answer is about, and do not merge concepts from different systems even if they share a name.'] : []),
      ...(guidanceMode === 'file' ? ['- Read the shared guidance and glossary in `50-ohjaus-ja-sanasto.md`. It takes precedence over your own inference.'] : []),
      '',
      `Files: ${files.join(', ')}`,
    ].join('\n'),
    guidanceInline: 'Shared guidance and glossary (takes precedence over your own inference):',
    readme: ({ label, classification, profile, projects, files, created, instructionsChars, guidanceMode, warnings, exportId }) => [
      '# vnetcon-docs export',
      '',
      `Export \`${exportId}\`, created ${created}.${label ? ` Recipient: ${label}.` : ''}`,
      classification ? `Classification: **${classification}**.` : null,
      '',
      'The package contains the published documentation as files for an AI client. '
        + 'It is a copy of a specific version: it does not update when the code changes.',
      '',
      '## Version',
      '',
      '| Project | Branch | Source commit | Release |',
      '|---|---|---|---|',
      ...projects.map((p) => `| ${p.display_name} (\`${p.project_id}\`) | \`${p.ref}\` | \`${p.source_commit_sha}\` | \`${p.release_id}\` |`),
      '',
      `## Setup: ${profile.label}`,
      '',
      '1. Create a new project (or GPT). Use one project per system and version.',
      `2. Upload all files in \`${UPLOAD_DIR}/\` (${files.length}) as project files.`,
      `3. Paste the contents of \`ohjeet.md\` into the project instructions${instructionsChars ? ` (${instructionsChars} characters).` : '.'}`,
      guidanceMode === 'file' ? '   The shared guidance did not fit into the instructions, so it is the file `50-ohjaus-ja-sanasto.md`.' : null,
      '4. Test it: ask something the documentation answers and check that the answer mentions the document path.',
      '',
      '## Updating',
      '',
      'When you receive a new export, delete the old files from the project before uploading the new ones. '
        + 'Otherwise the old and new versions mix in search.',
      '',
      '## What is missing compared to the MCP connection',
      '',
      '- Freshness: the MCP service updates with the code, this package does not.',
      '- Project isolation: the AI client file search does not keep systems apart, so use one project per system.',
      '- Access control: everyone with access to the AI client project sees all of the content.',
      '',
      '`manifest.json` contains the identifiers and file checksums.',
      ...(warnings.length ? ['', '## Warnings', '', ...warnings.map((item) => `- ${item}`)] : []),
      '',
    ].filter((line) => line !== null).join('\n'),
  },
};

// --- Profiilit ja valinnat -----------------------------------------------------

export function exportProfiles(loaded) {
  const overrides = loaded.config.exports?.profiles || {};
  const result = {};
  for (const name of new Set([...Object.keys(DEFAULT_PROFILES), ...Object.keys(overrides)])) {
    result[name] = { name, ...(DEFAULT_PROFILES[name] || { grouping: 'merged', max_files: null, max_file_bytes: null, instructions_chars: null, label: name }), ...(overrides[name] || {}) };
  }
  return result;
}

export function exportOptions(flags, loaded) {
  const channelId = String(flags.channel || loaded.config.service.default_channel);
  const projects = String(flags.project || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!projects.length) throw new UserError('--project puuttuu. Anna yksi projekti (tai useita pilkulla erotettuna ja --multi-project).');
  if (projects.length > 1 && !flags['multi-project']) {
    throw new UserError('Useampi projekti samassa viennissä vaatii valitsimen --multi-project. '
      + 'AI-clientin tiedostohaku ei pidä projekteja erillään, joten oletus on yksi projekti per vienti.');
  }
  const profiles = exportProfiles(loaded);
  const target = String(flags.target || 'chatgpt-projekti');
  if (!profiles[target]) throw new UserError(`Tuntematon kohde: ${target}. Vaihtoehdot: ${Object.keys(profiles).join(', ')}`);
  const language = String(flags.lang || loaded.config.exports?.language || 'fi');
  if (!TEXT[language]) throw new UserError('--lang pitää olla fi tai en.');
  const label = cleanText(flags.label, 120);
  const classification = cleanText(flags.classification, 40);
  return {
    channel_id: channelId,
    projects: [...new Set(projects)],
    target,
    language,
    label,
    classification,
    include_guidance: !flags['no-guidance'],
    include_interfaces: !flags['no-interfaces'],
  };
}

function cleanText(value, max) {
  if (value === undefined || value === true) return '';
  return String(value).replace(/[\u0000-\u001f\u007f<>`|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// --- Paketin muodostus -------------------------------------------------------

function releaseDocuments(loaded, release) {
  const root = path.join(storageRoot(loaded), 'projects', release.project_id, 'releases', release.release_id, 'documents');
  if (!fs.existsSync(root)) throw new UserError(`Julkaisun dokumentit puuttuvat: ${release.project_id}/${release.release_id}. Julkaise kanava uudelleen.`);
  return listFilesRecursive(root, (file) => file.endsWith('.md')).map((filename) => {
    assertInside(root, filename);
    return { path: path.relative(root, filename).split(path.sep).join('/'), content: fs.readFileSync(filename, 'utf8') };
  });
}

function slug(value) {
  return String(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
}

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? { frontmatter: match[1], body: content.slice(match[0].length) } : { frontmatter: '', body: content };
}

function documentTitle(document) {
  const { body } = splitFrontmatter(document.content);
  const heading = body.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  return heading ? heading.replace(/^#\s+/, '').trim() : document.path;
}

// Otsikot siirretään alemmas koodilohkojen ulkopuolella, frontmatter näytetään
// YAML-lohkona ja dokumenttien väliset .md-linkit muutetaan viittauksiksi
// viennin tiedostoon. Lähdeviitteet jäävät sellaisiksi kuin ne ovat.
function transformDocument(document, levels, fileOf, text) {
  const { frontmatter, body } = splitFrontmatter(document.content);
  let fenced = false;
  const lines = body.replace(/\r\n/g, '\n').split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced || /^\s*(```|~~~)/.test(line)) return line;
    let result = line;
    if (levels && /^#{1,6}\s/.test(result)) {
      const hashes = result.match(/^#+/)[0].length;
      result = `${'#'.repeat(Math.min(hashes + levels, 6))}${result.slice(hashes)}`;
    }
    return result.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, bang, label, href) => {
      if (bang || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return whole;
      const [target] = href.split('#');
      if (!target.endsWith('.md')) return whole;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(document.path), target));
      return `${label} (${text.seeAlso(resolved, fileOf(resolved))})`;
    });
  });
  const meta = frontmatter ? `**${text.metadata}**\n\n\`\`\`yaml\n${frontmatter}\n\`\`\`\n\n` : '';
  return `${meta}${lines.join('\n').trim()}\n`;
}

function fileHeader(project, text, date, classification) {
  return [
    text.header(project),
    text.headerVersion(project, date),
    `> ${text.kind}${classification ? ` · ${text.classification(classification)}` : ''}`,
    `> ${text.headerCopy}`,
    '',
  ].join('\n');
}

function documentBlock(document, fileOf, text) {
  const documentId = sha256(document.path).slice(0, 16);
  return `<!-- vnetcon:document path="${document.path}" id="${documentId}" kind="${KIND}" -->\n## ${document.path}\n\n${transformDocument(document, 2, fileOf, text)}`;
}

// Ryhmittely: kiinteät ryhmät + yksi tiedosto per moduuli. Jos tiedostoraja
// ylittyy, moduulit kootaan tasakokoisiin ryhmiin.
function planProjectFiles(project, documents, slotsForModules) {
  const prefix = slug(project.project_id);
  const files = [];
  const byGroup = new Map();
  const modules = new Map();
  for (const document of documents) {
    const [top, second] = document.path.split('/');
    if (top === 'moduulit' && second && document.path.split('/').length > 2) {
      if (!modules.has(second)) modules.set(second, []);
      modules.get(second).push(document);
    } else if (GROUPS.some(([group]) => group === top)) {
      if (!byGroup.has(top)) byGroup.set(top, []);
      byGroup.get(top).push(document);
    } else {
      if (!byGroup.has('yleiskuva')) byGroup.set('yleiskuva', []);
      byGroup.get('yleiskuva').push(document);
    }
  }
  files.push({ name: `${prefix}-00-yleiskuva.md`, role: 'overview', documents: byGroup.get('yleiskuva') || [] });
  for (const [group, base] of GROUPS) {
    if (byGroup.has(group)) files.push({ name: `${prefix}-${base}.md`, role: group, documents: byGroup.get(group) });
  }
  const moduleList = [...modules.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (slotsForModules === null || moduleList.length <= slotsForModules) {
    for (const [name, docs] of moduleList) files.push({ name: `${prefix}-30-moduuli-${slug(name)}.md`, role: 'module', modules: [name], documents: docs });
  } else {
    const buckets = Array.from({ length: Math.max(1, slotsForModules) }, () => ({ size: 0, modules: [], documents: [] }));
    const sized = moduleList.map(([name, docs]) => ({ name, docs, size: docs.reduce((sum, doc) => sum + doc.content.length, 0) }))
      .sort((a, b) => b.size - a.size);
    for (const item of sized) {
      const bucket = buckets.reduce((best, candidate) => (candidate.size < best.size ? candidate : best));
      bucket.size += item.size;
      bucket.modules.push(item.name);
      bucket.documents.push(...item.docs);
    }
    buckets.filter((bucket) => bucket.modules.length).forEach((bucket, index) => {
      bucket.modules.sort();
      bucket.documents.sort((a, b) => a.path.localeCompare(b.path));
      files.push({ name: `${prefix}-30-moduulit-${index + 1}.md`, role: 'modules', modules: bucket.modules, documents: bucket.documents });
    });
  }
  return files;
}

function fixedFileCount(documents) {
  const tops = new Set(documents.map((document) => document.path.split('/')[0]));
  return 1 + GROUPS.filter(([group]) => tops.has(group)).length;
}

function moduleCount(documents) {
  return new Set(documents.filter((document) => document.path.split('/').length > 2 && document.path.startsWith('moduulit/'))
    .map((document) => document.path.split('/')[1])).size;
}

function guidanceText(loaded, text) {
  const documents = readSharedGuidance(loaded);
  if (!documents.length) return { documents, markdown: '', digest: '' };
  const markdown = documents.map((document) => `<!-- vnetcon:guidance path="${document.path}" -->\n${transformDocument(document, 1, () => '', text)}`).join('\n');
  return { documents, markdown, digest: sha256(documents.map((document) => `${document.path}\0${document.content}`).join('\0')) };
}

function exportInterfaces(loaded, projectIds) {
  const selected = listInterfaces(loaded).filter((item) => item.status === 'active').filter((item) => {
    const parties = [item.provider?.project_id, ...(item.consumers || []).map((consumer) => consumer.project_id)].filter(Boolean);
    return parties.length && parties.every((projectId) => projectIds.includes(projectId));
  }).sort((a, b) => a.interface_id.localeCompare(b.interface_id));
  const files = selected.map((item) => ({ id: item.interface_id, content: fs.readFileSync(path.join(interfacesRoot(loaded), item._source), 'utf8') }));
  return { items: files, digest: sha256(files.map((item) => `${item.id}\0${item.content}`).join('\0')) };
}

function interfacesRoot(loaded) {
  const configured = loaded.config.interfaces?.path || './interfaces';
  return path.isAbsolute(configured) ? configured : path.resolve(loaded.root, configured);
}

// Muodostaa paketin muistiin. Ei kirjoita mitään.
export function buildExport(loaded, options, { createdAt = nowIso(), createdBy = '' } = {}) {
  const profile = exportProfiles(loaded)[options.target];
  const text = TEXT[options.language];
  getChannel(loaded.config, options.channel_id);
  let bundle;
  try { bundle = loadChannel(options.channel_id, loaded); } catch {
    throw new UserError(`Kanavaa ${options.channel_id} ei ole julkaistu. Julkaise se ensin: publish --channel ${options.channel_id}`);
  }
  const date = createdAt.slice(0, 10);
  const warnings = [];

  const projects = options.projects.map((projectId) => {
    const configured = getProject(loaded.config, projectId);
    const release = bundle.projects.find((item) => item.project_id === projectId);
    if (!release) throw new UserError(`Projekti ${projectId} ei kuulu kanavan ${options.channel_id} julkaisuun.`);
    const documents = releaseDocuments(loaded, release);
    if (!documents.length) throw new UserError(`${projectId}: julkaisussa ei ole dokumentteja.`);
    return {
      project_id: projectId,
      display_name: configured.display_name || projectId,
      ref: release.ref,
      source_commit_sha: release.source_commit_sha,
      documentation_revision: release.documentation_revision,
      release_id: release.release_id,
      documents,
    };
  });

  const guidance = options.include_guidance ? guidanceText(loaded, text) : { documents: [], markdown: '', digest: '' };
  const interfaces = options.include_interfaces ? exportInterfaces(loaded, options.projects) : { items: [], digest: '' };
  const versionText = projects.map((p) => `${p.project_id}@${p.ref} ${p.source_commit_sha.slice(0, 12)}`).join(', ') + ` (${date})`;

  // Tiedostosuunnitelma
  const bundleLevel = [];
  let guidanceMode = guidance.markdown ? 'instructions' : 'none';
  const uploads = [];
  if (profile.grouping === 'per-document') {
    for (const project of projects) {
      for (const document of project.documents) {
        uploads.push({ name: `${slug(project.project_id)}/${document.path.split('/').map(slug).join('/')}`, project, role: 'document', documents: [document] });
      }
    }
  } else {
    const fixed = projects.reduce((sum, project) => sum + fixedFileCount(project.documents), 0);
    // Ohjaukselle varataan tiedosto vain, jos se ei arviolta mahdu ohjekenttään.
    const guidanceNeedsFile = guidance.markdown && profile.instructions_chars && guidance.markdown.length + 2000 > profile.instructions_chars;
    const reserved = (interfaces.items.length ? 1 : 0) + (guidanceNeedsFile ? 1 : 0);
    const modules = projects.map((project) => moduleCount(project.documents));
    let slots = null;
    if (profile.max_files) {
      const available = profile.max_files - fixed - reserved;
      const totalModules = modules.reduce((sum, value) => sum + value, 0);
      if (totalModules > available) {
        // Moduulipaikat jaetaan projekteille moduulimäärien suhteessa, vähintään yksi.
        slots = modules.map((count) => Math.max(1, Math.floor((Math.max(available, projects.length) * count) / Math.max(totalModules, 1))));
        warnings.push(`Moduulit koottiin ryhmiin, jotta tiedostoja on enintään ${profile.max_files} (profiili ${profile.name}).`);
      }
    }
    projects.forEach((project, index) => {
      for (const file of planProjectFiles(project, project.documents, slots ? slots[index] : null)) uploads.push({ ...file, project });
    });
  }

  const fileOfDocument = new Map();
  for (const upload of uploads) for (const document of upload.documents) fileOfDocument.set(`${upload.project.project_id}\0${document.path}`, upload.name);

  const rendered = [];
  for (const upload of uploads) {
    const project = upload.project;
    const fileOf = (target) => fileOfDocument.get(`${project.project_id}\0${target}`) || '';
    const header = fileHeader(project, text, date, options.classification);
    let content;
    if (upload.role === 'document') {
      const document = upload.documents[0];
      content = `${header}\n<!-- vnetcon:document path="${document.path}" kind="${KIND}" -->\n${transformDocument(document, 0, fileOf, text)}`;
    } else if (upload.role === 'overview') {
      const index = projectIndex(project, fileOfDocument, text);
      content = `${header}\n# ${project.display_name}: ${text.overview}\n\n${upload.documents.map((document) => documentBlock(document, fileOf, text)).join('\n')}\n## ${text.documents}\n\n${index}\n`;
    } else {
      const title = upload.role === 'liiketoimintaprosessit' ? text.businessProcesses
        : upload.role === 'jarjestelmaprosessit' ? text.systemProcesses
          : upload.role === 'datamallit' ? text.dataModels
            : upload.modules.length === 1 ? text.module(upload.modules[0]) : `${text.modules}: ${upload.modules.join(', ')}`;
      content = `${header}\n# ${project.display_name}: ${title}\n\n${upload.documents.map((document) => documentBlock(document, fileOf, text)).join('\n')}`;
    }
    rendered.push({ name: upload.name, kind: KIND, project_id: project.project_id, documents: upload.documents.map((document) => document.path), content });
  }

  // Ohjeteksti; yhteinen ohjaus mukaan, jos se mahtuu profiilin merkkirajaan.
  const uploadNames = () => {
    const names = [...rendered, ...bundleLevel].map((file) => file.name);
    return names.length > 30 ? [`${names.length} (${UPLOAD_DIR}/)`] : names;
  };
  const makeInstructions = (mode) => {
    const base = text.instructions({ projects, multi: projects.length > 1, guidanceMode: mode, files: uploadNames(), version: versionText });
    return mode === 'instructions' ? `${base}\n\n${text.guidanceInline}\n\n${guidance.markdown}` : base;
  };
  if (interfaces.items.length) {
    bundleLevel.push({
      name: '60-rajapinnat.md',
      kind: 'rajapinnat',
      documents: interfaces.items.map((item) => `interfaces/${item.id}`),
      content: `# ${text.interfacesTitle}\n\n${text.interfacesIntro}\n\n${interfaces.items.map((item) => `## ${item.id}\n\n\`\`\`yaml\n${item.content.trim()}\n\`\`\`\n`).join('\n')}`,
    });
  }
  let instructions = makeInstructions(guidanceMode);
  if (guidanceMode === 'instructions' && profile.instructions_chars && instructions.length > profile.instructions_chars) {
    guidanceMode = 'file';
    bundleLevel.push({
      name: '50-ohjaus-ja-sanasto.md',
      kind: 'yhteinen-ohjaus',
      documents: guidance.documents.map((document) => `yhteiset/${document.path}`),
      content: `# ${text.guidanceTitle}\n\n${text.guidanceIntro}\n\n${guidance.markdown}`,
    });
    instructions = makeInstructions('file');
  }
  if (profile.instructions_chars && instructions.length > profile.instructions_chars) {
    warnings.push(`Ohjeteksti on ${instructions.length} merkkiä, profiilin raja on ${profile.instructions_chars}.`);
  }
  bundleLevel.sort((a, b) => a.name.localeCompare(b.name));

  const uploadFiles = [...rendered, ...bundleLevel];
  if (profile.max_files && uploadFiles.length > profile.max_files) {
    warnings.push(`Ladattavia tiedostoja on ${uploadFiles.length}, profiilin raja on ${profile.max_files}. Rajaa projekteja tai käytä toista profiilia.`);
  }
  for (const file of uploadFiles) {
    const bytes = Buffer.byteLength(file.content);
    if (profile.max_file_bytes && bytes > profile.max_file_bytes) warnings.push(`${file.name} on ${formatBytes(bytes)}, profiilin raja on ${formatBytes(profile.max_file_bytes)}.`);
  }
  if (projects.length > 1) warnings.push('Viennissä on useita projekteja. AI-clientin tiedostohaku ei pidä niitä erillään.');

  const exportId = `${date.replace(/-/g, '')}-${slug(projects.length > 1 ? 'moniprojekti' : projects[0].project_id).slice(0, 36)}-${sha256(`${createdAt}\0${JSON.stringify(options)}\0${bundle.bundle_id}`).slice(0, 8)}`;
  const readme = text.readme({
    label: options.label, classification: options.classification, profile, projects, files: uploadFiles, created: createdAt,
    instructionsChars: instructions.trim().length, guidanceMode, warnings, exportId,
  });
  const entries = [
    { name: 'LUE-MINUT.md', data: readme },
    ...uploadFiles.map((file) => ({ name: `${UPLOAD_DIR}/${file.name}`, data: file.content })),
    { name: 'ohjeet.md', data: `${instructions.trim()}\n` },
  ];
  const manifest = {
    schema_version: 1,
    kind: 'vnetcon-docs-export',
    export_id: exportId,
    created_at: createdAt,
    created_by: createdBy,
    label: options.label,
    classification: options.classification,
    language: options.language,
    target: { name: profile.name, label: profile.label, grouping: profile.grouping, max_files: profile.max_files, max_file_bytes: profile.max_file_bytes, instructions_chars: profile.instructions_chars },
    channel_id: options.channel_id,
    bundle_id: bundle.bundle_id,
    vnetcon_docs_version: readPackageVersion(),
    mcp_version: MCP_VERSION,
    projects: projects.map(({ documents, ...rest }) => ({ ...rest, document_count: documents.length })),
    guidance: { included: Boolean(guidance.markdown), mode: guidanceMode, digest: guidance.digest },
    interfaces: { included: interfaces.items.map((item) => item.id), digest: interfaces.digest },
    instructions_chars: instructions.trim().length,
    files: entries.map((entry) => {
      const meta = uploadFiles.find((file) => `${UPLOAD_DIR}/${file.name}` === entry.name);
      return {
        path: entry.name,
        kind: meta?.kind || (entry.name === 'ohjeet.md' ? 'ohjeet' : 'lue-minut'),
        bytes: Buffer.byteLength(entry.data),
        sha256: sha256(entry.data),
        ...(meta ? { documents: meta.documents } : {}),
      };
    }),
    warnings,
  };
  entries.push({ name: 'manifest.json', data: `${JSON.stringify(manifest, null, 2)}\n` });
  return { manifest, entries, instructions: instructions.trim(), options };
}

function projectIndex(project, fileOfDocument, text) {
  const rows = project.documents.map((document) => `| \`${document.path}\` | ${documentTitle(document).replace(/\|/g, '\\|')} | \`${fileOfDocument.get(`${project.project_id}\0${document.path}`) || ''}\` |`);
  return `${text.documentTable}\n${rows.join('\n')}`;
}

function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mt` : `${Math.ceil(bytes / 1024)} kt`;
}

// --- Rekisteri ---------------------------------------------------------------

export function exportsRoot(loaded) {
  return path.join(storageRoot(loaded), 'exports');
}

function exportDir(loaded, exportId) {
  if (!SAFE_EXPORT_ID.test(String(exportId))) throw new UserError(`Virheellinen vienti_id: ${exportId}`);
  return path.join(exportsRoot(loaded), exportId);
}

export function createdByDefault() {
  if (process.env.VNETCON_UI_PRINCIPAL) return `ui:${process.env.VNETCON_UI_PRINCIPAL}`;
  try { return `cli:${os.userInfo().username}`; } catch { return 'cli'; }
}

export function saveExport(loaded, built) {
  const directory = exportDir(loaded, built.manifest.export_id);
  if (fs.existsSync(directory)) throw new UserError(`Vienti on jo olemassa: ${built.manifest.export_id}`);
  const content = path.join(directory, 'sisalto');
  for (const entry of built.entries) {
    const destination = path.join(content, ...entry.name.split('/'));
    assertInside(content, destination);
    writeFileAtomic(destination, entry.data);
  }
  writeFileAtomic(path.join(directory, 'paketti.zip'), writeZip(built.entries, new Date(built.manifest.created_at)));
  writeJson(path.join(directory, 'record.json'), {
    schema_version: 1,
    export_id: built.manifest.export_id,
    created_at: built.manifest.created_at,
    created_by: built.manifest.created_by,
    options: built.options,
    manifest: built.manifest,
  });
  return directory;
}

export function readExport(loaded, exportId) {
  const record = readJson(path.join(exportDir(loaded, exportId), 'record.json'));
  if (!record) throw new UserError(`Vientiä ei ole: ${exportId}`);
  return record;
}

export function listExports(loaded) {
  const root = exportsRoot(loaded);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((name) => SAFE_EXPORT_ID.test(name))
    .map((name) => readJson(path.join(root, name, 'record.json')))
    .filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function exportZip(loaded, exportId) {
  readExport(loaded, exportId);
  return fs.readFileSync(path.join(exportDir(loaded, exportId), 'paketti.zip'));
}

export function exportInstructions(loaded, exportId) {
  readExport(loaded, exportId);
  return fs.readFileSync(path.join(exportDir(loaded, exportId), 'sisalto', 'ohjeet.md'), 'utf8');
}

// Ajan tasalla, kun kanavan nykyinen julkaisu, yhteinen ohjaus ja rajapinnat
// ovat samat kuin viennissä.
export function exportStatus(loaded, record) {
  const manifest = record.manifest;
  if (!loaded.config.channels.some((channel) => channel.channel_id === manifest.channel_id)) {
    return { status: 'kanava-poistettu', reasons: [`Kanavaa ${manifest.channel_id} ei ole enää.`] };
  }
  let bundle;
  try { bundle = loadChannel(manifest.channel_id, loaded); } catch {
    return { status: 'kanava-poistettu', reasons: [`Kanavaa ${manifest.channel_id} ei ole julkaistu.`] };
  }
  const reasons = [];
  for (const project of manifest.projects) {
    const current = bundle.projects.find((item) => item.project_id === project.project_id);
    if (!current) reasons.push(`${project.project_id} ei ole enää kanavassa.`);
    else if (current.release_id !== project.release_id) {
      reasons.push(`${project.project_id}: uudempi julkaisu ${current.ref} ${current.source_commit_sha.slice(0, 12)} (viennissä ${project.source_commit_sha.slice(0, 12)}).`);
    }
  }
  const options = record.options || {};
  if (options.include_guidance) {
    const current = guidanceText(loaded, TEXT[manifest.language] || TEXT.fi).digest;
    if (current !== (manifest.guidance?.digest || '')) reasons.push('Yhteinen ohjaus tai sanasto on muuttunut.');
  }
  if (options.include_interfaces) {
    const current = exportInterfaces(loaded, manifest.projects.map((project) => project.project_id)).digest;
    if (current !== (manifest.interfaces?.digest || '')) reasons.push('Rajapintatietueet ovat muuttuneet.');
  }
  return { status: reasons.length ? 'vanhentunut' : 'ajan-tasalla', reasons };
}

export function exportSummary(loaded, record) {
  const manifest = record.manifest;
  return {
    export_id: record.export_id,
    created_at: record.created_at,
    created_by: record.created_by,
    label: manifest.label,
    classification: manifest.classification,
    target: manifest.target.name,
    language: manifest.language,
    channel_id: manifest.channel_id,
    projects: manifest.projects.map(({ project_id: projectId, display_name: displayName, ref, source_commit_sha: sha }) => ({ project_id: projectId, display_name: displayName, ref, source_commit_sha: sha })),
    files: manifest.files,
    warnings: manifest.warnings,
    instructions_chars: manifest.instructions_chars,
    ...exportStatus(loaded, record),
  };
}

export function exportsForProject(loaded, projectId) {
  return listExports(loaded).filter((record) => record.manifest.projects.some((project) => project.project_id === projectId));
}

export function removeExportData(loaded, exportId) {
  fs.rmSync(exportDir(loaded, exportId), { recursive: true, force: true });
}

// Roskakoria varten: hakemisto siirretään sellaisenaan.
export function moveExport(loaded, exportId, destination) {
  ensureDirectory(path.dirname(destination));
  fs.renameSync(exportDir(loaded, exportId), destination);
}

export function restoreExport(loaded, exportId, source) {
  const directory = exportDir(loaded, exportId);
  if (fs.existsSync(directory)) throw new UserError(`Vienti on jo olemassa: ${exportId}`);
  ensureDirectory(path.dirname(directory));
  fs.renameSync(source, directory);
}

export function writeExportTo(loaded, exportId, out) {
  const target = path.resolve(out);
  if (target.toLowerCase().endsWith('.zip')) {
    ensureDirectory(path.dirname(target));
    fs.writeFileSync(target, exportZip(loaded, exportId));
    return { kind: 'zip', path: target };
  }
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new UserError(`Hakemisto ei ole tyhjä: ${target}`);
  for (const entry of readZip(exportZip(loaded, exportId))) {
    const destination = path.join(target, ...entry.name.split('/'));
    assertInside(target, destination);
    writeFileAtomic(destination, entry.data);
  }
  return { kind: 'directory', path: target };
}
