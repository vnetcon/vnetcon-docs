import fs from 'node:fs';
import path from 'node:path';
import { kuvaaTyokirja } from '../../xlsx-kartta.mjs';
import { UserError } from './errors.mjs';
import { convertPdf } from './pdf.mjs';
import { readZip } from './zip.mjs';

// Lähdeaineistojen muunnos Markdowniksi. PDF muunnetaan pdf.js:llä (pdf.mjs),
// muut ilman riippuvuuksia. Office-tiedostot
// ovat zip-paketteja XML:ää. XML luetaan säännöllisillä lausekkeilla eikä
// DTD:tä tai entiteettejä laajenneta, joten ulkoiset entiteetit eivät ole
// mahdollisia. Kuvat, kaaviot, makrot ja upotetut objektit ohitetaan ja
// lasketaan, jotta puute näkyy muunnoksen otsakkeessa.

export const SUPPORTED = ['.docx', '.pptx', '.xlsx', '.pdf', '.md', '.txt'];
const UNSUPPORTED = {
  '.doc': 'Vanha binäärimuoto. Tallenna tiedosto .docx-muodossa.',
  '.ppt': 'Vanha binäärimuoto. Tallenna tiedosto .pptx-muodossa.',
  '.xls': 'Vanha binäärimuoto. Tallenna tiedosto .xlsx-muodossa.',
  '.xlsb': 'Binäärinen työkirja. Tallenna tiedosto .xlsx-muodossa.',
};
const MAX_UNZIPPED = 200 * 1024 * 1024;

export function supportStatus(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (SUPPORTED.includes(extension)) return { supported: true, extension };
  return { supported: false, extension, reason: UNSUPPORTED[extension] || `Muotoa ${extension || '(ei päätettä)'} ei tueta.` };
}

// Palauttaa { markdown, skipped: { images, objects, other }, notes? }.
export async function convertFile(filename) {
  const { supported, extension, reason } = supportStatus(filename);
  if (!supported) throw new UserError(reason);
  if (extension === '.md' || extension === '.txt') {
    const text = fs.readFileSync(filename, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    return { markdown: text, skipped: emptySkipped() };
  }
  if (extension === '.pdf') return convertPdf(filename);
  const entries = zipEntries(filename);
  if (extension === '.docx') return convertDocx(entries);
  if (extension === '.pptx') return convertPptx(entries);
  return convertXlsx(filename, entries);
}

function emptySkipped() {
  return { images: 0, objects: 0, other: 0 };
}

function zipEntries(filename) {
  let entries;
  try {
    entries = readZip(fs.readFileSync(filename), { maxBytes: MAX_UNZIPPED });
  } catch (error) {
    throw new UserError(`Tiedosto ei ole kelvollinen Office-tiedosto: ${error.message}`);
  }
  if (entries.length > 5000) throw new UserError('Office-paketissa on liikaa osia.');
  return new Map(entries.map((entry) => [entry.name, entry.data.toString('utf8')]));
}

// --- XML-apurit --------------------------------------------------------------

export function decode(text) {
  return text
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => safeChar(Number(dec)))
    .replace(/&amp;/g, '&');
}

function safeChar(code) {
  try { return String.fromCodePoint(code); } catch { return ''; }
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? decode(match[1]) : '';
}

// Etsii elementin `name` ylimmän tason esiintymät sisäkkäisyys huomioiden.
function elements(xml, name) {
  const result = [];
  const tokens = new RegExp(`<${name}(?=[\\s>/])[^>]*?(/?)>|</${name}>`, 'g');
  let start = -1;
  let depth = 0;
  tokens.lastIndex = 0;
  let match;
  while ((match = tokens.exec(xml))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0 && start !== -1) { result.push(xml.slice(start, tokens.lastIndex)); start = -1; }
    } else if (match[1] === '/') {
      if (depth === 0) result.push(match[0]);
    } else {
      if (depth === 0) start = match.index;
      depth += 1;
    }
  }
  return result;
}

function count(xml, pattern) {
  return (xml.match(pattern) || []).length;
}

function cell(text) {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, '<br>').trim();
}

function table(rows) {
  const width = Math.max(...rows.map((row) => row.length), 1);
  const padded = rows.map((row) => [...row, ...Array(width - row.length).fill('')]);
  if (!padded.length) return '';
  return [
    `| ${padded[0].map(cell).join(' | ')} |`,
    `|${' --- |'.repeat(width)}`,
    ...padded.slice(1).map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

// --- Word -------------------------------------------------------------------

function docxStyles(entries) {
  const styles = new Map();
  for (const style of elements(entries.get('word/styles.xml') || '', 'w:style')) {
    const id = attr(style.match(/<w:style[^>]*>/)[0], 'w:styleId');
    const name = (style.match(/<w:name w:val="([^"]*)"/) || [])[1] || '';
    const outline = (style.match(/<w:outlineLvl w:val="(\d)"/) || [])[1];
    styles.set(id, { name: decode(name).toLowerCase(), outline: outline === undefined ? null : Number(outline) });
  }
  return styles;
}

// Otsikkotaso tyylin nimestä, ei tunnisteesta: suomenkielinen Word käyttää
// tunnisteita kuten Otsikko1, mutta nimi on aina "heading 1".
function headingLevel(styleId, styles) {
  const style = styles.get(styleId);
  const name = style?.name || styleId.toLowerCase();
  if (name === 'title' || name === 'otsikko') return 1;
  const match = name.match(/^(?:heading|otsikko)\s*(\d)$/);
  if (match) return Math.min(Number(match[1]) + 1, 6);
  if (style?.outline !== null && style?.outline !== undefined) return Math.min(style.outline + 2, 6);
  return 0;
}

function docxRunsText(xml) {
  const cleaned = xml
    .replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '')
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
    .replace(/<w:delText[^>]*>[\s\S]*?<\/w:delText>/g, '')
    .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, '');
  let text = '';
  const pattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g;
  let match;
  while ((match = pattern.exec(cleaned))) {
    if (match[1] !== undefined) text += decode(match[1]);
    else if (match[0] === '<w:tab/>') text += '\t';
    else text += '\n';
  }
  return text;
}

function docxParagraph(xml, styles) {
  const styleId = (xml.match(/<w:pStyle w:val="([^"]*)"/) || [])[1] || '';
  const text = docxRunsText(xml).replace(/[ \t]+$/gm, '').trim();
  if (!text) return '';
  const level = headingLevel(styleId, styles);
  if (level) return `${'#'.repeat(level)} ${text.replace(/\n+/g, ' ')}`;
  if (/<w:numPr>/.test(xml)) {
    const indent = Number((xml.match(/<w:ilvl w:val="(\d+)"/) || [])[1] || 0);
    return `${'  '.repeat(indent)}- ${text.replace(/\n+/g, ' ')}`;
  }
  return text;
}

function docxTable(xml, styles) {
  const rows = elements(xml, 'w:tr').map((row) => elements(row, 'w:tc')
    .map((tc) => elements(tc, 'w:p').map((p) => docxRunsText(p).trim()).filter(Boolean).join('\n')));
  return table(rows);
}

function convertDocx(entries) {
  const document = entries.get('word/document.xml');
  if (!document) throw new UserError('word/document.xml puuttuu.');
  const styles = docxStyles(entries);
  const body = (document.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || '';
  const skipped = {
    images: count(body, /<w:drawing\b|<w:pict\b/g),
    objects: count(body, /<w:object\b/g),
    other: entries.has('word/vbaProject.bin') ? 1 : 0,
  };
  const blocks = [];
  const pattern = /<w:tbl>|<w:p(?=[\s>])/g;
  let position = 0;
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(body))) {
    if (match.index < position) continue;
    if (match[0] === '<w:tbl>') {
      const [tbl] = elements(body.slice(match.index), 'w:tbl');
      blocks.push(docxTable(tbl, styles));
      position = match.index + tbl.length;
    } else {
      const [paragraph] = elements(body.slice(match.index), 'w:p');
      blocks.push(docxParagraph(paragraph, styles));
      position = match.index + paragraph.length;
    }
    pattern.lastIndex = position;
  }
  const notes = elements(entries.get('word/footnotes.xml') || '', 'w:footnote')
    .filter((note) => !/w:type="(separator|continuationSeparator)"/.test(note))
    .map((note) => docxRunsText(note).trim()).filter(Boolean);
  if (notes.length) blocks.push('## Alaviitteet', notes.map((note, index) => `${index + 1}. ${note}`).join('\n'));
  return { markdown: joinBlocks(blocks), skipped };
}

function joinBlocks(blocks) {
  const out = [];
  for (const block of blocks.filter(Boolean)) {
    const previous = out[out.length - 1];
    const listItem = /^\s*- /.test(block);
    if (previous !== undefined && listItem && /^\s*- /.test(previous.split('\n').at(-1))) out[out.length - 1] = `${previous}\n${block}`;
    else out.push(block);
  }
  return `${out.join('\n\n')}\n`;
}

// --- PowerPoint --------------------------------------------------------------

function relationships(xml) {
  const result = new Map();
  for (const tag of xml.match(/<Relationship\b[^>]*>/g) || []) result.set(attr(tag, 'Id'), { target: attr(tag, 'Target'), type: attr(tag, 'Type') });
  return result;
}

function resolvePart(base, target) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(base), target)).replace(/^\//, '');
}

function shapeParagraphs(shape) {
  return elements(shape, 'a:p').map((p) => {
    const level = Number((p.match(/<a:pPr[^>]*\slvl="(\d+)"/) || [])[1] || 0);
    const text = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:br\/>/g)].map((m) => (m[1] === undefined ? '\n' : decode(m[1]))).join('').trim();
    return { level, text };
  }).filter((item) => item.text);
}

function placeholder(shape) {
  const tag = (shape.match(/<p:ph\b[^>]*>/) || [])[0];
  return tag ? attr(tag, 'type') || 'body' : '';
}

function convertPptx(entries) {
  const presentation = entries.get('ppt/presentation.xml');
  if (!presentation) throw new UserError('ppt/presentation.xml puuttuu.');
  const rels = relationships(entries.get('ppt/_rels/presentation.xml.rels') || '');
  const slideParts = (presentation.match(/<p:sldId\b[^>]*>/g) || [])
    .map((tag) => rels.get(attr(tag, 'r:id'))?.target)
    .filter(Boolean)
    .map((target) => resolvePart('ppt/presentation.xml', target));
  const skipped = emptySkipped();
  const blocks = [];
  slideParts.forEach((part, index) => {
    const slide = entries.get(part) || '';
    skipped.images += count(slide, /<p:pic\b/g);
    skipped.objects += count(slide, /<c:chart\b|<p:oleObj\b|<dgm:relIds\b/g);
    const shapes = elements(slide, 'p:sp');
    const titleShape = shapes.find((shape) => ['title', 'ctrTitle'].includes(placeholder(shape)));
    const title = titleShape ? shapeParagraphs(titleShape).map((item) => item.text).join(' ') : '';
    const lines = [`## Dia ${index + 1}${title ? `: ${title.replace(/\n+/g, ' ')}` : ''}`];
    for (const shape of shapes) {
      if (shape === titleShape || ['sldNum', 'dt', 'ftr'].includes(placeholder(shape))) continue;
      for (const item of shapeParagraphs(shape)) lines.push(`${'  '.repeat(item.level)}- ${item.text.replace(/\n+/g, ' ')}`);
    }
    for (const tbl of elements(slide, 'a:tbl')) {
      const rows = elements(tbl, 'a:tr').map((row) => elements(row, 'a:tc').map((tc) => shapeParagraphs(tc).map((item) => item.text).join('\n')));
      lines.push('', table(rows));
    }
    const slideRels = relationships(entries.get(part.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels')) || '');
    const notesRel = [...slideRels.values()].find((rel) => rel.type.endsWith('/notesSlide'));
    if (notesRel) {
      const notes = entries.get(resolvePart(part, notesRel.target)) || '';
      const text = elements(notes, 'p:sp').filter((shape) => placeholder(shape) === 'body')
        .flatMap((shape) => shapeParagraphs(shape).map((item) => item.text)).join('\n');
      if (text) lines.push('', '**Puhujan muistiinpanot:**', '', text);
    }
    blocks.push(lines.join('\n'));
  });
  return { markdown: `${blocks.join('\n\n')}\n`, skipped };
}

// --- Excel ------------------------------------------------------------------

function convertXlsx(filename, entries) {
  const skipped = {
    images: [...entries.keys()].filter((name) => name.startsWith('xl/media/')).length,
    objects: [...entries.keys()].filter((name) => name.startsWith('xl/charts/') || name.startsWith('xl/embeddings/')).length,
    other: entries.has('xl/vbaProject.bin') ? 1 : 0,
  };
  let markdown;
  try {
    markdown = kuvaaTyokirja(filename, ['rakenne', 'arvot']);
  } catch (error) {
    throw new UserError(`Työkirjan luku epäonnistui: ${error.message}`);
  }
  return { markdown: `${markdown.replace(/^# .*\n+/, '').trim()}\n`, skipped };
}
