import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { docsModeForRef, resolveRootPath } from './config.mjs';
import { checkoutRef } from './git.mjs';
import { UserError } from './errors.mjs';
import { assertInside, encodeSegment, ensureDirectory, nowIso, readJson, writeFileAtomic, writeJson } from './util.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');

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

  if (documentation.mode === 'repository') {
    docsRoot = path.resolve(checkout.source, documentation.source_path || 'vnetcon-docs');
    assertInside(checkout.source, docsRoot);
    if (!fs.existsSync(docsRoot) || !fs.statSync(docsRoot).isDirectory()) {
      throw new UserError(`${project.project_id}@${ref}: repository-mallin dokumentaatiota ei ole: ${docsRoot}`);
    }
    status = 'validated';
  } else {
    docsRoot = path.join(checkout.source, 'vnetcon-docs');
    if (!fs.existsSync(docsRoot)) {
      fs.cpSync(DIST_ROOT, docsRoot, { recursive: true, force: false });
      initialiseManagedConfig(docsRoot, project, checkout.source);
      const version = readPackageVersion();
      writeFileAtomic(path.join(docsRoot, '.vnetcon-docs-versio'), `${version}\n`);
    } else {
      ensureManagedConfig(docsRoot, project, checkout.source);
    }
    status = 'needs_documentation';
  }

  const previous = readWorkspaceState(loaded, project.project_id, ref);
  const state = {
    schema_version: 1,
    project_id: project.project_id,
    ref,
    source_commit_sha: checkout.sha,
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
  if (state.documentation_mode === 'repository') {
    state.approved_revision = revision;
    state.status = 'validated';
  } else if (state.approved_revision !== revision) {
    state.status = 'review_required';
  }
  state.updated_at = nowIso();
  writeJson(stateFilename(loaded, state.project_id, state.ref), state);
  return state;
}

function initialiseManagedConfig(docsRoot, project, sourceRoot) {
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
  writeFileAtomic(path.join(docsRoot, 'vnetcon.config.yaml'), YAML.stringify(config, { lineWidth: 100 }));
}

function ensureManagedConfig(docsRoot, project, sourceRoot) {
  const filename = path.join(docsRoot, 'vnetcon.config.yaml');
  if (!fs.existsSync(filename)) {
    initialiseManagedConfig(docsRoot, project, sourceRoot);
    return;
  }
  const config = YAML.parse(fs.readFileSync(filename, 'utf8')) || {};
  config.projekti = config.projekti || {};
  config.projekti.juuri = path.relative(docsRoot, sourceRoot).split(path.sep).join('/');
  writeFileAtomic(filename, YAML.stringify(config, { lineWidth: 100 }));
}

function readPackageVersion() {
  try {
    return fs.readFileSync(path.join(PACKAGE_ROOT, 'VERSIO'), 'utf8').trim() || 'workspace';
  } catch {
    return 'workspace';
  }
}

export function packageRoot() {
  return PACKAGE_ROOT;
}
