#!/usr/bin/env node
// Generoi vnetcon-docs-dokumentaation .md-tiedostoista staattisen HTML-version.
//
// Lähde (totuus): vnetcon-docs/*.md. Tuotos: vnetcon-docs/html/ (johdettu, ei muokata käsin).
// - .md-linkit muunnetaan .html-linkeiksi (suhteellinen rakenne säilyy)
// - frontmatter näytetään metatietopalkkina (ei raakadumppia)
// - Mermaid-lohkot renderöityvät selaimessa (vendoroitu mermaid.min.js)
// - vasemman reunan navigaatio muodostetaan hakemistopuusta + tila/rakenne.yaml:sta
// - client-side-haku (MiniSearch, indeksi upotetaan JS:nä → toimii file://)
//
// Projektikohtaiset asetukset: ../../vnetcon.config.yaml (html + dokumentaatio).
//
// Aja:  npm install  &&  node generoi.mjs
// Ks.   ../../metodi/generointi-tyonkulku.md

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JUURI = path.resolve(__dirname, '..', '..'); // vnetcon-docs/

// --- Komentoriviargumentit ------------------------------------------------

const argv = process.argv.slice(2);
const arg = (nimi) => {
  const i = argv.indexOf(nimi);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const HILJAA = argv.includes('--hiljaa');
const OUT = path.resolve(JUURI, arg('--ulos') || 'html');
const ASSETS = path.join(OUT, 'assets');
const kerro = (...a) => { if (!HILJAA) console.log(...a); };
const varoita = (...a) => console.warn(...a);

// --- Konfiguraatio --------------------------------------------------------

function lueYaml(p, oletus = null) {
  try { return fs.existsSync(p) ? (yaml.load(fs.readFileSync(p, 'utf8')) || oletus) : oletus; }
  catch (e) { varoita(`VAROITUS: ${path.basename(p)} lukuvirhe: ${e.message}`); return oletus; }
}

const KONF = lueYaml(path.join(JUURI, 'vnetcon.config.yaml'), {}) || {};
const DOK = KONF.dokumentaatio || {};
const HTMLK = KONF.html || {};
const RAKENNE = lueYaml(path.join(JUURI, 'tila', 'rakenne.yaml'), null);

if (!fs.existsSync(path.join(JUURI, 'vnetcon.config.yaml'))) {
  varoita('VAROITUS: vnetcon.config.yaml puuttuu — käytetään oletusasetuksia. Aja /vnetcon-init.');
}

const SIVUSTON_OTSIKKO = DOK.otsikko
  || (KONF.projekti && KONF.projekti.nimi ? `${KONF.projekti.nimi} — dokumentaatio` : 'Dokumentaatio');

const MODUULIT_LABEL = DOK.moduulit_label || 'Moduulit';

// Renderöitävät dokumenttihakemistot (vain nämä; tila/ ym. jätetään pois).
const OLETUS_RYHMAT = ['liiketoimintaprosessit', 'jarjestelmaprosessit', 'moduulit', 'datamallit', 'metodi', 'tiketit'];
const SRC_DIRS = Array.isArray(HTMLK.ryhmat) && HTMLK.ryhmat.length ? HTMLK.ryhmat : OLETUS_RYHMAT;

const OLETUS_OTSIKOT = {
  liiketoimintaprosessit: 'Liiketoimintaprosessit',
  jarjestelmaprosessit: 'Järjestelmäprosessit (end-to-end)',
  datamallit: 'Datamallit',
  moduulit: MODUULIT_LABEL,
  metodi: 'Menettely',
  tiketit: 'Tiketit',
};
const GROUP_LABELS = { ...OLETUS_OTSIKOT, ...(HTMLK.otsikot || {}) };

const READER_TIER = Array.isArray(HTMLK.lukijan_taso) && HTMLK.lukijan_taso.length
  ? HTMLK.lukijan_taso
  : ['liiketoimintaprosessit', 'jarjestelmaprosessit', 'moduulit', 'datamallit'];
const MACHINERY_TIER = Array.isArray(HTMLK.koneiston_taso) && HTMLK.koneiston_taso.length
  ? HTMLK.koneiston_taso
  : ['metodi', 'tiketit'];
const TIER_LABELS = { reader: 'Dokumentaatio', machinery: 'Dokumentaation tuottaminen' };

// Moduulin sisäiset kategoriat: yleiskuvaus ensin, sitten nämä tässä järjestyksessä.
const KATEGORIA_LABELS = { prosessit: 'Prosessit', datavirrat: 'Datavirrat', datarakenteet: 'Datarakenteet' };
const KATEGORIA_JARJESTYS = ['prosessit', 'datavirrat', 'datarakenteet'];

const SANASTO_REL = 'metodi/sanasto.html'; // nostetaan menettelystä lukijan viitteisiin

// --- Apurit ---------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Karkea puhdistus hakuindeksiä varten: pois koodilohkot, markdown-merkit, HTML.
function plainText(mdText) {
  return String(mdText)
    .replace(/```[\s\S]*?```/g, ' ')            // koodilohkot (ml. mermaid)
    .replace(/`[^`]*`/g, ' ')                   // inline-koodi
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')  // linkit/kuvat -> pelkkä teksti
    .replace(/<!--[\s\S]*?-->/g, ' ')           // html-kommentit
    .replace(/<[^>]+>/g, ' ')                   // html-tagit
    .replace(/[*_>#|]+/g, ' ')                  // markdown-merkit
    .replace(/\s+/g, ' ')
    .trim();
}

// Vaihe-tunnisteet vakioina: "Vaihe 3 — ..." -> #vaihe-3 (ks. konventiot §5).
function slugify(s) {
  const m = String(s).trim().match(/^Vaihe\s+([^\s—-]+)/i);
  if (m) return 'vaihe-' + m[1].toLowerCase();
  return String(s).toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const toPosix = (p) => p.split(path.sep).join('/');

// --- Markdown-moottori ----------------------------------------------------

const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
  .use(anchor, { slugify, tabIndex: false });

// .md-linkit -> .html (paitsi ulkoiset / ankkurit / mailto).
const defLink = md.renderer.rules.link_open
  || ((t, i, o, e, self) => self.renderToken(t, i, o));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const href = tokens[idx].attrGet('href');
  if (href && !/^(https?:|mailto:|#|\/\/)/.test(href)) {
    tokens[idx].attrSet('href', href.replace(/\.md(#[^)]*)?$/i, (m, frag) => '.html' + (frag || '')));
  }
  return defLink(tokens, idx, opts, env, self);
};

// Mermaid-kaavioiden nimiö-/viestiteksteissä on merkkejä, jotka rikkovat
// jäsennyksen tai renderöinnin:
//  - Puolipiste ';' on mermaidin lauseen erotin -> katkaisee nimiön kesken
//    ("Parse error"). Muunnetaan mermaidin entiteetiksi #59; (näkyy ';').
//  - Tagimaiset kulmasulut (<script src=...>, <oid>, <App/>) tulkitaan
//    HTML-tageiksi (loose-tila) -> teksti katoaa/rikkoutuu. Korvataan näkyvillä
//    guillemet-merkeillä (U+2039/U+203A), jotka renderöityvät kulmasulkuina.
// Säilytetään <br>-rivinvaihdot ja nuolioperaattorit (->>, -->, ==>, <-->, <|--).
function mermaidSafe(s) {
  const LT = String.fromCharCode(0x2039), GT = String.fromCharCode(0x203A); // ‹ ›
  const brs = [];
  s = String(s).replace(/<br\s*\/?>/gi, (m) => { brs.push(m); return `\u0000BR${brs.length - 1}\u0000`; });
  s = s.replace(/<(?=[A-Za-z/])/g, LT);              // tagimainen < (nuolet <-- / <|-- säilyvät)
  s = s.replace(/(?<=[A-Za-z0-9 ."'\)\]?])>/g, GT); // literaali > (ei nuolia -->> / ==> / -.->)
  s = s.replace(/;/g, '#59;');                       // mermaidin lauseerotin
  s = s.replace(/\u0000BR(\d+)\u0000/g, (_, i) => brs[+i]);
  return s;
}

// ```mermaid -> <pre class="mermaid"> (renderöidään selaimessa).
const defFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
  const t = tokens[idx];
  if ((t.info || '').trim().toLowerCase() === 'mermaid') {
    return `<pre class="mermaid">${esc(mermaidSafe(t.content))}</pre>\n`;
  }
  return defFence(tokens, idx, opts, env, self);
};

// --- Kerää sivut ----------------------------------------------------------

const pages = [];
for (const d of SRC_DIRS) {
  for (const abs of walk(path.join(JUURI, d))) {
    const raw = fs.readFileSync(abs, 'utf8');
    let data = {}, content = raw;
    try { ({ data, content } = matter(raw)); }
    catch (e) { varoita(`VAROITUS: frontmatter-virhe ${toPosix(path.relative(JUURI, abs))}: ${e.message}`); }
    const relMd = toPosix(path.relative(JUURI, abs));       // esim. moduulit/x/y.md
    const outRel = relMd.replace(/\.md$/, '.html');
    const h1 = content.match(/^#\s+(.+?)\s*$/m);
    const title = data.otsikko || (h1 && h1[1]) || path.basename(abs, '.md');
    pages.push({ abs, relMd, outRel, top: d, data, content, title });
  }
}

if (!pages.length) {
  varoita('Ei .md-dokumentteja löytynyt. Onko dokumentointi aloitettu? (/dokumentoi)');
}

// --- Navigaatio -----------------------------------------------------------
// Kaksi tasoa: lukijan dokumentaatio ensin, tuotantokoneisto toissijaisena.

function liList(items, prefix) {
  return '<ul>' + items
    .map((it) => `<li><a href="${prefix}${it.outRel}">${esc(it.title)}</a></li>`)
    .join('') + '</ul>';
}

// Moduulin sivut ryhmiin: top (yleiskuvaus ym.) + kategoriat (prosessit/...).
function moduuliOsat(items) {
  const top = [];
  const kategoriat = {};
  for (const it of items) {
    const parts = it.outRel.split('/'); // moduulit/<m>/[kategoria/]tiedosto.html
    if (parts.length <= 3) top.push(it);
    else (kategoriat[parts[2]] ||= []).push(it);
  }
  top.sort((a, b) => {
    const ay = /\/yleiskuvaus\.html$/.test(a.outRel) ? 0 : 1;
    const by = /\/yleiskuvaus\.html$/.test(b.outRel) ? 0 : 1;
    return ay - by || a.title.localeCompare(b.title);
  });
  return { top, kategoriat };
}

function renderModuuli(m, mItems, prefix, activeUrl) {
  const { top, kategoriat } = moduuliOsat(mItems);
  const auki = activeUrl && activeUrl.startsWith('moduulit/' + m + '/');
  let out = `<details class="navi-moduuli"${auki ? ' open' : ''}><summary>${esc(m)}</summary>`;
  if (top.length) out += liList(top, prefix);
  const jarj = [...KATEGORIA_JARJESTYS,
    ...Object.keys(kategoriat).filter((k) => !KATEGORIA_JARJESTYS.includes(k)).sort()];
  for (const kat of jarj) {
    const kItems = kategoriat[kat];
    if (!kItems) continue;
    kItems.sort((a, b) => a.title.localeCompare(b.title));
    out += `<div class="navi-kategoria"><h4>${esc(KATEGORIA_LABELS[kat] || kat)}</h4>${liList(kItems, prefix)}</div>`;
  }
  return out + '</details>';
}

// Ryhmittely osa-alueittain (tila/rakenne.yaml); ilman sitä litteä lista.
function renderModuulit(items, prefix, activeUrl) {
  const byModuuli = {};
  for (const it of items) (byModuuli[it.outRel.split('/')[1] || '(muu)'] ||= []).push(it);
  const alueet = RAKENNE && RAKENNE['osa-alueet'];
  const modAuki = (m) => activeUrl && activeUrl.startsWith('moduulit/' + m + '/');
  if (!Array.isArray(alueet) || !alueet.length) {
    return Object.keys(byModuuli).sort()
      .map((m) => renderModuuli(m, byModuuli[m], prefix, activeUrl)).join('');
  }
  let out = '';
  const kaytetyt = new Set();
  for (const alue of alueet) {
    const mods = (alue.moduulit || alue.palvelut || []).filter((s) => byModuuli[s]);
    if (!mods.length) continue;
    const auki = mods.some(modAuki);
    out += `<details class="navi-osa-alue"${auki ? ' open' : ''}><summary class="osa-alue-otsikko">${esc(alue.nimi || alue.tunnus)}</summary>`;
    for (const m of mods) { out += renderModuuli(m, byModuuli[m], prefix, activeUrl); kaytetyt.add(m); }
    out += '</details>';
  }
  const muut = Object.keys(byModuuli).filter((s) => !kaytetyt.has(s)).sort();
  if (muut.length) {
    const auki = muut.some(modAuki);
    out += `<details class="navi-osa-alue"${auki ? ' open' : ''}><summary class="osa-alue-otsikko">Muut</summary>`;
    for (const m of muut) out += renderModuuli(m, byModuuli[m], prefix, activeUrl);
    out += '</details>';
  }
  return out;
}

function renderMetodi(items, prefix) {
  const top = [];
  const alaryhmat = {};
  for (const it of items) {
    if (it.outRel === SANASTO_REL) continue; // näkyy lukijan viitteissä
    const parts = it.outRel.split('/');
    if (parts.length >= 3) (alaryhmat[parts[1]] ||= []).push(it);
    else top.push(it);
  }
  top.sort((a, b) => a.title.localeCompare(b.title));
  let out = top.length ? liList(top, prefix) : '';
  const LABELS = { mallipohjat: 'Mallipohjat', pinot: 'Pinoprofiilit' };
  for (const k of Object.keys(alaryhmat).sort()) {
    alaryhmat[k].sort((a, b) => a.title.localeCompare(b.title));
    out += `<div class="navi-kategoria"><h4>${esc(LABELS[k] || k)}</h4>${liList(alaryhmat[k], prefix)}</div>`;
  }
  return out;
}

// Tiketit: yksi <details> per tiketti (tunnus = hakemisto).
function renderTiketit(items, prefix, activeUrl) {
  const byTiketti = {};
  for (const it of items) {
    const parts = it.outRel.split('/');
    (byTiketti[parts.length >= 3 ? parts[1] : '(muu)'] ||= []).push(it);
  }
  return Object.keys(byTiketti).sort().reverse().map((t) => {
    const auki = activeUrl && activeUrl.startsWith('tiketit/' + t + '/');
    const its = byTiketti[t].sort((a, b) => a.outRel.localeCompare(b.outRel));
    if (t === '(muu)') return liList(its, prefix);
    return `<details class="navi-moduuli"${auki ? ' open' : ''}><summary>${esc(t)}</summary>${liList(its, prefix)}</details>`;
  }).join('');
}

function renderGroup(top, items, prefix, activeUrl) {
  if (top === 'moduulit') return renderModuulit(items, prefix, activeUrl);
  if (top === 'metodi') return renderMetodi(items, prefix);
  if (top === 'tiketit') return renderTiketit(items, prefix, activeUrl);
  return liList([...items].sort((a, b) => a.outRel.localeCompare(b.outRel)), prefix);
}

function buildNav() {
  const has = (top) => pages.some((p) => p.top === top);
  const sanasto = pages.find((p) => p.outRel === SANASTO_REL);

  const tier = (label, tops, prefix, activeUrl, extraClass, tail = '') => {
    const groups = tops.filter(has);
    if (!groups.length && !tail) return '';
    let out = `<div class="navi-taso${extraClass ? ' ' + extraClass : ''}"><div class="navi-taso-otsikko">${esc(label)}</div>`;
    for (const top of groups) {
      const items = pages.filter((p) => p.top === top);
      out += `<div class="navi-ryhma"><h2>${esc(GROUP_LABELS[top] || top)}</h2>${renderGroup(top, items, prefix, activeUrl)}</div>`;
    }
    return out + tail + '</div>';
  };

  return (prefix, activeUrl) => {
    let out = `<div class="navi-otsikko"><a href="${prefix}index.html">${esc(SIVUSTON_OTSIKKO)}</a></div>`;
    const viitteet = sanasto
      ? `<div class="navi-ryhma navi-viitteet"><h2>Viitteet</h2><ul><li><a href="${prefix}${sanasto.outRel}">${esc(sanasto.title)}</a></li></ul></div>`
      : '';
    out += tier(TIER_LABELS.reader, READER_TIER, prefix, activeUrl, '', viitteet);
    out += tier(TIER_LABELS.machinery, MACHINERY_TIER, prefix, activeUrl, 'navi-taso-toissijainen');
    return out;
  };
}
const navFor = buildNav();

// --- Metatietopalkki frontmatterista --------------------------------------

// YAML jäsentää lainausmerkittömän 2026-08-10:n Date-objektiksi — näytetään
// aina muodossa YYYY-MM-DD (ei aikavyöhykkeellistä täyspituista muotoa).
function pvmTeksti(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  return String(v);
}

function metaBox(data) {
  if (!data || Object.keys(data).length === 0) return '';
  const badges = [];
  if (data.tyyppi) badges.push(`<span class="merkki tyyppi">${esc(data.tyyppi)}</span>`);
  const mod = data.moduuli || data.palvelu;
  if (mod) badges.push(`<span class="merkki">${esc(mod)}</span>`);
  if (Array.isArray(data.moduulit)) badges.push(`<span class="merkki">${esc(data.moduulit.join(' · '))}</span>`);
  if (data.tunnus) badges.push(`<span class="merkki">${esc(data.tunnus)}</span>`);
  if (data.tila) badges.push(`<span class="merkki tila-${esc(String(data.tila))}">${esc(data.tila)}</span>`);
  if (data['metodi-versio']) badges.push(`<span class="merkki">metodi v${esc(data['metodi-versio'])}</span>`);
  if (data.pvm) badges.push(`<span class="merkki">${esc(pvmTeksti(data.pvm))}</span>`);
  if (data.paivitetty) badges.push(`<span class="merkki">päivitetty ${esc(pvmTeksti(data.paivitetty))}</span>`);
  if (data['git-viite']) badges.push(`<span class="merkki">git ${esc(data['git-viite'])}</span>`);

  let lahteet = '';
  if (Array.isArray(data.lahteet) && data.lahteet.length) {
    lahteet = '<details class="lahteet"><summary>Lähteet (koodi)</summary><ul>'
      + data.lahteet.map((l) => `<li><code>${esc(l)}</code></li>`).join('')
      + '</ul></details>';
  }
  if (!badges.length && !lahteet) return '';
  return `<div class="meta">${badges.join(' ')}${lahteet}</div>`;
}

// --- Sivupohja ------------------------------------------------------------

function page({ title, prefix, bodyHtml, metaHtml, activeUrl }) {
  const nav = navFor(prefix, activeUrl);
  return `<!doctype html>
<html lang="${esc(DOK.kieli || 'fi')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(SIVUSTON_OTSIKKO)}</title>
<link rel="stylesheet" href="${prefix}assets/tyyli.css">
</head>
<body>
<button class="navi-nappi" onclick="document.body.classList.toggle('navi-auki')">☰ Sisällys</button>
<nav class="sivupalkki"><div class="haku"><input id="haku-kentta" type="search" placeholder="Hae dokumentaatiosta…" autocomplete="off"><div id="haku-tulokset"></div></div><button id="laajenna-kaikki" class="laajenna-nappi" type="button">Laajenna kaikki</button>${nav}</nav>
<main class="sisalto">${metaHtml}${bodyHtml}</main>
<script>window.HAKU_PREFIX=${JSON.stringify(prefix)};</script>
<script src="${prefix}assets/minisearch.min.js"></script>
<script src="${prefix}assets/haku-indeksi.js"></script>
<script src="${prefix}assets/haku.js"></script>
<script src="${prefix}assets/mermaid.min.js"></script>
<script>window.mermaid&&mermaid.initialize({startOnLoad:true,securityLevel:'loose',theme:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'default'});</script>
</body>
</html>
`;
}

// --- Kirjoita tuotos ------------------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(ASSETS, { recursive: true });

for (const p of pages) {
  const outAbs = path.join(OUT, p.outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const depth = p.outRel.split('/').length - 1;
  const prefix = '../'.repeat(depth);
  fs.writeFileSync(outAbs, page({
    title: p.title,
    prefix,
    activeUrl: p.outRel,
    metaHtml: metaBox(p.data),
    bodyHtml: md.render(p.content),
  }));
}

// --- Etusivu --------------------------------------------------------------
// Orientoiva aloitussivu: johdanto + järjestelmäkartta + moduulikortit +
// prosessilistat + viitteet. Linkit juuresta (prefix = '').

function jarjestelmakartta() {
  const alueet = RAKENNE && RAKENNE['osa-alueet'];
  const sallittu = HTMLK.jarjestelmakartta !== false
    && !(RAKENNE && RAKENNE.etusivu && RAKENNE.etusivu.jarjestelmakartta === false);
  if (!Array.isArray(alueet) || !alueet.length || !sallittu) return '';
  const ids = {}; let n = 0;
  const nodeId = (s) => (ids[s] ||= 's' + (n++));
  let mm = 'flowchart LR\n';
  let g = 0;
  let solmuja = 0;
  for (const alue of alueet) {
    const mods = (alue.moduulit || alue.palvelut || []).filter(Boolean);
    if (!mods.length) continue;
    mm += `  subgraph g${g++} [${JSON.stringify(alue.nimi || alue.tunnus)}]\n`;
    for (const s of mods) { mm += `    ${nodeId(s)}[${JSON.stringify(s)}]\n`; solmuja++; }
    mm += '  end\n';
  }
  if (!solmuja) return '';
  for (const k of (RAKENNE.kytkennat || [])) {
    if (k && ids[k.from] && ids[k.to]) mm += `  ${nodeId(k.from)} --> ${nodeId(k.to)}\n`;
  }
  return `<h2>Järjestelmäkartta</h2><pre class="mermaid">${esc(mm)}</pre>`;
}

function johdanto() {
  const nimi = HTMLK.johdanto_tiedosto || DOK.johdanto_tiedosto || 'johdanto.md';
  const f = path.join(JUURI, nimi);
  if (!fs.existsSync(f)) return '';
  const body = matter(fs.readFileSync(f, 'utf8')).content.replace(/^#\s+.*\n?/, '').trim();
  return body ? md.render(body) : '';
}

function etusivuBody() {
  let out = `<h1>${esc(SIVUSTON_OTSIKKO)}</h1>` + johdanto();
  out += jarjestelmakartta();

  // Moduulikortit
  const moduulit = pages.filter((p) => p.top === 'moduulit');
  if (moduulit.length) {
    const byModuuli = {};
    for (const it of moduulit) (byModuuli[it.outRel.split('/')[1] || '(muu)'] ||= []).push(it);
    out += `<h2>${esc(MODUULIT_LABEL)}</h2><div class="kortit">`;
    for (const m of Object.keys(byModuuli).sort()) {
      const items = byModuuli[m];
      const yleis = items.find((it) => /\/yleiskuvaus\.html$/.test(it.outRel));
      const n = (kat) => items.filter((it) => {
        const parts = it.outRel.split('/');
        return parts.length >= 4 && parts[2] === kat;
      }).length;
      const meta = [
        [n('prosessit'), 'prosessi', 'prosessia'],
        [n('datavirrat'), 'datavirta', 'datavirtaa'],
        [n('datarakenteet'), 'datarakenne', 'datarakennetta'],
      ].filter(([c]) => c > 0).map(([c, s, p]) => `${c} ${c === 1 ? s : p}`).join(' · ');
      const href = (yleis || items[0]).outRel;
      out += `<a class="kortti" href="${href}"><h3>${esc(m)}</h3>${meta ? `<p>${esc(meta)}</p>` : ''}</a>`;
    }
    out += '</div>';
  }

  // Prosessikerrokset ja datamallit
  for (const top of ['liiketoimintaprosessit', 'jarjestelmaprosessit', 'datamallit']) {
    const items = pages.filter((p) => p.top === top);
    if (!items.length) continue;
    const nakyvat = top === 'datamallit'
      ? items.filter((it) => /(^|\/)indeksi\.html$/.test(it.outRel)) // iso joukko → vain indeksi
      : items;
    const lista = nakyvat.length ? nakyvat : items;
    out += `<h2>${esc(GROUP_LABELS[top] || top)}</h2>`
      + liList([...lista].sort((a, b) => a.title.localeCompare(b.title)), '');
    if (top === 'datamallit' && nakyvat.length && nakyvat.length < items.length) {
      out += `<p class="vinkki">${items.length} datamallia — ks. indeksi tai vasen palkki.</p>`;
    }
  }

  // Viitteet
  const sanasto = pages.find((p) => p.outRel === SANASTO_REL);
  if (sanasto) out += `<h2>Viitteet</h2><ul><li><a href="${sanasto.outRel}">${esc(sanasto.title)}</a></li></ul>`;

  // Dokumentaation tuottaminen (toissijainen)
  const tyonkulku = pages.find((p) => p.outRel === 'metodi/tyonkulku.html');
  out += '<h2>Dokumentaation tuottaminen</h2><p>Miten dokumentaatio syntyy ja pysyy ajan tasalla: '
    + (tyonkulku ? `<a href="${tyonkulku.outRel}">menettely ja työnkulut</a>` : 'menettely')
    + ', mallipohjat ja tiketit — ks. vasemman palkin osio <em>Dokumentaation tuottaminen</em>.</p>';

  return out;
}
fs.writeFileSync(path.join(OUT, 'index.html'), page({
  title: 'Etusivu', prefix: '', metaHtml: '', bodyHtml: etusivuBody(),
}));

// Tyylit.
fs.writeFileSync(path.join(ASSETS, 'tyyli.css'), CSS());

// Mermaid node_modulesista tuotokseen (offline).
const mermaidSrc = path.join(__dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
if (fs.existsSync(mermaidSrc)) {
  fs.copyFileSync(mermaidSrc, path.join(ASSETS, 'mermaid.min.js'));
} else {
  fs.writeFileSync(path.join(ASSETS, 'mermaid.min.js'),
    '/* mermaid.min.js puuttuu: aja `npm install` generaattorin hakemistossa ja generoi uudelleen. */');
  varoita('VAROITUS: mermaid.min.js ei löytynyt node_modulesista — aja `npm install` (kaaviot eivät piirry).');
}

// --- Haku (MiniSearch, vain HTML-export) ----------------------------------

function polkuTeksti(pg) {
  if (pg.top === 'moduulit') {
    const parts = pg.outRel.split('/');
    const kat = parts.length >= 4 ? (KATEGORIA_LABELS[parts[2]] || parts[2]) : '';
    return MODUULIT_LABEL + ' / ' + (parts[1] || '') + (kat ? ' / ' + kat : '');
  }
  return GROUP_LABELS[pg.top] || pg.top;
}

// Indeksi upotetaan JS-tiedostona (window.HAKU) → toimii file:// (ei fetchiä).
const hakuIndeksi = pages.map((p, i) => ({
  id: i, u: p.outRel, t: p.title, p: polkuTeksti(p), b: plainText(p.content),
}));
fs.writeFileSync(path.join(ASSETS, 'haku-indeksi.js'),
  'window.HAKU=' + JSON.stringify(hakuIndeksi) + ';');

// MiniSearch node_modulesista (UMD-globaali). Kokeillaan tunnetut dist-polut.
const msSrc = [
  'dist/umd/index.min.js', 'dist/umd/index.js', 'dist/MiniSearch.min.js',
].map((r) => path.join(__dirname, 'node_modules', 'minisearch', r)).find((f) => fs.existsSync(f));
if (msSrc) {
  fs.copyFileSync(msSrc, path.join(ASSETS, 'minisearch.min.js'));
} else {
  fs.writeFileSync(path.join(ASSETS, 'minisearch.min.js'),
    '/* minisearch puuttuu: aja `npm install`. Haku ei toimi ilman tätä. */');
  varoita('VAROITUS: minisearch ei löytynyt node_modulesista — aja `npm install` (haku pois käytöstä).');
}

fs.writeFileSync(path.join(ASSETS, 'haku.js'), HAKU_JS());

kerro(`Valmis: ${pages.length} sivua -> ${OUT}`);
kerro(`Avaa: ${path.join(OUT, 'index.html')}`);

// --- Hakulogiikka (client-side, kirjoitetaan assets/haku.js:ksi) -----------

function HAKU_JS() {
  return `(function(){
  // Laajenna / pienennä kaikki (toimii vaikka haku olisi pois käytöstä).
  var nappi = document.getElementById('laajenna-kaikki');
  if (nappi) {
    var palkki = document.querySelector('.sivupalkki');
    nappi.addEventListener('click', function(){
      var kaikki = palkki.querySelectorAll('details');
      var avaa = Array.prototype.some.call(kaikki, function(d){ return !d.open; });
      Array.prototype.forEach.call(kaikki, function(d){ d.open = avaa; });
      nappi.textContent = avaa ? 'Pienennä kaikki' : 'Laajenna kaikki';
    });
  }
  var MS = window.MiniSearch; if (MS && MS.default) MS = MS.default;
  var box = document.getElementById('haku-kentta');
  var res = document.getElementById('haku-tulokset');
  if (!box || !res) return;
  if (!window.HAKU || !MS) { box.placeholder = 'Haku ei käytössä'; box.disabled = true; return; }
  var mini = new MS({ fields:['t','p','b'], storeFields:['t','p','u'],
    searchOptions:{ boost:{t:4,p:2}, prefix:true, fuzzy:0.2, combineWith:'AND' } });
  mini.addAll(window.HAKU);
  var PREFIX = window.HAKU_PREFIX || '';
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function render(q){
    if(!q){ res.innerHTML=''; return; }
    var hits = mini.search(q).slice(0,40);
    if(!hits.length){ res.innerHTML='<div class="haku-ei">Ei osumia</div>'; return; }
    res.innerHTML = hits.map(function(h){
      return '<a class="haku-osuma" href="'+PREFIX+h.u+'"><span class="haku-t">'+esc(h.t)+'</span><span class="haku-p">'+esc(h.p||'')+'</span></a>';
    }).join('');
  }
  var t; box.addEventListener('input', function(){ clearTimeout(t); t=setTimeout(function(){ render(box.value.trim()); }, 120); });
  box.addEventListener('keydown', function(e){ if(e.key==='Escape'){ box.value=''; res.innerHTML=''; } });
})();`;
}

// --- Tyylit ---------------------------------------------------------------

function CSS() {
  return `:root{--rako:16px;--reuna:#e2e2e2;--muste:#1a1a1a;--linkki:#0b5cad;--palkki:#f6f7f9;--tausta:#fff;--vaimea:#8a8a8a;--koodi:#f0f0f3}
@media(prefers-color-scheme:dark){
  :root{--reuna:#333a44;--muste:#e6e6e6;--linkki:#78b9f0;--palkki:#181c21;--tausta:#11151a;--vaimea:#9aa4b0;--koodi:#1e242b}
}
*{box-sizing:border-box}
body{margin:0;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--muste);background:var(--tausta);display:flex}
.sivupalkki{width:300px;min-width:300px;height:100vh;overflow:auto;position:sticky;top:0;padding:var(--rako);background:var(--palkki);border-right:1px solid var(--reuna);font-size:14px}
.navi-otsikko{font-weight:700;font-size:16px;margin-bottom:12px}
.navi-otsikko a{color:var(--muste);text-decoration:none}
.navi-taso{margin-bottom:22px}
.navi-taso-otsikko{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--vaimea);padding-bottom:5px;margin:10px 0 6px;border-bottom:1px solid var(--reuna)}
.navi-taso-toissijainen{opacity:.9}
.navi-ryhma h2{font-size:13px;font-weight:700;color:var(--muste);margin:14px 0 4px}
.navi-osa-alue{margin:6px 0 10px}
details.navi-osa-alue>summary,details.navi-moduuli>summary{list-style:none;cursor:pointer;user-select:none}
details.navi-osa-alue>summary::-webkit-details-marker,details.navi-moduuli>summary::-webkit-details-marker{display:none}
details.navi-osa-alue>summary::before,details.navi-moduuli>summary::before{content:'+';display:inline-block;width:1em;color:var(--vaimea);font-weight:400}
details[open].navi-osa-alue>summary::before,details[open].navi-moduuli>summary::before{content:'−'}
.osa-alue-otsikko{font-size:13px;font-weight:700;color:var(--linkki);margin:12px 0 4px}
.navi-osa-alue .navi-moduuli{padding-left:8px;border-left:2px solid var(--reuna);margin-left:2px}
details.navi-moduuli>summary{font-size:13px;margin:8px 0 2px;color:var(--muste);font-weight:700}
.laajenna-nappi{width:100%;margin-bottom:10px;padding:5px 8px;border:1px solid var(--reuna);border-radius:6px;background:var(--tausta);font-size:12px;color:var(--muste);cursor:pointer;text-align:left}
.laajenna-nappi:hover{border-color:var(--linkki)}
.navi-kategoria{margin:4px 0}
.navi-kategoria h4{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--vaimea);margin:6px 0 2px;padding-left:8px}
.sivupalkki ul{list-style:none;margin:0 0 4px;padding-left:8px}
.sivupalkki li{margin:2px 0}
.sivupalkki a{color:var(--linkki);text-decoration:none}
.sivupalkki a:hover{text-decoration:underline}
.sisalto{flex:1;max-width:900px;padding:32px 40px;overflow-x:auto}
.sisalto h1{margin-top:0}
.kortit{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:16px 0 8px}
.kortti{display:block;padding:16px;border:1px solid var(--reuna);border-radius:8px;background:var(--palkki);text-decoration:none;color:var(--muste);transition:border-color .12s,box-shadow .12s}
.kortti:hover{border-color:var(--linkki);box-shadow:0 1px 6px rgba(0,0,0,.12)}
.kortti h3{margin:0 0 4px;font-size:16px;color:var(--linkki)}
.kortti p{margin:0;font-size:13px;color:var(--vaimea)}
.vinkki{font-size:13px;color:var(--vaimea)}
.meta{margin:0 0 24px;padding-bottom:12px;border-bottom:1px solid var(--reuna)}
.merkki{display:inline-block;font-size:12px;background:var(--palkki);border:1px solid var(--reuna);border-radius:4px;padding:1px 8px;margin:2px 4px 2px 0;color:var(--muste)}
.merkki.tila-valmis{background:#e6f5ea;border-color:#bfe3c9;color:#14532d}
.merkki.tila-luonnos{background:#fff4e0;border-color:#f0dcae;color:#713f12}
.merkki.tila-vanhentunut{background:#fbe6e6;border-color:#eebcbc;color:#7f1d1d}
.merkki.tila-kesken{background:#e7edfb;border-color:#c3d2f2;color:#1e3a8a}
.lahteet{margin-top:8px;font-size:14px}
.lahteet code{font-size:12px}
a{color:var(--linkki)}
code{background:var(--koodi);padding:1px 5px;border-radius:3px;font-size:.9em}
pre{background:var(--palkki);border:1px solid var(--reuna);border-radius:6px;padding:12px;overflow-x:auto}
pre code{background:none;padding:0}
pre.mermaid{background:var(--tausta);text-align:center}
table{border-collapse:collapse;width:100%;margin:16px 0;display:block;overflow-x:auto}
th,td{border:1px solid var(--reuna);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--palkki)}
blockquote{margin:16px 0;padding:8px 16px;border-left:4px solid var(--reuna);background:var(--palkki);color:var(--muste)}
.haku{margin-bottom:14px}
#haku-kentta{width:100%;padding:7px 9px;border:1px solid var(--reuna);border-radius:6px;font-size:14px;background:var(--tausta);color:var(--muste)}
#haku-tulokset{margin-top:6px}
.haku-osuma{display:block;padding:6px 8px;border-radius:5px;text-decoration:none;color:var(--muste)}
.haku-osuma:hover{background:var(--tausta)}
.haku-t{display:block;color:var(--linkki);font-size:13px}
.haku-p{display:block;color:var(--vaimea);font-size:11px}
.haku-ei{padding:6px 8px;color:var(--vaimea);font-size:13px}
.navi-nappi{display:none}
@media(max-width:800px){
  body{display:block}
  .sivupalkki{display:none;width:100%;height:auto;position:static}
  body.navi-auki .sivupalkki{display:block}
  .navi-nappi{display:block;width:100%;padding:12px;border:0;background:var(--palkki);border-bottom:1px solid var(--reuna);font-size:15px;text-align:left;cursor:pointer;color:var(--muste)}
  .sisalto{padding:20px}
}
`;
}
