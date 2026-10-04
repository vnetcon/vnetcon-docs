import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { UserError } from './errors.mjs';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.error) throw new UserError(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new UserError(`${command} ${args.join(' ')} epäonnistui${detail ? `: ${detail}` : ''}`);
  }
  return (result.stdout || '').trim();
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const equals = value.indexOf('=');
    if (equals !== -1) {
      flags[value.slice(2, equals)] = value.slice(equals + 1);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { positional, flags };
}

export function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === true || value === '') {
    throw new UserError(`--${name} puuttuu.`);
  }
  return String(value);
}

export function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

export function writeFileAtomic(filename, content, options = {}) {
  ensureDirectory(path.dirname(filename));
  const temporary = `${filename}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(temporary, content, options);
  fs.renameSync(temporary, filename);
}

export function readJson(filename, fallback = undefined) {
  if (!fs.existsSync(filename)) return fallback;
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

export function writeJson(filename, value) {
  writeFileAtomic(filename, `${JSON.stringify(value, null, 2)}\n`);
}

export function encodeSegment(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function nowIso() {
  return new Date().toISOString();
}

export function listFilesRecursive(root, predicate = () => true) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && predicate(absolute)) result.push(absolute);
    }
  };
  visit(root);
  return result.sort();
}

export function assertInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UserError(`Polku ei ole sallitun hakemiston sisällä: ${child}`);
  }
}

export function findUp(start, filename) {
  let current = path.resolve(start);
  while (true) {
    const candidate = path.join(current, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return '';
    current = parent;
  }
}

export function safeProjectId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(value)) {
    throw new UserError('project_id saa sisältää pieniä kirjaimia, numeroita sekä ._- merkkejä (2–63 merkkiä).');
  }
  return value;
}

export function safeChannelId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(value)) {
    throw new UserError('channel_id saa sisältää pieniä kirjaimia, numeroita sekä ._- merkkejä (1–63 merkkiä).');
  }
  return value;
}
