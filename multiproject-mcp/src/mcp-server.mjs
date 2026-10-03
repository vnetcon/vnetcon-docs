import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import {
  fetchDocument,
  getInterface,
  getProjectVersion,
  listInterfaces,
  listProjects,
  searchProject,
} from './search.mjs';
import { assertProjectAccess, filterProjects } from './auth.mjs';
import { loadChannel } from './publisher.mjs';

function result(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export function createMcpServer(loaded, channelId, access = {}) {
  // One MCP connection always sees one immutable publication bundle. A later
  // publish only affects newly opened connections and cannot mix releases in
  // the middle of an existing conversation.
  const bundle = loadChannel(channelId, loaded);
  const server = new McpServer(
    { name: 'vnetcon-multiproject-docs', version: '0.3.0' },
    { instructions: 'Valitse projekti list_projects-työkalulla ja kohdista jokainen search- ja fetch-kutsu täsmälleen yhteen project_id-arvoon.' },
  );

  server.registerTool('list_projects', {
    title: 'List projects',
    description: 'Listaa valitun julkaisukanavan projektit ja niiden tarkat versiot.',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => result({ projects: filterProjects(access, listProjects(loaded, channelId, bundle)) }));

  server.registerTool('get_project_version', {
    title: 'Get project version',
    description: 'Palauttaa yhden projektin refin, lähdecommitin ja julkaisun tunnisteet.',
    inputSchema: { project_id: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ project_id }) => {
    assertProjectAccess(access, project_id);
    return result(getProjectVersion(loaded, channelId, project_id, bundle));
  });

  server.registerTool('search', {
    title: 'Search project documentation',
    description: 'Hakee dokumentaatiota täsmälleen yhdestä projektista. Ei yhdistä eri projektien aineistoja.',
    inputSchema: {
      project_id: z.string().min(1),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(25).optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ project_id, query, limit }) => {
    assertProjectAccess(access, project_id);
    return result({ project_id, results: searchProject(loaded, channelId, project_id, query, limit, bundle) });
  });

  server.registerTool('fetch', {
    title: 'Fetch documentation',
    description: 'Hakee yhden search-työkalun palauttaman dokumentin samasta projektista.',
    inputSchema: {
      project_id: z.string().min(1),
      document_id: z.string().min(1),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ project_id, document_id }) => {
    assertProjectAccess(access, project_id);
    return result(fetchDocument(loaded, channelId, project_id, document_id, bundle));
  });

  server.registerTool('list_interfaces', {
    title: 'List project interfaces',
    description: 'Listaa hyväksytyt projektien väliset rajapintatietueet.',
    inputSchema: { project_id: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ project_id }) => {
    if (project_id) assertProjectAccess(access, project_id);
    const interfaces = listInterfaces(loaded, project_id).filter((item) => interfaceAllowed(access, item));
    return result({ interfaces });
  });

  server.registerTool('get_interface', {
    title: 'Get project interface',
    description: 'Palauttaa yhden eksplisiittisesti määritellyn rajapintatietueen.',
    inputSchema: { interface_id: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ interface_id }) => {
    const item = getInterface(loaded, interface_id);
    if (!interfaceAllowed(access, item)) throw new Error(`Käyttöoikeus rajapintaan puuttuu: ${interface_id}`);
    return result(item);
  });

  return server;
}

export async function serveStdio(loaded, channelId) {
  const server = createMcpServer(loaded, channelId);
  await server.connect(new StdioServerTransport());
}

function interfaceAllowed(access, item) {
  if (!access.projects) return true;
  const parties = [item.provider?.project_id, ...(item.consumers || []).map((consumer) => consumer.project_id)].filter(Boolean);
  return parties.every((projectId) => access.projects.includes(projectId));
}
