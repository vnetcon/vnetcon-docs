import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UserError } from './errors.mjs';
import { nowIso, readJson, sha256, writeFileAtomic } from './util.mjs';

const SECRET_FILE = path.join('.multiproject', 'secrets', 'auth.json');
const oidcVerifiers = new Map();

export function authConfig(loaded) {
  return loaded.config.runtime?.http?.authentication || { mode: 'none' };
}

export function authSecretsFilename(loaded) {
  return path.join(loaded.root, SECRET_FILE);
}

export function readAuthSecrets(loaded) {
  return readJson(authSecretsFilename(loaded), {
    schema_version: 1,
    bearer_tokens: [],
    basic_users: [],
    webhook_tokens: [],
  });
}

export function createWebhookToken(loaded, name, projects = undefined) {
  const secrets = readAuthSecrets(loaded);
  secrets.webhook_tokens = secrets.webhook_tokens || [];
  if (secrets.webhook_tokens.some((item) => item.name === name)) throw new UserError(`Webhook-token on jo olemassa: ${name}`);
  const token = `hook_${crypto.randomBytes(32).toString('base64url')}`;
  secrets.webhook_tokens.push({
    name,
    token_hash: sha256(token),
    created_at: nowIso(),
    ...(projects?.length ? { projects: [...new Set(projects)].sort() } : {}),
  });
  writeAuthSecrets(loaded, secrets);
  return token;
}

export function revokeWebhookToken(loaded, name) {
  const secrets = readAuthSecrets(loaded);
  secrets.webhook_tokens = secrets.webhook_tokens || [];
  const before = secrets.webhook_tokens.length;
  secrets.webhook_tokens = secrets.webhook_tokens.filter((item) => item.name !== name);
  if (secrets.webhook_tokens.length === before) throw new UserError(`Webhook-tokenia ei löydy: ${name}`);
  writeAuthSecrets(loaded, secrets);
}

export function authenticateWebhook(req, loaded, projectId) {
  const token = String(req.headers['x-multiproject-webhook-token'] || '');
  if (!token) return null;
  const tokenHash = sha256(token);
  const records = readAuthSecrets(loaded).webhook_tokens || [];
  const record = records.find((item) => safeEqual(item.token_hash, tokenHash));
  if (!record || (record.projects && !record.projects.includes(projectId))) return null;
  return { id: `webhook:${record.name}`, projects: record.projects };
}

export function writeAuthSecrets(loaded, secrets) {
  writeFileAtomic(authSecretsFilename(loaded), `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(authSecretsFilename(loaded), 0o600); } catch { /* Windows */ }
}

export function createBearerToken(loaded, name, access = {}) {
  const secrets = readAuthSecrets(loaded);
  if (secrets.bearer_tokens.some((item) => item.name === name)) {
    throw new UserError(`Bearer-token on jo olemassa: ${name}`);
  }
  const token = `mcp_${crypto.randomBytes(32).toString('base64url')}`;
  secrets.bearer_tokens.push({
    name,
    token_hash: sha256(token),
    created_at: nowIso(),
    ...normaliseAccess(access),
  });
  writeAuthSecrets(loaded, secrets);
  return token;
}

export function revokeBearerToken(loaded, name) {
  const secrets = readAuthSecrets(loaded);
  const before = secrets.bearer_tokens.length;
  secrets.bearer_tokens = secrets.bearer_tokens.filter((item) => item.name !== name);
  if (secrets.bearer_tokens.length === before) throw new UserError(`Bearer-tokenia ei löydy: ${name}`);
  writeAuthSecrets(loaded, secrets);
}

export function addBasicUser(loaded, username, password, access = {}) {
  if (!/^[A-Za-z0-9._@-]{1,128}$/.test(username)) throw new UserError('Virheellinen käyttäjätunnus.');
  if (password.length < 12) throw new UserError('Salasanan pitää olla vähintään 12 merkkiä pitkä.');
  const secrets = readAuthSecrets(loaded);
  if (secrets.basic_users.some((item) => item.username === username)) {
    throw new UserError(`Käyttäjä on jo olemassa: ${username}`);
  }
  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync(password, salt, 32);
  secrets.basic_users.push({
    username,
    salt: salt.toString('base64url'),
    password_hash: passwordHash.toString('base64url'),
    created_at: nowIso(),
    ...normaliseAccess(access),
  });
  writeAuthSecrets(loaded, secrets);
}

export function removeBasicUser(loaded, username) {
  const secrets = readAuthSecrets(loaded);
  const before = secrets.basic_users.length;
  secrets.basic_users = secrets.basic_users.filter((item) => item.username !== username);
  if (secrets.basic_users.length === before) throw new UserError(`Käyttäjää ei löydy: ${username}`);
  writeAuthSecrets(loaded, secrets);
}

export async function authenticateRequest(req, loaded) {
  const configuration = authConfig(loaded);
  const mode = configuration.mode || 'none';
  if (mode === 'none') return principal('anonymous', 'anonymous');

  const authorization = String(req.headers.authorization || '');
  const secrets = readAuthSecrets(loaded);
  if (mode === 'bearer') {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const tokenHash = sha256(match[1]);
    const record = secrets.bearer_tokens.find((item) => safeEqual(item.token_hash, tokenHash));
    return record ? principal(`token:${record.name}`, 'bearer', record) : null;
  }
  if (mode === 'basic') {
    const match = authorization.match(/^Basic\s+(.+)$/i);
    if (!match) return null;
    let decoded;
    try { decoded = Buffer.from(match[1], 'base64').toString('utf8'); } catch { return null; }
    const separator = decoded.indexOf(':');
    if (separator < 1) return null;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    const record = secrets.basic_users.find((item) => item.username === username);
    if (!record) return null;
    const actual = crypto.scryptSync(password, Buffer.from(record.salt, 'base64url'), 32);
    const expected = Buffer.from(record.password_hash, 'base64url');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
      ? principal(`user:${username}`, 'basic', record)
      : null;
  }
  if (mode === 'oidc') return authenticateOidc(authorization, configuration.oidc || {});
  throw new UserError(`Tuntematon HTTP-autentikointitila: ${mode}`);
}

export function challengeFor(loaded) {
  const mode = authConfig(loaded).mode || 'none';
  if (mode === 'basic') return 'Basic realm="multiproject-mcp", charset="UTF-8"';
  if (mode === 'oidc') {
    const oidc = authConfig(loaded).oidc || {};
    const metadataUrl = oidc.resource_metadata_url || resourceMetadataUrl(oidc.resource);
    const scopes = (oidc.required_scopes || []).join(' ');
    return `Bearer realm="multiproject-mcp"${metadataUrl ? `, resource_metadata="${metadataUrl}"` : ''}${scopes ? `, scope="${scopes}"` : ''}`;
  }
  return 'Bearer realm="multiproject-mcp"';
}

function resourceMetadataUrl(resource) {
  if (!resource) return '';
  try {
    const url = new URL(resource);
    const suffix = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    return `${url.origin}/.well-known/oauth-protected-resource${suffix}`;
  } catch {
    return '';
  }
}

export function oidcResourceMetadata(loaded) {
  const configuration = authConfig(loaded);
  if (configuration.mode !== 'oidc') return null;
  const oidc = configuration.oidc || {};
  return {
    resource: oidc.resource,
    authorization_servers: [oidc.issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: oidc.required_scopes || [],
  };
}

export function assertChannelAccess(access, channelId) {
  if (access.channels && !access.channels.includes(channelId)) {
    throw new UserError(`Käyttöoikeus kanavaan puuttuu: ${channelId}`, 403);
  }
}

export function assertProjectAccess(access, projectId) {
  if (access.projects && !access.projects.includes(projectId)) {
    throw new UserError(`Käyttöoikeus projektiin puuttuu: ${projectId}`, 403);
  }
}

export function filterProjects(access, projects) {
  return access.projects ? projects.filter((item) => access.projects.includes(item.project_id)) : projects;
}

export function accessFromFlags(flags) {
  return normaliseAccess({
    channels: csv(flags.channels),
    projects: csv(flags.projects),
  });
}

function principal(id, method, record = {}) {
  return {
    id,
    method,
    channels: record.channels,
    projects: record.projects,
  };
}

function normaliseAccess(access) {
  const result = {};
  if (access.channels?.length) result.channels = [...new Set(access.channels)].sort();
  if (access.projects?.length) result.projects = [...new Set(access.projects)].sort();
  return result;
}

function csv(value) {
  if (!value || value === true) return undefined;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function authenticateOidc(authorization, oidc) {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  if (!oidc.issuer || !oidc.audience) throw new UserError('OIDC issuer tai audience puuttuu konfiguraatiosta.', 503);
  try {
    const verifier = await oidcVerifier(oidc);
    const { payload } = await jwtVerify(match[1], verifier.jwks, {
      issuer: verifier.issuer,
      audience: oidc.audience,
      algorithms: oidc.algorithms || ['RS256', 'ES256'],
      clockTolerance: Number(oidc.clock_tolerance_seconds || 5),
    });
    if (!hasRequiredScopes(payload, oidc.required_scopes || [])) return null;
    const principalClaim = oidc.principal_claim || 'sub';
    const principalValue = payload[principalClaim];
    if (typeof principalValue !== 'string' || !principalValue) return null;
    const access = accessFromOidcRules(payload, oidc.access_rules || []);
    return principal(`oidc:${payload.iss}:${principalValue}`, 'oidc', access);
  } catch (error) {
    if (error instanceof UserError) throw error;
    return null;
  }
}

async function oidcVerifier(oidc) {
  const key = `${oidc.issuer}\0${oidc.discovery_url || ''}\0${oidc.jwks_uri || ''}`;
  if (oidcVerifiers.has(key)) return oidcVerifiers.get(key);
  const promise = (async () => {
    const discoveryUrl = oidc.discovery_url || `${String(oidc.issuer).replace(/\/$/, '')}/.well-known/openid-configuration`;
    let issuer = oidc.issuer;
    let jwksUri = oidc.jwks_uri;
    if (!jwksUri) {
      let response;
      try { response = await fetch(discoveryUrl, { headers: { accept: 'application/json' } }); }
      catch (error) { throw new UserError(`OIDC discovery ei onnistunut: ${error.message}`, 503); }
      if (!response.ok) throw new UserError(`OIDC discovery palautti HTTP ${response.status}.`, 503);
      const metadata = await response.json();
      if (!metadata.jwks_uri || !metadata.issuer) throw new UserError('OIDC discovery -vastauksesta puuttuu issuer tai jwks_uri.', 503);
      if (metadata.issuer !== oidc.issuer) throw new UserError('OIDC discovery issuer ei vastaa konfiguraatiota.', 503);
      issuer = metadata.issuer;
      jwksUri = metadata.jwks_uri;
    }
    let url;
    try { url = new URL(jwksUri); } catch { throw new UserError('OIDC jwks_uri ei ole kelvollinen URL.', 503); }
    if (url.protocol !== 'https:' && !oidc.allow_insecure_http) {
      throw new UserError('OIDC jwks_uri pitää olla HTTPS-osoite.', 503);
    }
    return { issuer, jwks: createRemoteJWKSet(url) };
  })();
  oidcVerifiers.set(key, promise);
  try { return await promise; }
  catch (error) { oidcVerifiers.delete(key); throw error; }
}

function hasRequiredScopes(payload, required) {
  if (!required.length) return true;
  const values = new Set([
    ...String(payload.scope || payload.scp || '').split(/\s+/).filter(Boolean),
    ...(Array.isArray(payload.scopes) ? payload.scopes : []),
  ]);
  return required.every((scope) => values.has(scope));
}

function accessFromOidcRules(payload, rules) {
  if (!rules.length) return {};
  const channels = new Set();
  const projects = new Set();
  let matched = 0;
  let channelsRestricted = false;
  let projectsRestricted = false;
  for (const rule of rules) {
    const actual = Array.isArray(payload[rule.claim]) ? payload[rule.claim] : [payload[rule.claim]];
    const expected = Array.isArray(rule.values) ? rule.values : [];
    if (!actual.some((value) => expected.includes(String(value)))) continue;
    matched += 1;
    if (rule.channels) channelsRestricted = true;
    if (rule.projects) projectsRestricted = true;
    for (const channel of rule.channels || []) channels.add(channel);
    for (const project of rule.projects || []) projects.add(project);
  }
  if (!matched) return { channels: [], projects: [] };
  return {
    ...(channelsRestricted ? { channels: [...channels].sort() } : {}),
    ...(projectsRestricted ? { projects: [...projects].sort() } : {}),
  };
}
