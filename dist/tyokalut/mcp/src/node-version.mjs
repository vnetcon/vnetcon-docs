// Vähimmäisversio, jonka package.json lupaa. pdf.js (PDF-lähdeaineistot) vaatii
// saman, ja zlib.crc32 on tätä vanhemmista puuttuva.
export const MIN_NODE = [22, 13];

export function nodeSupported(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
}
