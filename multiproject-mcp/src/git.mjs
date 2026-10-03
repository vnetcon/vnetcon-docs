import fs from 'node:fs';
import path from 'node:path';
import { UserError } from './errors.mjs';
import { ensureDirectory, encodeSegment, run } from './util.mjs';
import { resolveRootPath } from './config.mjs';

export function repositoryLocation(project, loaded) {
  if (project.repository.path) return resolveRootPath(loaded, project.repository.path);
  return project.repository.url;
}

export function inspectRepository(location) {
  const root = path.resolve(location);
  run('git', ['-C', root, 'rev-parse', '--git-dir']);
  const defaultRef = run('git', ['-C', root, 'branch', '--show-current']) || 'main';
  const remote = runOptional('git', ['-C', root, 'remote', 'get-url', 'origin']);
  const refs = run('git', ['-C', root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads'])
    .split('\n').filter(Boolean);
  return { root, defaultRef, remote, refs };
}

export function resolveRef(project, ref, loaded) {
  run('git', ['check-ref-format', '--branch', ref]);
  const location = repositoryLocation(project, loaded);
  if (project.repository.path) {
    const candidates = [ref, `refs/heads/${ref}`, `refs/remotes/origin/${ref}`];
    for (const candidate of candidates) {
      const sha = runOptional('git', ['-C', location, 'rev-parse', '--verify', `${candidate}^{commit}`]);
      if (sha) return sha;
    }
    throw new UserError(`${project.project_id}: refiä ei löydy: ${ref}`);
  }
  const output = run('git', ['ls-remote', location, ref, `refs/heads/${ref}`, `refs/tags/${ref}^{}`]);
  const sha = output.split(/\s+/)[0];
  if (!sha) throw new UserError(`${project.project_id}: refiä ei löydy: ${ref}`);
  return sha;
}

export function checkoutRef(project, ref, loaded, workspaceRoot, options = {}) {
  const sha = resolveRef(project, ref, loaded);
  const projectRoot = path.join(workspaceRoot, project.project_id, encodeSegment(ref));
  const source = path.join(projectRoot, 'source');
  const location = repositoryLocation(project, loaded);
  ensureDirectory(projectRoot);
  if (!fs.existsSync(path.join(source, '.git'))) {
    if (fs.existsSync(source)) fs.rmSync(source, { recursive: true, force: true });
    run('git', ['clone', '--no-checkout', location, source]);
  } else {
    run('git', ['-C', source, 'remote', 'set-url', 'origin', location]);
  }
  run('git', ['-C', source, 'fetch', '--prune', 'origin']);
  if (options.preserveManagedDocs) {
    const trackedDocs = runOptional('git', ['-C', source, 'cat-file', '-e', `${sha}:vnetcon-docs`]) === ''
      ? runOptional('git', ['-C', source, 'ls-tree', '--name-only', sha, '--', 'vnetcon-docs'])
      : 'vnetcon-docs';
    if (trackedDocs) {
      throw new UserError(
        `${project.project_id}@${ref}: lähdehaaraan on ilmestynyt versionhallittu vnetcon-docs/. `
        + 'Vaihda documentation.mode repositoryksi tai tee hallittu migraatio.',
      );
    }
    const exclude = path.join(source, '.git', 'info', 'exclude');
    ensureDirectory(path.dirname(exclude));
    const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
    if (!current.split(/\r?\n/).includes('/vnetcon-docs/')) {
      fs.appendFileSync(exclude, `${current.endsWith('\n') || !current ? '' : '\n'}/vnetcon-docs/\n`);
    }
  }
  run('git', ['-C', source, 'checkout', '--detach', '--force', sha]);
  run('git', ['-C', source, 'clean', '-fdx', '-e', 'vnetcon-docs']);
  return { projectRoot, source, sha };
}

export function runOptional(command, args, options = {}) {
  try {
    return run(command, args, options);
  } catch {
    return '';
  }
}
