#!/usr/bin/env node
// Savutesti — tarkistaa, että koneelliset työkalut antavat oikeat vastaukset.
//
//   node tyokalut/testaa.mjs [--pida]
//   tyokalut/testaa.sh [--pida]        (macOS/Linux)
//   tyokalut\testaa.cmd [--pida]       (Windows)
//
// Rakentaa tilapäisiä projekteja, asentaa paketin niihin ja väittää tuloksista.
// --pida jättää tilapäishakemistot paikalleen tutkittavaksi.
//
// Kattaa ne tapaukset, jotka ovat kertaalleen olleet rikki. Jos jokin näistä
// hajoaa uudelleen, se hajoaa hiljaa ja näkyy vasta asiakkaan koodipohjassa:
//   1. moduuliehdokkaat löytyvät myös src/:n ulkopuolelta (shared/, web/, scripts/)
//   2. dokumentaatio- ja esimerkkikansiot EIVÄT kelpaa ehdokkaiksi
//   3. moduuli ei ole hakemisto: `tiedostot`-lista ratkaisee rivimäärät, ja saman
//      hakemiston jakavat moduulit eivät vie toistensa rivejä
//   4. rekisterin kattama ehdokas ei tuota haamuriviä
//   5. rekisterin ulkopuolinen koodi raportoidaan (`vain koodi`)
//   6. rekisterin kuollut polku tuottaa löydöksen
//   7. `syy`-kenttä ei katkea ensimmäiseen pilkkuun
//   8. vnetcon-ai:n komennot vastaavat samoin kaikilla alustoilla (Node-portti)
//   9. asenna --paivita säilyttää laajennuspisteet ja jättää settings.json.uusi
//  10. xlsx-kartta löytää työkirjan ansat (lyhyt hakualue, IFERROR, piilotettu
//      välilehti, ulkoinen linkki) ja import-rajapinta nimeää sarakkeet oikein

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const PIDA = process.argv.slice(2).includes('--pida');

const VARI = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const C_OK = VARI ? '[32m' : '';
const C_VIRHE = VARI ? '[31m' : '';
const C_HIM = VARI ? '[2m' : '';
const C_0 = VARI ? '[0m' : '';

let VIRHEITA = 0;
const ok = (s) => process.stdout.write(`${C_OK}✓${C_0} ${s}\n`);
const virhe = (s) => { VIRHEITA += 1; process.stderr.write(`${C_VIRHE}✗${C_0} ${s}\n`); };
const him = (s) => process.stdout.write(`${C_HIM}${s}${C_0}\n`);

const TYO = fs.mkdtempSync(path.join(os.tmpdir(), 'vnetcon-testaa-'));
process.on('exit', () => {
  if (PIDA) him(`Tilapäishakemistot jätettiin: ${TYO}`);
  else { try { fs.rmSync(TYO, { recursive: true, force: true }); } catch { /* ohita */ } }
});

// --- Apurit ----------------------------------------------------------------

function mk(tiedosto, rivit) {
  fs.mkdirSync(path.dirname(tiedosto), { recursive: true });
  let s = '';
  for (let i = 1; i <= rivit; i += 1) s += `const x${i} = ${i};\n`;
  fs.appendFileSync(tiedosto, s);
}

function ajaNode(skripti, args, opts = {}) {
  return spawnSync(process.execPath, [skripti, ...args], { encoding: 'utf8', ...opts });
}

function git(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function repoAlustus(dir) {
  const r1 = git(dir, ['init', '-q', '.']);
  const r2 = git(dir, ['add', '-A']);
  const r3 = git(dir, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'alku']);
  if (r1.status !== 0 || r2.status !== 0 || r3.status !== 0) virhe('git init epäonnistui');
}

function asenna(kohde, lisa = []) {
  const r = ajaNode(path.join(REPO, 'tyokalut', 'asenna.mjs'), [kohde, ...lisa]);
  if (r.status !== 0) virhe(`asenna.mjs epäonnistui: ${(r.stderr || '').trim()}`);
  return r;
}

function kentta(jsonTiedosto, moduuli, nimi) {
  try {
    const j = JSON.parse(fs.readFileSync(jsonTiedosto, 'utf8'));
    const m = (j.moduulit || []).find((x) => x.nimi === moduuli);
    return m ? String(m[nimi]) : 'PUUTTUU';
  } catch { return 'PUUTTUU'; }
}

const onSama = (kuvaus, odotettu, saatu) => {
  if (odotettu === saatu) ok(kuvaus);
  else virhe(`${kuvaus} — odotettiin '${odotettu}', saatiin '${saatu}'`);
};

const onValilla = (kuvaus, min, max, saatu) => {
  const n = Number(saatu);
  if (!/^\d+$/.test(String(saatu))) { virhe(`${kuvaus} — ei lukua: '${saatu}'`); return; }
  if (n >= min && n <= max) ok(`${kuvaus} (${n})`);
  else virhe(`${kuvaus} — odotettiin ${min}–${max}, saatiin ${n}`);
};

const sisaltaa = (kuvaus, merkkijono, tiedosto) => {
  let teksti = '';
  try { teksti = fs.readFileSync(tiedosto, 'utf8'); } catch { /* ohita */ }
  if (teksti.includes(merkkijono)) ok(kuvaus);
  else virhe(`${kuvaus} — ei löytynyt: '${merkkijono}'`);
};

const sisaltaaTeksti = (kuvaus, merkkijono, teksti) => {
  if (String(teksti).includes(merkkijono)) ok(kuvaus);
  else virhe(`${kuvaus} — ei löytynyt: '${merkkijono}'`);
};

// --- Syntaksitarkistukset --------------------------------------------------

him('Syntaksi');
const mjsTiedostot = [
  ...fs.readdirSync(path.join(REPO, 'dist', 'tyokalut')).filter((f) => f.endsWith('.mjs'))
    .map((f) => path.join(REPO, 'dist', 'tyokalut', f)),
  path.join(REPO, 'dist', 'tyokalut', 'html-generaattori', 'generoi.mjs'),
  path.join(REPO, 'dist', 'tyokalut', 'vnetcon-ai', 'vnetcon-ai.mjs'),
  path.join(REPO, 'dist', 'tyokalut', 'vnetcon-ai', 'hae-token.mjs'),
  path.join(REPO, 'tyokalut', 'asenna.mjs'),
  path.join(REPO, 'tyokalut', 'testaa.mjs'),
];
for (const f of mjsTiedostot) {
  if (!fs.existsSync(f)) { virhe(`puuttuu: ${path.basename(f)}`); continue; }
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status === 0) ok(`node --check ${path.basename(f)}`);
  else virhe(`node --check ${path.basename(f)}`);
}

// Käynnistimien olemassaolo: ilman näitä tuttu komento tai Windows-polku katoaa.
for (const f of [
  'dist/tyokalut/vnetcon-ai/vnetcon-ai',
  'dist/tyokalut/vnetcon-ai/vnetcon-ai.cmd',
  'dist/tyokalut/vnetcon-ai/vnetcon-ai.ps1',
  'dist/tyokalut/vnetcon-ai/hae-token.sh',
  'dist/tyokalut/vnetcon-ai/hae-token.cmd',
  'tyokalut/asenna.sh',
  'tyokalut/asenna.cmd',
]) {
  if (fs.existsSync(path.join(REPO, f))) ok(`käynnistin ${path.basename(f)}`);
  else virhe(`käynnistin puuttuu: ${f}`);
}

// bash -n vain jos bash on olemassa (Windowsilla ei ole eikä tarvita).
const bashPolku = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['bash'], { encoding: 'utf8' });
if (bashPolku.status === 0) {
  for (const f of ['tyokalut/asenna.sh', 'tyokalut/paketoi.sh', 'tyokalut/testaa.sh',
    'dist/tyokalut/vnetcon-ai/vnetcon-ai', 'dist/tyokalut/vnetcon-ai/hae-token.sh']) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    const r = spawnSync('bash', ['-n', p], { encoding: 'utf8' });
    if (r.status === 0) ok(`bash -n ${path.basename(f)}`);
    else virhe(`bash -n ${path.basename(f)}`);
  }
} else {
  him('(bash puuttuu — sh-käynnistimien syntaksitarkistus ohitettiin)');
}

// Workflow-skriptit ajetaan async-kontekstissa ja saavat käyttää top-level
// returnia, joten `node --check` hylkäisi ne sellaisenaan. Kääritään ja
// poistetaan export-avainsana, jotta syntaksin voi silti tarkistaa — muuten
// kirjoitusvirhe workflow'ssa paljastuu vasta asiakkaan /dokumentoi-kaikki-ajossa.
const wfDir = path.join(REPO, 'dist', '.claude', 'workflows');
if (fs.existsSync(wfDir)) {
  for (const f of fs.readdirSync(wfDir).filter((x) => x.endsWith('.mjs'))) {
    const sisalto = fs.readFileSync(path.join(wfDir, f), 'utf8').replace(/^export const /gm, 'const ');
    const tmp = path.join(TYO, 'wf.mjs');
    fs.writeFileSync(tmp, `(async () => {\n${sisalto}\n})()\n`);
    const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    if (r.status === 0) ok(`syntaksi ${f}`);
    else virhe(`syntaksi ${f}`);
  }
}

// --- Tapaus 1: ei rekisteriä, moduulit päätellään koodin sijainnista -------

process.stdout.write('\n'); him('Tapaus 1 — moduuliehdokkaat ilman rekisteriä');
const P1 = path.join(TYO, 'ilman-rekisteria');
fs.mkdirSync(P1, { recursive: true });
mk(path.join(P1, 'src/maksut/reitit.ts'), 40);
mk(path.join(P1, 'src/maksut/laskuri.ts'), 30);
mk(path.join(P1, 'shared/api/skeema.ts'), 25);
mk(path.join(P1, 'shared/api/asiakas.ts'), 15);
mk(path.join(P1, 'web/ui/nappi.tsx'), 20);
mk(path.join(P1, 'web/ui/lomake.tsx'), 20);
mk(path.join(P1, 'scripts/aja.sh'), 10);
mk(path.join(P1, 'scripts/siivoa.sh'), 10);
mk(path.join(P1, 'scripts/vie.sh'), 10);
mk(path.join(P1, 'docs/esimerkki.sh'), 5);
repoAlustus(P1);
asenna(P1);

const J1 = path.join(TYO, 'moduulit1.json');
{
  const r = ajaNode(path.join(P1, 'vnetcon-docs', 'tyokalut', 'moduulit.mjs'), ['--json']);
  if (r.status !== 0) virhe('moduulit --json epäonnistui');
  fs.writeFileSync(J1, r.stdout || '{}');
}

onValilla('src/maksut löytyy', 70, 74, kentta(J1, 'maksut', 'loc'));
onValilla('shared/api löytyy', 40, 44, kentta(J1, 'shared-api', 'loc'));
onValilla('web/ui löytyy', 40, 44, kentta(J1, 'ui', 'loc'));
onValilla('scripts löytyy', 31, 35, kentta(J1, 'scripts', 'loc'));
onSama('docs/ ei ole ehdokas', 'PUUTTUU', kentta(J1, 'docs', 'loc'));

// --- Tapaus 2: rekisteri, jossa moduuli ei ole hakemisto -------------------

process.stdout.write('\n'); him('Tapaus 2 — moduuli ei ole hakemisto (tiedostot-lista ratkaisee)');
const P2 = path.join(TYO, 'rekisteri');
fs.mkdirSync(P2, { recursive: true });
mk(path.join(P2, 'src/maksut/reitit.ts'), 40);
mk(path.join(P2, 'src/maksut/laskuri.ts'), 30);
mk(path.join(P2, 'backend/palvelut/tilaus.py'), 100);
mk(path.join(P2, 'backend/palvelut/laskutus.py'), 60);
mk(path.join(P2, 'backend/palvelut/hyvitys.py'), 40);
// Kaksi tiedostoa: lähdejuurten (src, app, lib…) ulkopuolella ehdokkaaksi
// vaaditaan kaksi koodi tiedostoa, jottei yksittäinen skripti tuota moduulia.
mk(path.join(P2, 'web/ui/nappi.tsx'), 20);
mk(path.join(P2, 'web/ui/lomake.tsx'), 20);
repoAlustus(P2);
asenna(P2);

fs.writeFileSync(path.join(P2, 'vnetcon-docs', 'tila', 'rekisteri.yaml'), `paivitetty: 2026-01-01

moduulit:
  - nimi: tilaukset
    polku: backend/palvelut
    tyyppi: python
    tila: tekematta
    pilotti: true
    kuvaus: "Tilausten vastaanotto. Jakaa hakemiston laskutuksen kanssa."
    tiedostot:
      - backend/palvelut/tilaus.py

  - nimi: laskutus
    polku: backend/palvelut
    tyyppi: python
    tila: kesken
    kuvaus: "Laskujen muodostus ja hyvitykset."
    tiedostot:
      - backend/palvelut/laskutus.py
      - backend/palvelut/hyvitys.py

  - nimi: maksut
    polku: src/maksut
    tyyppi: node-ts
    tila: valmis

  - { nimi: puuttuva, polku: backend/ei-ole-olemassa, tila: tekematta }

  - { nimi: vanha-sdk, polku: shared/ei-ole, tila: rajattu-pois, syy: "Generoitu koodi, ei ylläpidetä käsin, korvautuu uudella rajapinnalla" }
`);

const J2 = path.join(TYO, 'moduulit2.json');
{
  const r = ajaNode(path.join(P2, 'vnetcon-docs', 'tyokalut', 'moduulit.mjs'), ['--json']);
  if (r.status !== 0) virhe('moduulit --json epäonnistui');
  fs.writeFileSync(J2, r.stdout || '{}');
}

// Bugi, joka tämän testin on tarkoitus estää: kumpikin sai 0 tai 203 riviä,
// koska tiedostot-lista jäi jäsentymättä ja polku ratkaisi rajauksen.
onValilla('tilaukset saa omat rivinsä', 95, 105, kentta(J2, 'tilaukset', 'loc'));
onValilla('laskutus saa omat rivinsä', 95, 105, kentta(J2, 'laskutus', 'loc'));
onSama('ei haamuriviä hakemistosta', 'PUUTTUU', kentta(J2, 'palvelut', 'loc'));
onSama('rekisterin ulkopuolinen koodi merkitään', 'vain koodi', kentta(J2, 'ui', 'lahde'));
sisaltaa('syy ei katkea pilkkuun', 'korvautuu uudella rajapinnalla', J2);

const R2 = path.join(P2, 'vnetcon-docs', 'kalibrointiraportti.md');
{
  const r = ajaNode(path.join(P2, 'vnetcon-docs', 'tyokalut', 'kalibroi.mjs'), []);
  if (r.status !== 0) virhe('kalibroi epäonnistui');
}
sisaltaa('kuollut rekisterin polku löydetään', 'Rekisterin polut', R2);
sisaltaa('rekisterin ulkopuolinen koodi raportoidaan', 'Rekisterin ulkopuolinen koodi', R2);
sisaltaa('moduulitaulu tulee rekisteristä', '## Moduulit (rekisteri)', R2);

// --- Tapaus 3: vnetcon-ai:n komennot (Node-portti, sama kaikilla alustoilla)

process.stdout.write('\n'); him('Tapaus 3 — vnetcon-ai ilman bashia');
const CLI = path.join(P2, 'vnetcon-docs', 'tyokalut', 'vnetcon-ai', 'vnetcon-ai.mjs');
const ymparisto = { ...process.env, NO_COLOR: '1' };

{
  const r = ajaNode(CLI, ['--help'], { env: ymparisto });
  onSama('--help palauttaa 0', 0, r.status);
  sisaltaaTeksti('--help listaa komennot', 'doctor                  Tarkista asennus', r.stdout);
}
{
  const r = ajaNode(CLI, ['doctor'], { env: ymparisto });
  onSama('doctor palauttaa 0', 0, r.status);
  sisaltaaTeksti('doctor tunnistaa git-repon', 'projekti on git-repo', r.stdout);
  sisaltaaTeksti('doctor kertoo Node-version', `node ${process.version}`, r.stdout);
}
{
  // Ilman konfiguraatiota konfig kaatuu tarkoituksella; kirjoitetaan minimaalinen
  // tiedosto, joka samalla testaa YAML-lukijan (sisennys + kommentit + lainaukset).
  fs.writeFileSync(path.join(P2, 'vnetcon-docs', 'vnetcon.config.yaml'), `versio: 1

projekti:
  nimi: "Testiprojekti"        # kommentti ei saa päätyä arvoon
  juuri: ".."

agentit:
  dokumentointi: claude
  toteutus: codex
  claude:
    tarjoaja: oma
`);
  const r = ajaNode(CLI, ['konfig'], { env: ymparisto });
  onSama('konfig palauttaa 0', 0, r.status);
  sisaltaaTeksti('konfig lukee sisennetyn YAML-arvon', 'projekti.nimi            Testiprojekti', r.stdout);
  sisaltaaTeksti('konfig ei vuoda tunnisteita', '(tunnisteita ei näytetä', r.stdout);
}
{
  const r = ajaNode(CLI, ['tama-komentoa-ei-ole'], { env: ymparisto });
  onSama('tuntematon komento → 1', 1, r.status);
  sisaltaaTeksti('tuntematon komento kirjoittaa stderriin', 'Tuntematon komento', r.stderr);
}
{
  // token ilman konfiguroitua lähdettä: paluukoodi 1 eikä mitään stdoutiin —
  // apiKeyHelper lukee tämän sellaisenaan, joten ylimääräinen tuloste rikkoisi sen.
  const r = ajaNode(CLI, ['token', 'claude'], { env: ymparisto });
  onSama('token ilman lähdettä → 1', 1, r.status);
  onSama('token ei tulosta mitään', '', r.stdout);
}

// --- Tapaus 4: asenna --paivita säilyttää laajennuspisteet -----------------

process.stdout.write('\n'); him('Tapaus 4 — päivitys säilyttää projektin omat tiedostot');
const KARTOITUS = path.join(P2, 'vnetcon-docs', 'metodi', 'kartoitus.md');
const ASETUKSET = path.join(P2, 'vnetcon-docs', '.claude', 'settings.json');
const OMA_KARTOITUS = '# Projektin oma kartoitus\n\nÄLÄ YLIKIRJOITA MINUA\n';
fs.writeFileSync(KARTOITUS, OMA_KARTOITUS);
fs.writeFileSync(ASETUKSET, '{\n  "permissions": { "allow": ["Bash(echo oma:*)"] }\n}\n');

asenna(P2, ['--paivita']);

onSama('kartoitus.md säilyi', OMA_KARTOITUS, fs.readFileSync(KARTOITUS, 'utf8'));
sisaltaa('settings.json säilyi', 'Bash(echo oma:*)', ASETUKSET);
if (fs.existsSync(ASETUKSET + '.uusi')) {
  sisaltaa('paketin uusi settings.json jätettiin viereen', 'PowerShell(', ASETUKSET + '.uusi');
} else {
  virhe('settings.json.uusi puuttuu — paketin uudet säännöt eivät saavuta projektia');
}
sisaltaa('versiotiedosto päivittyi', fs.readFileSync(path.join(REPO, 'VERSIO'), 'utf8').trim(),
  path.join(P2, 'vnetcon-docs', '.vnetcon-docs-versio'));
if (fs.existsSync(path.join(P2, 'vnetcon-docs', 'tyokalut', 'vnetcon-ai', 'vnetcon-ai.cmd'))) {
  ok('Windows-käynnistin kopioitui asennukseen');
} else {
  virhe('vnetcon-ai.cmd ei kopioitunut asennukseen');
}

// --- Tapaus 5: Excel-työkirjan kartoitus -----------------------------------

// Fixtuuri rakennetaan käsin: .xlsx on zip-paketti XML:ää, ja pakkaamaton
// (store) kelpaa lukijalle. Näin savutestissä ei ole riippuvuuksia eikä
// binääritiedostoa versionhallinnassa — ja fixtuuriin saa juuri ne ansat, jotka
// työkalun on löydettävä: liian lyhyt hakualue, IFERROR, piilotettu välilehti,
// tekstinä oleva päivämäärä ja ulkoinen linkki Windows-polkuun.

process.stdout.write('\n'); him('Tapaus 5 — Excel-työkirjan kartoitus (xlsx-kartta.mjs)');

let CRC_TAULU = null;
function crc32(buf) {
  if (!CRC_TAULU) {
    CRC_TAULU = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TAULU[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = CRC_TAULU[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function kirjoitaZip(kohde, tiedostot) {
  const paikalliset = [];
  const hakemisto = [];
  let siirtyma = 0;
  for (const [nimi, sisalto] of Object.entries(tiedostot)) {
    const data = Buffer.from(sisalto, 'utf8');
    const nimiBuf = Buffer.from(nimi, 'utf8');
    const crc = crc32(data);
    const otsake = Buffer.alloc(30);
    otsake.writeUInt32LE(0x04034b50, 0);
    otsake.writeUInt16LE(20, 4);
    otsake.writeUInt16LE(0, 8);                  // menetelmä 0 = pakkaamaton
    otsake.writeUInt32LE(crc, 14);
    otsake.writeUInt32LE(data.length, 18);
    otsake.writeUInt32LE(data.length, 22);
    otsake.writeUInt16LE(nimiBuf.length, 26);
    paikalliset.push(otsake, nimiBuf, data);

    const kh = Buffer.alloc(46);
    kh.writeUInt32LE(0x02014b50, 0);
    kh.writeUInt16LE(20, 4); kh.writeUInt16LE(20, 6);
    kh.writeUInt16LE(0, 10);
    kh.writeUInt32LE(crc, 16);
    kh.writeUInt32LE(data.length, 20);
    kh.writeUInt32LE(data.length, 24);
    kh.writeUInt16LE(nimiBuf.length, 28);
    kh.writeUInt32LE(siirtyma, 42);
    hakemisto.push(kh, nimiBuf);
    siirtyma += 30 + nimiBuf.length + data.length;
  }
  const keskus = Buffer.concat(hakemisto);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(tiedostot).length, 8);
  eocd.writeUInt16LE(Object.keys(tiedostot).length, 10);
  eocd.writeUInt32LE(keskus.length, 12);
  eocd.writeUInt32LE(siirtyma, 16);
  fs.writeFileSync(kohde, Buffer.concat([...paikalliset, keskus, eocd]));
}

const TYOKIRJA = path.join(TYO, 'tyokirja.xlsx');
{
  const jaetut = ['Päivä', 'Myyjä', 'Summa', 'Tuoteryhmä', 'Provisio-%', 'Kaapelit', 'Keskukset'];
  const s = (i) => `t="s"><v>${i}</v>`;
  kirjoitaZip(TYOKIRJA, {
    '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
    'xl/workbook.xml': '<?xml version="1.0"?><workbook><sheets>'
      + '<sheet name="Laskenta" sheetId="1" r:id="rId1"/>'
      + '<sheet name="Kertoimet" sheetId="2" r:id="rId2"/>'
      + '<sheet name="Parametrit (vanha)" sheetId="3" state="hidden" r:id="rId3"/>'
      + '</sheets><definedNames><definedName name="Provisiokanta">Kertoimet!$A$2:$B$3</definedName></definedNames>'
      + '<externalReferences><externalReference r:id="rId9"/></externalReferences></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships>'
      + '<Relationship Id="rId1" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Target="worksheets/sheet2.xml"/>'
      + '<Relationship Id="rId3" Target="worksheets/sheet3.xml"/>'
      + '<Relationship Id="rId9" Target="externalLinks/externalLink1.xml"/>'
      + '</Relationships>',
    // Otsikkorivi on 2 ja yhdistetty — data alkaa vasta riviltä 3.
    'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet>'
      + '<sheetViews><sheetView><pane topLeftCell="A3"/></sheetView></sheetViews>'
      + '<mergeCells><mergeCell ref="A1:C1"/></mergeCells><sheetData>'
      + `<row r="2"><c r="A2" ${s(0)}</c><c r="B2" ${s(1)}</c><c r="C2" ${s(2)}</c></row>`
      + '<row r="3"><c r="A3" t="str"><v>1.3.2025</v></c>'
      + '<c r="B3"><f>IFERROR(VLOOKUP($C3,Kertoimet!$A$2:$B$3,2,FALSE),0)</f><v>0</v></c>'
      + '<c r="C3"><f>IF($A3="Virtanen",$B3*0.03,[1]Budjetti!$B$2)</f><v>1</v></c></row>'
      + '<row r="4"><c r="A4" t="str"><v>2.3.2025</v></c>'
      + '<c r="B4"><f>IFERROR(VLOOKUP($C4,Kertoimet!$A$2:$B$3,2,FALSE),0)</f><v>0</v></c>'
      + '<c r="C4"><f>NOW()</f><v>1</v></c></row>'
      + '</sheetData></worksheet>',
    // Taulukossa on rivi 4, mutta yllä oleva haku päättyy riviin 3.
    'xl/worksheets/sheet2.xml': '<?xml version="1.0"?><worksheet><sheetData>'
      + `<row r="1"><c r="A1" ${s(3)}</c><c r="B1" ${s(4)}</c></row>`
      + `<row r="2"><c r="A2" ${s(5)}</c><c r="B2"><v>0.03</v></c></row>`
      + `<row r="3"><c r="A3" ${s(6)}</c><c r="B3"><v>0.04</v></c></row>`
      + '<row r="4"><c r="A4" t="str"><v>Valaisimet</v></c><c r="B4"><v>0.05</v></c></row>'
      + '</sheetData></worksheet>',
    'xl/worksheets/sheet3.xml': '<?xml version="1.0"?><worksheet><sheetData>'
      + '<row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>',
    'xl/sharedStrings.xml': `<?xml version="1.0"?><sst count="${jaetut.length}">`
      + jaetut.map((x) => `<si><t>${x}</t></si>`).join('') + '</sst>',
    'xl/externalLinks/externalLink1.xml': '<?xml version="1.0"?><externalLink><externalBook>'
      + '<sheetNames><sheetName val="Budjetti"/></sheetNames></externalBook></externalLink>',
    'xl/externalLinks/_rels/externalLink1.xml.rels': '<?xml version="1.0"?><Relationships>'
      + '<Relationship Id="rId1" Target="C:\\Talous\\budjetti%202025.xlsx" TargetMode="External"/>'
      + '</Relationships>',
  });
}

const XLSX_KARTTA = path.join(REPO, 'dist', 'tyokalut', 'xlsx-kartta.mjs');
const osaTuloste = (osa) => {
  const r = ajaNode(XLSX_KARTTA, [TYOKIRJA, '--osa', osa]);
  if (r.status !== 0) virhe(`--osa ${osa} epäonnistui: ${(r.stderr || '').trim()}`);
  return r.stdout || '';
};

{
  const t = osaTuloste('rakenne');
  sisaltaaTeksti('rakenne: piilotettu välilehti merkitään', '[PIILOTETTU]', t);
  sisaltaaTeksti('rakenne: otsikkorivi 2 tunnistetaan', 'otsikkorivi 2:', t);
  sisaltaaTeksti('rakenne: rivisiirtymä sanotaan ääneen', 'data alkaa vasta riviltä 3', t);
  sisaltaaTeksti('rakenne: nimetyt alueet listataan', 'Provisiokanta', t);
}
{
  // Kaksi samanlaista riviä on yksi sääntö — muuten 500-rivinen työkirja
  // tulostaa 500 kertaa saman kaavan eikä logiikkaa erota datasta.
  const t = osaTuloste('kaavat');
  sisaltaaTeksti('kaavat: toistuva kaava tiivistyy yhdeksi säännöksi', '×2', t);
}
{
  const t = osaTuloste('funktiot');
  sisaltaaTeksti('funktiot: funktiot lasketaan', '`VLOOKUP`', t);
  sisaltaaTeksti('funktiot: haihtuvasta funktiosta varoitetaan', 'Haihtuvat funktiot: NOW', t);
}
{
  const t = osaTuloste('arvot');
  sisaltaaTeksti('arvot: parametrivälilehti tulostetaan kokonaan', 'B2=0.03', t);
}
{
  const t = osaTuloste('linkit');
  sisaltaaTeksti('linkit: ulkoinen kohde luetaan (myös välilyönnillinen polku)', 'budjetti 2025.xlsx', t);
  sisaltaaTeksti('linkit: ehdoton polku tunnistetaan', 'ehdoton polku', t);
  sisaltaaTeksti('linkit: viittaavat solut näytetään', 'Laskenta!C3', t);
}
{
  const t = osaTuloste('riskit');
  sisaltaaTeksti('riskit: IFERROR-nielaisu', 'Virheen nielaisu', t);
  sisaltaaTeksti('riskit: hakualue jää taulukkoa lyhyemmäksi', 'Hakualue ei kata koko taulukkoa', t);
  sisaltaaTeksti('riskit: kovakoodattu ehto', 'Kovakoodattu ehto kaavassa', t);
  sisaltaaTeksti('riskit: kovakoodattu luku', 'Kovakoodattu luku kaavassa', t);
  sisaltaaTeksti('riskit: piilotettu välilehti', 'Piilotettu välilehti', t);
  sisaltaaTeksti('riskit: hylätyltä kuulostava nimi', 'Nimi viittaa hylättyyn', t);
  sisaltaaTeksti('riskit: päivämäärä tekstinä', 'Päivämäärä tekstinä', t);
  sisaltaaTeksti('riskit: ulkoinen linkki', 'Ulkoinen linkki toiseen työkirjaan', t);
}
{
  // Import-rajapinta: `rivit()` lukee otsikot sarakkeittain. Jos se ottaisi ne
  // otsikkorivi():n tiivistetystä listasta, tyhjä tai tunnistamaton otsikkorivi
  // siirtäisi arvot väärän nimen alle — hiljainen virhe, jota ei huomaa.
  const { lueTyokirja, valilehti, rivit } = await import(pathToFileURL(XLSX_KARTTA).href);
  const wb = lueTyokirja(TYOKIRJA);
  const r = rivit(valilehti(wb, 'Kertoimet'));
  onSama('import: rivimäärä otsikkorivin alta', '3', String(r.length));
  onSama('import: sarakkeet osuvat otsikoihin', 'Kaapelit', String(r[0]?.['Tuoteryhmä']));
  onSama('import: arvo säilyy lukuna', '0.03', String(r[0]?.['Provisio-%']));
}

// --- Paketin omat linkit ---------------------------------------------------

process.stdout.write('\n'); him('Dokumentaation linkit');
{
  const r = ajaNode(path.join(REPO, 'dist', 'tyokalut', 'tarkista-linkit.mjs'), []);
  const teksti = (r.stdout || '') + (r.stderr || '');
  if (teksti.includes('(0 rikki)')) ok('dist: ei rikkinäisiä linkkejä');
  else { virhe('dist: rikkinäisiä linkkejä'); process.stdout.write(teksti.split('\n').slice(-5).join('\n') + '\n'); }
}

// --- Yhteenveto -----------------------------------------------------------

process.stdout.write('\n');
if (VIRHEITA === 0) {
  ok('Savutesti läpi.');
  process.exit(0);
} else {
  virhe(`Savutesti epäonnistui: ${VIRHEITA} virhettä.`);
  process.exit(1);
}
