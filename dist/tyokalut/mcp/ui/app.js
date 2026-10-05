// vnetcon-docs MCP — hallintakäyttöliittymä. Ei riippuvuuksia. Kaikki palvelimelta
// tuleva teksti asetetaan textContentina, ei HTML:nä. Jokainen toiminto ajaa yhden
// CLI-komennon, ja sama komento näytetään käyttäjälle kohdassa "Komentorivillä".
'use strict';

const AUTH_KEY = 'vnetcon-mcp-auth';
const S = { session: null, overview: null, process: null, jobs: [], guidance: [], interfaces: { interfaces: [], template: '' }, commands: [], selectedJob: null, editProject: null };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
// form.id ja form.name osoittavat lomakkeen omiin ominaisuuksiin, eivät kenttiin.
const field = (form, name) => form.elements.namedItem(name);
const short = (sha) => (sha ? sha.slice(0, 12) : '—');
const when = (iso) => (iso ? new Date(iso).toLocaleString('fi-FI') : '—');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// --- Palvelinkutsut ---------------------------------------------------------

function authHeader() {
  try { return sessionStorage.getItem(AUTH_KEY) || ''; } catch { return ''; }
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const auth = authHeader();
  if (auth) headers.Authorization = auth;
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-Vnetcon-UI'] = '1';
  }
  const response = await fetch(`api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLogin(data);
    throw new Error(data.error || 'Kirjautuminen vaaditaan.');
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

// --- Komentorivin esitys ----------------------------------------------------

function quote(value, shell) {
  if (/^[A-Za-z0-9._/@:=,+-]+$/.test(value) || /^<[^>]+>$/.test(value)) return value;
  return shell === 'bash' ? `'${value.replaceAll("'", `'\\''`)}'` : `'${value.replaceAll("'", "''")}'`;
}

// Päätteessä sisältö annetaan tiedostosta ja agentti ajetaan etualalla.
function displayArgs(args) {
  return args.filter((value) => value !== '--background')
    .flatMap((value) => (value === '--stdin' ? ['--file', '<tiedosto>'] : value === '--input-stdin' ? ['--input-file', '<tiedosto>'] : [value]));
}

function commandLines(args) {
  const shown = displayArgs(args);
  return {
    bash: ['./tyokalut/vnetcon-ai/vnetcon-ai', 'mcp', ...shown.map((value) => quote(value, 'bash'))].join(' '),
    powershell: ['tyokalut\\vnetcon-ai\\vnetcon-ai.cmd', 'mcp', ...shown.map((value) => quote(value, 'powershell'))].join(' '),
  };
}

function cliBlock(argsList, slash) {
  const list = (Array.isArray(argsList[0]) ? argsList : [argsList]).filter((args) => args.length);
  if (!list.length && !slash) return null;
  const bash = list.map((args) => commandLines(args).bash).join('\n');
  const powershell = list.map((args) => commandLines(args).powershell).join('\n');
  return el('details', { class: 'cli' }, el('summary', {}, 'Komentorivillä'),
    slash ? el('p', { class: 'hint' }, `Agentissa (claude tai codex vnetcon-docs-hakemistossa): ${slash}`) : null,
    list.length ? [el('div', { class: 'cli-label' }, 'bash (macOS, Linux, WSL, Git Bash) ', copyButton(bash)), el('pre', { class: 'mono' }, bash),
      el('div', { class: 'cli-label' }, 'PowerShell (Windows) ', copyButton(powershell)), el('pre', { class: 'mono' }, powershell)] : null);
}

function copyButton(textValue) {
  return el('button', { type: 'button', class: 'small ghost', onclick: () => copy(textValue) }, 'Kopioi');
}

async function copy(textValue) {
  try {
    await navigator.clipboard.writeText(textValue);
    setStatus('Kopioitu leikepöydälle.', true);
  } catch {
    setStatus('Leikepöytä ei ole käytettävissä; kopioi teksti käsin.', false);
  }
}

// --- Toiminnot ----------------------------------------------------------------

function setStatus(text, ok) {
  const status = $('#tila');
  status.textContent = text;
  status.className = ok === undefined ? '' : ok ? 'ok' : 'err';
}

async function run(args, { stdin, quiet } = {}) {
  const buttons = $$('button');
  buttons.forEach((item) => { item.disabled = true; });
  setStatus('Käynnissä…');
  $('#komento').hidden = false;
  $('#komento').textContent = `$ ${commandLines(args).bash}`;
  try {
    const result = await api('/run', { method: 'POST', body: { args, stdin } });
    $('#loki').textContent = result.output || 'Valmis.';
    setStatus(result.ok ? 'Onnistui' : 'Epäonnistui', result.ok);
    if (!quiet) await refresh();
    return result;
  } catch (error) {
    $('#loki').textContent = error.message;
    setStatus('Epäonnistui', false);
    return { ok: false, output: error.message };
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
  }
}

// Painike + "Komentorivillä". args voi olla funktio, joka lukee lomakkeen arvot;
// komentovihje päivittyy, kun lomaketta muutetaan.
function action(label, args, { stdin, ghost, admin = true, small = true, after, cli = true } = {}) {
  const resolve = () => (typeof args === 'function' ? args() : args);
  const holder = el('div', { class: `action${admin ? ' admin' : ''}` });
  const render = () => {
    let current = [];
    try { current = resolve() || []; } catch { current = []; }
    const open = holder.querySelector('details')?.open;
    holder.replaceChildren(...[
      el('button', {
        type: 'button', class: `${small ? 'small ' : ''}${ghost ? 'ghost' : ''}`,
        onclick: async () => {
          let finalArgs;
          try { finalArgs = resolve(); } catch (error) { setStatus(error.message, false); return; }
          const result = await run(finalArgs, { stdin: typeof stdin === 'function' ? stdin() : stdin });
          if (after) after(result);
        },
      }, label),
      cli ? cliBlock(current) : null].filter(Boolean));
    if (open && holder.querySelector('details')) holder.querySelector('details').open = true;
  };
  render();
  holder.refresh = render;
  return holder;
}

// Poisto: suunnitelma, kirjoitettu vahvistus ja valinnainen pysyvä poisto.
function deleteAction(label, args, targetId) {
  const box = el('div', { class: 'action admin' });
  const confirmInput = el('input', { placeholder: targetId });
  const purge = el('input', { type: 'checkbox' });
  const lines = () => [...args, '--confirm', ...(purge.checked ? ['--purge'] : [])];
  const cli = el('div');
  const refreshCli = () => cli.replaceChildren(cliBlock(lines()));
  purge.addEventListener('change', refreshCli);
  const panel = el('div', { class: 'confirm', hidden: true },
    el('p', { class: 'hint' }, 'Suunnitelma näkyy lokissa. Poistettu kohde siirtyy roskakoriin, josta sen voi palauttaa.'),
    el('label', { class: 'check' }, purge, ' Poista pysyvästi (--purge): ei palautusta'),
    el('label', {}, `Vahvista kirjoittamalla ${targetId}`, confirmInput),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'small danger', onclick: async () => {
        if (confirmInput.value.trim() !== targetId) { setStatus(`Kirjoita ${targetId} vahvistukseksi.`, false); return; }
        await run(lines());
      } }, 'Poista'),
      el('button', { type: 'button', class: 'small ghost', onclick: () => { panel.hidden = true; } }, 'Peruuta')),
    cli);
  refreshCli();
  box.append(el('button', { type: 'button', class: 'small ghost danger-text', onclick: async () => {
    panel.hidden = false;
    await run(args, { quiet: true });
  } }, label), panel);
  return box;
}

// --- Kirjautuminen ja aloitus -----------------------------------------------

function showLogin(data) {
  const mode = data.auth_mode;
  $('#kirjaudu').hidden = false;
  $$('.tab').forEach((tab) => { tab.hidden = true; });
  const texts = {
    bearer: 'Palvelin vaatii bearer-tokenin (auth token create).',
    basic: 'Kirjaudu käyttäjätunnuksella (auth user add).',
    oidc: data.oidc?.client_id ? 'Kirjaudu organisaation tunnistuspalvelussa tai liitä access token.' : 'Palvelin käyttää OIDC-tunnistusta. Selainkirjautumista ei ole määritetty (auth configure-oidc --ui-client-id): liitä voimassa oleva access token.',
  };
  $('#kirjaudu-ohje').textContent = texts[mode] || 'Kirjautuminen vaaditaan.';
  $$('#kirjaudu-lomake [data-mode]').forEach((label) => { label.hidden = !label.dataset.mode.split(' ').includes(mode); });
  $('#kirjaudu-lomake').dataset.mode = mode || 'bearer';
  const oidcButton = $('#oidc-kirjaudu');
  oidcButton.hidden = !(mode === 'oidc' && data.oidc?.client_id);
  oidcButton.onclick = () => startOidc(data.oidc);
}

$('#kirjaudu-lomake').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const value = form.dataset.mode === 'basic'
    ? `Basic ${btoa(unescape(encodeURIComponent(`${field(form, 'username').value}:${field(form, 'password').value}`)))}`
    : `Bearer ${field(form, 'token').value.trim()}`;
  try { sessionStorage.setItem(AUTH_KEY, value); } catch { /* ei tallennusta */ }
  $('#kirjaudu').hidden = true;
  await start();
});

// OIDC: authorization code + PKCE selaimessa. Token tallennetaan vain välilehden ajaksi.
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
}

async function startOidc(oidc) {
  try {
    const discovery = await (await fetch(`${oidc.issuer}/.well-known/openid-configuration`)).json();
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    sessionStorage.setItem('vnetcon-oidc', JSON.stringify({ verifier, state, token_endpoint: discovery.token_endpoint, client_id: oidc.client_id }));
    const params = new URLSearchParams({
      response_type: 'code', client_id: oidc.client_id, redirect_uri: location.origin + location.pathname,
      scope: oidc.scopes || 'openid', state, code_challenge: challenge, code_challenge_method: 'S256',
    });
    if (oidc.resource) params.set('resource', oidc.resource);
    location.assign(`${discovery.authorization_endpoint}?${params}`);
  } catch (error) {
    setStatus(`Tunnistuspalveluun ei saatu yhteyttä: ${error.message}`, false);
  }
}

async function completeOidc() {
  const params = new URLSearchParams(location.search);
  if (!params.get('code')) return;
  const saved = JSON.parse(sessionStorage.getItem('vnetcon-oidc') || 'null');
  history.replaceState(null, '', location.pathname);
  if (!saved || saved.state !== params.get('state')) { setStatus('Kirjautuminen hylättiin: tila ei täsmää.', false); return; }
  const response = await fetch(saved.token_endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: location.origin + location.pathname, client_id: saved.client_id, code_verifier: saved.verifier }),
  });
  const token = await response.json();
  if (!token.access_token) { setStatus(`Kirjautuminen epäonnistui: ${token.error_description || token.error || response.status}`, false); return; }
  sessionStorage.setItem(AUTH_KEY, `Bearer ${token.access_token}`);
  sessionStorage.removeItem('vnetcon-oidc');
}

function showSetup(setup) {
  $('#aloitus').hidden = false;
  $$('.tab').forEach((tab) => { tab.hidden = true; });
  $('#tabs').hidden = true;
  $('#aloitus-ohje').textContent = setup.parent
    ? `Työtila luodaan hakemistoon ${setup.default_root}. Emoprojekti ${setup.parent.name} (${setup.parent.root})${setup.parent.addable ? ' voidaan lisätä ensimmäiseksi projektiksi.' : ` ei ole lisättävissä: ${setup.parent.note}`}`
    : `Työtila luodaan hakemistoon ${setup.default_root}. Projektit lisätään sen jälkeen.`;
  const make = (label, emoprojekti) => el('div', { class: 'action' },
    el('button', { type: 'button', onclick: async () => {
      setStatus('Luodaan työtilaa…');
      try {
        const result = await api('/setup/init', { method: 'POST', body: { emoprojekti } });
        $('#loki').textContent = result.output;
        setStatus(result.ok ? 'Työtila luotu, ladataan…' : 'Epäonnistui', result.ok);
        if (result.ok) setTimeout(() => location.reload(), 1500);
      } catch (error) { setStatus(error.message, false); }
    } }, label), cliBlock(['init', emoprojekti ? '--emoprojekti' : '--ilman-emoprojektia']));
  $('#aloitus-toiminnot').replaceChildren(
    setup.parent?.addable ? make('Luo työtila ja lisää emoprojekti', true) : null,
    make(setup.parent?.addable ? 'Luo työtila ilman emoprojektia' : 'Luo työtila', false));
}

// --- Välilehdet -------------------------------------------------------------

$('#tabs').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tab]');
  if (button) openTab(button.dataset.tab);
});

function openTab(name) {
  $$('#tabs button').forEach((item) => item.classList.toggle('active', item.dataset.tab === name));
  $$('.tab').forEach((tab) => { tab.hidden = tab.id !== name; });
  const loaders = { ohjaus: () => loadGuidance(), integraatiot: () => loadInterfaces(), ajot: loadJobs, roskakori: loadTrash, ohjeet: () => loadGuides(), asetukset: renderSettings };
  if (loaders[name] && S.overview) loaders[name]();
}

// --- Prosessi ---------------------------------------------------------------

const STATUS = { valmis: ['ok', 'valmis'], kesken: ['warn', 'kesken'], odottaa: ['info', 'odottaa'], 'ei-koske': ['', 'ei koske'], tieto: ['', 'tieto'] };
const FLOW = [['Työtila', ['tyotila']], ['Projektit', ['projektit']], ['Käyttöönotto', ['kayttoonotto']], ['Dokumentointi', ['dokumentointi']],
  ['Commit', ['commit']], ['Päivitys', ['paivitys']], ['Julkaisu', ['julkaisu']], ['Yhteys', ['yhteys']], ['Ylläpito', ['synkronointi', 'yhteinen-ohjaus']]];

function stepAction(item, project, ref) {
  const ui = item.ui;
  if (!ui) return null;
  if (ui.tab) return el('button', { type: 'button', class: 'small ghost', onclick: () => openTab(ui.tab) }, ui.label);
  // Vaiheen komennot näytetään vaiheen omassa Komentorivillä-kohdassa.
  if (ui.action === 'agent') return action(ui.label, ['agent', 'run', '--project', project, '--ref', ref, '--workflow', ui.workflow], { cli: false, after: () => openTab('ajot') });
  if (ui.action === 'commit') return el('button', { type: 'button', class: 'small ghost admin', onclick: () => { openTab('projektit'); showChanges(project, ref); } }, ui.label);
  const args = ui.action === 'approve' ? item.cli[1] : item.cli[0];
  return args ? action(ui.label, args, { cli: false }) : null;
}

function stepRow(item, project, ref) {
  const [chipClass, chipText] = STATUS[item.status] || ['', item.status];
  return el('li', { class: `step ${item.status}` },
    el('div', { class: 'step-head' }, el('span', { class: `chip ${chipClass}` }, chipText), el('strong', {}, item.title)),
    el('div', { class: 'hint' }, String(item.detail).replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, (iso) => when(iso))),
    item.total ? el('progress', { max: String(item.total), value: String(item.done) }) : null,
    item.status !== 'valmis' && item.status !== 'ei-koske' ? el('div', { class: 'step-actions' }, stepAction(item, project, ref), cliBlock(item.cli || [], item.slash)) : null);
}

function renderProcess() {
  const p = S.process;
  const all = [...p.workspace, ...p.projects.flatMap((project) => project.refs.flatMap((ref) => ref.steps))];
  const phase = (ids) => {
    const steps = all.filter((item) => ids.includes(item.id) && item.status !== 'ei-koske');
    if (!steps.length || steps.every((item) => item.status === 'tieto')) return 'tieto';
    if (steps.every((item) => item.status === 'valmis' || item.status === 'tieto')) return 'valmis';
    return steps.some((item) => item.status === 'valmis' || item.status === 'kesken') ? 'kesken' : 'odottaa';
  };
  $('#prosessikaavio').replaceChildren(...FLOW.map(([name, ids], index) => el('div', { class: `flow-step ${phase(ids)}` }, el('span', {}, `${index + 1}`), name)));
  $('#prosessi-tyotila').replaceChildren(el('h3', {}, 'Työtila'), el('ol', { class: 'steps' }, p.workspace.map((item) => stepRow(item))));
  $('#prosessi-projektit').replaceChildren(...p.projects.flatMap((project) => project.refs.map((ref) => el('div', { class: 'card' },
    el('h3', {}, `${project.display_name} `, el('code', {}, `${project.project_id}@${ref.ref}`), el('small', {}, ` ${MODE_TEXT[project.mode] || project.mode}`)),
    el('ol', { class: 'steps' }, ref.steps.map((item) => stepRow(item, project.project_id, ref.ref)))))));
  if (!p.projects.length) $('#prosessi-projektit').append(el('p', { class: 'hint' }, 'Ei projekteja. Lisää ensimmäinen välilehdellä Projektit.'));
}

// --- Projektit --------------------------------------------------------------

const MODE_TEXT = { repository: 'dokumentaatio projektin repossa', separate: 'dokumentaatio omassa repossaan', managed: 'dokumentaatio MCP-työtilassa' };

function renderProjects() {
  const target = $('#projektilista');
  const changes = $('#muutokset');
  target.replaceChildren();
  if (!S.overview.projects.length) {
    target.append(el('p', { class: 'hint' }, 'Projekteja ei ole vielä lisätty.'));
  } else {
    target.append(el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Projekti', 'Repositorio', 'Dokumentaatio', 'Haarat', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, S.overview.projects.map((project) => el('tr', {},
        el('td', {}, el('strong', {}, project.display_name), el('br'), el('code', {}, project.project_id)),
        el('td', {}, el('code', {}, project.repository.path || project.repository.url || '—')),
        el('td', {}, project.documentation.mode,
          project.documentation.repository ? [el('br'), el('code', {}, project.documentation.repository.path || project.documentation.repository.url)] : null),
        el('td', {}, project.refs.map((ref) => el('div', {}, el('code', {}, ref.ref)))),
        el('td', {}, el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'small ghost admin', onclick: () => editProject(project) }, 'Muokkaa'),
          project.documentation.mode !== 'managed' ? el('button', { type: 'button', class: 'small ghost admin', onclick: () => showChanges(project.project_id, project.refs[0]?.ref) }, 'Muutokset ja commit') : null,
          deleteAction('Poista', ['remove-project', project.project_id], project.project_id)))))))));
  }
  target.append(changes || el('div', { id: 'muutokset' }));
  renderProjectForm();
}

function editProject(project) {
  S.editProject = project;
  const form = $('#projekti-lomake');
  field(form, 'id').value = project.project_id;
  field(form, 'id').readOnly = true;
  field(form, 'name').value = project.display_name;
  field(form, 'location').value = '';
  field(form, 'location').placeholder = `${project.repository.path || project.repository.url || ''} (tyhjä = ei muutosta)`;
  field(form, 'refs').value = project.refs.map((ref) => ref.ref).join(',');
  field(form, 'docs_mode').value = project.documentation.mode;
  field(form, 'docs_repo').value = '';
  field(form, 'docs_ref').value = project.documentation.default_ref || '';
  toggleSeparate();
  renderProjectForm();
  $('#projekti-lomake-otsikko').scrollIntoView({ behavior: 'smooth' });
}

function projectArgs() {
  const form = $('#projekti-lomake');
  const value = (name) => field(form, name).value.trim();
  const id = value('id');
  if (!id) throw new Error('Anna projektin tunnus.');
  const location = value('location');
  const remote = /^[a-z][a-z0-9+.-]*:\/\//i.test(location) || /^[^/\\]+@[^:]+:/.test(location);
  const args = S.editProject ? ['project', 'set', '--id', id] : ['add-project', '--id', id];
  if (location) args.push(remote ? '--url' : '--path', location);
  else if (!S.editProject) throw new Error('Anna repositorion polku tai URL.');
  if (value('name')) args.push('--name', value('name'));
  if (value('refs')) args.push('--refs', value('refs'));
  args.push('--docs-mode', value('docs_mode'));
  if (value('docs_mode') === 'separate') {
    if (value('docs_repo')) args.push('--docs-repo', value('docs_repo'));
    if (value('docs_ref')) args.push('--docs-ref', value('docs_ref'));
  }
  return args;
}

function renderProjectForm() {
  $('#projekti-lomake-otsikko').textContent = S.editProject ? `Muokkaa projektia ${S.editProject.project_id}` : 'Lisää projekti';
  $('#projekti-lomake-toiminnot').replaceChildren(el('div', { class: 'actions' },
    action(S.editProject ? 'Tallenna muutokset' : 'Lisää projekti', projectArgs, { small: false, after: (result) => { if (result.ok) resetProjectForm(); } }),
    S.editProject ? el('button', { type: 'button', class: 'ghost', onclick: resetProjectForm }, 'Peruuta muokkaus') : null));
}

function resetProjectForm() {
  S.editProject = null;
  const form = $('#projekti-lomake');
  form.reset();
  field(form, 'id').readOnly = false;
  field(form, 'location').placeholder = '../../laskutus tai git@github.com:org/laskutus.git';
  toggleSeparate();
  renderProjectForm();
}

function toggleSeparate() {
  const separate = field($('#projekti-lomake'), 'docs_mode').value === 'separate';
  $$('.separate-only').forEach((label) => { label.hidden = !separate; });
}

$('#projekti-lomake').addEventListener('input', () => { toggleSeparate(); $('#projekti-lomake-toiminnot .action')?.refresh?.(); });

async function showChanges(projectId, ref) {
  let target = $('#muutokset');
  if (!target) { target = el('div', { id: 'muutokset' }); $('#projektilista').append(target); }
  const result = await run(['docs', 'diff', '--project', projectId, '--ref', ref], { quiet: true });
  const message = el('input', { value: 'Dokumentaatio: ' });
  const commit = action('Commitoi', () => ['docs', 'commit', '--project', projectId, '--ref', ref, '--message', message.value.trim() || 'Dokumentaatio'], { small: false });
  message.addEventListener('input', () => commit.refresh());
  target.replaceChildren(el('div', { class: 'card' },
    el('h3', {}, `Dokumentaation muutokset: ${projectId}@${ref}`),
    el('pre', { class: 'mono log' }, result.output || 'Ei muutoksia.'),
    el('label', {}, 'Commit-viesti', message), commit));
  target.scrollIntoView({ behavior: 'smooth' });
}

// --- Kanavat ----------------------------------------------------------------

function renderChannels() {
  const target = $('#kanavalista');
  target.replaceChildren();
  if (!S.overview.channels.length) target.append(el('p', { class: 'hint' }, 'Kanavia ei ole. Luo kanava alla.'));
  for (const channel of S.overview.channels) {
    const refs = Object.entries(channel.project_refs);
    const published = channel.published;
    target.append(el('div', { class: 'card' },
      el('div', { class: 'toolbar' },
        el('h3', {}, el('code', {}, channel.channel_id), channel.channel_id === S.overview.default_channel ? el('small', {}, ' oletuskanava') : null),
        published ? el('span', { class: 'chip ok' }, `julkaistu ${when(published.created_at)}`) : el('span', { class: 'chip warn' }, 'ei julkaistu')),
      refs.length ? el('ul', { class: 'plain' }, refs.map(([project, ref]) => el('li', { class: 'inline-item' }, el('span', {}, `${project} @ ${ref}`),
        action('Poista kanavasta', ['channel', 'unset-ref', channel.channel_id, project], { ghost: true })))) : el('p', { class: 'hint' }, 'Ei projekteja.'),
      el('div', { class: 'actions' },
        action('Julkaise', ['publish', '--channel', channel.channel_id], { small: false }),
        action('Tarkista haku', ['smoke-test', '--channel', channel.channel_id], { ghost: true }),
        channel.channel_id !== S.overview.default_channel ? action('Tee oletukseksi', ['channel', 'set-default', channel.channel_id], { ghost: true }) : null,
        deleteAction('Poista kanava', ['channel', 'remove', channel.channel_id], channel.channel_id))));
  }
  const create = action('Luo kanava', () => ['channel', 'create', $('#uusi-kanava').value.trim() || '<kanava>']);
  $('#uusi-kanava').oninput = () => create.refresh();
  $('#uusi-kanava-toiminto').replaceChildren(create);
  const setRef = action('Aseta', () => ['channel', 'set-ref', $('#ref-kanava').value || '<kanava>', $('#ref-projekti').value || '<projekti>', $('#ref-haara').value.trim() || '<haara>']);
  ['#ref-kanava', '#ref-projekti', '#ref-haara'].forEach((selector) => { $(selector).oninput = () => setRef.refresh(); $(selector).onchange = () => setRef.refresh(); });
  $('#ref-toiminto').replaceChildren(setRef);
}

function fillSelects() {
  const channels = S.overview.channels.map((channel) => channel.channel_id);
  for (const select of [...$$('select[name="channel"]'), $('#ref-kanava')]) {
    const current = select.value;
    select.replaceChildren(...channels.map((id) => el('option', { value: id }, id)));
    select.value = channels.includes(current) ? current : S.overview.default_channel;
  }
  for (const select of [...$$('select[name="project_id"]'), $('#ref-projekti'), $('#ajo-projekti')]) {
    const current = select.value;
    select.replaceChildren(...S.overview.projects.map((project) => el('option', { value: project.project_id }, `${project.display_name} (${project.project_id})`)));
    if (current) select.value = current;
  }
}

// --- Agenttiajot ------------------------------------------------------------

function jobArgs() {
  const project = $('#ajo-projekti').value;
  if (!project) throw new Error('Valitse projekti.');
  const workflow = $('#ajo-tyonkulku').value;
  const args = ['agent', 'run', '--project', project, '--workflow', workflow];
  if ($('#ajo-haara').value.trim()) args.push('--ref', $('#ajo-haara').value.trim());
  if (workflow === 'dokumentoi' && $('#ajo-moduuli').value.trim()) args.push('--module', $('#ajo-moduuli').value.trim());
  if (['katselmoi', 'kuvaa-integraatio'].includes(workflow)) args.push('--input-stdin');
  return args;
}

let jobForm = null;
function renderJobForm() {
  const workflow = $('#ajo-tyonkulku').value;
  $$('.ajo-moduuli').forEach((label) => { label.hidden = workflow !== 'dokumentoi'; });
  $$('.ajo-syote').forEach((label) => { label.hidden = !['katselmoi', 'kuvaa-integraatio'].includes(workflow); });
  jobForm = action('Käynnistä ajo', jobArgs, { small: false, stdin: () => $('#ajo-syote').value, after: () => loadJobs() });
  $('#ajo-toiminto').replaceChildren(jobForm);
}

['#ajo-tyonkulku', '#ajo-projekti'].forEach((selector) => $(selector).addEventListener('change', renderJobForm));
['#ajo-haara', '#ajo-moduuli'].forEach((selector) => $(selector).addEventListener('input', () => jobForm?.refresh()));

const JOB_STATUS = { running: ['info', 'käynnissä'], completed: ['ok', 'valmis'], needs_answers: ['warn', 'odottaa vastauksia'], failed: ['err', 'epäonnistui'], cancelled: ['', 'keskeytetty'], answered: ['', 'vastattu'] };
let jobTimer = null;

async function loadJobs() {
  try { S.jobs = (await api('/jobs')).jobs; } catch (error) { setStatus(error.message, false); return; }
  $('#ajolista').replaceChildren(...S.jobs.map((job) => {
    const [chipClass, chipText] = JOB_STATUS[job.status] || ['', job.status];
    return el('li', { class: job.id === S.selectedJob ? 'selected' : '', 'data-id': job.id, onclick: () => openJob(job.id) },
      el('span', { class: `chip ${chipClass}` }, chipText), ' ', job.workflow, el('small', {}, `${job.project_id}@${job.ref} · ${when(job.started_at)}`));
  }));
  if (!S.jobs.length) $('#ajolista').append(el('li', {}, el('small', {}, 'Ei ajoja.')));
  if (!S.selectedJob && S.jobs[0]) S.selectedJob = S.jobs[0].id;
  if (S.selectedJob) await openJob(S.selectedJob);
  clearTimeout(jobTimer);
  if (S.jobs.some((job) => job.status === 'running') && !$('#ajot').hidden) jobTimer = setTimeout(loadJobs, 3000);
}

async function openJob(id) {
  S.selectedJob = id;
  let job;
  try { job = await api(`/jobs/${encodeURIComponent(id)}`); } catch (error) { setStatus(error.message, false); return; }
  const answers = el('textarea', { rows: '6', placeholder: 'Vastaa kysymyksiin numeroittain.' });
  const [chipClass, chipText] = JOB_STATUS[job.status] || ['', job.status];
  $('#ajo-tiedot').replaceChildren(el('div', { class: 'card' },
    el('div', { class: 'toolbar' }, el('h3', {}, `${job.workflow}: ${job.project_id}@${job.ref}`), el('span', { class: `chip ${chipClass}` }, chipText)),
    el('p', { class: 'hint' }, `${job.agent} · kierros ${job.round} · aloitettu ${when(job.started_at)}${job.finished_at ? ` · päättyi ${when(job.finished_at)}` : ''}`),
    job.summary ? [el('h4', {}, 'Yhteenveto'), el('pre', { class: 'mono' }, job.summary)] : null,
    job.questions ? [el('h4', {}, 'Agentin kysymykset'), el('pre', { class: 'mono' }, job.questions)] : null,
    job.status === 'needs_answers' ? [el('label', {}, 'Vastaukset', answers),
      action('Lähetä vastaukset ja jatka', ['agent', 'answer', job.id, '--stdin'], { small: false, stdin: () => answers.value, after: () => loadJobs() })] : null,
    job.status === 'running' ? action('Keskeytä', ['agent', 'cancel', job.id], { ghost: true, after: () => loadJobs() }) : null,
    job.status === 'completed' && job.mode !== 'managed' ? el('button', { type: 'button', class: 'small ghost admin', onclick: () => { openTab('projektit'); showChanges(job.project_id, job.ref); } }, 'Tarkista muutokset ja commitoi') : null,
    el('h4', {}, 'Loki'), el('pre', { class: 'mono log' }, job.log.slice(-8000) || '—'),
    cliBlock([['agent', 'show', job.id]])));
  $$('#ajolista li').forEach((li) => li.classList.toggle('selected', li.dataset.id === job.id));
}

// --- Yhteinen ohjaus --------------------------------------------------------

async function loadGuidance(selected) {
  try { S.guidance = (await api('/guidance')).documents; } catch (error) { setStatus(error.message, false); return; }
  $('#ohjaus-tiedostot').replaceChildren(...S.guidance.map((doc) => el('li', { 'data-name': doc.path, onclick: () => openGuidance(doc.path) }, doc.path)));
  if (!S.guidance.length) $('#ohjaus-tiedostot').append(el('li', {}, el('small', {}, 'Ei tiedostoja. Kirjoita nimi ja sisältö ja tallenna.')));
  openGuidance(selected || S.guidance[0]?.path);
}

function openGuidance(name) {
  const doc = S.guidance.find((item) => item.path === name);
  $('#ohjaus-nimi').value = doc?.path || 'ohjaus.md';
  $('#ohjaus-sisalto').value = doc?.content || '';
  const current = () => $('#ohjaus-nimi').value.trim();
  const save = action('Tallenna', () => ['guidance', 'set', current(), '--stdin'], { small: false, stdin: () => $('#ohjaus-sisalto').value, after: () => loadGuidance(current()) });
  $('#ohjaus-nimi').oninput = () => save.refresh();
  $('#ohjaus-toiminnot').replaceChildren(el('div', { class: 'actions' }, save, doc ? deleteAction('Poista', ['guidance', 'remove', doc.path], doc.path) : null));
  $$('#ohjaus-tiedostot li').forEach((item) => item.classList.toggle('selected', item.dataset.name === name));
}

// --- Integraatiot -----------------------------------------------------------

const IF_STATUS = { active: 'ok', draft: 'warn', deprecated: 'err' };

async function loadInterfaces(selected) {
  try { S.interfaces = await api('/interfaces'); } catch (error) { setStatus(error.message, false); return; }
  $('#integraatio-lista').replaceChildren(...S.interfaces.interfaces.map((item) => el('li', { 'data-id': item.interface_id, onclick: () => openInterface(item.interface_id) },
    el('span', { class: `chip ${IF_STATUS[item.status] || ''}` }, item.status || '—'), ' ', item.display_name || item.interface_id, el('small', {}, item.interface_id))));
  if (!S.interfaces.interfaces.length) $('#integraatio-lista').append(el('li', {}, el('small', {}, 'Ei integraatiotietueita.')));
  if (selected) openInterface(selected);
}

function openInterface(id, yaml) {
  const item = S.interfaces.interfaces.find((candidate) => candidate.interface_id === id);
  $('#integraatio-id').value = id;
  $('#integraatio-yaml').value = yaml ?? item?._yaml ?? '';
  $('#integraatio-toiminnot').replaceChildren(el('div', { class: 'actions' },
    action('Tallenna', ['interface', 'set', id, '--stdin'], { small: false, stdin: () => $('#integraatio-yaml').value, after: () => loadInterfaces(id) }),
    item && item.status !== 'active' ? action('Hyväksy (active)', ['interface', 'set-status', id, 'active'], { ghost: true, after: () => loadInterfaces(id) }) : null,
    item && item.status === 'active' ? action('Vanhenna (deprecated)', ['interface', 'set-status', id, 'deprecated'], { ghost: true, after: () => loadInterfaces(id) }) : null,
    item ? deleteAction('Poista', ['interface', 'remove', id], id) : null));
  $$('#integraatio-lista li').forEach((li) => li.classList.toggle('selected', li.dataset.id === id));
}

$('#integraatio-uusi').addEventListener('click', () => {
  const id = $('#integraatio-uusi-id').value.trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(id)) { setStatus('Anna tunniste: pienet kirjaimet, numerot ja ._-', false); return; }
  openInterface(id, (S.interfaces.template || 'schema_version: 1\ninterface_id: <lyhyt-tunniste-v1>\nstatus: draft\n').replace('<lyhyt-tunniste-v1>', id));
});

// --- Haku -------------------------------------------------------------------

$('#haku-lomake').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const params = new URLSearchParams({ channel: field(form, 'channel').value, project_id: field(form, 'project_id').value, q: field(form, 'q').value });
  $('#dokumentti').hidden = true;
  try {
    const { results } = await api(`/search?${params}`);
    $('#hakutulokset').replaceChildren(...results.map((hit) => el('li', { onclick: () => openDocument(field(form, 'channel').value, field(form, 'project_id').value, hit.document_id) },
      el('strong', {}, hit.heading || hit.path), el('small', {}, `${hit.path} · ${hit.ref} · ${short(hit.source_commit_sha)}`), el('small', {}, hit.excerpt))));
    if (!results.length) $('#hakutulokset').append(el('li', {}, el('small', {}, 'Ei osumia.')));
  } catch (error) { setStatus(error.message, false); }
});

async function openDocument(channel, projectId, documentId) {
  try {
    const doc = await api(`/document?${new URLSearchParams({ channel, project_id: projectId, document_id: documentId })}`);
    $('#dokumentti').replaceChildren(el('div', { class: 'toolbar' }, el('strong', {}, doc.path), el('code', {}, `${doc.ref} · ${short(doc.source_commit_sha)}`)), el('hr'), markdown(doc.content));
    $('#dokumentti').hidden = false;
  } catch (error) { setStatus(error.message, false); }
}

// --- Yhteys -----------------------------------------------------------------

function renderConnection() {
  const c = S.overview.connection;
  const rows = [['MCP-osoite', c.mcp_url], ['Hallintakäyttöliittymä', c.ui_url], ['Tunnistus', c.auth_mode], ['Työtila', S.session.workspace], ['Oletuskanava', S.overview.default_channel]];
  $('#yhteystiedot').replaceChildren(...rows.flatMap(([key, value]) => [el('dt', {}, key), el('dd', {}, el('code', {}, value || '—'))]));
  $('#clientit').replaceChildren(...Object.entries(c.clients).map(([name, snippet]) => el('div', {},
    el('div', { class: 'toolbar' }, el('strong', {}, name), copyButton(snippet)), el('pre', { class: 'mono' }, snippet))));
  $('#tunneli-bash').textContent = c.tunnel.bash.join('\n');
  $('#tunneli-powershell').textContent = c.tunnel.powershell.join('\n');
}

// --- Asetukset --------------------------------------------------------------

function renderSettings() {
  const c = S.overview.connection;
  const input = (attrs) => el('input', attrs);
  const tokenName = input({ placeholder: 'tokenin nimi' });
  const tokenAdmin = input({ type: 'checkbox' });
  const revokeName = input({ placeholder: 'tokenin nimi' });
  const userName = input({ placeholder: 'käyttäjätunnus' });
  const userPassword = input({ type: 'password', placeholder: 'vähintään 12 merkkiä' });
  const userAdmin = input({ type: 'checkbox' });
  const removeUser = input({ placeholder: 'käyttäjätunnus' });
  const mode = el('select', {}, ...['none', 'bearer', 'basic', 'oidc'].map((value) => el('option', { value }, value)));
  mode.value = c.auth_mode;
  const listen = input({ value: c.mcp_url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') });
  const interval = input({ value: String(S.overview.refresh.poll_interval_seconds) });
  const debounce = input({ value: String(S.overview.refresh.debounce_seconds) });
  const keep = input({ value: '3' });
  const live = (holder, ...inputs) => { inputs.forEach((node) => { node.addEventListener('input', () => holder.refresh()); node.addEventListener('change', () => holder.refresh()); }); return holder; };
  $('#asetukset-sisalto').replaceChildren(
    el('div', { class: 'card' }, el('h3', {}, 'Tunnistus'),
      el('p', { class: 'hint' }, `Nykyinen tila: ${c.auth_mode}. Luo admin-token tai -käyttäjä ennen kuin vaihdat tilaa, muuten et pääse enää käyttöliittymään. Tilan muutos tulee voimaan, kun palvelin käynnistetään uudelleen.`),
      el('div', { class: 'form inline' }, el('label', {}, 'Tila', mode), live(action('Vaihda tila', () => ['auth', 'set-mode', mode.value]), mode)),
      el('h4', {}, 'Bearer-tokenit'),
      action('Näytä tokenit', ['auth', 'token', 'list'], { ghost: true }),
      el('div', { class: 'form inline' }, el('label', {}, 'Nimi', tokenName), el('label', { class: 'check' }, tokenAdmin, ' admin'),
        live(action('Luo token', () => ['auth', 'token', 'create', '--name', tokenName.value.trim() || '<nimi>', ...(tokenAdmin.checked ? ['--admin'] : [])]), tokenName, tokenAdmin)),
      el('p', { class: 'hint' }, 'Token näytetään vain kerran lokissa. Kopioi se talteen.'),
      el('div', { class: 'form inline' }, el('label', {}, 'Mitätöi token', revokeName),
        live(action('Mitätöi', () => ['auth', 'token', 'revoke', revokeName.value.trim() || '<nimi>'], { ghost: true }), revokeName)),
      el('h4', {}, 'Käyttäjät (basic)'),
      action('Näytä käyttäjät', ['auth', 'user', 'list'], { ghost: true }),
      el('div', { class: 'form inline' }, el('label', {}, 'Käyttäjätunnus', userName), el('label', {}, 'Salasana', userPassword), el('label', { class: 'check' }, userAdmin, ' admin'),
        live(action('Lisää käyttäjä', () => ['auth', 'user', 'add', '--username', userName.value.trim() || '<nimi>', '--password-stdin', ...(userAdmin.checked ? ['--admin'] : [])], { stdin: () => userPassword.value }), userName, userAdmin)),
      el('div', { class: 'form inline' }, el('label', {}, 'Poista käyttäjä', removeUser),
        live(action('Poista', () => ['auth', 'user', 'remove', removeUser.value.trim() || '<nimi>'], { ghost: true }), removeUser))),
    el('div', { class: 'card' }, el('h3', {}, 'HTTP-palvelin'),
      el('p', { class: 'hint' }, 'Muutos tulee voimaan, kun palvelin käynnistetään uudelleen. Muu kuin oman koneen osoite vaatii tunnistuksen.'),
      el('div', { class: 'form inline' }, el('label', {}, 'Kuuntele (host:port)', listen), live(action('Tallenna', () => ['server', 'configure-http', '--listen', listen.value.trim()]), listen))),
    el('div', { class: 'card' }, el('h3', {}, 'Muutosten automaattinen haku'),
      el('p', { class: 'hint' }, `Nykyinen tila: ${S.overview.refresh.mode}. Automaattinen haku päivittää työtilat; julkaisu tehdään edelleen erikseen.`),
      el('div', { class: 'form inline' }, el('label', {}, 'Väli (s)', interval), el('label', {}, 'Viive (s)', debounce),
        live(action('Ajastettu haku', () => ['refresh', 'configure-poll', '--interval', interval.value.trim(), '--debounce', debounce.value.trim()]), interval, debounce),
        live(action('Webhook', () => ['refresh', 'configure-webhook', '--debounce', debounce.value.trim()], { ghost: true }), debounce))),
    el('div', { class: 'card' }, el('h3', {}, 'Julkaisujen säilytys'),
      el('p', { class: 'hint' }, 'Poistaa vanhat julkaisut. Kanavien nykyiset julkaisut ja annettu määrä uusimpia säilytetään aina.'),
      el('div', { class: 'form inline' }, el('label', {}, 'Säilytä uusimmat', keep),
        live(action('Näytä suunnitelma', () => ['publications', 'prune', '--keep', keep.value.trim()], { ghost: true }), keep),
        live(action('Poista vanhat', () => ['publications', 'prune', '--keep', keep.value.trim(), '--confirm']), keep))),
    el('div', { class: 'card' }, el('h3', {}, 'Tarkistukset'),
      el('div', { class: 'actions' }, action('Tarkista ympäristö', ['doctor'], { ghost: true }), action('Tarkista konfiguraatio', ['config', 'validate'], { ghost: true }))));
}

// --- Roskakori --------------------------------------------------------------

async function loadTrash() {
  let entries = [];
  try { entries = (await api('/trash')).entries; } catch (error) { setStatus(error.message, false); return; }
  const kinds = { project: 'projekti', channel: 'kanava', interface: 'integraatio', guidance: 'ohjaus' };
  $('#roskakori-sisalto').replaceChildren(
    entries.length ? el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Kohde', 'Laji', 'Poistettu', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, entries.map((item) => el('tr', {},
        el('td', {}, el('code', {}, item.id)), el('td', {}, kinds[item.kind] || item.kind), el('td', {}, when(item.removed_at)),
        el('td', {}, action('Palauta', ['trash', 'restore', item.entry], { after: () => loadTrash() }))))))) : el('p', { class: 'hint' }, 'Roskakori on tyhjä.'),
    entries.length ? deleteAction('Tyhjennä roskakori pysyvästi', ['trash', 'empty'], 'tyhjennä') : null);
}

// --- Ohjeet -----------------------------------------------------------------

async function loadGuides(name) {
  try {
    const data = await api(`/guide?${new URLSearchParams({ name: name || '' })}`);
    $('#ohjelista').replaceChildren(el('li', { onclick: () => loadGuides(), class: name ? '' : 'selected' }, 'Prosessi'),
      ...data.guides.map((guide) => el('li', { class: guide === data.name ? 'selected' : '', onclick: () => loadGuides(guide) }, guide)));
    if (data.content) $('#ohje').replaceChildren(markdown(data.content));
    else showProcessGuide();
  } catch (error) { setStatus(error.message, false); }
}

function showProcessGuide() {
  const phases = [
    ['Työtila', 'MCP-työtila luodaan (init) ja emoprojekti ehdotetaan ensimmäiseksi projektiksi.', 'Prosessi / aloitus', 'init'],
    ['Projektit', 'Emoprojekti ja ulkopuoliset projektit lisätään (repository, separate tai managed).', 'Projektit', 'add-project, project set, remove-project'],
    ['Käyttöönotto', 'Agentti kartoittaa projektin: moduulit, pino ja hakukomennot.', 'Agenttiajot', 'agent run --workflow vnetcon-init'],
    ['Dokumentointi', 'Agentti dokumentoi moduulit ja end-to-end-kulut.', 'Agenttiajot', 'agent run --workflow dokumentoi'],
    ['Commit', 'Ihminen tarkistaa muutokset ja commitoi. MCP julkaisee vain commitoidun.', 'Projektit → Muutokset ja commit', 'docs diff, docs commit'],
    ['Päivitys', 'Uusin commit haetaan MCP-työtilaan.', 'Prosessi / Projektit', 'bootstrap'],
    ['Julkaisu', 'Kanavan sisältö viedään AI-clienteille.', 'Kanavat ja julkaisu', 'publish, smoke-test'],
    ['Yhteys', 'MCP-osoite lisätään clienttiin; ChatGPT tunnelin kautta.', 'Yhteys', 'tunnel prepare openai'],
    ['Ylläpito', 'Synkronointi koodimuutoksiin, katselmoinnin korjaukset ja integraatiot.', 'Agenttiajot, Yhteinen ohjaus, Integraatiot', 'agent run --workflow synkronoi | katselmoi'],
  ];
  $('#ohje').replaceChildren(el('h2', {}, 'Prosessi'),
    el('p', {}, 'Jokainen vaihe tehdään käyttöliittymässä tai komentorivillä (vnetcon-ai mcp <komento> vnetcon-docs-hakemistossa). Prosessi-välilehti näyttää, missä kukin projekti on.'),
    el('div', { class: 'flow' }, phases.map(([name], index) => el('div', { class: 'flow-step' }, el('span', {}, `${index + 1}`), name))),
    el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ...['Vaihe', 'Mitä tapahtuu', 'Käyttöliittymässä', 'Komentorivillä'].map((h) => el('th', {}, h)))),
      el('tbody', {}, phases.map(([name, text, ui, cli]) => el('tr', {}, el('td', {}, el('strong', {}, name)), el('td', {}, text), el('td', {}, ui), el('td', {}, el('code', {}, cli))))))));
}

$('#komentoviite-linkki').addEventListener('click', async () => {
  if (!S.commands.length) S.commands = (await api('/commands')).commands;
  const groups = [...new Set(S.commands.map((command) => command.group))];
  $('#ohje').replaceChildren(el('h2', {}, 'Komennot'),
    el('p', {}, 'Komennot ajetaan vnetcon-docs-hakemistossa muodossa vnetcon-ai mcp <komento> (PowerShell: tyokalut\\vnetcon-ai\\vnetcon-ai.cmd mcp <komento>). Merkintä [UI]: tehtävissä myös käyttöliittymässä.'),
    ...groups.flatMap((group) => [el('h3', {}, group), el('ul', { class: 'plain' }, S.commands.filter((command) => command.group === group).map((command) => el('li', {},
      el('code', {}, command.usage), command.ui ? ' [UI]' : '', el('div', { class: 'hint' }, command.description))))]));
});

// Turvallinen Markdown: otsikot, listat, taulukot, koodilohkot, rivinsisäinen koodi ja lihavointi.
function inline(textValue) {
  return textValue.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)
    .map((part) => (part.startsWith('`') ? el('code', {}, part.slice(1, -1)) : part.startsWith('**') ? el('strong', {}, part.slice(2, -2)) : part.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')));
}

function markdown(source) {
  const root = el('div', { class: 'md' });
  const lines = source.replace(/\r/g, '').split('\n');
  let list = null;
  let paragraph = [];
  const flushParagraph = () => { if (paragraph.length) { root.append(el('p', {}, inline(paragraph.join(' ')))); paragraph = []; } };
  const flush = () => { flushParagraph(); list = null; };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      for (index += 1; index < lines.length && !/^\s*```/.test(lines[index]); index += 1) code.push(lines[index]);
      root.append(el('pre', { class: 'mono' }, code.join('\n')));
    } else if (/^#{1,6}\s/.test(line)) {
      flush();
      root.append(el(`h${Math.min(line.match(/^#+/)[0].length + 1, 6)}`, {}, inline(line.replace(/^#+\s*/, ''))));
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushParagraph();
      if (!list) { list = el('ul'); root.append(list); }
      list.append(el('li', {}, inline(line.replace(/^\s*([-*]|\d+\.)\s+/, ''))));
    } else if (/^\s*\|/.test(line)) {
      flush();
      const rows = [];
      for (; index < lines.length && /^\s*\|/.test(lines[index]); index += 1) rows.push(lines[index]);
      index -= 1;
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const body = rows.filter((row) => !/^\s*\|?\s*:?-{2,}/.test(row));
      root.append(el('div', { class: 'table-wrap' }, el('table', {}, body.map((row, rowIndex) => el('tr', {}, cells(row).map((cell) => el(rowIndex === 0 ? 'th' : 'td', {}, inline(cell))))))));
    } else if (/^\s*>/.test(line)) {
      flush();
      root.append(el('blockquote', {}, inline(line.replace(/^\s*>\s?/, ''))));
    } else if (!line.trim()) {
      flush();
    } else {
      list = null;
      paragraph.push(line.trim());
    }
  }
  flush();
  return root;
}

// --- Käynnistys ja päivitys ---------------------------------------------------

async function refresh() {
  [S.overview, S.process] = await Promise.all([api('/overview'), api('/process')]);
  renderProcess();
  renderProjects();
  renderChannels();
  fillSelects();
  renderConnection();
  renderJobForm();
  const active = $('#tabs button.active')?.dataset.tab;
  if (active === 'asetukset') renderSettings();
}

async function start() {
  await completeOidc().catch((error) => setStatus(error.message, false));
  try {
    S.session = await api('/session');
  } catch {
    return;
  }
  if (S.session.setup) { showSetup(S.session.setup); return; }
  $('#who').textContent = `${S.session.principal.id} · ${S.session.principal.admin ? 'admin' : 'vain luku'} · tunnistus ${S.session.auth_mode}`;
  document.body.classList.toggle('readonly', !S.session.principal.admin);
  $('#kirjaudu').hidden = true;
  $('#tabs').hidden = false;
  await refresh().catch((error) => setStatus(error.message, false));
  openTab($('#tabs button.active')?.dataset.tab || 'prosessi');
}

start();
