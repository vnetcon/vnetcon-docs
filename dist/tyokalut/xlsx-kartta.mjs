#!/usr/bin/env node
// Purkaa Excel-työkirjan tekstiksi, jotta sitä voi lukea ja hakea kuten koodia.
//
//   node tyokalut/xlsx-kartta.mjs <tyokirja.xlsx> [--osa rakenne|kaavat|funktiot|arvot|linkit|riskit]
//
// Työkirja on binääri, joten `git grep` ei näe sen sisään. Tämä työkalu tekee
// siitä tekstin: välilehdet, otsikot, kaavat, nimetyt alueet ja tyypilliset
// riskikohdat. Tuloste on tarkoitettu sekä ihmisen luettavaksi että haettavaksi.
//
// Ei riippuvuuksia: .xlsx on zip-paketti XML:ää, ja Nodessa on zlib valmiina.
// Sama työkalu toimii macOS:llä, Linuxilla ja Windowsilla ilman asennuksia.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// --- Zip-luku --------------------------------------------------------------

/** Lukee zip-paketin muistiin: { tiedostonimi: Buffer }. */
function lueZip(polku) {
  const buf = fs.readFileSync(polku);

  // Keskushakemiston loppumerkintä (EOCD) on tiedoston lopussa, mahdollisen
  // kommentin edessä — etsitään taaksepäin.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Ei kelvollinen zip/xlsx-tiedosto');

  const maara = buf.readUInt16LE(eocd + 10);
  let siirtyma = buf.readUInt32LE(eocd + 16);

  const tiedostot = {};
  for (let n = 0; n < maara; n += 1) {
    if (buf.readUInt32LE(siirtyma) !== 0x02014b50) break;
    const menetelma = buf.readUInt16LE(siirtyma + 10);
    const pakattuKoko = buf.readUInt32LE(siirtyma + 20);
    const nimiPituus = buf.readUInt16LE(siirtyma + 28);
    const lisaPituus = buf.readUInt16LE(siirtyma + 30);
    const kommenttiPituus = buf.readUInt16LE(siirtyma + 32);
    const paikallinen = buf.readUInt32LE(siirtyma + 42);
    const nimi = buf.toString('utf8', siirtyma + 46, siirtyma + 46 + nimiPituus);

    // Paikallinen otsake: nimen ja lisäkentän pituudet voivat poiketa keskushakemistosta.
    const pNimiPituus = buf.readUInt16LE(paikallinen + 26);
    const pLisaPituus = buf.readUInt16LE(paikallinen + 28);
    const alku = paikallinen + 30 + pNimiPituus + pLisaPituus;
    const data = buf.subarray(alku, alku + pakattuKoko);
    tiedostot[nimi] = menetelma === 0 ? data : zlib.inflateRawSync(data);

    siirtyma += 46 + nimiPituus + lisaPituus + kommenttiPituus;
  }
  return tiedostot;
}

// --- XML-apurit ------------------------------------------------------------

const PURA = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&');

const attribuutti = (tagi, nimi) => {
  const m = tagi.match(new RegExp(`${nimi}="([^"]*)"`));
  return m ? PURA(m[1]) : null;
};

const sarakeIndeksi = (kirjaimet) => {
  let n = 0;
  for (const k of kirjaimet) n = n * 26 + (k.charCodeAt(0) - 64);
  return n;
};

const sarakeKirjain = (n) => {
  let s = '';
  while (n > 0) { const j = (n - 1) % 26; s = String.fromCharCode(65 + j) + s; n = (n - j - 1) / 26; }
  return s;
};

const pilkoViite = (viite) => {
  const m = viite.match(/^([A-Z]+)(\d+)$/);
  return m ? { sarake: sarakeIndeksi(m[1]), rivi: Number(m[2]) } : null;
};

// --- Työkirjan luku --------------------------------------------------------

function lueTyokirja(polku) {
  const zip = lueZip(polku);
  const teksti = (nimi) => (zip[nimi] ? zip[nimi].toString('utf8') : '');

  // Jaetut merkkijonot
  const jaetut = [];
  for (const si of teksti('xl/sharedStrings.xml').split('</si>')) {
    if (!si.includes('<si')) continue;
    const osat = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => PURA(m[1]));
    jaetut.push(osat.join(''));
  }

  // Välilehdet ja niiden tiedostot
  const wbXml = teksti('xl/workbook.xml');
  const relsXml = teksti('xl/_rels/workbook.xml.rels');
  const rels = {};
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = attribuutti(m[1], 'Id');
    const kohde = attribuutti(m[1], 'Target');
    if (id && kohde) rels[id] = kohde.replace(/^\/?xl\//, '').replace(/^\//, '');
  }

  const valilehdet = [];
  for (const m of wbXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const nimi = attribuutti(m[1], 'name');
    const rid = attribuutti(m[1], 'r:id') || attribuutti(m[1], 'id');
    const tila = attribuutti(m[1], 'state') || 'visible';
    const kohde = rels[rid] || '';
    valilehdet.push({ nimi, tila, tiedosto: `xl/${kohde}` });
  }

  const nimetyt = [];
  for (const m of wbXml.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)) {
    nimetyt.push({ nimi: attribuutti(m[1], 'name'), arvo: PURA(m[2]) });
  }

  for (const vl of valilehdet) {
    const xml = teksti(vl.tiedosto);
    vl.solut = new Map();       // "A3" -> { arvo, kaava }
    vl.maxRivi = 0;
    vl.maxSarake = 0;
    vl.yhdistetyt = [...xml.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1]);
    const pane = xml.match(/<pane\b[^>]*topLeftCell="([^"]+)"[^>]*\/>/);
    vl.jaadytys = pane ? pane[1] : null;

    for (const cm of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const viite = attribuutti(cm[1], 'r');
      if (!viite) continue;
      const paikka = pilkoViite(viite);
      if (!paikka) continue;
      const tyyppi = attribuutti(cm[1], 't');
      const sisalto = cm[2] || '';
      const fm = sisalto.match(/<f[^>]*>([\s\S]*?)<\/f>/);
      const vm = sisalto.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      const im = sisalto.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);

      let arvo = null;
      if (im) arvo = PURA(im[1]);
      else if (vm) {
        const raaka = PURA(vm[1]);
        if (tyyppi === 's') arvo = jaetut[Number(raaka)] ?? '';
        else if (tyyppi === 'str' || tyyppi === 'e') arvo = raaka;
        else arvo = raaka === '' ? null : Number(raaka);
      }

      vl.solut.set(viite, { arvo, kaava: fm ? '=' + PURA(fm[1]) : null });
      if (paikka.rivi > vl.maxRivi) vl.maxRivi = paikka.rivi;
      if (paikka.sarake > vl.maxSarake) vl.maxSarake = paikka.sarake;
    }
  }

  // Ulkoiset linkit toisiin työkirjoihin. Kaavoissa ne ovat muodossa
  // [1]Välilehti!A1, jossa [n] on externalReferences-listan JÄRJESTYSNUMERO —
  // ei tiedostonimi. Kohdepolku löytyy vasta linkkiosan omista rels-tiedoista.
  const linkit = [];
  for (const m of wbXml.matchAll(/<externalReference\b([^>]*)\/>/g)) {
    const rid = attribuutti(m[1], 'r:id') || attribuutti(m[1], 'id');
    const osa = rels[rid] || '';
    const relPolku = `xl/${osa.replace(/([^/]+)$/, '_rels/$1.rels')}`;
    let kohde = '';
    for (const rm of teksti(relPolku).matchAll(/<Relationship\b([^>]*)\/>/g)) {
      if ((attribuutti(rm[1], 'TargetMode') || '') === 'External') kohde = attribuutti(rm[1], 'Target') || '';
    }
    try { kohde = decodeURIComponent(kohde); } catch { /* jätetään raakana */ }
    const linkXml = teksti(`xl/${osa}`);
    linkit.push({
      indeksi: linkit.length + 1,
      kohde,
      valilehdet: [...linkXml.matchAll(/<sheetName\b[^>]*val="([^"]*)"/g)].map((x) => PURA(x[1])),
    });
  }

  return {
    polku,
    valilehdet,
    nimetyt,
    linkit,
    nimet: valilehdet.map((v) => v.nimi),
    ulkoisetLinkit: linkit.length > 0 || Object.keys(zip).some((n) => n.startsWith('xl/externalLinks/')),
    vba: Object.keys(zip).some((n) => n.toLowerCase().includes('vba')),
  };
}

// Tiedostonimi polusta myös silloin, kun polku on Windows-muotoinen
// (`C:\Talous\budjetti.xlsx`) mutta työkalu ajetaan macOS:llä tai Linuxilla —
// siellä `path.basename` ei katkaise kenoviivaan. Ulkoinen linkki osoittaa
// tyypillisesti juuri Windows-levylle, joten tämä on sääntö eikä poikkeus.
const tiedostonimi = (p) => String(p).split(/[\\/]/).pop();

const solu = (vl, rivi, sarake) => vl.solut.get(`${sarakeKirjain(sarake)}${rivi}`)?.arvo ?? null;
const valilehti = (wb, nimi) => wb.valilehdet.find((v) => v.nimi === nimi);

// --- Analyysi --------------------------------------------------------------

// Rivinumerot pois viittauksista, jotta toistuvat kaavat tiivistyvät yhdeksi.
const normalisoi = (kaava) => kaava.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, '$1n');

function otsikkorivi(vl) {
  for (let rivi = 1; rivi <= Math.min(vl.maxRivi, 10); rivi += 1) {
    const tekstit = [];
    for (let s = 1; s <= Math.min(vl.maxSarake, 40); s += 1) {
      const a = solu(vl, rivi, s);
      if (typeof a === 'string' && a.trim()) tekstit.push(a.trim());
    }
    if (tekstit.length >= 3) return { rivi, otsikot: tekstit };
  }
  return { rivi: 0, otsikot: [] };
}

/** Viimeinen yhtenäisen taulukon rivi annetusta sarakkeesta alaspäin. */
function taulukonViimeinenRivi(vl, sarake, alkurivi) {
  const s = sarakeIndeksi(sarake);
  let viimeinen = alkurivi - 1;
  for (let rivi = alkurivi; rivi <= vl.maxRivi; rivi += 1) {
    const a = solu(vl, rivi, s);
    if (a === null || a === '') break;
    viimeinen = rivi;
  }
  return viimeinen;
}

function keraaKaavat(wb) {
  const ulos = new Map();
  for (const vl of wb.valilehdet) {
    const nahdyt = new Map();
    for (const [viite, sisalto] of vl.solut) {
      if (!sisalto.kaava) continue;
      const avain = normalisoi(sisalto.kaava);
      if (nahdyt.has(avain)) nahdyt.get(avain).maara += 1;
      else nahdyt.set(avain, { solu: viite, kaava: sisalto.kaava, maara: 1 });
    }
    if (nahdyt.size) ulos.set(vl.nimi, [...nahdyt.values()]);
  }
  return ulos;
}

// --- Osat ------------------------------------------------------------------

const tulosta = (s = '') => process.stdout.write(s + '\n');

function osaRakenne(wb) {
  tulosta('## Rakenne\n');
  const koko = Math.round(fs.statSync(wb.polku).size / 1024);
  tulosta(`Tiedosto: ${path.basename(wb.polku)}  (${koko} kt)`);
  tulosta(`Välilehtiä: ${wb.valilehdet.length}\n`);
  for (const vl of wb.valilehdet) {
    tulosta(`### ${vl.nimi}${vl.tila !== 'visible' ? '  [PIILOTETTU]' : ''}`);
    if (!vl.maxRivi || !vl.maxSarake) {
      tulosta('- tyhjä välilehti');
    } else {
      tulosta(`- alue: A1:${sarakeKirjain(vl.maxSarake)}${vl.maxRivi}  (${vl.maxRivi} riviä, ${vl.maxSarake} saraketta)`);
    }
    if (vl.jaadytys) tulosta(`- jäädytys: ${vl.jaadytys}`);
    if (vl.yhdistetyt.length) tulosta(`- yhdistetyt solut: ${vl.yhdistetyt.join(', ')}`);
    const { rivi, otsikot } = otsikkorivi(vl);
    if (otsikot.length) {
      tulosta(`- otsikkorivi ${rivi}: ${otsikot.join(' | ')}`);
      if (rivi > 1) tulosta(`  HUOM: data alkaa vasta riviltä ${rivi + 1}, ei riviltä 2`);
    }
    tulosta();
  }
  if (wb.nimetyt.length) {
    tulosta('### Nimetyt alueet');
    for (const n of wb.nimetyt) tulosta(`- ${n.nimi} = ${n.arvo}`);
    tulosta();
  }
}

function osaKaavat(wb) {
  tulosta('## Kaavat (logiikka)\n');
  const kaavat = keraaKaavat(wb);
  if (!kaavat.size) { tulosta('Ei kaavoja — työkirja sisältää vain arvoja.\n'); return; }
  for (const [nimi, rivit] of kaavat) {
    tulosta(`### ${nimi}`);
    for (const r of [...rivit].sort((a, b) => b.maara - a.maara)) {
      tulosta(`- \`${r.solu}\`${r.maara > 1 ? `  ×${r.maara}` : ''}`);
      tulosta('  ```');
      tulosta('  ' + r.kaava);
      tulosta('  ```');
    }
    tulosta();
  }
}

// Haihtuvat funktiot lasketaan uudelleen joka avauksella; kaksi ensimmäistä
// rakentavat viittauksen merkkijonosta, jolloin hakualuetta EI voi tarkistaa
// staattisesti — riskianalyysin kattavuus on silloin vajaa ja se on sanottava.
const LAAJENTAVAT = ['INDIRECT', 'OFFSET'];
const HAIHTUVAT = ['NOW', 'TODAY', 'RAND', 'RANDBETWEEN', 'CELL', 'INFO'];

function osaFunktiot(wb) {
  tulosta('## Funktiot\n');
  const kaavat = keraaKaavat(wb);
  if (!kaavat.size) { tulosta('Ei kaavoja — työkirja sisältää vain arvoja.\n'); return; }

  const f = new Map();   // funktio -> { maara, paikat:Set }
  let saantoja = 0;
  let soluja = 0;
  for (const [vlNimi, rivit] of kaavat) {
    for (const r of rivit) {
      saantoja += 1;
      soluja += r.maara;
      for (const m of r.kaava.matchAll(/\b([A-Z][A-Z0-9.]{1,20})\s*\(/g)) {
        const nimi = m[1];
        if (!f.has(nimi)) f.set(nimi, { maara: 0, paikat: new Set() });
        const e = f.get(nimi);
        e.maara += r.maara;
        e.paikat.add(`${vlNimi}!${r.solu}`);
      }
    }
  }

  tulosta(`Kaavasoluja ${soluja}, erillisiä sääntöjä ${saantoja}, funktioita ${f.size}.\n`);
  tulosta('| Funktio | Esiintymiä | Missä |');
  tulosta('|---------|-----------|-------|');
  for (const [nimi, e] of [...f].sort((a, b) => b[1].maara - a[1].maara)) {
    const paikat = [...e.paikat];
    const nayta = paikat.slice(0, 4).join(', ') + (paikat.length > 4 ? `, +${paikat.length - 4}` : '');
    tulosta(`| \`${nimi}\` | ${e.maara} | ${nayta} |`);
  }
  tulosta();

  const laajentavat = LAAJENTAVAT.filter((n) => f.has(n));
  const haihtuvat = HAIHTUVAT.filter((n) => f.has(n));

  if (laajentavat.length) {
    tulosta(`> ⚠️ **Riskianalyysi on vajaa: ${laajentavat.join(', ')}.** Nämä rakentavat`);
    tulosta('> viittauksen merkkijonosta, joten hakualuetta ei voi tarkistaa staattisesti.');
    tulosta('> `--osa riskit` EI näe näiden läpi — tarkista ne käsin ja kirjaa katveeksi.\n');
  }
  if (haihtuvat.length) {
    tulosta(`> **Haihtuvat funktiot: ${haihtuvat.join(', ')}.** Tulos muuttuu joka avauksella,`);
    tulosta('> joten sama työkirja voi antaa eri luvun eri päivinä. Historiaa vasten');
    tulosta('> todentaminen ei ole luotettavaa ilman että tämä otetaan huomioon.\n');
  }
  if (!laajentavat.length && !haihtuvat.length) {
    tulosta('> Ei haihtuvia eikä viittausta laajentavia funktioita — `--osa riskit`:n');
    tulosta('> hakualuetarkistus kattaa kaikki kaavat.\n');
  }
}

// Palauttaa linkit rikastettuna sillä, mistä soluista niihin viitataan ja
// löytyykö kohdetiedosto levyltä. Käytetään myös monen tiedoston graafissa.
function linkkiKartta(wb) {
  return (wb.linkit || []).map((l) => {
    const viittaajat = [];
    for (const vl of wb.valilehdet) {
      for (const [viite, solu] of vl.solut) {
        if (solu.kaava && solu.kaava.includes(`[${l.indeksi}]`)) viittaajat.push(`${vl.nimi}!${viite}`);
      }
    }
    const ehdoton = /^(file:|[A-Za-z]:|\\\\|\/)/.test(l.kohde);
    let loytyy = null;
    if (l.kohde && !ehdoton) {
      try { loytyy = fs.existsSync(path.resolve(path.dirname(wb.polku), l.kohde)); } catch { loytyy = null; }
    }
    return { ...l, viittaajat, ehdoton, loytyy };
  });
}

function osaLinkit(wb) {
  tulosta('## Ulkoiset linkit\n');
  const kartta = linkkiKartta(wb);
  if (!kartta.length) {
    tulosta('Ei ulkoisia linkkejä — laskenta ei riipu muista työkirjoista.\n');
    return kartta;
  }
  for (const l of kartta) {
    tulosta(`### [${l.indeksi}] ${l.kohde || '(kohdetta ei saatu luettua)'}`);
    if (l.ehdoton) {
      tulosta('- ⚠️ **ehdoton polku** — osoittaa työasemalle tai verkkolevylle, ei repoon.');
      tulosta('  Linkki katkeaa toisella koneella, eikä katkeaminen näy laskennassa.');
    } else if (l.loytyy === false) {
      tulosta('- ⚠️ **kohdetiedostoa ei löydy** tästä hakemistosta.');
    } else if (l.loytyy === true) {
      tulosta('- kohde löytyy levyltä työkirjan vierestä.');
    }
    if (l.valilehdet.length) tulosta(`- välimuistiin tallennetut välilehdet: ${l.valilehdet.join(', ')}`);
    if (l.viittaajat.length) {
      const n = l.viittaajat.slice(0, 8).join(', ');
      tulosta(`- viitataan ${l.viittaajat.length} solusta: ${n}${l.viittaajat.length > 8 ? ', …' : ''}`);
    } else {
      tulosta('- ⚠️ **yksikään kaava ei viittaa tähän** — jäänne, joka kannattaa poistaa.');
    }
    tulosta();
  }
  tulosta('> Ulkoinen linkki on rajapinta ilman sopimusta: se on tiedostopolku jonkun');
  tulosta('> levyllä. Kirjaa kuka päivittää kohteen, milloin, ja mitä tapahtuu kun');
  tulosta('> tiedosto siirtyy tai nimetään uudelleen.\n');
  return kartta;
}

function osaArvot(wb) {
  tulosta('## Parametrit ja taulukot\n');
  for (const vl of wb.valilehdet) {
    if (vl.maxRivi > 60 || vl.maxSarake > 12) continue;
    tulosta(`### ${vl.nimi}`);
    for (let rivi = 1; rivi <= vl.maxRivi; rivi += 1) {
      const osat = [];
      for (let s = 1; s <= vl.maxSarake; s += 1) {
        const viite = `${sarakeKirjain(s)}${rivi}`;
        const sisalto = vl.solut.get(viite);
        if (!sisalto || (sisalto.arvo === null && !sisalto.kaava)) continue;
        osat.push(`${viite}=${JSON.stringify(sisalto.kaava ?? sisalto.arvo)}`);
      }
      if (osat.length) tulosta('  ' + osat.join('  '));
    }
    tulosta();
  }
}

function osaRiskit(wb) {
  tulosta('## Riskikohdat\n');
  const loydot = [];
  const kaavat = keraaKaavat(wb);

  for (const [vlNimi, rivit] of kaavat) {
    for (const { solu: paikkaSolu, kaava, maara } of rivit) {
      const paikka = `${vlNimi}!${paikkaSolu}`;

      if (/IFERROR/i.test(kaava)) {
        loydot.push(`**Virheen nielaisu** ${paikka} (×${maara}): \`IFERROR\` peittää osumattoman haun `
          + `— tulos on 0 tai tyhjä, ei virhettä.\n  \`${kaava}\``);
      }
      if (/=\s*"[^"]+"|<>\s*"[^"]+"/.test(kaava)) {
        loydot.push(`**Kovakoodattu ehto kaavassa** ${paikka} (×${maara}): poikkeus on kirjoitettu `
          + `kaavan sisään nimellä, ei taulukkoon.\n  \`${kaava}\``);
      }
      // Literaali luku laskenta- tai vertailuoperaattorin operandina: prosentti,
      // kerroin tai raja, jota ei näy missään taulukossa. Pilkun jälkeiset luvut
      // ovat funktioargumentteja (VLOOKUP-sarakeindeksi, ROUND-tarkkuus) eivätkä
      // osu tähän. Kaksimerkkiset operaattorit ensin, jotta >= ei katkea >:ksi.
      const luvut = [...new Set(
        [...kaava.matchAll(/(?:>=|<=|<>|[*\/><])\s*(\d+(?:[.,]\d+)?)/g)].map((m) => m[1]),
      )];
      if (luvut.length) {
        loydot.push(`**Kovakoodattu luku kaavassa** ${paikka} (×${maara}): ${luvut.join(', ')} `
          + `— prosentti, kerroin tai raja, jota ei näy missään taulukossa.\n  \`${kaava}\``);
      }
      for (const m of kaava.matchAll(/([A-Za-zÀ-ÿ '()]+)!\$([A-Z]{1,3})\$(\d+):\$([A-Z]{1,3})\$(\d+)/g)) {
        const nimi = m[1].trim().replace(/^'|'$/g, '');
        const vl = valilehti(wb, nimi);
        if (!vl) continue;
        // Verrataan sen taulukon todelliseen pituuteen, johon haku osuu — ei
        // välilehden viimeiseen riviin. Sama välilehti voi sisältää useita
        // taulukoita, eikä lyhyt hakualue ole niistä virhe.
        const viim = taulukonViimeinenRivi(vl, m[2], Number(m[3]));
        if (viim > Number(m[5])) {
          loydot.push(`**Hakualue ei kata koko taulukkoa** ${paikka}: alue päättyy riviin ${m[5]}, `
            + `mutta taulukossa '${nimi}'!${m[2]}${m[3]} on rivejä riviin ${viim} asti.\n  \`${kaava}\``);
        }
      }
    }
  }

  for (const vl of wb.valilehdet) {
    if (vl.tila !== 'visible') loydot.push(`**Piilotettu välilehti** '${vl.nimi}'`);
    if (vl.yhdistetyt.length && otsikkorivi(vl).rivi > 1) {
      loydot.push(`**Yhdistetty otsikkorivi** '${vl.nimi}': data ei ala riviltä 2 — automaattinen `
        + 'luku menee pieleen ilman rivisiirtymää.');
    }
    if (/vanha|old|copy|kopio/i.test(vl.nimi)) {
      loydot.push(`**Nimi viittaa hylättyyn** '${vl.nimi}': tarkista viittaako joku kaava siihen edelleen.`);
    }

    const { rivi } = otsikkorivi(vl);
    let tekstipaivat = 0;
    for (let r = rivi + 1; r <= Math.min(vl.maxRivi, rivi + 400); r += 1) {
      for (let s = 1; s <= Math.min(vl.maxSarake, 3); s += 1) {
        const a = solu(vl, r, s);
        if (typeof a === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(a.trim())) tekstipaivat += 1;
      }
    }
    if (tekstipaivat) {
      loydot.push(`**Päivämäärä tekstinä** '${vl.nimi}': ${tekstipaivat} solua muodossa p.k.vvvv `
        + 'merkkijonona, ei päivämääräarvona.');
    }
  }

  if (wb.ulkoisetLinkit) {
    const kohteet = (wb.linkit || []).map((l) => l.kohde).filter(Boolean);
    loydot.push('**Ulkoinen linkki toiseen työkirjaan** — laskenta riippuu tiedostosta, jota ei ole tässä repossa.'
      + (kohteet.length ? `\n  ${kohteet.join('\n  ')}\n  (yksityiskohdat: \`--osa linkit\`)` : ''));
  }
  if (wb.vba) {
    loydot.push('**VBA-makroja** — osa logiikasta on koodina työkirjan sisällä.');
  }

  const uniikit = [...new Set(loydot)];
  if (!uniikit.length) { tulosta('Ei tunnistettuja riskikohtia.\n'); return; }
  uniikit.forEach((l, i) => tulosta(`${i + 1}. ${l}\n`));
}

// --- Rajapinta muille työkaluille ------------------------------------------

export { lueTyokirja, valilehti, solu, keraaKaavat, otsikkorivi, sarakeKirjain, sarakeIndeksi };

/** Välilehden rivit olioina otsikkorivin mukaan. */
export function rivit(vl, otsikkoRivi = null) {
  // Otsikot luetaan sarake kerrallaan, ei `otsikkorivi()`:n palauttamasta
  // listasta: se on tiivistetty (tyhjät ja numeeriset solut pudotettu), joten
  // sarakkeiden nimet ja arvot menisivät ristiin heti kun otsikkorivissä on
  // aukko. Jos otsikkoriviä ei tunnistettu, oletetaan rivi 1 — muuten nimiksi
  // tulisi rivi 0, jota ei ole, ja jokainen kenttä olisi tyhjä ilman virhettä.
  const oRivi = otsikkoRivi ?? (otsikkorivi(vl).rivi || 1);
  const nimet = [];
  for (let s = 1; s <= vl.maxSarake; s += 1) nimet.push(String(solu(vl, oRivi, s) ?? ''));
  const ulos = [];
  for (let r = oRivi + 1; r <= vl.maxRivi; r += 1) {
    const olio = {};
    let tyhja = true;
    nimet.forEach((nimi, i) => {
      const arvo = solu(vl, r, i + 1);
      if (arvo !== null && arvo !== '') tyhja = false;
      olio[nimi] = arvo;
    });
    if (!tyhja) ulos.push(olio);
  }
  return ulos;
}

// --- Pääohjelma ------------------------------------------------------------

// Ajetaan vain komentoriviltä, ei importattaessa.
const AJETAAN = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
const argv = AJETAAN ? process.argv.slice(2) : [];
const osaIdx = argv.indexOf('--osa');
const osa = osaIdx >= 0 ? argv[osaIdx + 1] : 'kaikki';
// Kaikki ei-lippuargumentit ovat työkirjoja — paitsi --osa:n oma arvo.
// HUOM: kun --osa puuttuu, osaIdx on -1 eikä yhtään argumenttia saa pudottaa.
const tiedostot = argv.filter((a, i) => !a.startsWith('--') && (osaIdx < 0 || i !== osaIdx + 1));

const KAYTTO = 'Käyttö: node tyokalut/xlsx-kartta.mjs <tyokirja.xlsx> [<tyokirja2.xlsx> …] '
  + '[--osa rakenne|kaavat|funktiot|arvot|linkit|riskit]';

if (AJETAAN) {
  if (!tiedostot.length) {
    console.error(KAYTTO);
    process.exit(1);
  }
  const puuttuu = tiedostot.filter((t) => !fs.existsSync(t));
  if (puuttuu.length) {
    console.error(`Tiedostoa ei ole: ${puuttuu.join(', ')}`);
    process.exit(1);
  }

  const kaikkiLinkit = [];   // { lahde, kohde } monen tiedoston graafia varten

  for (const tiedosto of tiedostot) {
    const wb = lueTyokirja(tiedosto);
    tulosta(`# Työkirjan kartta: ${path.basename(tiedosto)}\n`);
    if (osa === 'kaikki' || osa === 'rakenne') osaRakenne(wb);
    if (osa === 'kaikki' || osa === 'kaavat') osaKaavat(wb);
    if (osa === 'kaikki' || osa === 'funktiot') osaFunktiot(wb);
    if (osa === 'kaikki' || osa === 'arvot') osaArvot(wb);
    if (osa === 'kaikki' || osa === 'linkit') {
      for (const l of osaLinkit(wb)) {
        kaikkiLinkit.push({ lahde: tiedostonimi(tiedosto), kohde: l.kohde ? tiedostonimi(l.kohde) : '?' });
      }
    }
    if (osa === 'kaikki' || osa === 'riskit') osaRiskit(wb);
    if (tiedostot.length > 1) tulosta('---\n');
  }

  // Riippuvuusgraafi on mielekäs vasta kun työkirjoja on monta. Solmuina
  // tiedostonimet, koska kohde voi olla repon ulkopuolella eikä sitä lueta.
  if (tiedostot.length > 1 && (osa === 'kaikki' || osa === 'linkit')) {
    tulosta('# Työkirjojen riippuvuudet\n');
    if (!kaikkiLinkit.length) {
      tulosta('Yksikään työkirja ei linkitä toiseen — ne ovat toisistaan riippumattomia.\n');
    } else {
      const tunnus = new Map();
      const id = (nimi) => {
        if (!tunnus.has(nimi)) tunnus.set(nimi, `T${tunnus.size + 1}`);
        return tunnus.get(nimi);
      };
      tulosta('```mermaid');
      tulosta('flowchart LR');
      for (const nimi of new Set(kaikkiLinkit.flatMap((l) => [l.lahde, l.kohde]))) {
        tulosta(`    ${id(nimi)}["${nimi}"]`);
      }
      for (const l of kaikkiLinkit) tulosta(`    ${id(l.lahde)} --> ${id(l.kohde)}`);
      tulosta('```\n');
      tulosta('> Nuoli osoittaa riippuvuuden suuntaan: lähde lukee kohdetta. Kohde voi');
      tulosta('> olla repon ulkopuolella — tarkista jokainen `--osa linkit` -tulosteesta.\n');
    }
  }
}
