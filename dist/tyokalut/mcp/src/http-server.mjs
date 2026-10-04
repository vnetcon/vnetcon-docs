import crypto from 'node:crypto';

// MCP-SDK käyttää globaalia Web Cryptoa (crypto.randomUUID), joka on globaali vasta
// Node 20:ssä. Node 18 tarvitsee sen tähän, muuten jokainen HTTP-pyyntö kaatuu.
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { UserError } from './errors.mjs';
import {
  assertChannelAccess,
  authenticateWebhook,
  authenticateRequest,
  authConfig,
  challengeFor,
  oidcResourceMetadata,
} from './auth.mjs';
import { getChannel } from './config.mjs';
import { createMcpServer } from './mcp-server.mjs';
import { loadChannel } from './publisher.mjs';
import { enqueueRefresh, refreshSettings, startRefreshController } from './refresh.mjs';
import { safeChannelId } from './util.mjs';
import { registerUi } from './ui-server.mjs';

const DEFAULT_IDLE_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 250;

export async function serveHttp(loaded, options = {}) {
  const http = loaded.config.runtime?.http || {};
  const host = options.host || http.host || '127.0.0.1';
  const port = Number(options.port ?? http.port ?? 8793);
  const basePath = normalisePath(options.path || http.path || '/mcp');
  const defaultChannel = options.channel || loaded.config.service.default_channel;
  const allowedHosts = http.allowed_hosts || undefined;
  const mode = authConfig(loaded).mode || 'none';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new UserError(`Virheellinen HTTP-portti: ${port}`);
  if (!isLoopback(host) && mode === 'none' && !http.authentication?.allow_unauthenticated_network) {
    throw new UserError(
      `Autentikoimatonta HTTP-palvelinta ei avata osoitteeseen ${host}. `
      + 'Ota bearer/basic/OIDC käyttöön tai aseta allow_unauthenticated_network: true tietoisena riskistä.',
    );
  }
  // Palvelin käynnistyy myös ennen ensimmäistä julkaisua, jotta käyttöönoton voi
  // tehdä hallintakäyttöliittymästä. MCP vastaa siihen asti virheellä.
  try {
    getChannel(loaded.config, defaultChannel);
    loadChannel(defaultChannel, loaded);
  } catch (error) {
    process.stderr.write(`multiproject-mcp: kanava ${defaultChannel} ei ole vielä käytettävissä (${error.message})\n`);
  }

  const app = createMcpExpressApp({ host, allowedHosts });
  const sessions = new Map();
  const idleMs = Number(http.session_idle_seconds || DEFAULT_IDLE_MS / 1000) * 1000;
  const maxSessions = Number(http.max_sessions || DEFAULT_MAX_SESSIONS);

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => {
    try {
      loadChannel(defaultChannel, loaded);
      res.json({ status: 'ready', default_channel: defaultChannel });
    } catch (error) {
      res.status(503).json({ status: 'not_ready', error: error.message });
    }
  });
  app.get('/.well-known/oauth-protected-resource', (_req, res) => resourceMetadataResponse(res, loaded));
  app.get(`/.well-known/oauth-protected-resource${basePath}`, (_req, res) => resourceMetadataResponse(res, loaded));
  app.post('/hooks/git', (req, res) => {
    try {
      if (refreshSettings(loaded).mode !== 'webhook') return res.status(404).json({ error: 'Webhook refresh is not enabled' });
      const projectId = String(req.body?.project_id || '');
      const ref = String(req.body?.ref || '');
      if (!projectId || !ref) return res.status(400).json({ error: 'project_id and ref are required' });
      if (!authenticateWebhook(req, loaded, projectId)) return res.status(401).json({ error: 'Invalid webhook token' });
      const job = enqueueRefresh(loaded, projectId, ref, {
        sourceCommitSha: req.body?.source_commit_sha ? String(req.body.source_commit_sha) : undefined,
        trigger: 'webhook',
      });
      return res.status(202).json({ status: 'pending', job });
    } catch (error) {
      const status = error instanceof UserError ? error.exitCode || 400 : 500;
      return res.status(status === 1 ? 400 : status).json({ error: error.message });
    }
  });

  const handler = async (req, res) => {
    try {
      const access = await authenticateRequest(req, loaded, { loopback: isLoopback(host) });
      if (!access) {
        res.set('WWW-Authenticate', challengeFor(loaded));
        return res.status(401).json(mcpError(-32001, 'Authentication required'));
      }
      const channelId = req.params.channel ? safeChannelId(req.params.channel) : defaultChannel;
      assertChannelAccess(access, channelId);
      getChannel(loaded.config, channelId);
      loadChannel(channelId, loaded);

      const sessionId = String(req.headers['mcp-session-id'] || '');
      let session = sessionId ? sessions.get(sessionId) : undefined;
      if (session) {
        if (session.principalId !== access.id || session.channelId !== channelId) {
          return res.status(403).json(mcpError(-32003, 'Session does not belong to this principal or channel'));
        }
        session.lastActive = Date.now();
        trackResponse(session, res);
        await session.transport.handleRequest(req, res, req.body);
        return;
      }
      if (sessionId) return res.status(404).json(mcpError(-32001, 'Session not found'));
      if (req.method !== 'POST' || !isInitializeRequest(req.body)) {
        return res.status(400).json(mcpError(-32000, 'Initialize request required'));
      }
      if (sessions.size >= maxSessions) return res.status(503).json(mcpError(-32000, 'Too many open sessions'));

      const server = createMcpServer(loaded, channelId, access);
      let transport;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: Boolean(http.json_responses),
        keepAliveMs: Number(http.keep_alive_seconds || 15) * 1000,
        onsessioninitialized: (id) => {
          sessions.set(id, {
            transport,
            server,
            principalId: access.id,
            channelId,
            lastActive: Date.now(),
            openResponses: 0,
          });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const status = error instanceof UserError ? error.exitCode || 400 : 500;
      if (!res.headersSent) res.status(status === 1 ? 400 : status).json(mcpError(-32603, error.message));
    }
  };

  const uiPath = http.ui?.enabled === false ? '' : normalisePath(http.ui?.path || '/ui');
  if (uiPath) registerUi(app, loaded, { path: uiPath, mcpPath: basePath, host, port, defaultChannel, loopback: isLoopback(host) });

  app.all(basePath, handler);
  app.all(`/channels/:channel${basePath}`, handler);

  const cleanup = setInterval(() => {
    const cutoff = Date.now() - idleMs;
    for (const session of sessions.values()) {
      if (session.openResponses === 0 && session.lastActive < cutoff) session.transport.close().catch(() => {});
    }
  }, Math.min(60_000, Math.max(5_000, idleMs))).unref();

  const listener = await new Promise((resolve, reject) => {
    const instance = app.listen(port, host, () => resolve(instance));
    instance.on('error', reject);
  });
  const refreshController = startRefreshController(loaded, {
    onError: (error) => process.stderr.write(`multiproject-mcp refresh: ${error.message}\n`),
  });
  process.stderr.write(`multiproject-mcp HTTP: http://${host}:${port}${basePath} channel=${defaultChannel} auth=${mode}\n`);
  if (uiPath) process.stderr.write(`Hallintakäyttöliittymä: http://${host}:${port}${uiPath}\n`);

  const close = async () => {
    refreshController.stop();
    clearInterval(cleanup);
    await Promise.allSettled([...sessions.values()].map((session) => session.transport.close()));
    await new Promise((resolve) => listener.close(resolve));
  };
  process.once('SIGINT', () => close().finally(() => process.exit(0)));
  process.once('SIGTERM', () => close().finally(() => process.exit(0)));
  return { app, listener, close };
}

function mcpError(code, message) {
  return { jsonrpc: '2.0', error: { code, message }, id: null };
}

function normalisePath(value) {
  const result = `/${String(value).replace(/^\/+|\/+$/g, '')}`;
  if (!/^\/[A-Za-z0-9/_-]+$/.test(result)) throw new UserError(`Virheellinen MCP-polku: ${value}`);
  return result;
}

export function isLoopback(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}

function trackResponse(session, res) {
  session.openResponses += 1;
  res.once('close', () => {
    session.openResponses = Math.max(0, session.openResponses - 1);
    session.lastActive = Date.now();
  });
}

function resourceMetadataResponse(res, loaded) {
  const metadata = oidcResourceMetadata(loaded);
  if (!metadata) return res.status(404).json({ error: 'OIDC is not enabled' });
  return res.json(metadata);
}
