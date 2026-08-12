#!/usr/bin/env node
// Tarkistaa dokumentaation sisäiset linkit: osoittavatko ne olemassa oleviin
// tiedostoihin. Lisäksi valinnaisesti frontmatterin `lahteet`-polut projektin
// puuhun. Ei riippuvuuksia — toimii ilman npm installia.
//
//   node tyokalut/tarkista-linkit.mjs            # linkit
//   node tyokalut/tarkista-linkit.mjs --lahteet  # myös lahteet-polut
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
let rikki = 0, linkkeja = 0, lahdeVirheet = 0, lahteita = 0;
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

  // 2. Frontmatterin lahteet-polut (projektin juuresta)
  if (TARKISTA_LAHTEET) {
    const fm = teksti.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const osio = fm[1].match(/^lahteet:\s*(\[[^\]]*\]|(?:\n[ \t]*-[^\n]*)+)/m);
    if (!osio) continue;
    const polut = osio[1].startsWith('[')
      ? osio[1].slice(1, -1).split(',').map((s) => s.trim())
      : osio[1].split('\n').map((s) => s.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
    for (const p of polut) {
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
  + (TARKISTA_LAHTEET ? ` · ${lahteita} lähdepolkua (${lahdeVirheet} ei löydy)` : ''));
if (!MUKAAN_MALLIPOHJAT) console.log('(mallipohjat ohitettu — lisää --mallipohjat jos haluat ne mukaan)');
process.exit(rikki + lahdeVirheet ? 1 : 0);
