import fs from 'node:fs';
import path from 'node:path';
import { getChannel, getProject, resolveRootPath } from './config.mjs';
import { UserError } from './errors.mjs';
import {
  assertInside,
  ensureDirectory,
  listFilesRecursive,
  nowIso,
  readJson,
  sha256,
  writeFileAtomic,
  writeJson,
} from './util.mjs';
import { readWorkspaceState, updateWorkspaceRevision } from './workspace.mjs';

const DEFAULT_GROUPS = ['liiketoimintaprosessit', 'jarjestelmaprosessit', 'moduulit', 'datamallit'];

export function storageRoot(loaded) {
  const storage = loaded.config.storage || { type: 'filesystem', root: './.multiproject/publications' };
  if (storage.type !== 'filesystem') {
    throw new UserError(`MVP tukee vain filesystem-tallennusta, saatiin: ${storage.type}`);
  }
  return resolveRootPath(loaded, storage.root);
}

export function collectDocuments(docsRoot) {
  const candidates = [];
  const introduction = path.join(docsRoot, 'johdanto.md');
  if (fs.existsSync(introduction) && !fs.lstatSync(introduction).isSymbolicLink()) candidates.push(introduction);
  for (const group of DEFAULT_GROUPS) {
    candidates.push(...listFilesRecursive(path.join(docsRoot, group), (file) => file.endsWith('.md')));
  }
  return [...new Set(candidates)].sort().map((filename) => {
    assertInside(docsRoot, filename);
    const relativePath = path.relative(docsRoot, filename).split(path.sep).join('/');
    const content = fs.readFileSync(filename, 'utf8');
    return { path: relativePath, content };
  });
}

export function calculateDocumentationRevision(docsRoot) {
  const documents = collectDocuments(docsRoot);
  return {
    documents,
    revision: sha256(documents.map((doc) => `${doc.path}\0${doc.content}`).join('\0')),
  };
}

export function publishProject(project, ref, loaded) {
  const state = readWorkspaceState(loaded, project.project_id, ref);
  if (!state) throw new UserError(`Työtilaa ei ole alustettu: ${project.project_id}@${ref}`);
  const { documents, revision: documentationRevision } = calculateDocumentationRevision(state.docs_root);
  if (documents.length === 0) {
    throw new UserError(`${project.project_id}@${ref}: julkaistavia Markdown-dokumentteja ei löytynyt.`);
  }
  updateWorkspaceRevision(loaded, state, documentationRevision);
  const policy = loaded.config.documentation?.publish_policy || 'approved';
  if (state.documentation_mode === 'managed' && policy === 'approved' && state.approved_revision !== documentationRevision) {
    throw new UserError(
      `${project.project_id}@${ref}: dokumentaatiorevisiota ei ole hyväksytty (${documentationRevision.slice(0, 12)}). `
      + `Aja approve --project ${project.project_id} --ref ${ref} --revision ${documentationRevision}.`,
    );
  }

  const releaseId = sha256([
    project.project_id,
    state.source_commit_sha,
    documentationRevision,
    '1',
  ].join('\0'));
  const root = storageRoot(loaded);
  const releaseRoot = path.join(root, 'projects', project.project_id, 'releases', releaseId);
  const documentRoot = path.join(releaseRoot, 'documents');
  ensureDirectory(documentRoot);

  const chunks = [];
  for (const document of documents) {
    const destination = path.join(documentRoot, ...document.path.split('/'));
    assertInside(documentRoot, destination);
    ensureDirectory(path.dirname(destination));
    writeFileAtomic(destination, document.content);
    chunks.push(...chunkMarkdown(project.project_id, releaseId, ref, state.source_commit_sha, document));
  }
  writeFileAtomic(path.join(releaseRoot, 'documents.jsonl'), `${chunks.map((chunk) => JSON.stringify(chunk)).join('\n')}\n`);
  const manifest = {
    schema_version: 1,
    project_id: project.project_id,
    ref,
    source_commit_sha: state.source_commit_sha,
    ...(state.docs_commit_sha ? { docs_commit_sha: state.docs_commit_sha } : {}),
    documentation_revision: documentationRevision,
    release_id: releaseId,
    created_at: nowIso(),
    document_count: documents.length,
    chunk_count: chunks.length,
  };
  writeJson(path.join(releaseRoot, 'manifest.json'), manifest);
  writeJson(path.join(root, 'projects', project.project_id, 'refs', `${Buffer.from(ref).toString('base64url')}.json`), manifest);
  return manifest;
}

export function publishChannel(channelId, loaded) {
  const channel = getChannel(loaded.config, channelId);
  const releases = [];
  for (const [projectId, ref] of Object.entries(channel.project_refs || {})) {
    releases.push(publishProject(getProject(loaded.config, projectId), ref, loaded));
  }
  if (releases.length === 0) throw new UserError(`Kanavalla ei ole projekteja: ${channelId}`);
  const bundleId = sha256(releases
    .map((release) => `${release.project_id}\0${release.release_id}`)
    .sort()
    .join('\0'));
  const bundle = { schema_version: 1, bundle_id: bundleId, channel_id: channelId, created_at: nowIso(), projects: releases };
  const root = storageRoot(loaded);
  writeJson(path.join(root, 'bundles', bundleId, 'manifest.json'), bundle);
  writeJson(path.join(root, 'channels', `${channelId}.json`), bundle);
  return bundle;
}

function chunkMarkdown(projectId, releaseId, ref, sourceCommitSha, document) {
  const lines = document.content.split(/\r?\n/);
  const chunks = [];
  let heading = '';
  let buffer = [];
  const flush = () => {
    const content = buffer.join('\n').trim();
    if (!content) return;
    const sectionId = sha256(`${document.path}\0${heading}\0${chunks.length}`).slice(0, 24);
    chunks.push({
      document_id: sha256(`${projectId}\0${releaseId}\0${document.path}`).slice(0, 32),
      section_id: sectionId,
      project_id: projectId,
      release_id: releaseId,
      ref,
      source_commit_sha: sourceCommitSha,
      path: document.path,
      heading,
      content,
    });
  };
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line) && buffer.length) {
      flush();
      buffer = [];
    }
    if (/^#{1,3}\s+/.test(line)) heading = line.replace(/^#+\s+/, '').trim();
    buffer.push(line);
  }
  flush();
  return chunks;
}

export function loadChannel(channelId, loaded) {
  const filename = path.join(storageRoot(loaded), 'channels', `${channelId}.json`);
  const bundle = readJson(filename);
  if (!bundle) throw new UserError(`Kanavaa ei ole julkaistu: ${channelId}`);
  return bundle;
}
