import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UserError } from './errors.mjs';

// PDF:n tekstin purku pdf.js:llä. Kirjasto ladataan vasta, kun PDF muunnetaan,
// jotta muut komennot eivät hidastu. PDF:ssä ei ole luotettavaa rakennetta:
// otsikoita ja taulukoita ei yritetä palauttaa, vaan teksti kootaan riveiksi ja
// kappaleiksi sivu kerrallaan (## Sivu n). Fontteja ei ladata, PDF:n skripteja
// ja lomakkeita ei suoriteta, eikä workeria käynnistetä erikseen.

export const PDF_LIMITS = { max_pages: 2000, timeout_ms: 60_000 };
const SCANNED_TEXT_CHARS = 20;

let pdfjsPromise = null;

function loadPdfjs() {
  pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs').catch((error) => {
    pdfjsPromise = null;
    throw new UserError(`PDF-kirjasto puuttuu (pdfjs-dist). Aja npm ci --prefix tyokalut/mcp. (${error.message})`);
  });
  return pdfjsPromise;
}

function packageDirectory(name) {
  const build = fileURLToPath(import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  return `${path.join(path.dirname(build), '..', '..', name)}${path.sep}`;
}

function unsupported(message) {
  const error = new UserError(message);
  error.unsupported = true;
  return error;
}

function pdfDate(value) {
  const match = /^D:(\d{4})(\d{2})?(\d{2})?/.exec(value || '');
  if (!match) return '';
  return [match[3], match[2], match[1]].filter(Boolean).map((part) => String(Number(part))).join('.');
}

function cleanMeta(value) {
  return String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}

// Tekstielementit riveiksi y-koordinaatin mukaan ja riveistä kappaleita
// riviväliin perustuen.
export function pageText(items) {
  const lines = [];
  let current = null;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const [, , , scaleY, x, y] = item.transform;
    const size = Math.abs(scaleY) || item.height || 10;
    if (item.str !== '') {
      const sameLine = current && Math.abs(current.y - y) <= size * 0.5;
      if (!sameLine) {
        current = { y, size, text: '', end: x };
        lines.push(current);
      }
      const gap = x - current.end;
      if (current.text && gap > size * 0.15 && !/\s$/.test(current.text) && !/^\s/.test(item.str)) current.text += ' ';
      current.text += item.str;
      current.end = x + (item.width || 0);
      current.size = Math.max(current.size, size);
    }
    if (item.hasEOL) current = null;
  }
  const text = lines.map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() })).filter((line) => line.text);
  const gaps = [];
  for (let index = 1; index < text.length; index += 1) {
    const gap = text[index - 1].y - text[index].y;
    if (gap > 0) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  // Alempi mediaani: kappalevälit ovat harvinaisempia kuin rivivälit.
  const typical = gaps.length ? gaps[Math.floor((gaps.length - 1) / 2)] : 0;
  const paragraphs = [];
  let paragraph = [];
  text.forEach((line, index) => {
    const gap = index ? text[index - 1].y - line.y : 0;
    // Uusi kappale, kun rivien väli on tavallista suurempi tai teksti hyppää
    // ylöspäin (seuraava palsta).
    if (paragraph.length && (gap < 0 || (typical && gap > typical * 1.4))) {
      paragraphs.push(paragraph);
      paragraph = [];
    }
    // Rivin alun # tekisi rivistä otsikon ja rikkoisi sivujaon (## Sivu n).
    paragraph.push(line.text.replace(/^(#{1,6}\s)/, '\\$1'));
  });
  if (paragraph.length) paragraphs.push(paragraph);
  return paragraphs.map((lines_) => lines_.join('\n')).join('\n\n');
}

// Palauttaa { markdown, skipped, notes, pages }. Skannattu PDF ja muut
// tukemattomat tapaukset heitetään virheenä, jossa unsupported = true.
export async function convertPdf(filename, limits = PDF_LIMITS) {
  const pdfjs = await loadPdfjs();
  const started = Date.now();
  const overTime = () => Date.now() - started > limits.timeout_ms;
  const task = pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(filename)),
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    isOffscreenCanvasSupported: false,
    stopAtErrors: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    cMapUrl: packageDirectory('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: packageDirectory('standard_fonts'),
    wasmUrl: packageDirectory('wasm'),
    iccUrl: packageDirectory('iccs'),
  });
  // Ilman tätä salasanasuojattu PDF jää odottamaan salasanaa.
  task.onPassword = () => task.destroy();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new UserError(`PDF:n avaaminen kesti yli ${Math.round(limits.timeout_ms / 1000)} s.`)), limits.timeout_ms);
  });
  let document;
  try {
    document = await Promise.race([task.promise, timeout]);
  } catch (error) {
    await task.destroy().catch(() => {});
    if (error instanceof UserError) throw error;
    if (error?.name === 'PasswordException' || /password/i.test(error?.message || '')) throw new UserError('PDF on salasanasuojattu.');
    throw new UserError(`Tiedosto ei ole kelvollinen PDF: ${error?.message || error}`);
  } finally {
    clearTimeout(timer);
  }
  try {
    if (document.numPages > limits.max_pages) throw new UserError(`PDF:ssä on ${document.numPages} sivua, raja on ${limits.max_pages}.`);
    const { info = {} } = await document.getMetadata().catch(() => ({}));
    const pages = [];
    const textless = [];
    let imageOnly = 0;
    for (let number = 1; number <= document.numPages; number += 1) {
      if (overTime()) throw new UserError(`PDF:n muunnos kesti yli ${Math.round(limits.timeout_ms / 1000)} s (sivu ${number}/${document.numPages}).`);
      const page = await document.getPage(number);
      const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
      const text = pageText(content.items);
      if (text.replace(/\s/g, '').length < SCANNED_TEXT_CHARS) {
        // Vähätekstinen sivu: onko sillä kuva (skannattu sivu)?
        const operators = await page.getOperatorList();
        const images = operators.fnArray.filter((op) => op === pdfjs.OPS.paintImageXObject || op === pdfjs.OPS.paintInlineImageXObject || op === pdfjs.OPS.paintImageMaskXObject).length;
        if (images) imageOnly += 1;
        if (!text) textless.push(number);
      }
      page.cleanup();
      pages.push(`## Sivu ${number}\n\n${text || '_(ei tekstiä)_'}`);
    }
    if (document.numPages && imageOnly > document.numPages / 2) {
      throw unsupported('Skannattu PDF: sivuilla on kuva mutta ei tekstiä. Tekstintunnistusta (OCR) ei tueta.');
    }
    const notes = ['PDF: otsikot ja taulukot eivät säily, sivunumerot säilyvät.'];
    const title = cleanMeta(info.Title);
    const author = cleanMeta(info.Author);
    const created = pdfDate(info.CreationDate);
    const meta = [title && `otsikko "${title}"`, author && `tekijä ${author}`, created && `luotu ${created}`].filter(Boolean);
    if (meta.length) notes.push(`PDF:n tiedot: ${meta.join(', ')}.`);
    if (textless.length) notes.push(`Sivut ilman tekstiä: ${textless.join(', ')}.`);
    return {
      markdown: pages.join('\n\n'),
      skipped: { images: 0, objects: 0, other: 0 },
      notes,
      pages: document.numPages,
    };
  } finally {
    await task.destroy().catch(() => {});
  }
}
