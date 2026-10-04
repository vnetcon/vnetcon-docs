import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';
import { UserError } from './errors.mjs';
import { findUp, writeFileAtomic } from './util.mjs';

export const CONFIG_NAME = 'multiproject-mcp.yaml';
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_SCHEMA = JSON.parse(fs.readFileSync(
  path.join(MODULE_ROOT, 'schemas', 'multiproject-mcp.schema.json'),
  'utf8',
));
const schemaValidator = new Ajv2020({ allErrors: true }).compile(CONFIG_SCHEMA);

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (!override || typeof override !== 'object') return override;
  const result = { ...(base && typeof base === 'object' ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(result[key], value)
      : value;
  }
  return result;
}

export function defaultConfig(instanceId = 'local-documentation') {
  return {
    schema_version: 1,
    service: { instance_id: instanceId, default_channel: 'local' },
    refresh: { mode: 'manual', max_parallel_jobs: 2 },
    documentation: {
      workspace_root: './.multiproject/workspaces',
      history_backend: 'content_digest',
      update_mode: 'ai_with_review',
      publish_policy: 'approved',
      vnetcon_docs_package: 'workspace',
    },
    projects: [],
    interfaces: { source: 'directory', path: './interfaces' },
    channels: [],
  };
}

export function defaultLocalProfile() {
  return {
    profile: 'local',
    storage: { type: 'filesystem', root: './.multiproject/publications' },
    runtime: { transport: 'stdio' },
    refresh: { mode: 'manual' },
  };
}

export function defaultServerProfile() {
  return {
    profile: 'server',
    storage: { type: 'filesystem', root: './.multiproject/publications' },
    runtime: {
      transport: 'http',
      http: {
        host: '127.0.0.1',
        port: 8793,
        path: '/mcp',
        authentication: { mode: 'bearer' },
      },
    },
    refresh: { mode: 'manual' },
  };
}

export function writeYaml(filename, value) {
  writeFileAtomic(filename, YAML.stringify(value, { lineWidth: 100 }));
}

export function resolveConfigPath(explicit = '', cwd = process.cwd()) {
  if (explicit) {
    const absolute = path.resolve(cwd, explicit);
    if (!fs.existsSync(absolute)) throw new UserError(`Konfiguraatiota ei ole: ${absolute}`);
    return absolute;
  }
  // Työtilan käynnistin kertoo oman työtilansa, jotta sitä voi ajaa mistä tahansa.
  if (process.env.MULTIPROJECT_MCP_CONFIG) {
    const launcherConfig = path.resolve(cwd, process.env.MULTIPROJECT_MCP_CONFIG);
    if (fs.existsSync(launcherConfig)) return launcherConfig;
  }
  const found = findUp(cwd, CONFIG_NAME);
  if (!found) throw new UserError(`${CONFIG_NAME} ei löydy. Aja ensin multiproject-mcp init <hakemisto>.`);
  return found;
}

export function readYaml(filename) {
  try {
    return YAML.parse(fs.readFileSync(filename, 'utf8')) || {};
  } catch (error) {
    throw new UserError(`Virheellinen YAML (${filename}): ${error.message}`);
  }
}

export function loadConfig({ explicit = '', cwd = process.cwd(), profile = 'local' } = {}) {
  const filename = resolveConfigPath(explicit, cwd);
  const root = path.dirname(filename);
  const base = readYaml(filename);
  const profileFile = path.join(root, `multiproject-mcp.${profile}.yaml`);
  const profileConfig = fs.existsSync(profileFile) ? readYaml(profileFile) : {};
  const effective = deepMerge(base, profileConfig);
  validateConfig(effective);
  return { filename, root, profile, profileFile, profileConfig, config: effective, base };
}

export function validateConfig(config) {
  const errors = [];
  if (!schemaValidator(config)) {
    errors.push(...schemaValidator.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
  }
  if (config.schema_version !== 1) errors.push('schema_version pitää olla 1');
  if (!config.service?.instance_id) errors.push('service.instance_id puuttuu');
  if (!Array.isArray(config.projects)) errors.push('projects pitää olla lista');
  if (!Array.isArray(config.channels)) errors.push('channels pitää olla lista');
  const ids = new Set();
  for (const project of config.projects || []) {
    if (!project.project_id) errors.push('projektilta puuttuu project_id');
    if (ids.has(project.project_id)) errors.push(`project_id esiintyy kahdesti: ${project.project_id}`);
    ids.add(project.project_id);
    if (!project.repository?.path && !project.repository?.url) {
      errors.push(`${project.project_id}: repository.path tai repository.url puuttuu`);
    }
    if (!['managed', 'repository', 'separate'].includes(project.documentation?.mode)) {
      errors.push(`${project.project_id}: documentation.mode pitää olla managed, repository tai separate`);
    }
    if (project.documentation?.mode === 'separate'
      && !project.documentation.repository?.path && !project.documentation.repository?.url) {
      errors.push(`${project.project_id}: separate-mallista puuttuu documentation.repository.path tai .url`);
    }
    if (!project.refs?.default) errors.push(`${project.project_id}: refs.default puuttuu`);
    if (!Array.isArray(project.refs?.include) || project.refs.include.length === 0) {
      errors.push(`${project.project_id}: refs.include pitää olla epätyhjä lista`);
    }
  }
  const channelIds = new Set();
  for (const channel of config.channels || []) {
    if (!channel.channel_id) errors.push('kanavalta puuttuu channel_id');
    if (channel.channel_id && !/^[a-z0-9][a-z0-9._-]{0,62}$/.test(channel.channel_id)) {
      errors.push(`virheellinen channel_id: ${channel.channel_id}`);
    }
    if (channelIds.has(channel.channel_id)) errors.push(`channel_id esiintyy kahdesti: ${channel.channel_id}`);
    channelIds.add(channel.channel_id);
    for (const projectId of Object.keys(channel.project_refs || {})) {
      if (!ids.has(projectId)) errors.push(`${channel.channel_id}: tuntematon projekti ${projectId}`);
    }
  }
  const authentication = config.runtime?.http?.authentication;
  if (authentication?.mode === 'oidc') {
    const oidc = authentication.oidc || {};
    if (!oidc.allow_insecure_http) {
      for (const [name, value] of Object.entries({ issuer: oidc.issuer, resource: oidc.resource, discovery_url: oidc.discovery_url, jwks_uri: oidc.jwks_uri })) {
        if (value && !String(value).startsWith('https://')) errors.push(`OIDC ${name} pitää olla HTTPS-osoite`);
      }
    }
    const ruleNames = new Set();
    for (const rule of oidc.access_rules || []) {
      if (rule.name && ruleNames.has(rule.name)) errors.push(`OIDC access_rule esiintyy kahdesti: ${rule.name}`);
      if (rule.name) ruleNames.add(rule.name);
      for (const projectId of rule.projects || []) if (!ids.has(projectId)) errors.push(`OIDC access_rule: tuntematon projekti ${projectId}`);
      for (const channelId of rule.channels || []) if (!channelIds.has(channelId)) errors.push(`OIDC access_rule: tuntematon kanava ${channelId}`);
    }
  }
  if (errors.length) throw new UserError(`Konfiguraatio ei kelpaa:\n- ${errors.join('\n- ')}`);
  return true;
}

export function saveBase(loaded) {
  validateConfig(loaded.base);
  writeYaml(loaded.filename, loaded.base);
}

export function saveProfile(loaded) {
  writeYaml(loaded.profileFile, loaded.profileConfig);
  loadConfig({ explicit: loaded.filename, profile: loaded.profile });
}

export function resolveRootPath(loaded, value) {
  return path.isAbsolute(value) ? value : path.resolve(loaded.root, value);
}

export function getProject(config, projectId) {
  const project = config.projects.find((item) => item.project_id === projectId);
  if (!project) throw new UserError(`Tuntematon projekti: ${projectId}`);
  return project;
}

export function getChannel(config, channelId) {
  const channel = config.channels.find((item) => item.channel_id === channelId);
  if (!channel) throw new UserError(`Tuntematon kanava: ${channelId}`);
  return channel;
}

export function docsModeForRef(project, ref) {
  for (const override of project.documentation?.ref_overrides || []) {
    const pattern = String(override.pattern || '');
    const expression = new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`);
    if (expression.test(ref)) return { ...project.documentation, ...override };
  }
  return project.documentation;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
