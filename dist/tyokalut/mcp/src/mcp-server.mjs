import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import {
  fetchDocument,
  fetchSourceDocument,
  getInterface,
  getProjectVersion,
  listInterfaces,
  listProjects,
  listSources,
  readSharedGuidance,
  searchProject,
  searchSource,
} from './search.mjs';
import { getSource, sourceAllowed } from './sources.mjs';
import { assertProjectAccess, filterProjects } from './auth.mjs';
import { loadChannel } from './publisher.mjs';

function result(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

const PROJECT_INSTRUCTIONS = 'Valitse projekti list_projects-työkalulla ja kohdista jokainen search- ja fetch-kutsu täsmälleen yhteen project_id-arvoon. '
  + 'Lue get_shared_guidance ennen kuin tulkitset käsitteitä, jotka esiintyvät useassa projektissa: se on ihmisen ylläpitämää ohjausta ja menee oman päättelyn edelle.';
const SOURCE_WITH_CODE_INSTRUCTIONS = 'Lähdeaineisto (list_sources, search_sources, fetch_source_document) on ihmisen kirjoittamaa, eikä sitä ole tarkistettu koodia vasten. '
  + 'Kerro, kun vastaus perustuu siihen. Jos se on ristiriidassa koodidokumentaation kanssa, kerro molemmat ja painota toteutuksen osalta koodidokumentaatiota.';
const SOURCE_ONLY_INSTRUCTIONS = 'Tietopohja on organisaation hyväksyttyä lähdeaineistoa. Aloita list_sources-työkalusta ja kohdista jokainen search_sources- ja fetch_source_document-kutsu yhteen source_id-arvoon. '
  + 'Mainitse vastauksessa lähde, tiedosto ja PDF:stä sivu. Jos tietoa ei löydy, sano se äläkä täydennä omalla tiedollasi. '
  + 'Lue get_shared_guidance, jos sitä on: se on ihmisen ylläpitämää ohjausta ja menee oman päättelyn edelle.';

// Ohje kanavan sisällön mukaan: pelkät projektit, projektit ja lähteet, tai
// pelkät lähteet (käyttö ilman koodia).
export function serverInstructions(bundle) {
  const hasProjects = Boolean(bundle.projects?.length);
  const hasSources = Boolean(bundle.sources?.length);
  if (!hasProjects && hasSources) return SOURCE_ONLY_INSTRUCTIONS;
  return hasSources ? `${PROJECT_INSTRUCTIONS} ${SOURCE_WITH_CODE_INSTRUCTIONS}` : PROJECT_INSTRUCTIONS;
}

export function createMcpServer(loaded, channelId, access = {}) {
  // One MCP connection always sees one immutable publication bundle. A later
  // publish only affects newly opened connections and cannot mix releases in
  // the middle of an existing conversation.
  const bundle = loadChannel(channelId, loaded);
  const server = new McpServer(
    { name: 'vnetcon-multiproject-docs', version: '0.6.0' },
    { instructions: serverInstructions(bundle) },
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

  const allowedSource = (sourceId) => {
    const source = getSource(loaded.config, sourceId);
    if (!sourceAllowed(access, source)) throw new Error(`Käyttöoikeus lähteeseen puuttuu: ${sourceId}`);
    return source;
  };

  server.registerTool('list_sources', {
    title: 'List source materials',
    description: 'Listaa kanavan lähdeaineistot: organisaation hyväksytyt dokumentit (Word, PowerPoint, Excel, PDF). Niitä ei ole tarkistettu koodia vasten. Valinnainen project_id rajaa projektiin linkitettyihin.',
    inputSchema: { project_id: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ project_id }) => {
    if (project_id) assertProjectAccess(access, project_id);
    const sources = listSources(loaded, channelId, bundle)
      .filter((item) => sourceAllowed(access, item))
      .filter((item) => !project_id || (item.linked_projects || []).includes(project_id));
    return result({ sources });
  });

  server.registerTool('search_sources', {
    title: 'Search source materials',
    description: 'Hakee yhdestä lähdeaineistosta. Tulokset ovat lähdeaineistoa (kind: lahdeaineisto), eivät koodidokumentaatiota, eikä niitä ole tarkistettu koodia vasten. PDF:n tuloksissa on sivunumero (page).',
    inputSchema: {
      source_id: z.string().min(1),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(25).optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ source_id, query, limit }) => {
    allowedSource(source_id);
    return result({ source_id, results: searchSource(loaded, channelId, source_id, query, limit, bundle) });
  });

  server.registerTool('fetch_source_document', {
    title: 'Fetch source document',
    description: 'Hakee yhden search_sources-työkalun palauttaman lähdedokumentin.',
    inputSchema: {
      source_id: z.string().min(1),
      document_id: z.string().min(1),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async ({ source_id, document_id }) => {
    allowedSource(source_id);
    return result(fetchSourceDocument(loaded, channelId, source_id, document_id, bundle));
  });

  server.registerTool('get_shared_guidance', {
    title: 'Get shared guidance',
    description: 'Palauttaa kaikkia projekteja koskevan yhteisen ohjauksen ja sanaston. Ihmisen ylläpitämä; menee oman päättelyn edelle.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => result({ documents: readSharedGuidance(loaded) }));

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
