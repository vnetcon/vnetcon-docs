#!/usr/bin/env node
// vnetcon-ai — käynnistää tekoälyagentit (Claude / Codex) tälle projektille
// konfiguroidulla tavalla: oma kirjautuminen, oma pilvitili, suora API-avain tai
// organisaation oma välityspalvelin.
//
// Asetukset: vnetcon-docs/vnetcon.config.yaml (osiot agentit, laskutus)
// Tunnisteet: ~/.vnetcon/credentials.env  (EI koskaan tähän hakemistoon)
//
// Tämä tiedosto on toteutus; `vnetcon-ai` (sh) ja `vnetcon-ai.cmd` ovat ohuita
// käynnistimiä. Toimii sellaisenaan Windowsilla ilman bashia.
//
// Ks. ../../metodi/agentit.md ja README.md

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const TYOKALU_DIR = path.dirname(fileURLToPath(import.meta.url));
const JUURI = fs.realpathSync(path.resolve(TYOKALU_DIR, '..', '..'));   // vnetcon-docs/
const KONF = path.join(JUURI, 'vnetcon.config.yaml');
const TUNNISTEET = process.env.VNETCON_CREDENTIALS || path.join(os.homedir(), '.vnetcon', 'credentials.env');
const WIN = process.platform === 'win32';

// Agenteille vietävä ympäristö. valmistele_* täydentää tätä.
const ENV = { ...process.env };

// --- Tuloste ---------------------------------------------------------------

const VARI = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const C_OK = VARI ? '[32m' : '';
const C_VAR = VARI ? '[33m' : '';
const C_VIRHE = VARI ? '[31m' : '';
const C_HIM = VARI ? '[2m' : '';
const C_0 = VARI ? '[0m' : '';

const rivi = (s) => process.stdout.write(s + '\n');
const ok = (s) => rivi(`${C_OK}✓${C_0} ${s}`);
const varo = (s) => rivi(`${C_VAR}!${C_0} ${s}`);
const virhe = (s) => process.stderr.write(`${C_VIRHE}✗${C_0} ${s}\n`);
const him = (s) => rivi(`${C_HIM}${s}${C_0}`);
const kuole = (s) => { virhe(s); process.exit(1); };

// --- Konfiguraation luku ---------------------------------------------------
// Minimaalinen YAML-lukija: tukee sisennettyjä skalaariavaimia (2 välilyöntiä
// per taso), joka riittää vnetcon.config.yaml:lle. Polku pisteillä:
//   konf('agentit.claude.base_url')

let KONF_RIVIT = null;

function konf(want) {
  if (!fs.existsSync(KONF)) return '';
  if (KONF_RIVIT === null) {
    KONF_RIVIT = fs.readFileSync(KONF, 'utf8').replace(/^﻿/, '').split('\n');
  }
  const polku = [];
  for (const raaka of KONF_RIVIT) {
    if (/^\s*#/.test(raaka)) continue;
    if (/^\s*$/.test(raaka)) continue;
    let line = raaka.replace(/\r$/, '');                 // CRLF-checkout Windowsilla
    const ind = (line.match(/^ */) || [''])[0].length;
    line = line.replace(/[ \t]+#.*$/, '');
    if (!/^ *[A-Za-z0-9_.-]+:/.test(line)) continue;
    const key = line.replace(/^ */, '').replace(/:.*$/, '');
    let val = line.replace(/^ *[A-Za-z0-9_.-]+:[ \t]*/, '');
    const lvl = Math.floor(ind / 2);
    polku[lvl] = key;
    polku.length = lvl + 1;
    const full = polku.map((p) => (p === undefined ? '' : p)).join('.');
    if (full === want) {
      val = val.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      if (val !== '' && val !== '[]' && val !== '{}') return val;
    }
  }
  return '';
}

const konfTai = (want, oletus) => { const v = konf(want); return v !== '' ? v : oletus; };

// Projektin juuri: konfiguraatiosta jos annettu, muuten vnetcon-docsin yläkansio.
let PROJEKTI;
{
  const jk = konf('projekti.juuri');
  const ehdokas = jk ? path.join(JUURI, jk) : '';
  const onHakemisto = Boolean(ehdokas) && fs.existsSync(ehdokas) && fs.statSync(ehdokas).isDirectory();
  PROJEKTI = fs.realpathSync(onHakemisto ? ehdokas : path.join(JUURI, '..'));
}

// --- Tunnisteet ------------------------------------------------------------

const tunnisteMuuttuja = (lahde) => (lahde.includes(':') ? lahde.slice(lahde.lastIndexOf(':') + 1) : lahde);

function tunnisteTiedosto(lahde) {
  // Eksplisiittinen ympäristöoverride voittaa konfiguraation polun (CI, testit).
  if (process.env.VNETCON_CREDENTIALS) return process.env.VNETCON_CREDENTIALS;
  const f = lahde.includes(':') ? lahde.slice(0, lahde.indexOf(':')) : TUNNISTEET;
  return f.startsWith('~') ? path.join(os.homedir(), f.slice(1)) : f;
}

function haeTunniste(lahde) {   // → arvo tai ''
  if (!lahde) return '';
  const muuttuja = tunnisteMuuttuja(lahde);
  if (!muuttuja) return '';
  // 1) ympäristö voittaa (CI, väliaikainen override)
  if (process.env[muuttuja]) return process.env[muuttuja];
  // 2) tunnistetiedosto
  const f = tunnisteTiedosto(lahde);
  if (!fs.existsSync(f)) return '';
  const hahmo = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${muuttuja}=(.*)$`);
  let arvo = '';
  for (const r of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = r.replace(/\r$/, '').match(hahmo);
    if (m) arvo = m[1];                                   // viimeinen osuma voittaa
  }
  return arvo.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

// --- Apurit ----------------------------------------------------------------

// command -v: etsii binäärin PATHista (Windowsilla PATHEXT-järjestyksessä,
// jolloin .exe voittaa .cmd:n — se välttää komentotulkin argumenttilainaukset).
function mista(bin) {
  if (!bin) return '';
  if (bin.includes('/') || bin.includes('\\') || path.isAbsolute(bin)) {
    return fs.existsSync(bin) ? bin : '';
  }
  const paatteet = WIN
    ? ['', ...(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
    : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const p of paatteet) {
      const ehdokas = path.join(dir, bin + p);
      try {
        const st = fs.statSync(ehdokas);
        if (st.isFile() && (WIN || (st.mode & 0o111))) return ehdokas;
      } catch { /* ohita */ }
    }
  }
  return '';
}

function aja(bin, args, opts = {}) {
  return spawnSync(bin, args, { encoding: 'utf8', ...opts });
}

function versioRivi(bin) {
  const r = aja(bin, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
  if (r.error || !r.stdout) return '';
  return r.stdout.split('\n')[0].trim();
}

function gitOk(args) {
  const r = aja('git', args, { stdio: ['ignore', 'pipe', 'ignore'] });
  return !r.error && r.status === 0;
}

function gitTuloste(args) {
  const r = aja('git', args, { stdio: ['ignore', 'pipe', 'ignore'] });
  if (r.error || r.status !== 0 || !r.stdout) return '';
  return r.stdout.trim();
}

// Vastaa bashin `ls -l | cut -c1-10` -tulostetta.
function oikeusmerkkijono(tiedosto) {
  const m = fs.statSync(tiedosto).mode;
  const b = (bitti, merkki) => ((m & bitti) ? merkki : '-');
  return '-'
    + b(0o400, 'r') + b(0o200, 'w') + b(0o100, 'x')
    + b(0o040, 'r') + b(0o020, 'w') + b(0o010, 'x')
    + b(0o004, 'r') + b(0o002, 'w') + b(0o001, 'x');
}

// --- Käyttölokitus (laskutus) ---------------------------------------------

function kirjaaKaytto(komento, agentti, kestoS, tulos) {
  const loki = konf('laskutus.kaytto_loki');
  if (!loki) return;
  const asiakas = konfTai('laskutus.asiakas', '');
  const kohde = path.isAbsolute(loki) ? loki : path.join(JUURI, loki);
  try { fs.mkdirSync(path.dirname(kohde), { recursive: true }); } catch { return; }
  const aika = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const json = `{"aika":"${aika}","asiakas":"${asiakas}","projekti":"${path.basename(PROJEKTI)}",`
    + `"komento":"${komento}","agentti":"${agentti}","kesto_s":${kestoS},"tulos":"${tulos}"}\n`;
  try { fs.appendFileSync(kohde, json); } catch { /* laskutus ei saa kaataa ajoa */ }
}

// --- Agenttien ympäristö ---------------------------------------------------

// Asettaa Claude Coden ympäristömuuttujat tarjoajan mukaan.
// Tulostaa puuttuvat asiat varoituksina; ei kaadu.
function valmisteleClaude() {
  const tarjoaja = konfTai('agentit.claude.tarjoaja', 'oma');
  const malli = konf('agentit.claude.malli');
  const base = konf('agentit.claude.base_url');
  const tokenLahde = konf('agentit.claude.token_lahde');
  const alue = konf('agentit.claude.alue');
  const projektiId = konf('agentit.claude.projekti_id');

  switch (tarjoaja) {
    case 'oma':
      break;
    case 'gateway': {
      // Asiakkaan oma sisäinen välityspalvelin (bearer-tunniste). Ei Vnetconin palvelua.
      if (!base) kuole(`agentit.claude.base_url puuttuu (tarjoaja=${tarjoaja}). Aja /agentit.`);
      ENV.ANTHROPIC_BASE_URL = base;
      const token = haeTunniste(tokenLahde);
      if (token) ENV.ANTHROPIC_AUTH_TOKEN = token;
      else varo(`Claude-tunniste puuttuu (${tokenLahde}). Aja: vnetcon-ai tunnisteet --alusta`);
      break;
    }
    case 'anthropic-api': {
      const token = haeTunniste(tokenLahde);
      if (base) ENV.ANTHROPIC_BASE_URL = base;
      if (token) ENV.ANTHROPIC_API_KEY = token;
      else varo(`Anthropic API -avain puuttuu (${tokenLahde}).`);
      break;
    }
    case 'bedrock':
      ENV.CLAUDE_CODE_USE_BEDROCK = '1';
      if (alue) ENV.AWS_REGION = alue;
      break;
    case 'vertex':
      ENV.CLAUDE_CODE_USE_VERTEX = '1';
      if (alue) ENV.CLOUD_ML_REGION = alue;
      if (projektiId) ENV.ANTHROPIC_VERTEX_PROJECT_ID = projektiId;
      break;
    default:
      varo(`Tuntematon agentit.claude.tarjoaja: ${tarjoaja} — käytetään omaa kirjautumista.`);
  }

  if (malli) ENV.ANTHROPIC_MODEL = malli;

  const otel = konf('laskutus.otel_endpoint');
  if (otel) {
    ENV.CLAUDE_CODE_ENABLE_TELEMETRY = '1';
    ENV.OTEL_METRICS_EXPORTER = process.env.OTEL_METRICS_EXPORTER || 'otlp';
    ENV.OTEL_EXPORTER_OTLP_PROTOCOL = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http/protobuf';
    ENV.OTEL_EXPORTER_OTLP_ENDPOINT = otel;
  }
}

// Codexin tarjoaja annetaan -c-parametreina, jotta käyttäjän ~/.codex/config.toml
// pysyy koskemattomana.
let CODEX_ARGS = [];

function valmisteleCodex() {
  CODEX_ARGS = [];
  const tarjoaja = konfTai('agentit.codex.tarjoaja', 'oma');
  const malli = konf('agentit.codex.malli');
  const base = konf('agentit.codex.base_url');
  const tokenLahde = konf('agentit.codex.token_lahde');
  const wire = konfTai('agentit.codex.wire_api', 'chat');
  const tunnus = konfTai('agentit.codex.tarjoajan_tunnus', 'mukautettu');

  switch (tarjoaja) {
    case 'oma':
      break;
    case 'gateway':
    case 'openai-api':
    case 'azure': {
      const muuttuja = tunnisteMuuttuja(tokenLahde);
      const token = haeTunniste(tokenLahde);
      if (token && muuttuja) ENV[muuttuja] = token;
      else varo(`Codex-tunniste puuttuu (${tokenLahde}). Aja: vnetcon-ai tunnisteet --alusta`);
      if (base) {
        if (!muuttuja) kuole('agentit.codex.token_lahde puuttuu (tarvitaan env_key).');
        // Arvot lainausmerkeissä, jotta ne jäsentyvät TOML-merkkijonoiksi.
        CODEX_ARGS.push('-c', `model_provider="${tunnus}"`);
        CODEX_ARGS.push('-c', `model_providers.${tunnus}.name="${tunnus}"`);
        CODEX_ARGS.push('-c', `model_providers.${tunnus}.base_url="${base}"`);
        CODEX_ARGS.push('-c', `model_providers.${tunnus}.env_key="${muuttuja}"`);
        CODEX_ARGS.push('-c', `model_providers.${tunnus}.wire_api="${wire}"`);
      }
      break;
    }
    default:
      varo(`Tuntematon agentit.codex.tarjoaja: ${tarjoaja} — käytetään omaa kirjautumista.`);
  }

  if (malli) CODEX_ARGS.push('-m', malli);
}

const komentoClaude = () => konfTai('agentit.claude.komento', 'claude');
const komentoCodex = () => konfTai('agentit.codex.komento', 'codex');

// --- Agentin ajo -----------------------------------------------------------

function ajaAgentti(agentti, hakemisto, kehote, args, komentoNimi) {
  const alku = Date.now();
  let bin;
  let lisa = [];

  if (agentti === 'claude') {
    bin = komentoClaude();
    if (!mista(bin)) kuole(`Komentoa '${bin}' ei löydy. Asenna Claude Code tai aseta agentit.claude.komento.`);
    valmisteleClaude();
    him(`→ ${bin}  (hakemisto: ${hakemisto})`);
  } else if (agentti === 'codex') {
    bin = komentoCodex();
    if (!mista(bin)) kuole(`Komentoa '${bin}' ei löydy. Asenna Codex CLI tai aseta agentit.codex.komento.`);
    valmisteleCodex();
    lisa = CODEX_ARGS;
    him(`→ ${bin} ${CODEX_ARGS.join(' ')}  (hakemisto: ${hakemisto})`);
  } else {
    kuole(`Tuntematon agentti: ${agentti} (odotettiin claude tai codex)`);
  }

  const argv = [...lisa, ...args];
  if (kehote) argv.push(kehote);

  const polku = mista(bin);
  // Windowsilla .cmd/.bat vaatii komentotulkin; .exe ajetaan suoraan, jolloin
  // monirivinen kehote välittyy sellaisenaan.
  const tarvitseeKuoren = WIN && /\.(cmd|bat)$/i.test(polku);
  const r = spawnSync(polku, argv, {
    cwd: hakemisto,
    stdio: 'inherit',
    env: ENV,
    shell: tarvitseeKuoren,
  });

  const tulos = (!r.error && r.status === 0) ? 'ok' : 'virhe';
  kirjaaKaytto(komentoNimi || process.env.VNETCON_KOMENTO || 'aja', agentti,
    Math.round((Date.now() - alku) / 1000), tulos);
  if (tulos !== 'ok') process.exit(1);
}

// --- Komennot --------------------------------------------------------------

function cmdDoctor() {
  rivi('vnetcon-docs — tarkistus');
  him(`projekti:      ${PROJEKTI}`);
  him(`vnetcon-docs:  ${JUURI}`);
  rivi('');

  if (fs.existsSync(KONF)) {
    ok('vnetcon.config.yaml löytyy');
    const nimi = konf('projekti.nimi');
    if (nimi) him(`  projekti.nimi: ${nimi}`);
  } else {
    varo('vnetcon.config.yaml PUUTTUU — aja Claudessa /vnetcon-init');
  }

  const projektiYaml = path.join(JUURI, 'tila', 'projekti.yaml');
  let taytetty = false;
  if (fs.existsSync(projektiYaml)) {
    try { taytetty = !fs.readFileSync(projektiYaml, 'utf8').includes('TÄYTTÄMÄTÖN'); } catch { taytetty = false; }
  }
  if (taytetty) ok('tila/projekti.yaml täytetty');
  else varo('tila/projekti.yaml on täyttämätön — käyttöönotto kesken (/vnetcon-init)');

  if (!mista('git')) {
    varo('git EI ole asennettu — skooppi (git ls-files) ja synkronointi eivät toimi');
    him('  Windowsilla: asenna Git for Windows — se tuo sekä gitin että bashin');
  } else if (fs.existsSync(path.join(PROJEKTI, '.git')) || gitOk(['-C', PROJEKTI, 'rev-parse', '--git-dir'])) {
    ok(`projekti on git-repo (${gitTuloste(['-C', PROJEKTI, 'rev-parse', '--abbrev-ref', 'HEAD']) || '?'})`);
  } else {
    varo('projekti EI ole git-repo — aseta projekti.versionhallinta: none');
  }
  rivi('');

  for (const a of ['claude', 'codex']) {
    const bin = a === 'claude' ? komentoClaude() : komentoCodex();
    const polku = mista(bin);
    if (polku) ok(`${a} asennettu: ${polku}  ${versioRivi(polku)}`);
    else varo(`${a} EI asennettu (komento: ${bin})`);

    const tarjoaja = konfTai(`agentit.${a}.tarjoaja`, 'oma');
    him(`  tarjoaja: ${tarjoaja}`);
    const base = konf(`agentit.${a}.base_url`);
    if (base) him(`  base_url: ${base}`);
    const malli = konf(`agentit.${a}.malli`);
    if (malli) him(`  malli:    ${malli}`);

    if (tarjoaja !== 'oma') {
      const lahde = konf(`agentit.${a}.token_lahde`);
      if (!lahde) {
        varo('  token_lahde puuttuu konfiguraatiosta');
      } else {
        const t = haeTunniste(lahde);
        if (t) ok(`  tunniste löytyy (${tunnisteMuuttuja(lahde)}, ${t.length} merkkiä)`);
        else varo(`  tunniste PUUTTUU: ${lahde}`);
      }
    }
  }
  rivi('');

  him('työnjako:');
  him(`  dokumentointi: ${konfTai('agentit.dokumentointi', 'claude')}`);
  him(`  toteutus:      ${konfTai('agentit.toteutus', 'codex')}`);
  him(`  päivitys:      ${konfTai('agentit.paivitys', 'codex')}`);
  rivi('');

  if (fs.existsSync(path.join(JUURI, 'kalibrointiraportti.md'))) ok('kalibrointiraportti.md löytyy');
  else varo('kalibrointiraporttia ei ole — aja: vnetcon-ai kalibroi');

  ok(`node ${process.version}`);

  if (fs.existsSync(path.join(TYOKALU_DIR, '..', 'html-generaattori', 'node_modules'))) {
    ok('html-generaattorin riippuvuudet asennettu');
  } else {
    varo(`html-generaattori: aja  cd ${path.join(JUURI, 'tyokalut', 'html-generaattori')} && npm install`);
  }

  if (fs.existsSync(TUNNISTEET)) {
    if (WIN) {
      // Windowsilla POSIX-oikeusbitit eivät kerro mitään — ACL ratkaisee.
      ok(`tunnistetiedosto: ${TUNNISTEET}`);
      him('  Windows: rajaa oikeudet tiedoston ominaisuuksista (vain oma käyttäjä).');
    } else {
      const oik = oikeusmerkkijono(TUNNISTEET);
      ok(`tunnistetiedosto: ${TUNNISTEET} (${oik})`);
      if (oik !== '-rw-------') varo(`  oikeudet väljät — aja: chmod 600 ${TUNNISTEET}`);
    }
  } else {
    him(`tunnistetiedostoa ei ole: ${TUNNISTEET} (tarvitaan vain pilvitarjoajilla)`);
  }
}

const POHJA_TUNNISTEET = `# Vnetcon-tunnisteet. TÄTÄ TIEDOSTOA EI KOSKAAN VIEDÄ VERSIONHALLINTAAN.
# Täytä vain ne rivit, joita projektisi konfiguraatio käyttää
# (vnetcon.config.yaml → agentit.*.token_lahde).

VNETCON_ANTHROPIC_TOKEN=
VNETCON_OPENAI_TOKEN=
`;

function cmdTunnisteet(args) {
  if (args[0] === '--alusta') {
    fs.mkdirSync(path.dirname(TUNNISTEET), { recursive: true });
    if (fs.existsSync(TUNNISTEET)) {
      varo(`${TUNNISTEET} on jo olemassa — ei ylikirjoiteta.`);
    } else {
      fs.writeFileSync(TUNNISTEET, POHJA_TUNNISTEET, { mode: 0o600 });
      try { fs.chmodSync(TUNNISTEET, 0o600); } catch { /* Windows: ACL ratkaisee */ }
      ok(`Luotiin ${TUNNISTEET} (oikeudet 600). Täytä arvot editorilla.`);
    }
    him(`Avaa esim.:  \${EDITOR:-nano} ${TUNNISTEET}`);
    return;
  }
  him(`Tunnistetiedosto: ${TUNNISTEET}`);
  if (fs.existsSync(TUNNISTEET)) {
    for (const r of fs.readFileSync(TUNNISTEET, 'utf8').split('\n')) {
      const m = r.replace(/\r$/, '').match(/^[ \t]*(?:export[ \t]+)?([A-Z_][A-Z0-9_]*)=/);
      if (m) rivi(`  ${m[1]} = (asetettu)`);
    }
  } else {
    varo('ei ole olemassa — luo: vnetcon-ai tunnisteet --alusta');
  }
}

function cmdToken(args) {   // tulostaa tunnisteen (apiKeyHelperille) — ei mitään muuta
  const a = args[0] || 'claude';
  const lahde = konf(`agentit.${a}.token_lahde`);
  if (!lahde) process.exit(1);
  const t = haeTunniste(lahde);
  if (!t) process.exit(1);
  process.stdout.write(t);
}

function cmdHtml(args) {
  const gen = path.join(JUURI, 'tyokalut', 'html-generaattori');
  let zip = false;
  const genArgs = [];
  for (const a of args) {
    if (a === '--zip') zip = true; else genArgs.push(a);
  }
  if (!fs.existsSync(path.join(gen, 'node_modules'))) {
    varo(`node_modules puuttuu — haku ja kaaviot eivät toimi. Aja: (cd ${gen} && npm install)`);
  }
  const r = spawnSync(process.execPath, ['generoi.mjs', ...genArgs], { cwd: gen, stdio: 'inherit' });
  if (r.error || r.status !== 0) process.exit(r.status || 1);

  if (zip) {
    const kohde = path.join(JUURI, 'html.zip');
    try { fs.rmSync(kohde, { force: true }); } catch { /* ohita */ }
    let z;
    if (mista('zip')) {
      z = spawnSync('zip', ['-rq', 'html.zip', 'html'], { cwd: JUURI, stdio: 'inherit' });
    } else if (mista('tar')) {
      // bsdtar (Windows 10+, macOS) kirjoittaa zipin päätteen perusteella (-a).
      z = spawnSync('tar', ['-a', '-c', '-f', 'html.zip', 'html'], { cwd: JUURI, stdio: 'inherit' });
    } else {
      kuole('zip-komento puuttuu (asenna zip tai paketoi käsin).');
    }
    if (z.error || z.status !== 0) kuole('Paketointi epäonnistui.');
    ok(`Paketoitiin ${kohde}`);
  }
  kirjaaKaytto('html', '-', 0, 'ok');
}

function ajaNode(skripti, args) {
  const r = spawnSync(process.execPath, [path.join(JUURI, 'tyokalut', skripti), ...args], { stdio: 'inherit' });
  if (r.error) kuole(`Ei voitu ajaa ${skripti}: ${r.error.message}`);
  if (r.status !== 0) process.exit(r.status || 1);
}

function cmdToteuta(args) {
  const tunnus = args[0] || '';
  if (!tunnus) kuole('Käyttö: vnetcon-ai toteuta <tiketin-tunnus>');
  const dir = path.join(JUURI, 'tiketit', tunnus);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    kuole(`Tikettihakemistoa ei ole: ${dir} (aja Claudessa /valmistele-tiketti)`);
  }
  let kehote = '';
  for (const f of [path.join(dir, 'codex-kehote.md'), path.join(dir, 'toteutuskehote.md')]) {
    if (fs.existsSync(f)) { kehote = f; break; }
  }
  const agentti = konfTai('agentit.toteutus', 'codex');
  let teksti;
  if (kehote) {
    teksti = fs.readFileSync(kehote, 'utf8');
  } else {
    varo(`Valmista kehotetta ei löytynyt (${path.join(dir, 'codex-kehote.md')}) — annetaan geneerinen ohje.`);
    teksti = `Toteuta tiketti ${tunnus}. Lue ensin vnetcon-docs/metodi/tiketti-tyonkulku.md ja vnetcon-docs/metodi/konventiot.md sekä kaikki tiedostot hakemistosta vnetcon-docs/tiketit/${tunnus}/. Jatka siitä vaiheesta, joka on kesken. Jos suunnitelma on jo hyväksytty toisessa sessiossa, aloita vaiheesta 3b (vastaanottoportti): tarkista suunnitelma koodia vasten, esitä toteutus, eriävät kohdat ja avoimet kysymykset, ja odota lupaa ennen koodimuutoksia. Älä committaa ilman lupaa.`;
  }
  ajaAgentti(agentti, PROJEKTI, teksti, [], `toteuta:${tunnus}`);
}

function cmdDokumentoi(args) {
  const moduuli = args[0] || '';
  const agentti = konfTai('agentit.dokumentointi', 'claude');
  const komentoNimi = `dokumentoi${moduuli ? ':' + moduuli : ''}`;
  if (agentti === 'claude') {
    ajaAgentti('claude', JUURI, `/dokumentoi${moduuli ? ' ' + moduuli : ''}`, [], komentoNimi);
  } else {
    const teksti = `Dokumentoi ${moduuli || 'seuraava tekemätön moduuli'} vnetcon-docs-järjestelmään. Lue ensin vnetcon-docs/metodi/tyonkulku.md, vnetcon-docs/metodi/konventiot.md, vnetcon-docs/metodi/kartoitus.md ja vnetcon-docs/tila/rekisteri.yaml, ja seuraa työnkulkua vaihe vaiheelta. Älä committaa ilman lupaa.`;
    ajaAgentti(agentti, PROJEKTI, teksti, [], komentoNimi);
  }
}

function cmdAsennaKehotteet() {
  const dir = path.join(os.homedir(), '.codex', 'prompts');
  fs.mkdirSync(dir, { recursive: true });
  const lahde = path.join(TYOKALU_DIR, 'codex-kehotteet');
  const tiedostot = fs.existsSync(lahde)
    ? fs.readdirSync(lahde).filter((f) => f.endsWith('.md')).sort()
    : [];
  let n = 0;
  for (const f of tiedostot) {
    const sisalto = fs.readFileSync(path.join(lahde, f), 'utf8').split('__VNETCON_DOCS__').join(JUURI);
    fs.writeFileSync(path.join(dir, `vnetcon-${f}`), sisalto);
    n += 1;
  }
  if (n > 0) {
    ok(`Asennettiin ${n} kehotetta hakemistoon ${dir}`);
    him('Käytettävissä Codexissa: /vnetcon-tiketti, /vnetcon-dokumentoi, /vnetcon-synkronoi');
    varo('Kehotteet ovat GLOBAALEJA ja sisältävät tämän projektin polun.');
  } else {
    varo(`Ei kehotteita hakemistossa ${lahde}`);
  }
}

function cmdKonfig() {
  if (!fs.existsSync(KONF)) kuole('vnetcon.config.yaml puuttuu — aja /vnetcon-init.');
  rivi(`projekti.nimi            ${konfTai('projekti.nimi', '-')}`);
  rivi(`agentit.dokumentointi   ${konfTai('agentit.dokumentointi', 'claude')}`);
  rivi(`agentit.toteutus        ${konfTai('agentit.toteutus', 'codex')}`);
  rivi(`agentit.paivitys        ${konfTai('agentit.paivitys', 'codex')}`);
  for (const a of ['claude', 'codex']) {
    rivi(`agentit.${a}.tarjoaja ${konfTai(`agentit.${a}.tarjoaja`, 'oma')}`);
    rivi(`agentit.${a}.base_url ${konfTai(`agentit.${a}.base_url`, '-')}`);
    rivi(`agentit.${a}.malli    ${konfTai(`agentit.${a}.malli`, '(oletus)')}`);
  }
  rivi(`laskutus.asiakas        ${konfTai('laskutus.asiakas', '-')}`);
  rivi(`laskutus.otel_endpoint  ${konfTai('laskutus.otel_endpoint', '-')}`);
  him('(tunnisteita ei näytetä — ks. vnetcon-ai tunnisteet)');
}

function kaytto() {
  rivi(`vnetcon-ai — tekoälyagenttien käynnistys tälle projektille

Käyttö: vnetcon-ai <komento> [argumentit]

  doctor                  Tarkista asennus, konfiguraatio ja tunnisteet
  kalibroi                Kartoita projekti ja kirjoita kalibrointiraportti
  moduulit [--tekematta]  Listaa moduulit ja dokumentointitila (+ mikä seuraavaksi)
  claude [args...]        Käynnistä Claude vnetcon-docs-hakemistossa
  codex [args...]         Käynnistä Codex projektin juuressa
  dokumentoi [moduuli]    Käynnistä dokumentointiagentti
  toteuta <tunnus>        Käynnistä toteutusagentti tiketin valmiilla kehotteella
  html [--zip]            Generoi selattava HTML (ja paketoi)
  linkit [--lahteet]      Tarkista dokumentaation linkit ja lähdepolut
  tunnisteet [--alusta]   Näytä / luo ~/.vnetcon/credentials.env
  token <claude|codex>    Tulosta tunniste (Claude Coden apiKeyHelperille)
  asenna-kehotteet        Asenna Codex-slash-kehotteet ~/.codex/prompts/
  konfig                  Näytä tehokas konfiguraatio (ilman salaisuuksia)

Asetukset: ${KONF}
Tunnisteet: ${TUNNISTEET}
Ks. myös: ${path.join(JUURI, 'metodi', 'agentit.md')}`);
}

// --- Reititys --------------------------------------------------------------

const argv = process.argv.slice(2);
const komento = argv.length > 0 ? argv[0] : '';
const args = argv.slice(1);

switch (komento) {
  case 'doctor':
  case 'tarkista':
    cmdDoctor();
    break;
  case 'claude':
    ajaAgentti('claude', JUURI, '', args, 'claude');
    break;
  case 'codex':
    ajaAgentti('codex', PROJEKTI, '', args, 'codex');
    break;
  case 'dokumentoi':
    cmdDokumentoi(args);
    break;
  case 'toteuta':
    cmdToteuta(args);
    break;
  case 'html':
    cmdHtml(args);
    break;
  case 'linkit':
    ajaNode('tarkista-linkit.mjs', args);
    break;
  case 'kalibroi':
    ajaNode('kalibroi.mjs', args);
    break;
  case 'moduulit':
    ajaNode('moduulit.mjs', args);
    break;
  case 'tunnisteet':
    cmdTunnisteet(args);
    break;
  case 'token':
    cmdToken(args);
    break;
  case 'asenna-kehotteet':
    cmdAsennaKehotteet();
    break;
  case 'konfig':
    cmdKonfig();
    break;
  case '':
  case '-h':
  case '--help':
  case 'help':
    kaytto();
    break;
  default:
    virhe(`Tuntematon komento: ${komento}`);
    rivi('');
    kaytto();
    process.exit(1);
}
