import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { docsModeForRef, resolveRootPath } from './config.mjs';
import { revisionKey } from './git.mjs';
import { loadChannel } from './publisher.mjs';
import { listInterfaces, readSharedGuidance } from './search.mjs';
import { readWorkspaceState } from './workspace.mjs';
import { DEFAULT_HTTP, isLoopbackHost, mcpEndpoint, storedTunnel, tunnelCommands } from './tunnel.mjs';
import { run } from './util.mjs';

// Prosessin tila: mitä on tehty, mitä on jäljellä ja miten kukin vaihe tehdään
// käyttöliittymässä ja komentorivillä. Tila päätellään työtilasta ja
// dokumentaatiosta, ei merkitä käsin. Sama tieto CLI:lle (process) ja UI:lle.

const DONE = 'valmis';
const PARTIAL = 'kesken';
const TODO = 'odottaa';
const NA = 'ei-koske';
const INFO = 'tieto';

export function concreteRefs(project) {
  const refs = (project.refs?.include || []).filter((ref) => !ref.includes('*'));
  return refs.length ? refs : [project.refs.default];
}

// Missä projektin dokumentaatio on muokattavissa (agentit, commit) tai luettavissa.
export function docsLocation(project, loaded, ref) {
  const documentation = docsModeForRef(project, ref);
  const state = readWorkspaceState(loaded, project.project_id, ref);
  if (documentation.mode === 'repository' && project.repository?.path) {
    const gitDir = resolveRootPath(loaded, project.repository.path);
    const pathspec = documentation.source_path || 'vnetcon-docs';
    return { mode: 'repository', root: path.join(gitDir, pathspec), gitDir, pathspec, writable: true };
  }
  if (documentation.mode === 'separate' && documentation.repository?.path) {
    const gitDir = resolveRootPath(loaded, documentation.repository.path);
    const pathspec = documentation.source_path || '.';
    return { mode: 'separate', root: path.resolve(gitDir, pathspec), gitDir, pathspec, writable: true };
  }
  if (documentation.mode === 'managed') {
    return { mode: 'managed', root: state?.docs_root || null, gitDir: null, pathspec: null, writable: Boolean(state?.docs_root) };
  }
  // Etärepository: vain julkaisua varten haettu kopio, johon ei kirjoiteta.
  return { mode: documentation.mode, root: state?.docs_root || null, gitDir: null, pathspec: null, writable: false, remote: true };
}

// `running` on käynnissä olevan HTTP-palvelimen osoite ({ host, port, path }),
// kun prosessi lasketaan käyttöliittymälle.
export function computeProcess(loaded, access = {}, running = null) {
  const projects = loaded.config.projects.filter((project) => !access.projects || access.projects.includes(project.project_id));
  const channelId = loaded.config.service.default_channel;
  const channel = loaded.config.channels.find((item) => item.channel_id === channelId);
  let bundle = null;
  try { bundle = loadChannel(channelId, loaded); } catch { /* ei julkaistu */ }

  const projectProcesses = projects.map((project) => ({
    project_id: project.project_id,
    display_name: project.display_name || project.project_id,
    mode: project.documentation.mode,
    refs: concreteRefs(project).map((ref) => ({ ref, steps: projectSteps(loaded, project, ref, bundle) })),
  }));

  const drafts = listInterfaces(loaded, '', { includeDrafts: true }).filter((item) => item.status === 'draft');
  const guidance = readSharedGuidance(loaded);
  const workspace = [
    step('tyotila', 'MCP-työtila', DONE, loaded.root, null, [['init']]),
    step('projektit', 'Projektit lisätty', projects.length ? DONE : TODO,
      projects.length ? `${projects.length} projektia` : 'Lisää emoprojekti tai ulkopuolisia projekteja.',
      { tab: 'projektit', label: 'Lisää projekti' }, [['add-project', '--id', '<tunnus>', '--path', '<repo>', '--refs', 'main', '--docs-mode', 'repository']]),
    step('kanava', 'Julkaisukanava', channel && Object.keys(channel.project_refs || {}).length ? DONE : TODO,
      channel ? `${channelId}: ${Object.entries(channel.project_refs || {}).map(([p, r]) => `${p}@${r}`).join(', ') || 'ei projekteja'}` : `Oletuskanavaa ${channelId} ei ole.`,
      { tab: 'projektit', label: 'Kanavat' }, [['channel', 'create', channelId], ['channel', 'set-ref', channelId, '<projekti>', '<haara>']]),
    publishStep(loaded, channelId, channel, bundle),
    step('yhteinen-ohjaus', 'Yhteinen ohjaus ja integraatiot',
      drafts.length ? PARTIAL : INFO,
      `${guidance.length} ohjaustiedostoa${drafts.length ? `, ${drafts.length} integraatioluonnosta odottaa hyväksyntää` : ''}`,
      { tab: drafts.length ? 'integraatiot' : 'ohjaus', label: drafts.length ? 'Integraatiot' : 'Yhteinen ohjaus' },
      [['guidance', 'list'], ['interface', 'list']]),
  ];
  return { workspace, connection: connectionSteps(loaded, bundle, channelId, running), projects: projectProcesses, default_channel: channelId };
}

function projectSteps(loaded, project, ref, bundle) {
  const id = project.project_id;
  const location = docsLocation(project, loaded, ref);
  const state = readWorkspaceState(loaded, id, ref);
  const steps = [];
  const agent = (workflow) => ['agent', 'run', '--project', id, '--ref', ref, '--workflow', workflow];

  // Käyttöönotto
  const projectYaml = location.root ? readText(path.join(location.root, 'tila', 'projekti.yaml')) : null;
  if (projectYaml === null) {
    steps.push(step('kayttoonotto', 'Käyttöönotto (/vnetcon-init)', TODO,
      location.mode === 'managed' ? 'Aja ensin päivitys, joka luo dokumentaatiotyötilan.' : 'Dokumentaatiota ei löydy.',
      { action: 'bootstrap', label: 'Päivitä' }, [['bootstrap', '--project', id, '--ref', ref]]));
  } else {
    const done = !projectYaml.includes('TÄYTTÄMÄTÖN');
    steps.push(step('kayttoonotto', 'Käyttöönotto (/vnetcon-init)', done ? DONE : TODO,
      done ? 'Projekti on kartoitettu.' : 'Projektia ei ole vielä kartoitettu.',
      location.writable ? { action: 'agent', workflow: 'vnetcon-init', label: 'Käynnistä käyttöönotto' } : null,
      [agent('vnetcon-init')], '/vnetcon-init'));
  }

  // Dokumentointi
  const registry = location.root ? readYaml(path.join(location.root, 'tila', 'rekisteri.yaml')) : null;
  const modules = Array.isArray(registry?.moduulit) ? registry.moduulit : [];
  const counts = { valmis: 0, kesken: 0, tekematta: 0, 'rajattu-pois': 0 };
  for (const item of modules) counts[item?.tila] = (counts[item?.tila] || 0) + 1;
  const scope = modules.length - (counts['rajattu-pois'] || 0);
  const documented = counts.valmis || 0;
  steps.push(step('dokumentointi', 'Dokumentointi (/dokumentoi)',
    !modules.length ? TODO : documented >= scope ? DONE : documented || counts.kesken ? PARTIAL : TODO,
    modules.length ? `${documented}/${scope} moduulia valmiina${counts.kesken ? `, ${counts.kesken} kesken` : ''}` : 'Moduulirekisteri on tyhjä; käyttöönotto luo sen.',
    location.writable ? { action: 'agent', workflow: 'dokumentoi', label: 'Dokumentoi seuraava moduuli' } : null,
    [agent('dokumentoi'), agent('dokumentoi-kaikki')], '/dokumentoi',
    { modules: counts, total: scope, done: documented }));

  // Commit
  if (location.gitDir) {
    const changes = gitStatus(location.gitDir, location.pathspec);
    steps.push(step('commit', 'Commit', changes === null ? INFO : changes.length ? PARTIAL : DONE,
      changes === null ? 'Git-tilaa ei voitu lukea.' : changes.length ? `${changes.length} commitoimatonta muutosta. MCP julkaisee vain commitoidun.` : 'Kaikki muutokset on commitoitu.',
      { action: 'commit', label: 'Muutokset ja commit' }, [['docs', 'diff', '--project', id, '--ref', ref], ['docs', 'commit', '--project', id, '--ref', ref, '--message', '<viesti>']]));
  } else {
    steps.push(step('commit', 'Commit', NA,
      location.mode === 'managed' ? 'Managed-dokumentaatio hyväksytään, sitä ei commitoida.' : 'Etärepository: muutokset tehdään projektin omassa työnkulussa.', null, []));
  }

  // Päivitys
  let key = null;
  let error = null;
  try { key = revisionKey(project, ref, loaded); } catch (caught) { error = caught.message; }
  const current = state && (state.revision_key || state.source_commit_sha) === key;
  steps.push(step('paivitys', 'Päivitys MCP-työtilaan', error ? INFO : !state ? TODO : current ? DONE : PARTIAL,
    error || (!state ? 'Ei vielä päivitetty.' : current ? 'Työtila vastaa uusinta committia.' : 'Repossa on uusia committeja.'),
    { action: 'bootstrap', label: 'Päivitä' }, [['bootstrap', '--project', id, '--ref', ref]]));

  // Hyväksyntä (managed)
  if (location.mode === 'managed') {
    const approved = state?.approved_revision && state.approved_revision === state.documentation_revision;
    steps.push(step('hyvaksynta', 'Hyväksyntä', approved ? DONE : state?.status === 'needs_documentation' ? TODO : PARTIAL,
      approved ? 'Nykyinen revisio on hyväksytty.' : 'Tarkista ja hyväksy dokumentaatio ennen julkaisua.',
      { action: 'approve', label: 'Hyväksy' }, [['review', '--project', id, '--ref', ref], ['approve', '--project', id, '--ref', ref]]));
  }

  // Julkaisu
  const release = bundle?.projects?.find((item) => item.project_id === id && item.ref === ref);
  const published = release && state && release.source_commit_sha === state.source_commit_sha
    && (release.docs_commit_sha || null) === (state.docs_commit_sha || null);
  steps.push(step('julkaisu', 'Julkaisu', !release ? TODO : published ? DONE : PARTIAL,
    !release ? 'Ei vielä julkaistu oletuskanavassa.' : published ? 'Julkaistu versio vastaa työtilaa.' : 'Työtilassa on julkaisematonta sisältöä.',
    { action: 'publish', label: 'Julkaise' }, [['publish', '--channel', loaded.config.service.default_channel]]));

  // Ylläpito: synkronointi koodimuutoksiin
  const sync = location.root ? readYaml(path.join(location.root, 'tila', 'synkronoitu.yaml')) : null;
  const baseline = String(sync?.viimeisin_synkronoitu_commit || '');
  const codeDir = project.repository?.path ? resolveRootPath(loaded, project.repository.path) : null;
  let behind = null;
  if (baseline && codeDir) {
    try { behind = Number(run('git', ['-C', codeDir, 'rev-list', '--count', `${baseline}..${ref}`])); } catch { behind = null; }
  }
  steps.push(step('synkronointi', 'Ylläpito: synkronointi koodimuutoksiin',
    behind === null ? INFO : behind > 0 ? PARTIAL : DONE,
    behind === null ? 'Lähtötasoa ei ole vielä asetettu tai koodirepo ei ole paikallinen.' : behind > 0 ? `${behind} committia lähtötason jälkeen.` : 'Dokumentaatio on synkronoitu koodiin.',
    location.writable ? { action: 'agent', workflow: 'synkronoi', label: 'Synkronoi' } : null,
    [agent('synkronoi')], '/synkronoi-dokumentaatio'));
  return steps;
}

// Yhteys AI-clienteihin. Paikalliset clientit tarvitsevat vain osoitteen;
// ChatGPT:n ketjusta osa tehdään OpenAI:n palveluissa ja terminaalissa, joten
// niiden tila on "tieto" ja vaihe kertoo, missä se tehdään.
function connectionSteps(loaded, bundle, channelId, running) {
  const http = loaded.config.runtime?.http || null;
  const endpoint = mcpEndpoint(loaded, running);
  const listen = `${endpoint.host}:${endpoint.port}`;
  const saveHttp = ['server', 'configure-http', '--listen', running ? listen : `${DEFAULT_HTTP.host}:${DEFAULT_HTTP.port}`];
  const published = bundle ? `Kanava ${channelId} on julkaistu.` : `Kanavaa ${channelId} ei ole julkaistu; julkaise ensin, muuten clientit eivät näe dokumentaatiota.`;

  let httpStatus;
  let httpDetail;
  if (http && (!running || (http.host === running.host && Number(http.port) === Number(running.port)))) {
    httpStatus = DONE;
    httpDetail = `${endpoint.url}${running ? ' — tämä käyttöliittymä palvelee samaa osoitetta.' : ''}`;
  } else if (http) {
    httpStatus = PARTIAL;
    httpDetail = `Asetuksissa ${http.host}:${http.port}, mutta käyttöliittymä kuuntelee ${listen}. Tallenna nykyinen osoite tai käynnistä ui uudelleen.`;
  } else {
    httpStatus = TODO;
    httpDetail = running
      ? `Käyttöliittymä palvelee MCP:tä osoitteessa ${endpoint.url}, mutta osoitetta ei ole tallennettu. Tallenna se, niin sama osoite toimii myös serve- ja tunnel-komennoilla.`
      : `Osoitetta ei ole tallennettu. Oletus on ${DEFAULT_HTTP.host}:${DEFAULT_HTTP.port} (sama kuin ui).`;
  }

  const mode = loaded.config.runtime?.http?.authentication?.mode || 'none';
  const loopback = isLoopbackHost(endpoint.host);
  let authStatus = DONE;
  let authDetail = `${mode}: MCP kuuntelee vain omaa konetta, ja tunnel-client ottaa yhteyden täältä. ChatGPT:n käyttäjät rajataan workspacen oikeuksilla.`;
  if (mode === 'none' && !loopback) {
    authStatus = TODO;
    authDetail = 'Palvelin kuuntelee verkkoa ilman tunnistusta. Valitse tunnistus ennen käyttöä.';
  } else if (mode === 'oidc') {
    authDetail = 'oidc: ChatGPT kirjautuu tunnistuspalvelun kautta (OAuth).';
  } else if (mode !== 'none') {
    authStatus = INFO;
    authDetail = `${mode}: token tai salasana asetetaan clienttiin. ChatGPT:n yhteydelle sopivat oidc (OAuth) tai none omalla koneella.`;
  }

  const tunnel = storedTunnel(loaded);
  const commands = tunnelCommands(loaded, { running });
  return [
    step('yhteys-paikalliset', 'Paikalliset clientit (Claude, Codex, Cursor, VS Code)', INFO,
      `${published} Lisää clienttiin osoite ${endpoint.url} tai stdio-käynnistys. Valmiit asetukset: Yhteys.`,
      { tab: 'yhteys', label: 'Yhteys' }, [], null, { group: 'paikalliset' }),
    step('yhteys-julkaisu', `Kanava ${channelId} julkaistu`, bundle ? DONE : TODO,
      bundle ? `Julkaistu ${bundle.created_at}. ChatGPT näkee tämän julkaisun.` : 'ChatGPT näkee vain julkaistun sisällön. Julkaise kanava ensin.',
      { action: 'publish', label: 'Julkaise' }, [['publish', '--channel', channelId]], null, { group: 'chatgpt' }),
    step('http', 'HTTP-palvelimen osoite', httpStatus, httpDetail,
      { action: 'save-http', label: 'Tallenna osoite' }, [saveHttp], null, { group: 'chatgpt' }),
    step('tunnistus', 'Tunnistus', authStatus, authDetail,
      { tab: 'asetukset', label: 'Asetukset' }, [['auth', 'status']], null, { group: 'chatgpt' }),
    step('tunneli', 'Tunneli OpenAI:ssa', tunnel ? DONE : TODO,
      tunnel
        ? `${tunnel.tunnel_id} (tunnel-client-profiili ${tunnel.profile})`
        : 'Luo tunneli: platform.openai.com/settings/organization/tunnels. Luo ajonaikainen avain (Restricted, Tunnels: Read + Use): platform.openai.com/settings/organization/api-keys. Tallenna tunnelin tunniste tähän.',
      { action: 'form', label: tunnel ? 'Vaihda tunniste' : 'Tallenna tunniste', fields: [{ name: 'tunnel-id', placeholder: 'tunnel_ + 32 merkkiä', value: tunnel?.tunnel_id || '' }], args: ['tunnel', 'configure', 'openai', '--tunnel-id', '{tunnel-id}'] },
      [['tunnel', 'configure', 'openai', '--tunnel-id', tunnel?.tunnel_id || '<TUNNEL_ID>']], null, { group: 'chatgpt' }),
    step('tunnel-client-asennus', 'tunnel-client asennettu', commands.installed ? DONE : TODO,
      commands.installed
        ? `${commands.directory}. Poisto: tunnel uninstall openai tai poista hakemisto.`
        : `Asennetaan MCP-työtilaan (${commands.directory}), ei PATHiin eikä kotihakemistoon; poisto poistamalla hakemisto. Lataus OpenAI:n julkaisusta tarkistussummalla, tai --from <zip|hakemisto> paikallisesta kopiosta.`,
      { action: 'install-tunnel-client', label: 'Lataa ja asenna' }, [['tunnel', 'install', 'openai'], ['tunnel', 'install', 'openai', '--from', '<zip|hakemisto>']], null, { group: 'chatgpt' }),
    step('tunnel-client', 'tunnel-client käynnissä', INFO,
      `Aja vnetcon-docs-hakemistossa omassa terminaali-ikkunassa. Pidä run käynnissä${running ? ' ja tämä käyttöliittymä auki' : ' ja MCP-palvelin (ui tai serve --transport http) käynnissä'}. ${tunnel ? '' : 'Korvaa <TUNNEL_ID> tai tallenna tunniste ensin.'}`.trim(),
      null, [['tunnel', 'prepare', 'openai']], null, { group: 'chatgpt', terminal: { bash: commands.bash, powershell: commands.powershell } }),
    step('chatgpt', 'Yhteys ChatGPT:ssä', INFO,
      'chatgpt.com → Settings → Connectors → Connection: Tunnel, valitse tunneli. Vaatii Business-, Enterprise- tai Edu-workspacen, jossa ylläpitäjä on sallinut omat MCP-yhteydet. Kokeile: "Mitä projekteja dokumentaatiossa on?"',
      null, [], null, { group: 'chatgpt' }),
  ];
}

function publishStep(loaded, channelId, channel, bundle) {
  return step('julkaisu', 'Julkaisu AI-clienteille', !bundle ? TODO : DONE,
    bundle ? `${channelId} julkaistu ${bundle.created_at}` : `Kanavaa ${channelId} ei ole julkaistu.`,
    channel ? { action: 'publish', label: 'Julkaise' } : null, [['publish', '--channel', channelId], ['smoke-test', '--channel', channelId]]);
}

function step(id, title, status, detail, ui, cli, slash = null, extra = {}) {
  return { id, title, status, detail, ui, cli, slash, ...extra };
}

function gitStatus(gitDir, pathspec) {
  try {
    const output = run('git', ['-C', gitDir, 'status', '--porcelain', '--', pathspec || '.']);
    return output ? output.split('\n').filter(Boolean) : [];
  } catch {
    return null;
  }
}

function readText(filename) {
  try { return fs.readFileSync(filename, 'utf8'); } catch { return null; }
}

function readYaml(filename) {
  const text = readText(filename);
  if (text === null) return null;
  try { return YAML.parse(text); } catch { return null; }
}

// Komentorivin esitys: sama komento bashille ja PowerShellille.
export function commandLines(args) {
  const quote = (value, shell) => {
    // Paikanpitäjät (<tunnus>) näytetään sellaisenaan; käyttäjä korvaa ne.
    if (/^[A-Za-z0-9._/@:=,+-]+$/.test(value) || /^<[^>]+>$/.test(value)) return value;
    return shell === 'bash' ? `'${value.replaceAll("'", `'\\''`)}'` : `'${value.replaceAll("'", "''")}'`;
  };
  return {
    bash: ['./tyokalut/vnetcon-ai/vnetcon-ai', 'mcp', ...args.map((value) => quote(value, 'bash'))].join(' '),
    powershell: ['tyokalut\\vnetcon-ai\\vnetcon-ai.cmd', 'mcp', ...args.map((value) => quote(value, 'powershell'))].join(' '),
  };
}
