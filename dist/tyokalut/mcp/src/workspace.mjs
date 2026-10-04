import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { docsModeForRef, resolveRootPath } from './config.mjs';
import { checkoutRef, separateDocs } from './git.mjs';
import { UserError } from './errors.mjs';
import { assertInside, encodeSegment, ensureDirectory, nowIso, readJson, writeFileAtomic, writeJson } from './util.mjs';

// MCP asuu vnetcon-docs-hakemistossa: <vnetcon-docs>/tyokalut/mcp/src/workspace.mjs.
// Managed-työtilan menetelmä kopioidaan tästä samasta vnetcon-docs-hakemistosta.
const DOCS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Moottori: samat polut, jotka asennin päivittää (tyokalut/asenna.mjs --paivita).
// Projektikohtaiset tiedostot eivät kuulu tähän, joten työtilan voi luoda myös
// jo käyttöönotetusta asennuksesta.
const ENGINE_PATHS = ['metodi', 'tyokalut', '.claude/skills', '.claude/workflows', 'tila/metodi.yaml',
  'CLAUDE.md', 'AGENTS.md', 'README.md', 'vnetcon.config.example.yaml', '.gitignore'];
const ENGINE_EXCLUDE = new Set(['tyokalut/mcp', 'metodi/kartoitus.md', 'metodi/sanasto.md', 'metodi/ohjaus.md']);

// Projektikohtaiset tiedostot otetaan koskemattomasta asennuspohjasta.
const TEMPLATE_ROOT = path.join(DOCS_ROOT, 'metodi', 'mallipohjat', 'asennuspohja');
const TEMPLATE_FILES = {
  'tila/edistyminen.md': 'tila/edistyminen.md',
  'tila/projekti.yaml': 'tila/projekti.yaml',
  'tila/rakenne.yaml': 'tila/rakenne.yaml',
  'tila/rekisteri.yaml': 'tila/rekisteri.yaml',
  'tila/synkronoitu.yaml': 'tila/synkronoitu.yaml',
  'metodi/kartoitus.md': 'metodi/kartoitus.md',
  'metodi/sanasto.md': 'metodi/sanasto.md',
  'metodi/ohjaus.md': 'metodi/ohjaus.md',
  'johdanto.md': 'johdanto.md',
  'claude-settings.json': '.claude/settings.json',
};
const CONTENT_DIRECTORIES = ['moduulit', 'jarjestelmaprosessit', 'liiketoimintaprosessit', 'datamallit', 'tiketit'];

function copyEngine(target) {
  for (const enginePath of ENGINE_PATHS) {
    const source = path.join(DOCS_ROOT, ...enginePath.split('/'));
    if (!fs.existsSync(source)) continue;
    const destination = path.join(target, ...enginePath.split('/'));
    ensureDirectory(path.dirname(destination));
    fs.cpSync(source, destination, {
      recursive: true,
      force: false,
      filter: (item) => {
        const relative = path.relative(DOCS_ROOT, item).split(path.sep).join('/');
        if (ENGINE_EXCLUDE.has(relative)) return false;
        return !relative.split('/').some((part) => part === 'node_modules' || part === '.DS_Store');
      },
    });
  }
  for (const [template, destination] of Object.entries(TEMPLATE_FILES)) {
    const source = path.join(TEMPLATE_ROOT, ...template.split('/'));
    if (!fs.existsSync(source)) throw new UserError(`Asennuspohja puuttuu: ${source}. Päivitä vnetcon-docs.`);
    const file = path.join(target, ...destination.split('/'));
    ensureDirectory(path.dirname(file));
    fs.copyFileSync(source, file);
  }
  for (const directory of CONTENT_DIRECTORIES) {
    ensureDirectory(path.join(target, directory));
    writeFileAtomic(path.join(target, directory, '.gitkeep'), '');
  }
}

export function runtimeRoot(loaded) {
  return resolveRootPath(loaded, loaded.config.documentation?.workspace_root || './.multiproject/workspaces');
}

export function stateFilename(loaded, projectId, ref) {
  return path.join(loaded.root, '.multiproject', 'state', projectId, `${encodeSegment(ref)}.json`);
}

export function readWorkspaceState(loaded, projectId, ref) {
  return readJson(stateFilename(loaded, projectId, ref));
}

export function bootstrapProject(project, ref, loaded) {
  const root = runtimeRoot(loaded);
  ensureDirectory(root);
  const documentation = docsModeForRef(project, ref);
  const checkout = checkoutRef(project, ref, loaded, root, {
    preserveManagedDocs: documentation.mode === 'managed',
  });
  let docsRoot;
  let status;
  let docsCommitSha = null;

  if (documentation.mode === 'separate') {
    // Dokumentaatio omasta repositorystaan, koodi lähderepositorysta. Kumpikin
    // haetaan tarkkaan committiin; lähderepositoryyn ei kirjoiteta mitään.
    const docs = separateDocs(project, ref);
    const docsCheckout = checkoutRef(docs.project, docs.ref, loaded, root, { directory: 'docs', directoryRef: ref });
    docsRoot = path.resolve(docsCheckout.source, docs.sourcePath);
    assertInside(docsCheckout.source, docsRoot);
    if (!fs.existsSync(docsRoot) || !fs.statSync(docsRoot).isDirectory()) {
      throw new UserError(`${project.project_id}@${ref}: separate-mallin dokumentaatiota ei ole: ${docsRoot}`);
    }
    docsCommitSha = docsCheckout.sha;
    status = 'validated';
  } else if (documentation.mode === 'repository') {
    docsRoot = path.resolve(checkout.source, documentation.source_path || 'vnetcon-docs');
    assertInside(checkout.source, docsRoot);
    if (!fs.existsSync(docsRoot) || !fs.statSync(docsRoot).isDirectory()) {
      throw new UserError(`${project.project_id}@${ref}: repository-mallin dokumentaatiota ei ole: ${docsRoot}`);
    }
    status = 'validated';
  } else {
    docsRoot = path.join(checkout.source, 'vnetcon-docs');
    if (!fs.existsSync(docsRoot)) {
      copyEngine(docsRoot);
      initialiseManagedConfig(docsRoot, project, checkout.source, loaded);
      const version = readPackageVersion();
      writeFileAtomic(path.join(docsRoot, '.vnetcon-docs-versio'), `${version}\n`);
    } else {
      ensureManagedConfig(docsRoot, project, checkout.source, loaded);
    }
    status = 'needs_documentation';
  }

  const previous = readWorkspaceState(loaded, project.project_id, ref);
  const state = {
    schema_version: 1,
    project_id: project.project_id,
    ref,
    source_commit_sha: checkout.sha,
    docs_commit_sha: docsCommitSha,
    revision_key: docsCommitSha ? `${checkout.sha}+${docsCommitSha}` : checkout.sha,
    previous_source_commit_sha: previous?.source_commit_sha || null,
    documentation_mode: documentation.mode,
    docs_root: docsRoot,
    source_root: checkout.source,
    status: previous?.source_commit_sha === checkout.sha ? (previous.status || status) : status,
    documentation_revision: previous?.source_commit_sha === checkout.sha
      ? (previous.documentation_revision || null)
      : null,
    approved_revision: previous?.source_commit_sha === checkout.sha
      ? (previous.approved_revision || null)
      : null,
    updated_at: nowIso(),
  };
  writeJson(stateFilename(loaded, project.project_id, ref), state);
  return state;
}

export function approveWorkspace(loaded, projectId, ref, revision) {
  const filename = stateFilename(loaded, projectId, ref);
  const state = readJson(filename);
  if (!state) throw new UserError(`Työtilaa ei ole alustettu: ${projectId}@${ref}`);
  state.documentation_revision = revision;
  state.approved_revision = revision;
  state.status = 'approved';
  state.approved_at = nowIso();
  writeJson(filename, state);
  return state;
}

export function updateWorkspaceRevision(loaded, state, revision) {
  state.documentation_revision = revision;
  if (state.documentation_mode === 'repository' || state.documentation_mode === 'separate') {
    state.approved_revision = revision;
    state.status = 'validated';
  } else if (state.approved_revision !== revision) {
    state.status = 'review_required';
  }
  state.updated_at = nowIso();
  writeJson(stateFilename(loaded, state.project_id, state.ref), state);
  return state;
}

// Managed-työtila on syvällä MCP-työtilan sisällä, joten sille kerrotaan, missä
// yhteinen ohjaus ja integraatiotietueet ovat (konventiot.md kohta 11).
function guidancePointers(docsRoot, loaded) {
  const relative = (target) => path.relative(docsRoot, target).split(path.sep).join('/');
  return {
    yhteiset: relative(resolveRootPath(loaded, loaded.config.guidance?.path || './yhteiset')),
    integraatiot: relative(resolveRootPath(loaded, loaded.config.interfaces?.path || './interfaces')),
  };
}

function initialiseManagedConfig(docsRoot, project, sourceRoot, loaded) {
  const example = path.join(docsRoot, 'vnetcon.config.example.yaml');
  const config = fs.existsSync(example) ? YAML.parse(fs.readFileSync(example, 'utf8')) : {};
  config.versio = config.versio || 1;
  config.projekti = {
    ...(config.projekti || {}),
    nimi: project.display_name || project.project_id,
    juuri: path.relative(docsRoot, sourceRoot).split(path.sep).join('/'),
    versionhallinta: 'git',
    paahaara: project.refs.default,
    vain_versioitu: true,
  };
  config.ohjaus = { ...(config.ohjaus || {}), ...guidancePointers(docsRoot, loaded) };
  writeFileAtomic(path.join(docsRoot, 'vnetcon.config.yaml'), YAML.stringify(config, { lineWidth: 100 }));
}

function ensureManagedConfig(docsRoot, project, sourceRoot, loaded) {
  const filename = path.join(docsRoot, 'vnetcon.config.yaml');
  if (!fs.existsSync(filename)) {
    initialiseManagedConfig(docsRoot, project, sourceRoot, loaded);
    return;
  }
  const config = YAML.parse(fs.readFileSync(filename, 'utf8')) || {};
  config.projekti = config.projekti || {};
  config.projekti.juuri = path.relative(docsRoot, sourceRoot).split(path.sep).join('/');
  config.ohjaus = { ...(config.ohjaus || {}), ...guidancePointers(docsRoot, loaded) };
  writeFileAtomic(filename, YAML.stringify(config, { lineWidth: 100 }));
}

// Asennetussa tai puretussa paketissa versio on .vnetcon-docs-versio-tiedostossa;
// lähderepossa (vnetcon-docs = dist/) se on repon juuren VERSIO-tiedostossa.
function readPackageVersion() {
  for (const filename of [path.join(DOCS_ROOT, '.vnetcon-docs-versio'), path.join(DOCS_ROOT, '..', 'VERSIO')]) {
    try {
      const version = fs.readFileSync(filename, 'utf8').trim();
      if (version) return version;
    } catch { /* seuraava */ }
  }
  return 'workspace';
}

export function packageRoot() {
  return DOCS_ROOT;
}
