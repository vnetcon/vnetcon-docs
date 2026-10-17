#!/usr/bin/env node
// Tarkistaa dokumentaation sisäiset linkit: osoittavatko ne olemassa oleviin
// tiedostoihin. Lisäksi valinnaisesti frontmatterin `lahteet`-polut projektin
// puuhun, ja aina vahvistettujen kohtien merkinnät (konventiot.md kohta 11.2):
// parit täsmäävät eivätkä ole sisäkkäin. Ei riippuvuuksia — toimii ilman npm installia.
//
//   node tyokalut/tarkista-linkit.mjs            # linkit
//   node tyokalut/tarkista-linkit.mjs --lahteet  # myös lahteet-polut
//   node tyokalut/tarkista-linkit.mjs --lahteet --lahdeaineistot <mcp-työtila>
//                                                # myös lahde:-viitteet lähdeaineistoihin
//   node tyokalut/tarkista-linkit.mjs --mallipohjat  # tarkista myös mallipohjat
//
// Palauttaa exit-koodin 1, jos rikkinäisiä löytyi (sopii CI:hin).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JUURI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJEKTI = path.resolve(JUURI, '..');
const argv = process.argv.slice(2);
const TARKISTA_LAHTEET = argv.includes('--lahteet');
const MUKAAN_MALLIPOHJAT = argv.includes('--mallipohjat');
// lahde:-viitteet osoittavat MCP-työtilan lähdeaineistoon, eivät projektin puuhun.
// Ne tarkistetaan vain, kun työtila annetaan; vanhentunut tiiviste on varoitus.
const LAHDE_IDX = argv.indexOf('--lahdeaineistot');
const LAHDEAINEISTOT = LAHDE_IDX >= 0 && argv[LAHDE_IDX + 1] ? path.resolve(argv[LAHDE_IDX + 1]) : '';
let lahdeViitteita = 0;
let lahdeVaroituksia = 0;

function tarkistaLahdeviite(viite, dokki) {
  lahdeViitteita++;
  if (!LAHDEAINEISTOT) return;
  const m = viite.match(/^lahde:([a-z0-9][a-z0-9._-]{1,62})\/([^#]+?)(?:#([0-9a-f]{6,64}))?$/);
  const virhe = (syy) => { console.log(`LAHDE   ${dokki}  ->  ${viite}  (${syy})`); lahdeVirheet++; };
  if (!m) return virhe('virheellinen muoto, odotettu lahde:<lähde>/<polku>#<tiiviste>');
  const inventaario = path.join(LAHDEAINEISTOT, '.multiproject', 'sources', m[1], 'inventory.json');
  if (!fs.existsSync(inventaario)) return virhe('lähdettä ei ole työtilassa');
  const tiedosto = JSON.parse(fs.readFileSync(inventaario, 'utf8')).files?.[m[2]];
  if (!tiedosto || tiedosto.missing) return virhe('tiedostoa ei ole lähteessä');
  if (!tiedosto.approved_sha256) return virhe('tiedostoa ei ole hyväksytty');
  if (m[3] && !tiedosto.approved_sha256.startsWith(m[3])) {
    console.log(`VAROITUS ${dokki}  ->  ${viite}  (tiedosto on muuttunut viittauksen jälkeen; hyväksytty ${tiedosto.approved_sha256.slice(0, 12)})`);
    lahdeVaroituksia++;
  }
}

// Mallipohjien polut on kirjoitettu kohdesijainnista käsin, joten ne eivät
// osoita mihinkään mallipohjan omasta sijainnista. Ohitetaan oletuksena.
const OHITA = ['html', 'node_modules', ...(MUKAAN_MALLIPOHJAT ? [] : ['mallipohjat'])];

function md_tiedostot(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || OHITA.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) md_tiedostot(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const tiedostot = md_tiedostot(JUURI);
let rikki = 0, linkkeja = 0, lahdeVirheet = 0, lahteita = 0, vahvistuksia = 0, vahvistusVirheet = 0;
const rel = (p) => path.relative(JUURI, p);

for (const f of tiedostot) {
  const teksti = fs.readFileSync(f, 'utf8');

  // 1. Suhteelliset linkit
  for (const m of teksti.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const raaka = m[1];
    if (/^(https?:|mailto:|#|\/\/)/.test(raaka)) continue;
    if (raaka.includes('<')) continue;              // paikanpitäjä, esim. <moduuli>
    const href = raaka.split('#')[0];
    if (!href) continue;
    linkkeja++;
    if (!fs.existsSync(path.resolve(path.dirname(f), href))) {
      console.log(`LINKKI  ${rel(f)}  ->  ${raaka}`);
      rikki++;
    }
  }

  // 2. Vahvistettujen kohtien merkinnät. Koodilohkot ja rivinsisäinen koodi
  //    ohitetaan, koska ohjeissa merkintä esiintyy esimerkkinä.
  {
    const ilmanKoodia = teksti.replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, '').replace(/`[^`\n]*`/g, '');
    let auki = false;
    for (const m of ilmanKoodia.matchAll(/<!--\s*(\/?)vahvistettu\b/g)) {
      const sulkeva = m[1] === '/';
      if (!sulkeva && auki) { console.log(`VAHVISTUS  ${rel(f)}  ->  sisäkkäinen tai sulkematon vahvistettu-merkintä`); vahvistusVirheet++; }
      if (sulkeva && !auki) { console.log(`VAHVISTUS  ${rel(f)}  ->  /vahvistettu ilman avaavaa merkintää`); vahvistusVirheet++; }
      if (!sulkeva) vahvistuksia++;
      auki = !sulkeva;
    }
    if (auki) { console.log(`VAHVISTUS  ${rel(f)}  ->  vahvistettu-merkintä jäi sulkematta`); vahvistusVirheet++; }
  }

  // 3. Frontmatterin lahteet-polut (projektin juuresta)
  if (TARKISTA_LAHTEET) {
    const fm = teksti.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const osio = fm[1].match(/^lahteet:\s*(\[[^\]]*\]|(?:\n[ \t]*-[^\n]*)+)/m);
    if (!osio) continue;
    const polut = osio[1].startsWith('[')
      ? osio[1].slice(1, -1).split(',').map((s) => s.trim())
      : osio[1].split('\n').map((s) => s.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
    for (const p of polut) {
      if (/^["']?lahde:/.test(p)) { tarkistaLahdeviite(p.replace(/^["']|["']$/g, ''), rel(f)); continue; }
      const puhdas = p.replace(/^["']|["']$/g, '').split(':')[0];
      if (!puhdas || puhdas.includes('<') || puhdas.includes('...')) continue;
      lahteita++;
      if (!fs.existsSync(path.resolve(PROJEKTI, puhdas))) {
        console.log(`LAHDE   ${rel(f)}  ->  ${puhdas}`);
        lahdeVirheet++;
      }
    }
  }
}

console.log(`\n${tiedostot.length} dokumenttia · ${linkkeja} linkkiä (${rikki} rikki)`
  + (TARKISTA_LAHTEET ? ` · ${lahteita} lähdepolkua (${lahdeVirheet} ei löydy)` : '')
  + (lahdeViitteita ? ` · ${lahdeViitteita} lähdeaineistoviitettä${LAHDEAINEISTOT ? ` (${lahdeVaroituksia} vanhentunut)` : ' (ei tarkistettu: anna --lahdeaineistot <mcp-työtila>)'}` : '')
  + (vahvistuksia || vahvistusVirheet ? ` · ${vahvistuksia} vahvistettua kohtaa (${vahvistusVirheet} virhettä)` : ''));
if (!MUKAAN_MALLIPOHJAT) console.log('(mallipohjat ohitettu — lisää --mallipohjat jos haluat ne mukaan)');
process.exit(rikki + lahdeVirheet + vahvistusVirheet ? 1 : 0);
