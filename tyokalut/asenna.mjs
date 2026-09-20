#!/usr/bin/env node
// Asentaa vnetcon-docs-paketin kohdeprojektin juureen.
//
//   node tyokalut/asenna.mjs <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]
//
// Windowsilla sama komento toimii sellaisenaan PowerShellissa. `asenna.sh` on
// ohut käynnistin tälle tiedostolle.
//
// Ks. asenna.sh / asenna.cmd.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYOKALU_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = fs.realpathSync(path.resolve(TYOKALU_DIR, '..'));
const DIST = path.join(REPO, 'dist');

let VERSIO = 'tuntematon';
try { VERSIO = fs.readFileSync(path.join(REPO, 'VERSIO'), 'utf8').trim() || 'tuntematon'; } catch { /* ohita */ }

const OHJE = `Asentaa vnetcon-docs-paketin kohdeprojektin juureen.

  tyokalut/asenna.sh <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]
  (Windows: node tyokalut\\asenna.mjs <polku> [--paivita] [--nimi <hakemisto>])

Oletus: luo <kohde>/vnetcon-docs. Jos hakemisto on jo olemassa, komento
keskeytyy ellei anneta --paivita, joka päivittää vain MOOTTORIN ja jättää
projektin oman sisällön koskematta.

--paivita säilyttää aina:
  vnetcon.config.yaml, tila/, johdanto.md, moduulit/, liiketoimintaprosessit/,
  jarjestelmaprosessit/, datamallit/, tiketit/, html/,
  metodi/kartoitus.md, metodi/sanasto.md, .claude/settings.json
ja päivittää: metodi/** (muut), tyokalut/**, .claude/skills|workflows (paketin
  omat), CLAUDE.md, AGENTS.md, README.md, vnetcon.config.example.yaml, .gitignore`;

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
const him = (s) => rivi(`${C_HIM}${s}${C_0}`);
const kuole = (s) => { process.stderr.write(`${C_VIRHE}✗${C_0} ${s}\n`); process.exit(1); };

// --- Argumentit ------------------------------------------------------------

let KOHDE = '';
let PAIVITA = false;
let NIMI = 'vnetcon-docs';

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--paivita') {
    PAIVITA = true;
  } else if (a === '--nimi') {
    NIMI = argv[i + 1];
    if (!NIMI) kuole('--nimi vaatii arvon');
    i += 1;
  } else if (a === '-h' || a === '--help') {
    rivi(OHJE);
    process.exit(0);
  } else if (a.startsWith('-')) {
    kuole(`Tuntematon lippu: ${a}`);
  } else if (KOHDE) {
    kuole('Anna vain yksi kohdepolku.');
  } else {
    KOHDE = a;
  }
}

if (!KOHDE) kuole('Käyttö: asenna.sh <kohdeprojektin-polku> [--paivita] [--nimi <hakemisto>]');
if (!fs.existsSync(DIST) || !fs.statSync(DIST).isDirectory()) kuole(`dist/ puuttuu repossa: ${DIST}`);
if (!fs.existsSync(KOHDE) || !fs.statSync(KOHDE).isDirectory()) kuole(`Kohdehakemistoa ei ole: ${KOHDE}`);

KOHDE = fs.realpathSync(KOHDE);
const MAALI = path.join(KOHDE, NIMI);

if (KOHDE === REPO) kuole('Kohde on tämä repo itse — asenna johonkin toiseen projektiin.');

// --- Apurit ----------------------------------------------------------------

function suorituskelpoiset() {
  if (process.platform === 'win32') return;   // ei suoritusbittiä
  for (const f of ['vnetcon-ai', 'vnetcon-ai.mjs', 'hae-token.sh', 'hae-token.mjs']) {
    const p = path.join(MAALI, 'tyokalut', 'vnetcon-ai', f);
    try { fs.chmodSync(p, 0o755); } catch { /* ei pakollinen */ }
  }
}

// Kopioi paketin oman tiedoston tai hakemiston päälle.
// Ei poista projektin omia lisäyksiä.
function paalle(suhteellinen) {
  const src = path.join(DIST, suhteellinen);
  if (!fs.existsSync(src)) return;
  const kohde = path.join(MAALI, suhteellinen);
  fs.mkdirSync(path.dirname(kohde), { recursive: true });
  fs.cpSync(src, kohde, { recursive: true, force: true });
}

const samat = (a, b) => {
  try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch { return false; }
};

// --- Uusi asennus ---------------------------------------------------------

if (!fs.existsSync(MAALI)) {
  fs.mkdirSync(MAALI, { recursive: true });
  fs.cpSync(DIST, MAALI, { recursive: true, force: true });
  fs.writeFileSync(path.join(MAALI, '.vnetcon-docs-versio'), VERSIO + '\n');
  suorituskelpoiset();
  ok(`Asennettiin vnetcon-docs ${VERSIO} → ${MAALI}`);
  rivi('');
  him('Seuraavat askeleet:');
  // Polut ja ketjutus alustan mukaan: Windows-käyttäjälle ei näytetä
  // ./-alkuisia polkuja eikä &&-ketjutusta, jotka eivät toimi PowerShellissa.
  const cli = process.platform === 'win32'
    ? 'tyokalut\\vnetcon-ai\\vnetcon-ai.cmd'
    : './tyokalut/vnetcon-ai/vnetcon-ai';
  rivi(`  1) cd "${MAALI}"
  2) claude                       # tai: ${cli} claude
  3) Clauden syötekenttään:  /vnetcon-init

Tarkistus ilman agenttia:  cd "${MAALI}"
                           ${cli} doctor
Käyttöohje:                ${path.join(MAALI, 'README.md')}`);
  process.exit(0);
}

// --- Moottorin päivitys ---------------------------------------------------

if (!PAIVITA) kuole(`${MAALI} on jo olemassa. Päivitä moottori: asenna.sh "${KOHDE}" --paivita`);

let VANHA = 'tuntematon';
try { VANHA = fs.readFileSync(path.join(MAALI, '.vnetcon-docs-versio'), 'utf8').trim() || 'tuntematon'; } catch { /* ohita */ }
him(`Päivitetään moottori: ${VANHA} → ${VERSIO}  (${MAALI})`);

// Projektin omat tiedostot, joita paketti EI koskaan ylikirjoita.
const SUOJATUT = ['metodi/kartoitus.md', 'metodi/sanasto.md', '.claude/settings.json'];

const TALLE = fs.mkdtempSync(path.join(os.tmpdir(), 'vnetcon-asenna-'));
const siivoa = () => { try { fs.rmSync(TALLE, { recursive: true, force: true }); } catch { /* ohita */ } };
process.on('exit', siivoa);

for (const p of SUOJATUT) {
  const lahde = path.join(MAALI, ...p.split('/'));
  if (!fs.existsSync(lahde) || !fs.statSync(lahde).isFile()) continue;
  const kohde = path.join(TALLE, ...p.split('/'));
  fs.mkdirSync(path.dirname(kohde), { recursive: true });
  fs.copyFileSync(lahde, kohde);
}

// HUOM: tila/metodi.yaml on MOOTTORIA vaikka se asuu tila/-hakemistossa.
// Menettelyn versio ja muutosloki ovat samat kaikille projekteille, ja
// /yhdenmukaista-dokumentaatio vertaa dokumenttien metodi-versiota juuri siihen
// lukuun. Jos tiedostoa ei päivitetä, versionumero jää vanhaan ja yhdenmukaistus
// ei löydä mitään tehtävää — menettelymuutos ei koskaan saavuta projektia.
for (const p of ['metodi', 'tyokalut', '.claude/skills', '.claude/workflows', 'tila/metodi.yaml',
  'CLAUDE.md', 'AGENTS.md', 'README.md', 'vnetcon.config.example.yaml', '.gitignore']) {
  paalle(p);
}

// Palauta suojatut tiedostot. metodi/kartoitus.md ja metodi/sanasto.md ovat
// projektin sisältöä (paketin versio on pelkkä pohja) → palautetaan hiljaisesti.
// .claude/settings.json voi sisältää sekä paketin sääntöjä että projektin
// pilviasetuksia → paketin uusi versio jätetään viereen yhdistettäväksi.
for (const p of SUOJATUT) {
  const talle = path.join(TALLE, ...p.split('/'));
  if (!fs.existsSync(talle)) continue;
  const kohde = path.join(MAALI, ...p.split('/'));
  // settings.json ei ole kopioitavien listalla, joten kohteessa on yhä projektin
  // oma versio. Vertaa siksi PAKETIN versioon — muuten uudet säännöt (esim.
  // PowerShell-oikeudet) eivät päätyisi olemassa olevaan asennukseen mitenkään.
  if (p === '.claude/settings.json') {
    const paketissa = path.join(DIST, '.claude', 'settings.json');
    if (fs.existsSync(paketissa) && !samat(talle, paketissa)) {
      fs.copyFileSync(paketissa, kohde + '.uusi');
      varo(`${p}: säilytettiin projektin versio; paketin uusi on ${p}.uusi — yhdistä tai aja /agentit`);
    }
  }
  fs.mkdirSync(path.dirname(kohde), { recursive: true });
  fs.copyFileSync(talle, kohde);
}
// Jos suojattua tiedostoa ei ollut lainkaan, paketin versio jäi paikalleen — ok.
if (!fs.existsSync(path.join(MAALI, '.claude', 'settings.json'))) paalle('.claude/settings.json');

fs.writeFileSync(path.join(MAALI, '.vnetcon-docs-versio'), VERSIO + '\n');
suorituskelpoiset();

ok(`Moottori päivitetty versioon ${VERSIO}`);
him(`Säilytettiin: ${SUOJATUT.join(' ')} + kaikki projektin dokumentit, tila/ ja konfiguraatio.`);
him('Jos menettelyn versio kasvoi (tila/metodi.yaml), aja Claudessa /yhdenmukaista-dokumentaatio.');
him(`Tarkista muutokset: git -C "${KOHDE}" status`);
