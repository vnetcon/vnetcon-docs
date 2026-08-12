#!/usr/bin/env node
// Listaa projektin moduulit ja niiden dokumentointitila.
//
//   node tyokalut/moduulit.mjs                 # kaikki, osa-alueittain
//   node tyokalut/moduulit.mjs --tekematta      # vain dokumentoimattomat
//   node tyokalut/moduulit.mjs --osa-alue ydin  # rajaa osa-alueeseen
//   node tyokalut/moduulit.mjs --json           # koneluettava
//   node tyokalut/moduulit.mjs --nopea          # älä päivitä kalibrointia
//
// Lähteet: tila/kalibrointi.json (rekisterin moduulit rivimäärineen + koodista
// päätellyt ehdokkaat) ja tila/rakenne.yaml (osa-alueet). Ei riippuvuuksia,
// ei tekoälyä.
//
// tila/rekisteri.yaml luetaan tyokalut/kalibroi.mjs:ssä — se on paketin ainoa
// rekisterin lukija, jotta rivimäärät ja tilat eivät voi erota kahden eri
// jäsentäjän välillä. Tämä skripti vain esittää sen tuloksen.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TYOKALUT = path.dirname(fileURLToPath(import.meta.url));
const JUURI = path.resolve(TYOKALUT, '..');
const argv = process.argv.slice(2);
const on = (l) => argv.includes(l);
const arvo = (l) => { const i = argv.indexOf(l); return i >= 0 ? argv[i + 1] : null; };

const VAIN_TEKEMATTA = on('--tekematta');
const JSON_ULOS = on('--json');
const NOPEA = on('--nopea');
const OSA_ALUE = arvo('--osa-alue');

// --- Kalibrointidata (päätellyt ehdokkaat + koodirivit) --------------------

const kalibrointiT = path.join(JUURI, 'tila', 'kalibrointi.json');
if (!NOPEA || !fs.existsSync(kalibrointiT)) {
  try {
    execFileSync(process.execPath, [path.join(TYOKALUT, 'kalibroi.mjs'), '--json-vain', '--hiljaa'],
      { stdio: 'ignore' });
  } catch { /* jatketaan vanhalla datalla jos on */ }
}
let kal = null;
try { kal = JSON.parse(fs.readFileSync(kalibrointiT, 'utf8')); } catch { kal = null; }

// Moduulin nimi hakemistopolusta. Perusnimi riittää yleensä, mutta liian
// yleinen nimi (src, lib, core…) tai kahden ehdokkaan törmäys tarkennetaan
// yläkansiolla: shared/api -> shared-api. Väliviiva, ei kauttaviivaa, koska
// moduulit/<nimi>/ on yksitasoinen.
const GENEERISET = new Set(['src', 'lib', 'app', 'core', 'main', 'server', 'client',
  'api', 'common', 'shared', 'yleiset', 'backend', 'frontend', 'web', 'internal', 'pkg']);
function moduuliNimi(dir, kaikkiPolut) {
  const osat = String(dir).split('/').filter(Boolean);
  const perus = osat[osat.length - 1] || dir;
  if (osat.length < 2) return perus;
  const tormaa = kaikkiPolut.filter((d) => (d.split('/').filter(Boolean).pop() || d) === perus).length > 1;
  return (GENEERISET.has(perus.toLowerCase()) || tormaa) ? osat.slice(-2).join('-') : perus;
}

const rekisteri = (kal && kal.rekisteri) || [];

// Rekisterin ollessa käytössä pääteltyjä ehdokkaita näytetään vain siltä osin
// kuin ne EIVÄT kuulu jo johonkin rekisterin moduuliin. Ilman tätä sama koodi
// näkyisi kahdesti: kertaalleen oikeana moduulina ja kertaalleen hakemiston
// nimisenä haamurivinä, ja yhteissumma olisi väärä.
const ehdokkaat = new Map();   // nimi -> { hakemisto, loc, tyypit }
const kaikkiEhdokkaat = ((kal && kal.moduulit) || []).filter((m) => !(rekisteri.length && m.katettu));
const kaikkiPolut = kaikkiEhdokkaat.map((m) => m.hakemisto);
for (const m of kaikkiEhdokkaat) {
  ehdokkaat.set(moduuliNimi(m.hakemisto, kaikkiPolut),
    { hakemisto: m.hakemisto, loc: m.loc || 0, tyypit: m.tyypit || [] });
}

// --- tila/rakenne.yaml (osa-alueet) --------------------------------------

function lueOsaAlueet() {
  const f = path.join(JUURI, 'tila', 'rakenne.yaml');
  if (!fs.existsSync(f)) return [];
  const teksti = fs.readFileSync(f, 'utf8').split('\n').filter((r) => !/^\s*#/.test(r)).join('\n');
  const i = teksti.search(/^osa-alueet:/m);
  if (i < 0) return [];
  const loppu = teksti.slice(i).search(/\n[a-zä-ö_-]+:/i);
  const runko = loppu > 0 ? teksti.slice(i, i + loppu) : teksti.slice(i);
  const palat = runko.split(/\n(?=\s*-\s)/).slice(1);
  const ulos = [];
  for (const pala of palat) {
    const tunnus = (pala.match(/tunnus:\s*([^\s,}]+)/) || [])[1];
    if (!tunnus) continue;
    const nimi = (pala.match(/nimi:\s*["']?([^"'\n]+)["']?/) || [])[1];
    const lista = pala.match(/moduulit:\s*\[([\s\S]*?)\]/);
    const moduulit = lista
      ? lista[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : [];
    ulos.push({ tunnus, nimi: (nimi || tunnus).trim(), moduulit });
  }
  return ulos;
}
const osaAlueet = lueOsaAlueet();

// --- Dokumenttien määrä per moduuli --------------------------------------

function dokkeja(nimi) {
  const d = path.join(JUURI, 'moduulit', nimi);
  if (!fs.existsSync(d)) return 0;
  let n = 0;
  (function kavele(p) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const q = path.join(p, e.name);
      if (e.isDirectory()) kavele(q);
      else if (e.name.endsWith('.md')) n++;
    }
  })(d);
  return n;
}

// --- Yhdistetty näkymä ---------------------------------------------------

const nimet = new Set([...rekisteri.map((r) => r.nimi), ...ehdokkaat.keys()]);
const moduulit = [...nimet].map((nimi) => {
  const r = rekisteri.find((x) => x.nimi === nimi) || null;
  const e = ehdokkaat.get(nimi) || null;
  const n = dokkeja(nimi);
  // Tila: rekisteri on virallinen. Ilman rekisteriä päätellään dokeista.
  let tila = r ? r.tila : (n > 0 ? 'valmis?' : 'tekematta');
  // Rivimäärä: rekisterin oma kohdistus (tiedostot- tai polku-pohjainen) voittaa,
  // koska moduuli ei välttämättä ole hakemisto. Vasta sen puuttuessa
  // turvaudutaan samannimiseen pääteltyyn ehdokkaaseen.
  const loc = r && r.loc != null ? r.loc : (e ? e.loc : null);
  return {
    nimi,
    tila,
    lahde: r ? (r.loc ? 'rekisteri' : (e ? 'rekisteri+koodi' : 'vain rekisteri')) : 'vain koodi',
    hakemisto: (r && r.polku) || (e && e.hakemisto) || null,
    tyyppi: (r && r.tyyppi) || (e && e.tyypit.join(', ')) || null,
    loc,
    kuvaus: (r && r.kuvaus) || null,
    tiedostoja: (r && r.tiedostot && r.tiedostot.length) || null,
    dokkeja: n,
    pilotti: !!(r && r.pilotti),
    paivitetty: r && r.paivitetty,
    syy: r && r.syy,
    osaAlue: (osaAlueet.find((a) => a.moduulit.includes(nimi)) || {}).tunnus || null,
  };
});

const TILA_JARJ = { kesken: 0, tekematta: 1, 'valmis?': 2, valmis: 3, 'rajattu-pois': 4 };
moduulit.sort((a, b) =>
  (TILA_JARJ[a.tila] ?? 9) - (TILA_JARJ[b.tila] ?? 9) || (b.loc || 0) - (a.loc || 0) || a.nimi.localeCompare(b.nimi));

let nakyvat = moduulit;
if (OSA_ALUE) nakyvat = nakyvat.filter((m) => m.osaAlue === OSA_ALUE);
if (VAIN_TEKEMATTA) nakyvat = nakyvat.filter((m) => m.tila === 'tekematta' || m.tila === 'kesken');

// --- Ehdotus seuraavaksi -------------------------------------------------

const avoimet = nakyvat.filter((m) => m.tila === 'tekematta' || m.tila === 'kesken');
const kesken = avoimet.find((m) => m.tila === 'kesken');
const pilotti = avoimet.find((m) => m.pilotti);
const pienin = [...avoimet].filter((m) => m.loc).sort((a, b) => a.loc - b.loc)[0];
const ehdotus = kesken
  ? { moduuli: kesken.nimi, syy: 'kesken — vie loppuun ensin' }
  : pilotti
    ? { moduuli: pilotti.nimi, syy: 'merkitty pilotiksi' }
    : pienin
      ? { moduuli: pienin.nimi, syy: `pienin dokumentoimaton (${pienin.loc.toLocaleString('fi-FI')} riviä) — halpa tarkistusajo` }
      : avoimet[0] ? { moduuli: avoimet[0].nimi, syy: 'ensimmäinen dokumentoimaton' } : null;

// --- Tuloste -------------------------------------------------------------

if (JSON_ULOS) {
  console.log(JSON.stringify({ moduulit: nakyvat, osaAlueet, ehdotus }, null, 2));
  process.exit(0);
}

const VARI = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (koodi, s) => (VARI ? `\u001b[${koodi}m${s}\u001b[0m` : s);
const MERKKI = {
  valmis: c(32, '✓'), 'valmis?': c(32, '~'), kesken: c(33, '»'),
  tekematta: c(90, '·'), 'rajattu-pois': c(90, '×'),
};

if (!rekisteri.length) {
  console.log(c(33, '! tila/rekisteri.yaml on tyhjä — käyttöönottoa ei ole tehty.'));
  console.log(c(90, '  Alla on koodista PÄÄTELLYT moduuliehdokkaat. Vahvista jako ajamalla /vnetcon-init.'));
  console.log('');
}

const lyhenna = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const rivi = (m) => {
  const tila = (MERKKI[m.tila] || '?') + ' ' + m.tila.padEnd(13);
  const loc = m.loc != null ? String(m.loc.toLocaleString('fi-FI')).padStart(9) : '        —';
  const dok = m.dokkeja ? String(m.dokkeja).padStart(4) : '   —';
  const tyyppi = m.tyyppi ? c(90, ' ' + lyhenna(m.tyyppi, 26)) : '';
  const lisa = [
    m.pilotti ? c(36, 'pilotti') : null,
    // Koodihakemisto, jota rekisteri ei tunne — hiljaisesti dokumentoimatta jäävä alue.
    rekisteri.length && m.lahde === 'vain koodi' ? c(33, 'ei rekisterissä') : null,
    m.syy ? c(90, lyhenna(m.syy, 60)) : null,
  ].filter(Boolean).join(' ');
  return `  ${tila} ${m.nimi.padEnd(30)} ${loc} riviä  ${dok} dok${tyyppi} ${lisa}`;
};

const ryhmat = OSA_ALUE || !osaAlueet.length
  ? [{ tunnus: null, nimi: null, jasenet: nakyvat }]
  : [
    ...osaAlueet.map((a) => ({ tunnus: a.tunnus, nimi: a.nimi, jasenet: nakyvat.filter((m) => m.osaAlue === a.tunnus) })),
    { tunnus: null, nimi: 'Ei osa-aluetta', jasenet: nakyvat.filter((m) => !m.osaAlue) },
  ];

for (const r of ryhmat) {
  if (!r.jasenet.length) continue;
  if (r.nimi) console.log(c(1, `${r.nimi}${r.tunnus ? c(90, `  (${r.tunnus})`) : ''}`));
  for (const m of r.jasenet) console.log(rivi(m));
  console.log('');
}

if (!nakyvat.length) {
  console.log(c(90, OSA_ALUE ? `Ei moduuleja osa-alueessa "${OSA_ALUE}".` : 'Ei moduuleja.'));
  process.exit(0);
}

const laske = (t) => moduulit.filter((m) => m.tila === t).length;
console.log(c(1, 'Yhteensä: ') + `${moduulit.length} moduulia · `
  + `${laske('valmis') + laske('valmis?')} valmis · ${laske('kesken')} kesken · `
  + `${laske('tekematta')} tekemättä${laske('rajattu-pois') ? ` · ${laske('rajattu-pois')} rajattu pois` : ''}`);

if (kal && kal.arvio && kal.arvio.dokumentoimatta) {
  console.log(c(90, `Arvio jäljellä: ${kal.arvio.tokenit_min_M}–${kal.arvio.tokenit_max_M} M tokenia, `
    + `${kal.arvio.dokkeja_min}–${kal.arvio.dokkeja_max} dokumenttia`));
}
// Rekisterin ulkopuolelle jäävä koodi on kerrottava ääneen: se ei näy
// tekemättömien joukossa eikä laajuusarviossa, joten se jäisi muuten kokonaan
// huomaamatta.
const ulkopuoliset = moduulit.filter((m) => rekisteri.length && m.lahde === 'vain koodi' && m.loc);
if (ulkopuoliset.length) {
  const rivit = ulkopuoliset.reduce((s, m) => s + m.loc, 0);
  console.log(c(33, `! ${ulkopuoliset.length} koodihakemistoa (${rivit.toLocaleString('fi-FI')} riviä) ei kuulu yhteenkään rekisterin moduuliin.`));
  console.log(c(90, '  Merkitty "ei rekisterissä". Lisää moduuli tai rajaa alue pois tila/rekisteri.yaml:iin.'));
}

if (ehdotus) {
  console.log('');
  console.log(c(1, 'Seuraavaksi: ') + c(36, `/dokumentoi ${ehdotus.moduuli}`) + c(90, `  (${ehdotus.syy})`));
}
if (!rekisteri.length) {
  console.log(c(90, 'Huom: tilat ovat päätelty dokumenttien olemassaolosta ("valmis?"), eivät rekisteristä.'));
  console.log(c(90, 'Ehdokkaiksi kelpuutetaan hakemistot, joissa on koodia; virallinen jako syntyy /vnetcon-init -ajossa.'));
}
