import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { getProject, resolveRootPath } from './config.mjs';
import { UserError } from './errors.mjs';
import { loadChannel, storageRoot } from './publisher.mjs';
import { listFilesRecursive } from './util.mjs';

function releaseForProject(bundle, projectId) {
  const release = bundle.projects.find((item) => item.project_id === projectId);
  if (!release) throw new UserError(`Projekti ${projectId} ei kuulu kanavaan ${bundle.channel_id}.`);
  return release;
}

function loadChunks(loaded, release) {
  const filename = path.join(
    storageRoot(loaded),
    'projects',
    release.project_id,
    'releases',
    release.release_id,
    'documents.jsonl',
  );
  if (!fs.existsSync(filename)) throw new UserError(`Hakuindeksi puuttuu: ${filename}`);
  return fs.readFileSync(filename, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

export function listProjects(loaded, channelId, selectedBundle) {
  const bundle = selectedBundle || loadChannel(channelId, loaded);
  return bundle.projects.map((release) => {
    const project = getProject(loaded.config, release.project_id);
    return {
      project_id: release.project_id,
      display_name: project.display_name || release.project_id,
      ref: release.ref,
      source_commit_sha: release.source_commit_sha,
      release_id: release.release_id,
      bundle_id: bundle.bundle_id,
    };
  });
}

export function getProjectVersion(loaded, channelId, projectId, selectedBundle) {
  const bundle = selectedBundle || loadChannel(channelId, loaded);
  const release = releaseForProject(bundle, projectId);
  return { ...release, bundle_id: bundle.bundle_id, channel_id: bundle.channel_id };
}

export function searchProject(loaded, channelId, projectId, query, limit = 8, selectedBundle) {
  if (!query.trim()) throw new UserError('Hakukysely on tyhjä.');
  const bundle = selectedBundle || loadChannel(channelId, loaded);
  const release = releaseForProject(bundle, projectId);
  const terms = [...new Set(query.toLocaleLowerCase('fi').split(/[^\p{L}\p{N}_-]+/u).filter((term) => term.length > 1))];
  const hits = loadChunks(loaded, release).map((chunk) => {
    const haystack = `${chunk.heading}\n${chunk.content}`.toLocaleLowerCase('fi');
    let score = 0;
    for (const term of terms) {
      let position = haystack.indexOf(term);
      while (position !== -1) {
        score += chunk.heading.toLocaleLowerCase('fi').includes(term) ? 4 : 1;
        position = haystack.indexOf(term, position + term.length);
      }
    }
    return { score, chunk };
  }).filter((hit) => hit.score > 0);
  hits.sort((a, b) => b.score - a.score || a.chunk.path.localeCompare(b.chunk.path));
  return hits.slice(0, Math.max(1, Math.min(Number(limit) || 8, 25))).map(({ score, chunk }) => ({
    score,
    project_id: chunk.project_id,
    release_id: chunk.release_id,
    ref: chunk.ref,
    source_commit_sha: chunk.source_commit_sha,
    document_id: chunk.document_id,
    section_id: chunk.section_id,
    path: chunk.path,
    heading: chunk.heading,
    excerpt: chunk.content.slice(0, 1600),
  }));
}

export function fetchDocument(loaded, channelId, projectId, documentId, selectedBundle) {
  const bundle = selectedBundle || loadChannel(channelId, loaded);
  const release = releaseForProject(bundle, projectId);
  const chunks = loadChunks(loaded, release).filter((chunk) => chunk.document_id === documentId);
  if (chunks.length === 0) throw new UserError(`Dokumenttia ei löytynyt projektista ${projectId}: ${documentId}`);
  return {
    project_id: projectId,
    release_id: release.release_id,
    ref: release.ref,
    source_commit_sha: release.source_commit_sha,
    document_id: documentId,
    path: chunks[0].path,
    content: chunks.map((chunk) => chunk.content).join('\n\n'),
  };
}

export function listInterfaces(loaded, projectId = '') {
  const interfaces = loaded.config.interfaces || {};
  if (interfaces.source !== 'directory') return [];
  const root = resolveRootPath(loaded, interfaces.path || './interfaces');
  return listFilesRecursive(root, (file) => /\.ya?ml$/i.test(file)).flatMap((filename) => {
    try {
      const item = YAML.parse(fs.readFileSync(filename, 'utf8'));
      if (!item?.interface_id) return [];
      const parties = [item.provider?.project_id, ...(item.consumers || []).map((consumer) => consumer.project_id)].filter(Boolean);
      if (projectId && !parties.includes(projectId)) return [];
      return [{ ...item, _source: path.relative(root, filename).split(path.sep).join('/') }];
    } catch {
      return [];
    }
  });
}

export function getInterface(loaded, interfaceId) {
  const item = listInterfaces(loaded).find((candidate) => candidate.interface_id === interfaceId);
  if (!item) throw new UserError(`Rajapintaa ei löytynyt: ${interfaceId}`);
  return item;
}
