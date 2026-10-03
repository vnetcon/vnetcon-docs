import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getProject } from './config.mjs';
import { UserError } from './errors.mjs';
import { resolveRef } from './git.mjs';
import { nowIso, readJson, writeJson } from './util.mjs';
import { bootstrapProject, readWorkspaceState } from './workspace.mjs';

const QUEUE_FILE = path.join('.multiproject', 'refresh', 'queue.json');

export function refreshSettings(loaded) {
  return {
    mode: loaded.config.refresh?.mode || 'manual',
    debounce_seconds: Number(loaded.config.refresh?.debounce_seconds ?? 300),
    poll_interval_seconds: Number(loaded.config.refresh?.poll_interval_seconds ?? 300),
    worker_interval_seconds: Number(loaded.config.refresh?.worker_interval_seconds ?? 15),
    auto_apply: loaded.config.refresh?.auto_apply !== false,
  };
}

export function listRefreshJobs(loaded, { activeOnly = false } = {}) {
  const jobs = readQueue(loaded).jobs;
  return activeOnly ? jobs.filter((job) => ['pending', 'running', 'failed'].includes(job.status)) : jobs;
}

export function detectChanges(loaded, targets = configuredTargets(loaded)) {
  const results = [];
  for (const { project, ref } of targets) {
    const currentSha = resolveRef(project, ref, loaded);
    const state = readWorkspaceState(loaded, project.project_id, ref);
    if (state?.source_commit_sha === currentSha) {
      results.push({ project_id: project.project_id, ref, source_commit_sha: currentSha, status: 'unchanged' });
      continue;
    }
    const job = enqueueRefresh(loaded, project.project_id, ref, { sourceCommitSha: currentSha, trigger: 'poll' });
    results.push({ project_id: project.project_id, ref, source_commit_sha: currentSha, status: 'pending', job_id: job.job_id });
  }
  return results;
}

export function enqueueRefresh(loaded, projectId, ref, options = {}) {
  const project = getProject(loaded.config, projectId);
  assertRefAllowed(project, ref);
  const resolvedSha = resolveRef(project, ref, loaded);
  if (options.sourceCommitSha && options.sourceCommitSha !== resolvedSha) {
    throw new UserError(`${projectId}@${ref}: ilmoitettu commit ei vastaa lähteen nykyistä refiä.`, 409);
  }
  const debounceSeconds = refreshSettings(loaded).debounce_seconds;
  const now = new Date();
  const notBefore = new Date(now.getTime() + debounceSeconds * 1000).toISOString();
  let selected;
  mutateQueue(loaded, (queue) => {
    selected = queue.jobs.find((job) => job.project_id === projectId && job.ref === ref && job.status === 'pending');
    if (selected) {
      selected.source_commit_sha = resolvedSha;
      selected.detected_at = now.toISOString();
      selected.not_before = notBefore;
      selected.trigger = options.trigger || selected.trigger;
      return;
    }
    selected = {
      job_id: crypto.randomUUID(),
      project_id: projectId,
      ref,
      source_commit_sha: resolvedSha,
      trigger: options.trigger || 'manual',
      status: 'pending',
      detected_at: now.toISOString(),
      not_before: notBefore,
    };
    queue.jobs.push(selected);
  });
  return selected;
}

export function runRefreshJobs(loaded, { dueOnly = true } = {}) {
  const candidates = claimRefreshJobs(loaded, dueOnly);
  const results = [];
  for (const candidate of candidates) {
    try {
      const project = getProject(loaded.config, candidate.project_id);
      const currentSha = resolveRef(project, candidate.ref, loaded);
      if (currentSha !== candidate.source_commit_sha) {
        updateJob(loaded, candidate.job_id, { status: 'superseded', finished_at: nowIso() });
        const replacement = enqueueRefresh(loaded, candidate.project_id, candidate.ref, {
          sourceCommitSha: currentSha,
          trigger: candidate.trigger,
        });
        results.push({ ...candidate, status: 'superseded', replacement_job_id: replacement.job_id });
        continue;
      }
      const state = bootstrapProject(project, candidate.ref, loaded);
      updateJob(loaded, candidate.job_id, {
        status: 'refreshed',
        finished_at: nowIso(),
        applied_source_commit_sha: state.source_commit_sha,
      });
      results.push({ ...candidate, status: 'refreshed', applied_source_commit_sha: state.source_commit_sha });
    } catch (error) {
      updateJob(loaded, candidate.job_id, { status: 'failed', finished_at: nowIso(), error: error.message });
      results.push({ ...candidate, status: 'failed', error: error.message });
    }
  }
  return results;
}

export function startRefreshController(loaded, { onError = () => {} } = {}) {
  const settings = refreshSettings(loaded);
  if (!['poll', 'webhook'].includes(settings.mode)) return { stop() {} };
  let stopped = false;
  let running = false;
  const tick = () => {
    if (stopped || running) return;
    running = true;
    try {
      if (settings.mode === 'poll') detectChanges(loaded);
      if (settings.auto_apply) runRefreshJobs(loaded, { dueOnly: true });
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  tick();
  const interval = settings.mode === 'poll' ? settings.poll_interval_seconds : settings.worker_interval_seconds;
  const timer = setInterval(tick, Math.max(5, interval) * 1000);
  return { stop() { stopped = true; clearInterval(timer); } };
}

export function configuredTargets(loaded) {
  return loaded.config.projects.flatMap((project) => concreteRefs(project).map((ref) => ({ project, ref })));
}

function concreteRefs(project) {
  const refs = (project.refs?.include || []).filter((ref) => !ref.includes('*'));
  return refs.length ? refs : [project.refs.default];
}

function assertRefAllowed(project, ref) {
  const allowed = (project.refs?.include || []).some((pattern) => {
    const expression = new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`);
    return expression.test(ref);
  });
  if (!allowed) throw new UserError(`${project.project_id}: ref ${ref} ei kuulu refs.include-sääntöihin.`, 403);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function queueFilename(loaded) {
  return path.join(loaded.root, QUEUE_FILE);
}

function readQueue(loaded) {
  return readJson(queueFilename(loaded), { schema_version: 1, jobs: [] });
}

function mutateQueue(loaded, mutation) {
  const filename = queueFilename(loaded);
  const lock = `${filename}.lock`;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const descriptor = acquireQueueLock(lock);
  try {
    const queue = readQueue(loaded);
    mutation(queue);
    writeJson(filename, queue);
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lock);
  }
}

function claimRefreshJobs(loaded, dueOnly) {
  const now = Date.now();
  let selected = [];
  mutateQueue(loaded, (queue) => {
    selected = queue.jobs
      .filter((job) => job.status === 'pending' && (!dueOnly || Date.parse(job.not_before) <= now));
    for (const job of selected) {
      job.status = 'running';
      job.started_at = nowIso();
      delete job.error;
    }
    selected = selected.map((job) => ({ ...job }));
  });
  return selected;
}

function acquireQueueLock(lock) {
  try {
    const descriptor = fs.openSync(lock, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${process.pid} ${nowIso()}\n`);
    return descriptor;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    try {
      const age = Date.now() - fs.statSync(lock).mtimeMs;
      if (age > 60_000) {
        fs.unlinkSync(lock);
        return acquireQueueLock(lock);
      }
    } catch (retryError) {
      if (retryError.code !== 'ENOENT') throw retryError;
      return acquireQueueLock(lock);
    }
    throw new UserError('Refresh-jono on toisen prosessin käsiteltävänä; yritä uudelleen.', 409);
  }
}

function updateJob(loaded, jobId, values) {
  mutateQueue(loaded, (queue) => {
    const job = queue.jobs.find((item) => item.job_id === jobId);
    if (!job) throw new UserError(`Refresh-työtä ei löydy: ${jobId}`);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete job[key];
      else job[key] = value;
    }
  });
}
