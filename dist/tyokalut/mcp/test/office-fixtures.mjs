import fs from 'node:fs';
import path from 'node:path';
import { writeZip } from '../src/zip.mjs';

function save(filename, data) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, data);
}

// Pienet Office-tiedostot testeihin. Rakennetaan käsin, jotta repoon ei
// tarvitse tallentaa binäärejä.

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

export function writeDocx(filename, { paragraphs = [], table = null, extraBody = '' } = {}) {
  const p = ({ style, text, list }) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${list !== undefined ? `<w:numPr><w:ilvl w:val="${list}"/><w:numId w:val="1"/></w:numPr>` : ''}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  const tbl = table ? `<w:tbl><w:tblPr/>${table.map((row) => `<w:tr>${row.map((c) => `<w:tc><w:p><w:r><w:t>${c}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>` : '';
  const body = `${paragraphs.map(p).join('')}${tbl}${extraBody}`;
  save(filename, writeZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types/>' },
    { name: 'word/document.xml', data: `<?xml version="1.0"?><w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>` },
    { name: 'word/styles.xml', data: `<?xml version="1.0"?><w:styles ${W}>`
      + '<w:style w:type="paragraph" w:styleId="Otsikko1"><w:name w:val="heading 1"/></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Otsikko2"><w:name w:val="heading 2"/></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Normaali"><w:name w:val="Normal"/></w:style></w:styles>' },
  ]));
}

const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export function writePptx(filename, slides) {
  const entries = [{ name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types/>' }];
  // Diat tarkoituksella eri järjestyksessä kuin tiedostonimet: järjestys tulee presentation.xml:stä.
  const order = slides.map((_slide, index) => slides.length - index);
  entries.push({ name: 'ppt/presentation.xml', data: `<?xml version="1.0"?><p:presentation ${P}><p:sldIdLst>${slides.map((_s, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst></p:presentation>` });
  entries.push({ name: 'ppt/_rels/presentation.xml.rels', data: `<?xml version="1.0"?><Relationships>${slides.map((_s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${order[i]}.xml"/>`).join('')}</Relationships>` });
  slides.forEach((slide, i) => {
    const n = order[i];
    const sp = (type, lines) => `<p:sp><p:nvSpPr><p:nvPr>${type ? `<p:ph type="${type}"/>` : ''}</p:nvPr></p:nvSpPr><p:txBody>${lines.map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`;
    entries.push({ name: `ppt/slides/slide${n}.xml`, data: `<?xml version="1.0"?><p:sld ${P}><p:cSld><p:spTree>${sp('title', [slide.title])}${sp('', slide.bullets || [])}${slide.picture ? '<p:pic/>' : ''}</p:spTree></p:cSld></p:sld>` });
    if (slide.notes) {
      entries.push({ name: `ppt/slides/_rels/slide${n}.xml.rels`, data: `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/></Relationships>` });
      entries.push({ name: `ppt/notesSlides/notesSlide${n}.xml`, data: `<?xml version="1.0"?><p:notes ${P}><p:cSld><p:spTree>${sp('sldImg', [])}${sp('body', [slide.notes])}</p:spTree></p:cSld></p:notes>` });
    }
  });
  save(filename, writeZip(entries));
}

export function writeXlsx(filename, rows) {
  const cells = rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => {
    const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
    return typeof value === 'number' ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
  }).join('')}</row>`).join('');
  save(filename, writeZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types/>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hinnasto" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>` },
  ]));
}
