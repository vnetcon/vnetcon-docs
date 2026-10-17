import fs from 'node:fs';
import path from 'node:path';

// Pieniä PDF-tiedostoja testeihin ilman riippuvuuksia: pakkaamaton sisältövirta,
// Helvetica ja WinAnsiEncoding (ä = 0xE4, ö = 0xF6). Ristiviitetaulukon
// tavusijainnit lasketaan, jotta pdf.js lukee tiedoston korjaamatta.

function winAnsi(text) {
  return Buffer.from(text.replace(/[\\()]/g, (char) => `\\${char}`), 'latin1');
}

function pageStream(lines) {
  const parts = [Buffer.from('BT /F1 12 Tf 72 720 Td 16 TL\n', 'latin1')];
  for (const line of lines) {
    if (line === '') { parts.push(Buffer.from('T*\n', 'latin1')); continue; }
    parts.push(Buffer.from('(', 'latin1'), winAnsi(line), Buffer.from(') Tj T*\n', 'latin1'));
  }
  parts.push(Buffer.from('ET\n', 'latin1'));
  return Buffer.concat(parts);
}

// Harmaasävykuva 1×1, joka piirretään koko sivulle kuten skannerin tuottama sivu.
const IMAGE_STREAM = 'q 612 0 0 792 0 0 cm /Im1 Do Q\n';

// pages: [{ lines: ['rivi', ...] } | { image: true, lines?: [...] }]
export function writePdf(filename, pages, { title = '', author = '' } = {}) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalog = add(null);
  const pagesId = add(null);
  const font = add(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1'));
  const image = add(Buffer.concat([
    Buffer.from('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n', 'latin1'),
    Buffer.from([0x80]),
    Buffer.from('\nendstream', 'latin1'),
  ]));
  const kids = [];
  for (const page of pages) {
    const content = Buffer.concat([
      page.image ? Buffer.from(IMAGE_STREAM, 'latin1') : Buffer.alloc(0),
      page.lines?.length ? pageStream(page.lines) : Buffer.alloc(0),
    ]);
    const stream = add(Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream', 'latin1'),
    ]));
    kids.push(add(Buffer.from(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${image} 0 R >> >> /Contents ${stream} 0 R >>`, 'latin1')));
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, 'latin1');
  objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`, 'latin1');
  const info = add(Buffer.concat([Buffer.from('<< /Title (', 'latin1'), winAnsi(title), Buffer.from(') /Author (', 'latin1'), winAnsi(author), Buffer.from(') >>', 'latin1')]));

  const chunks = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = chunks[0].length;
  const offsets = [];
  objects.forEach((body, index) => {
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
    offsets.push(offset);
    offset += chunk.length;
    chunks.push(chunk);
  });
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((value) => `${String(value).padStart(10, '0')} 00000 n \n`)].join('');
  chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, Buffer.concat(chunks));
}
