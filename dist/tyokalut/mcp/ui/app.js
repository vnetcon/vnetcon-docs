// vnetcon-docs MCP — hallintakäyttöliittymä. Ei riippuvuuksia. Kaikki palvelimelta
// tuleva teksti asetetaan textContentina, ei HTML:nä.
'use strict';

const AUTH_KEY = 'vnetcon-mcp-auth';
let overview = null;
let session = null;
let guidance = [];
let interfaces = { interfaces: [], template: '' };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

// form.id ja form.name osoittavat lomakkeen omiin ominaisuuksiin, eivät kenttiin.
const field = (form, name) => form.elements.namedItem(name);

const short = (sha) => (sha ? sha.slice(0, 12) : '—');
const when = (iso) => (iso ? new Date(iso).toLocaleString('fi-FI') : '—');

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
    showLogin(data.auth_mode);
    throw new Error(data.error || 'Kirjautuminen vaaditaan.');
  }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function log(text, ok = true) {
  $('#loki').textContent = text || '—';
  const status = $('#tila');
  status.textContent = ok ? 'Onnistui' : 'Epäonnistui';
  status.className = ok ? 'ok' : 'err';
}

async function action(button, run) {
  const buttons = $$('button');
  buttons.forEach((item) => { item.disabled = true; });
  $('#tila').textContent = 'Käynnissä…';
  $('#tila').className = '';
  try {
    const result = await run();
    log(result?.output || 'Valmis.', result?.ok !== false);
    await refresh();
  } catch (error) {
    log(error.message, false);
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
  }
}

// --- Kirjautuminen ----------------------------------------------------------

function showLogin(mode) {
  $('#kirjaudu').hidden = false;
  $$('.tab').forEach((tab) => { tab.hidden = true; });
  const texts = {
    bearer: 'Palvelin vaatii bearer-tokenin (auth token create).',
    basic: 'Kirjaudu käyttäjätunnuksella (auth user add).',
    oidc: 'Palvelin käyttää OIDC-tunnistusta. Selainkirjautuminen tunnistuspalveluun ei ole vielä käytössä: liitä voimassa oleva access token.',
  };
  $('#kirjaudu-ohje').textContent = texts[mode] || 'Kirjautuminen vaaditaan.';
  $$('#kirjaudu-lomake [data-mode]').forEach((label) => { label.hidden = !label.dataset.mode.split(' ').includes(mode); });
  $('#kirjaudu-lomake').dataset.mode = mode || 'bearer';
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

// --- Välilehdet -------------------------------------------------------------

$('#tabs').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tab]');
  if (!button) return;
  $$('#tabs button').forEach((item) => item.classList.toggle('active', item === button));
  $$('.tab').forEach((tab) => { tab.hidden = tab.id !== button.dataset.tab; });
  if (button.dataset.tab === 'ohjaus') loadGuidance();
  if (button.dataset.tab === 'integraatiot') loadInterfaces();
});

// --- Yleiskatsaus -----------------------------------------------------------

const ACTION_CHIPS = {
  'no-change': ['ok', 'ajan tasalla'],
  refresh: ['warn', 'muuttunut'],
  bootstrap: ['info', 'ei alustettu'],
  error: ['err', 'virhe'],
};
const STATUS_TEXT = {
  validated: 'tarkistettu',
  needs_documentation: 'odottaa dokumentointia',
  review_required: 'odottaa hyväksyntää',
  approved: 'hyväksytty',
};
const MODE_TEXT = { repository: 'projektin repossa', separate: 'oma repo', managed: 'MCP-työtilassa' };

function renderProjects() {
  const target = $('#projektilista');
  target.replaceChildren();
  if (!overview.projects.length) {
    target.append(el('p', { class: 'hint' }, 'Projekteja ei ole vielä lisätty. Lisää ensimmäinen välilehdellä Projektit ja kanavat.'));
    return;
  }
  const rows = overview.projects.flatMap((project) => project.refs.map((ref) => {
    const [chipClass, chipText] = ACTION_CHIPS[ref.action] || ['', ref.action];
    const mode = project.documentation.mode;
    const actions = el('div', { class: 'actions' },
      el('button', { class: 'small admin', onclick: (e) => action(e.target, () => api('/bootstrap', { method: 'POST', body: { project_id: project.project_id, ref: ref.ref } })) }, 'Päivitä'));
    if (mode === 'managed' && ref.status && ref.status !== 'needs_documentation' && !ref.approved) {
      actions.append(el('button', { class: 'small ghost admin', onclick: (e) => action(e.target, () => api('/approve', { method: 'POST', body: { project_id: project.project_id, ref: ref.ref } })) }, 'Hyväksy'));
    }
    const notes = [];
    if (ref.error) notes.push(el('small', { class: 'hint' }, ref.error));
    if (mode === 'managed' && ref.status === 'needs_documentation') {
      notes.push(el('small', { class: 'hint' }, `Dokumentoi agentilla: vnetcon-ai mcp document --project ${project.project_id} --ref ${ref.ref}`));
    }
    return el('tr', {},
      el('td', {}, el('strong', {}, project.display_name), el('br'), el('code', {}, project.project_id)),
      el('td', {}, MODE_TEXT[mode] || mode, mode === 'separate' && ref.docs_ref ? el('br') : null, mode === 'separate' && ref.docs_ref ? el('small', {}, `dokumentaatio: ${ref.docs_ref}`) : null),
      el('td', {}, el('code', {}, ref.ref)),
      el('td', {}, el('span', { class: `chip ${chipClass}` }, chipText), ' ', STATUS_TEXT[ref.status] || ref.status || '', ...notes),
      el('td', {}, el('code', {}, short(ref.source_commit_sha)), ref.docs_commit_sha ? el('br') : null, ref.docs_commit_sha ? el('code', {}, `docs ${short(ref.docs_commit_sha)}`) : null),
      el('td', {}, when(ref.updated_at)),
      el('td', {}, actions));
  }));
  target.append(el('div', { class: 'table-wrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ...['Projekti', 'Dokumentaatio', 'Haara', 'Tila', 'Commit', 'Päivitetty', ''].map((h) => el('th', {}, h)))),
    el('tbody', {}, rows))));
}

function renderChannels() {
  const target = $('#kanavalista');
  target.replaceChildren();
  if (!overview.channels.length) {
    target.append(el('p', { class: 'hint' }, 'Kanavia ei ole. Luo kanava välilehdellä Projektit ja kanavat.'));
    return;
  }
  const rows = overview.channels.map((channel) => {
    const refs = Object.entries(channel.project_refs);
    const published = channel.published;
    return el('tr', {},
      el('td', {}, el('code', {}, channel.channel_id), channel.channel_id === overview.default_channel ? el('small', {}, ' (oletus)') : null),
      el('td', {}, refs.length ? refs.map(([project, ref]) => el('div', {}, `${project} @ ${ref}`)) : el('span', { class: 'hint' }, 'ei projekteja')),
      el('td', {}, published
        ? [el('span', { class: 'chip ok' }, 'julkaistu'), ' ', when(published.created_at), el('br'), el('code', {}, short(published.bundle_id))]
        : el('span', { class: 'chip warn' }, 'ei julkaistu')),
      el('td', {}, el('button', { class: 'small admin', disabled: !refs.length, onclick: (e) => action(e.target, () => api('/publish', { method: 'POST', body: { channel: channel.channel_id } })) }, 'Julkaise')));
  });
  target.append(el('div', { class: 'table-wrap' }, el('table', {},
    el('thead', {}, el('tr', {}, ...['Kanava', 'Projektit', 'Julkaisu', ''].map((h) => el('th', {}, h)))),
    el('tbody', {}, rows))));
}

function fillSelects() {
  for (const select of $$('select[name="channel"]')) {
    const current = select.value;
    select.replaceChildren(...overview.channels.map((channel) => el('option', { value: channel.channel_id }, channel.channel_id)));
    select.value = current || overview.default_channel;
  }
  for (const select of $$('select[name="project_id"]')) {
    const current = select.value;
    select.replaceChildren(...overview.projects.map((project) => el('option', { value: project.project_id }, `${project.display_name} (${project.project_id})`)));
    if (current) select.value = current;
  }
}

function renderConnection() {
  const c = overview.connection;
  const rows = [
    ['MCP-osoite', c.mcp_url],
    ['Hallintakäyttöliittymä', c.ui_url],
    ['Tunnistus', c.auth_mode],
    ['Työtila', session.workspace],
    ['Oletuskanava', overview.default_channel],
  ];
  $('#yhteystiedot').replaceChildren(...rows.flatMap(([key, value]) => [el('dt', {}, key), el('dd', {}, el('code', {}, value || '—'))]));
  $('#clientit').replaceChildren(...Object.entries(c.clients).map(([name, snippet]) => el('div', {},
    el('div', { class: 'toolbar' }, el('strong', {}, name), el('button', { class: 'small ghost', onclick: () => copy(snippet) }, 'Kopioi')),
    el('pre', { class: 'mono' }, snippet))));
  $('#tunneli-bash').textContent = c.tunnel.bash.join('\n');
  $('#tunneli-powershell').textContent = c.tunnel.powershell.join('\n');
}

async function copy(textValue) {
  try {
    await navigator.clipboard.writeText(textValue);
    log('Kopioitu leikepöydälle.');
  } catch {
    log('Leikepöytä ei ole käytettävissä tässä selaimessa; kopioi teksti käsin.', false);
  }
}

async function refresh() {
  overview = await api('/overview');
  renderProjects();
  renderChannels();
  fillSelects();
  renderConnection();
}

$('#lataa-uudelleen').addEventListener('click', () => refresh().catch((error) => log(error.message, false)));
$('#paivita-kaikki').addEventListener('click', (event) => action(event.target, () => api('/bootstrap', { method: 'POST', body: {} })));

// --- Projektit ja kanavat ---------------------------------------------------

field($('#projekti-lomake'), 'docs_mode').addEventListener('change', (event) => {
  $$('.separate-only').forEach((label) => { label.hidden = event.target.value !== 'separate'; });
});

$('#projekti-lomake').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const location = field(form, 'location').value.trim();
  const remote = /^[a-z][a-z0-9+.-]*:\/\//i.test(location) || /^[^/\\]+@[^:]+:/.test(location);
  const body = {
    id: field(form, 'id').value.trim(),
    name: field(form, 'name').value.trim() || undefined,
    refs: field(form, 'refs').value.trim(),
    docs_mode: field(form, 'docs_mode').value,
    docs_repo: field(form, 'docs_repo').value.trim() || undefined,
    docs_ref: field(form, 'docs_ref').value.trim() || undefined,
    ...(remote ? { url: location } : { path: location }),
  };
  action(form.querySelector('button'), () => api('/projects', { method: 'POST', body }));
});

$('#kanava-lomake').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form.querySelector('button'), () => api('/channels', { method: 'POST', body: { id: field(form, 'id').value.trim() } }));
});

$('#kanava-ref-lomake').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  action(form.querySelector('button'), () => api(`/channels/${encodeURIComponent(field(form, 'channel').value)}/refs`, {
    method: 'POST', body: { project_id: field(form, 'project_id').value, ref: field(form, 'ref').value.trim() },
  }));
});

// --- Yhteinen ohjaus --------------------------------------------------------

async function loadGuidance(selected) {
  try {
    guidance = (await api('/guidance')).documents;
  } catch (error) {
    log(error.message, false);
    return;
  }
  const list = $('#ohjaus-tiedostot');
  list.replaceChildren(...guidance.map((doc) => el('li', {
    class: doc.path === selected ? 'selected' : '',
    onclick: () => openGuidance(doc.path),
  }, doc.path)));
  if (!guidance.length) list.append(el('li', {}, el('small', {}, 'Ei tiedostoja. Kirjoita nimi ja sisältö ja tallenna.')));
  openGuidance(selected || guidance[0]?.path);
}

function openGuidance(name) {
  const doc = guidance.find((item) => item.path === name);
  $('#ohjaus-nimi').value = doc?.path || 'ohjaus.md';
  $('#ohjaus-sisalto').value = doc?.content || '';
  $$('#ohjaus-tiedostot li').forEach((item) => item.classList.toggle('selected', item.textContent === name));
}

$('#ohjaus-tallenna').addEventListener('click', (event) => {
  const name = $('#ohjaus-nimi').value.trim();
  action(event.target, async () => {
    const result = await api(`/guidance/${encodeURIComponent(name)}`, { method: 'PUT', body: { content: $('#ohjaus-sisalto').value } });
    await loadGuidance(name);
    return result;
  });
});

// --- Integraatiot -----------------------------------------------------------

const STATUS_CHIPS = { active: 'ok', draft: 'warn', deprecated: 'err' };

async function loadInterfaces(selected) {
  try {
    interfaces = await api('/interfaces');
  } catch (error) {
    log(error.message, false);
    return;
  }
  const list = $('#integraatio-lista');
  list.replaceChildren(...interfaces.interfaces.map((item) => el('li', {
    class: item.interface_id === selected ? 'selected' : '',
    onclick: () => openInterface(item.interface_id),
  }, el('span', { class: `chip ${STATUS_CHIPS[item.status] || ''}` }, item.status || '—'), ' ', item.display_name || item.interface_id,
  el('small', {}, item.interface_id))));
  if (!interfaces.interfaces.length) list.append(el('li', {}, el('small', {}, 'Ei integraatiotietueita.')));
  if (selected) openInterface(selected);
}

function openInterface(id) {
  const item = interfaces.interfaces.find((candidate) => candidate.interface_id === id);
  $('#integraatio-id').value = id;
  $('#integraatio-yaml').value = item?._yaml || '';
  $$('#integraatio-lista li').forEach((li) => li.classList.toggle('selected', li.querySelector('small')?.textContent === id));
}

$('#integraatio-uusi').addEventListener('submit', (event) => {
  event.preventDefault();
  const id = field(event.currentTarget, 'id').value.trim();
  if (!id) return;
  $('#integraatio-id').value = id;
  $('#integraatio-yaml').value = (interfaces.template || 'schema_version: 1\ninterface_id: <lyhyt-tunniste-v1>\nstatus: draft\n')
    .replace('<lyhyt-tunniste-v1>', id);
});

$('#integraatio-tallenna').addEventListener('click', (event) => {
  const id = $('#integraatio-id').value.trim();
  action(event.target, async () => {
    const result = await api(`/interfaces/${encodeURIComponent(id)}`, { method: 'PUT', body: { yaml: $('#integraatio-yaml').value } });
    await loadInterfaces(id);
    return result;
  });
});

// --- Haku -------------------------------------------------------------------

$('#haku-lomake').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const params = new URLSearchParams({ channel: field(form, 'channel').value, project_id: field(form, 'project_id').value, q: field(form, 'q').value });
  $('#dokumentti').hidden = true;
  try {
    const { results } = await api(`/search?${params}`);
    const list = $('#hakutulokset');
    list.replaceChildren(...results.map((hit) => el('li', {
      onclick: () => openDocument(field(form, 'channel').value, field(form, 'project_id').value, hit.document_id),
    }, el('strong', {}, hit.heading || hit.path), el('small', {}, `${hit.path} · ${hit.ref} · ${short(hit.source_commit_sha)}`), el('small', {}, hit.excerpt))));
    if (!results.length) list.append(el('li', {}, el('small', {}, 'Ei osumia.')));
  } catch (error) {
    log(error.message, false);
  }
});

async function openDocument(channel, projectId, documentId) {
  try {
    const params = new URLSearchParams({ channel, project_id: projectId, document_id: documentId });
    const doc = await api(`/document?${params}`);
    const article = $('#dokumentti');
    article.replaceChildren(el('div', { class: 'toolbar' }, el('strong', {}, doc.path), el('code', {}, `${doc.ref} · ${short(doc.source_commit_sha)}`)), el('hr'), doc.content);
    article.hidden = false;
  } catch (error) {
    log(error.message, false);
  }
}

// --- Käynnistys -------------------------------------------------------------

async function start() {
  try {
    session = await api('/session');
  } catch {
    return;
  }
  $('#who').textContent = `${session.principal.id} · ${session.principal.admin ? 'admin' : 'vain luku'} · tunnistus ${session.auth_mode}`;
  document.body.classList.toggle('readonly', !session.principal.admin);
  $('#kirjaudu').hidden = true;
  const active = $('#tabs button.active')?.dataset.tab || 'yleiskatsaus';
  $$('.tab').forEach((tab) => { tab.hidden = tab.id !== active; });
  await refresh().catch((error) => log(error.message, false));
}

start();
