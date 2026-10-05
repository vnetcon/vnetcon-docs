import fs from 'node:fs';
import path from 'node:path';
import { run } from './util.mjs';
import { packageRoot } from './workspace.mjs';

// Emoprojekti = Git-repository, jonka juureen tämä vnetcon-docs on asennettu.
// Lähderepon dist/-hakemistolla ei ole asennusversiota, joten sitä ei tarjota.
export function detectParentProject() {
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

export function runOptional(fn) {
  try {
    return fn();
  } catch {
    return '';
  }
}
