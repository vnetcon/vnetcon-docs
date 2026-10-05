import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { getProject } from './config.mjs';
import { UserError } from './errors.mjs';
import { docsLocation } from './process.mjs';
import { ensureDirectory, nowIso, parseArgs, readJson, requireFlag, run, writeFileAtomic, writeJson } from './util.mjs';

// Agenttiajot ilman vuorovaikutusta. Agentti ajetaan vnetcon-ai:n kautta, jolloin
// projektin agentti- ja tiliasetukset (/agentit) ovat käytössä. Menetelmän
// hyväksyntäportit säilyvät: agentti kirjaa kysymyksensä tiedostoon ja lopettaa,
// ja ihmisen vastauksilla ajo jatkuu. Agentti ei commitoi.

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'multiproject-mcp.mjs');

export const WORKFLOWS = {
  'vnetcon-init': { skill: 'vnetcon-init', title: 'Käyttöönotto' },
  dokumentoi: { skill: 'dokumentoi', title: 'Dokumentointi', module: true },
  'dokumentoi-kaikki': { skill: 'dokumentoi-kaikki', title: 'Kattava dokumentointi' },
  synkronoi: { skill: 'synkronoi-dokumentaatio', title: 'Synkronointi koodimuutoksiin' },
  katselmoi: { skill: 'katselmoi', title: 'Katselmoinnin korjaukset', input: true },
  'kuvaa-integraatio': { skill: 'kuvaa-integraatio', title: 'Integraation kuvaus', input: true },
  yhdenmukaista: { skill: 'yhdenmukaista-dokumentaatio', title: 'Yhdenmukaistus' },
};

// Lukevat työkalut sallitaan; kirjoittavat git-komennot estetään. Muokkaukset
// sallitaan vain työhakemistossa (permission-mode acceptEdits).
const CLAUDE_ALLOWED = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(git -C:*)', 'Bash(git ls-files:*)', 'Bash(git grep:*)',
  'Bash(git log:*)', 'Bash(git diff:*)', 'Bash(git show:*)', 'Bash(git rev-parse:*)', 'Bash(git status:*)',
  'Bash(node tyokalut/*)', 'Bash(ls:*)', 'Bash(wc:*)', 'Bash(find:*)', 'Bash(cat:*)', 'Bash(head:*)', 'Bash(grep:*)', 'Bash(sort:*)'];
const CLAUDE_DISALLOWED = ['Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git push:*)', 'Bash(git -C .. add:*)',
  'Bash(git -C .. commit:*)', 'Bash(git -C .. push:*)', 'Bash(git reset:*)', 'Bash(git checkout:*)'];

function out(value = '') {
  process.stdout.write(`${value}\n`);
}

export function jobsRoot(loaded) {
  return path.join(loaded.root, '.multiproject', 'ajot');
}

export function readJob(loaded, id) {
  const meta = readJson(path.join(jobsRoot(loaded), path.basename(String(id)), 'meta.json'));
  if (!meta) throw new UserError(`Ajoa ei ole: ${id}`);
  if (meta.status === 'running' && !alive(meta.pid)) {
    meta.status = 'failed';
    meta.error = 'Ajoprosessi päättyi odottamatta.';
  }
  return meta;
}

export function listJobs(loaded) {
  const root = jobsRoot(loaded);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).sort().reverse().map((id) => {
    try { return readJob(loaded, id); } catch { return null; }
  }).filter(Boolean);
}

export function jobDetails(loaded, id) {
  const meta = readJob(loaded, id);
  const dir = path.join(jobsRoot(loaded), meta.id);
  const read = (name) => { try { return fs.readFileSync(path.join(dir, name), 'utf8'); } catch { return ''; } };
  return { ...meta, log: read('loki.txt'), questions: read('kysymykset.md'), summary: read('yhteenveto.md'), answers: read('vastaukset.md') };
}

export async function agentCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  if (action === 'run') return startJob(loaded, flags, null);
  if (action === 'list') {
    const jobs = listJobs(loaded);
    if (!jobs.length) return out('Agenttiajoja ei ole.');
    for (const job of jobs) out(`${job.status.padEnd(13)} ${job.id}  ${job.project_id}@${job.ref} ${job.workflow}`);
    return undefined;
  }
  if (action === 'show') {
    const job = jobDetails(loaded, positional[1] || requireFlag(flags, 'id'));
    out(`${job.id}: ${job.status} (${job.agent}, ${job.project_id}@${job.ref}, ${job.workflow})`);
    if (job.summary) out(`\nYhteenveto:\n${job.summary}`);
    if (job.questions) out(`\nKysymykset (vastaa: agent answer ${job.id} --file <polku>):\n${job.questions}`);
    out(`\nLoki:\n${job.log.slice(-6000)}`);
    return undefined;
  }
  if (action === 'answer') {
    const previous = readJob(loaded, positional[1] || requireFlag(flags, 'id'));
    if (previous.status !== 'needs_answers') throw new UserError(`Ajo ${previous.id} ei odota vastauksia (${previous.status}).`);
    const answers = flags.stdin ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(String(requireFlag(flags, 'file'))), 'utf8');
    return startJob(loaded, { project: previous.project_id, ref: previous.ref, workflow: previous.workflow, module: previous.module, background: flags.background }, { previous, answers });
  }
  if (action === 'cancel') {
    const job = readJob(loaded, positional[1] || requireFlag(flags, 'id'));
    if (job.status !== 'running') throw new UserError(`Ajo ${job.id} ei ole käynnissä (${job.status}).`);
    try { process.kill(-job.pid, 'SIGTERM'); } catch { try { process.kill(job.pid, 'SIGTERM'); } catch { /* jo päättynyt */ } }
    updateJob(loaded, job.id, { status: 'cancelled', finished_at: nowIso() });
    return out(`Ajo ${job.id} keskeytettiin.`);
  }
  if (action === '_worker') return runWorker(loaded, positional[1]);
  throw new UserError('Käyttö: agent run --project <id> --workflow <työnkulku> [--ref <haara>] [--module <moduuli>] [--input-file <polku> | --input-stdin] [--background] | agent list | agent show <ajo> | agent answer <ajo> (--file <polku> | --stdin) | agent cancel <ajo>');
}

function startJob(loaded, flags, continuation) {
  const project = getProject(loaded.config, requireFlag(flags, 'project'));
  const ref = String(flags.ref || project.refs.default);
  const workflow = String(requireFlag(flags, 'workflow'));
  const definition = WORKFLOWS[workflow];
  if (!definition) throw new UserError(`Tuntematon työnkulku: ${workflow}. Vaihtoehdot: ${Object.keys(WORKFLOWS).join(', ')}`);
  const location = docsLocation(project, loaded, ref);
  if (!location.writable || !location.root || !fs.existsSync(location.root)) {
    throw new UserError(location.remote
      ? `${project.project_id}: dokumentaatio on etärepositoriossa, johon MCP ei kirjoita. Dokumentoi projektin omassa työnkulussa.`
      : `${project.project_id}@${ref}: dokumentaatiohakemistoa ei ole. Aja ensin bootstrap.`);
  }
  const running = listJobs(loaded).find((job) => job.project_id === project.project_id && job.status === 'running');
  if (running) throw new UserError(`Projektilla on jo käynnissä ajo ${running.id}. Odota tai keskeytä se (agent cancel).`);

  let input = '';
  if (flags['input-stdin']) input = fs.readFileSync(0, 'utf8');
  else if (flags['input-file']) input = fs.readFileSync(path.resolve(String(flags['input-file'])), 'utf8');
  if (definition.input && !input && !continuation) throw new UserError(`Työnkulku ${workflow} tarvitsee syötteen (--input-file tai --input-stdin).`);

  const id = `${nowIso().replace(/[:.]/g, '-')}-${project.project_id}-${workflow}`;
  const dir = path.join(jobsRoot(loaded), id);
  ensureDirectory(dir);
  const agent = agentFor(location.root);
  const meta = {
    schema_version: 1,
    id,
    project_id: project.project_id,
    ref,
    workflow,
    module: flags.module ? String(flags.module) : null,
    agent,
    docs_root: location.root,
    mode: location.mode,
    status: 'running',
    round: continuation ? (continuation.previous.round || 1) + 1 : 1,
    continues: continuation?.previous.id || null,
    started_at: nowIso(),
  };
  if (input) writeFileAtomic(path.join(dir, 'syote.md'), input);
  if (continuation) {
    const previousDir = path.join(jobsRoot(loaded), continuation.previous.id);
    for (const name of ['syote.md', 'kysymykset.md', 'yhteenveto.md']) {
      const source = path.join(previousDir, name);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(dir, name === 'kysymykset.md' ? 'aiemmat-kysymykset.md' : name === 'yhteenveto.md' ? 'aiempi-yhteenveto.md' : name));
    }
    writeFileAtomic(path.join(dir, 'vastaukset.md'), continuation.answers);
    updateJob(loaded, continuation.previous.id, { status: 'answered', answered_by: id });
  }
  writeJson(path.join(dir, 'meta.json'), meta);

  if (flags.background) {
    const log = fs.openSync(path.join(dir, 'loki.txt'), 'a');
    const child = spawn(process.execPath, [CLI, 'agent', '_worker', id, '--config', loaded.filename, '--profile', loaded.profile],
      { cwd: loaded.root, detached: true, stdio: ['ignore', log, log], env: process.env });
    child.unref();
    updateJob(loaded, id, { pid: child.pid });
    out(`Agenttiajo käynnistyi taustalla: ${id}`);
    out(`Seuraa: agent show ${id}`);
    return undefined;
  }
  updateJob(loaded, id, { pid: process.pid });
  return runWorker(loaded, id, true);
}

async function runWorker(loaded, id, foreground = false) {
  const meta = readJob(loaded, id);
  const dir = path.join(jobsRoot(loaded), meta.id);
  // Agentin tuottamat tiedostot kirjoitetaan dokumentaatiohakemiston .paikallinen-
  // hakemistoon, joka on agentin työhakemistossa ja gitin ulkopuolella.
  const exchange = path.join(meta.docs_root, '.paikallinen', 'ajot', meta.id);
  ensureDirectory(exchange);
  for (const name of ['syote.md', 'vastaukset.md', 'aiemmat-kysymykset.md', 'aiempi-yhteenveto.md']) {
    const source = path.join(dir, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(exchange, name));
  }
  const prompt = buildPrompt(meta, exchange);
  writeFileAtomic(path.join(dir, 'kehote.md'), prompt);
  const command = agentCommandLine(meta, prompt);
  const log = fs.createWriteStream(path.join(dir, 'loki.txt'), { flags: 'a' });
  log.write(`[${nowIso()}] ${meta.agent}: ${meta.workflow} ${meta.project_id}@${meta.ref} (${meta.docs_root})\n`);

  const code = await new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { cwd: meta.docs_root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VNETCON_KOMENTO: `mcp-${meta.workflow}` } });
    if (!foreground) updateJob(loaded, meta.id, { agent_pid: child.pid });
    const forward = (chunk) => { log.write(chunk); if (foreground) process.stdout.write(chunk); };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);
    child.on('error', (error) => { log.write(`\n${error.message}\n`); resolve(127); });
    child.on('close', (exitCode) => resolve(exitCode ?? 1));
  });

  for (const name of ['kysymykset.md', 'yhteenveto.md']) {
    const source = path.join(exchange, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(dir, name));
  }
  fs.rmSync(exchange, { recursive: true, force: true });
  const questions = fs.existsSync(path.join(dir, 'kysymykset.md')) && fs.readFileSync(path.join(dir, 'kysymykset.md'), 'utf8').trim();
  const current = readJson(path.join(dir, 'meta.json'));
  const status = current?.status === 'cancelled' ? 'cancelled' : code !== 0 ? 'failed' : questions ? 'needs_answers' : 'completed';
  updateJob(loaded, meta.id, { status, exit_code: code, finished_at: nowIso() });
  await new Promise((resolve) => log.end(resolve));
  if (foreground) {
    out('');
    out(`Ajo ${meta.id}: ${status}`);
    if (status === 'needs_answers') out(`Agentti kysyy (vastaa: agent answer ${meta.id} --file <polku>):\n${fs.readFileSync(path.join(dir, 'kysymykset.md'), 'utf8')}`);
    if (status === 'completed') out('Tarkista muutokset (docs diff) ja commitoi (docs commit).');
    if (status === 'failed') process.exitCode = 1;
  }
}

function buildPrompt(meta, exchange) {
  const definition = WORKFLOWS[meta.workflow];
  const lines = [
    `Olet ei-interaktiivisessa ajossa vnetcon-docs-hakemistossa ${meta.docs_root}.`,
    `Tehtävä: suorita työnkulku "${definition.title}". Lue ja noudata tiedostoa .claude/skills/${definition.skill}/SKILL.md ja sen viittaamia metodi/-ohjeita.`,
  ];
  if (meta.module) lines.push(`Kohdemoduuli: ${meta.module}.`);
  lines.push('', 'Tämän ajon säännöt menevät ohjeiden edelle:',
    '1. Käyttäjä ei voi vastata kesken ajon. Kun ohje käskee kysyä tai pyytää hyväksyntää:',
    '   - jos voit jatkaa turvallisesti perustellulla oletuksella, jatka ja kirjaa oletus yhteenvetoon;',
    `   - jos et voi jatkaa ilman päätöstä, kirjoita kysymykset tiedostoon ${path.join(exchange, 'kysymykset.md')} numeroituna, kunkin perään oma ehdotuksesi, ja lopeta ajo.`,
    '2. Älä aja git add-, git commit- tai git push -komentoja. Ihminen commitoi muutokset.',
    `3. Kirjoita lopuksi yhteenveto tiedostoon ${path.join(exchange, 'yhteenveto.md')}: mitä teit, mitkä tiedostot muuttuivat, tehdyt oletukset ja avoimet kysymykset.`);
  if (fs.existsSync(path.join(exchange, 'syote.md'))) lines.push('', `Käyttäjän syöte on tiedostossa ${path.join(exchange, 'syote.md')}.`);
  if (fs.existsSync(path.join(exchange, 'vastaukset.md'))) {
    lines.push('', 'Tämä on jatkoajo. Edellisen ajon kysymykset, yhteenveto ja käyttäjän vastaukset:',
      `- ${path.join(exchange, 'aiemmat-kysymykset.md')}`, `- ${path.join(exchange, 'aiempi-yhteenveto.md')}`, `- ${path.join(exchange, 'vastaukset.md')}`,
      'Jatka työnkulkua vastausten pohjalta.');
  }
  return lines.join('\n');
}

function agentCommandLine(meta, prompt) {
  // Testeissä ja erikoisympäristöissä agentin voi korvata: JSON-taulukko, jossa
  // {prompt} korvataan kehotteella.
  if (process.env.VNETCON_AGENT_COMMAND) {
    return JSON.parse(process.env.VNETCON_AGENT_COMMAND).map((part) => part.replaceAll('{prompt}', prompt));
  }
  const launcher = path.join(meta.docs_root, 'tyokalut', 'vnetcon-ai', 'vnetcon-ai.mjs');
  if (meta.agent === 'codex') {
    return [process.execPath, launcher, 'codex', 'exec', '-s', 'workspace-write', '-C', meta.docs_root, prompt];
  }
  return [process.execPath, launcher, 'claude', '-p', prompt, '--permission-mode', 'acceptEdits',
    '--disallowedTools', ...CLAUDE_DISALLOWED, '--allowedTools', ...CLAUDE_ALLOWED];
}

function agentFor(docsRoot) {
  try {
    const config = YAML.parse(fs.readFileSync(path.join(docsRoot, 'vnetcon.config.yaml'), 'utf8')) || {};
    return config.agentit?.dokumentointi === 'codex' ? 'codex' : 'claude';
  } catch {
    return 'claude';
  }
}

function updateJob(loaded, id, changes) {
  const filename = path.join(jobsRoot(loaded), id, 'meta.json');
  const meta = readJson(filename);
  if (meta) writeJson(filename, { ...meta, ...changes });
}

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// --- Dokumentaation muutokset ja commit -------------------------------------

export function docsCommand(argv, loaded) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  const project = getProject(loaded.config, requireFlag(flags, 'project'));
  const ref = String(flags.ref || project.refs.default);
  const location = docsLocation(project, loaded, ref);
  if (!location.gitDir) {
    throw new UserError(location.mode === 'managed'
      ? 'Managed-dokumentaatiota ei commitoida; se tarkistetaan ja hyväksytään (review, approve).'
      : 'Dokumentaatio on etärepositoriossa, johon MCP ei kirjoita.');
  }
  if (action === 'diff') {
    const status = run('git', ['-C', location.gitDir, 'status', '--porcelain', '--', location.pathspec]);
    if (!status) return out('Ei commitoimattomia muutoksia.');
    out(`Muutokset (${location.gitDir}, ${location.pathspec}):\n${status}\n`);
    const diff = run('git', ['-C', location.gitDir, 'diff', '--stat', '--', location.pathspec]);
    if (diff) out(diff);
    return out(run('git', ['-C', location.gitDir, 'diff', '--', location.pathspec], { maxBuffer: 32 * 1024 * 1024 }).slice(0, 200000));
  }
  if (action === 'commit') {
    const message = String(requireFlag(flags, 'message'));
    if (!run('git', ['-C', location.gitDir, 'status', '--porcelain', '--', location.pathspec])) return out('Ei commitoitavaa.');
    run('git', ['-C', location.gitDir, 'add', '-A', '--', location.pathspec]);
    run('git', ['-C', location.gitDir, 'commit', '-m', message, '--', location.pathspec]);
    return out(`Commitoitiin ${run('git', ['-C', location.gitDir, 'rev-parse', '--short', 'HEAD'])}: ${message}`);
  }
  throw new UserError('Käyttö: docs diff --project <id> [--ref <haara>] | docs commit --project <id> [--ref <haara>] --message <viesti>');
}
