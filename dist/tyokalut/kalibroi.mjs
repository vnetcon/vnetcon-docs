#!/usr/bin/env node
// Kalibrointi: kartoittaa projektin koneellisesti ja kertoo, kuinka hyvin
// geneerinen vnetcon-docs osuu tähän projektiin — ja mikä jää katveeseen.
//
//   node tyokalut/kalibroi.mjs                 # kirjoittaa kalibrointiraportti.md
//   node tyokalut/kalibroi.mjs --json-vain     # vain tila/kalibrointi.json
//   node tyokalut/kalibroi.mjs --hiljaa
//
// Ei riippuvuuksia — toimii heti asennuksen jälkeen ilman npm installia.
//
// TIETOSISÄLTÖ: raportti sisältää hakemisto- ja moduulinimiä, tiedostomääriä ja
// osumalukuja. Se EI sisällä koodia, koodirivejä eikä tiedostojen sisältöä.
// Raportti on tarkoitettu luettavaksi ja tarvittaessa lähetettäväksi eteenpäin
// — lue se silti läpi ennen kuin lähetät.
//
// Ks. ../metodi/kayttoonotto-tyonkulku.md ja ../metodi/laajennuspisteet.md

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const JUURI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // vnetcon-docs/
const argv = process.argv.slice(2);
const HILJAA = argv.includes('--hiljaa');
const JSON_VAIN = argv.includes('--json-vain');
const lippuArvo = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const kerro = (...a) => { if (!HILJAA) console.log(...a); };

// --- Kevyt YAML-luku (skalaarit, 2 välilyönnin sisennys) -------------------

function yamlSkalaari(tiedosto, polku) {
  if (!fs.existsSync(tiedosto)) return null;
  const pino = [];
  for (const raaka of fs.readFileSync(tiedosto, 'utf8').split('\n')) {
    if (/^\s*#/.test(raaka) || !raaka.trim()) continue;
    const m = raaka.match(/^( *)([A-Za-z0-9_.-]+):[ \t]*(.*)$/);
    if (!m) continue;
    const lvl = Math.floor(m[1].length / 2);
    pino[lvl] = m[2];
    pino.length = lvl + 1;
    if (pino.join('.') === polku) {
      let v = m[3].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
      if (v && v !== '[]' && v !== '{}') return v;
    }
  }
  return null;
}

const KONF_T = path.join(JUURI, 'vnetcon.config.yaml');
const konf = (p) => yamlSkalaari(KONF_T, p);
const PROJEKTI = (() => {
  const j = konf('projekti.juuri');
  const ehdokas = j ? path.resolve(JUURI, j) : path.resolve(JUURI, '..');
  return fs.existsSync(ehdokas) ? ehdokas : path.resolve(JUURI, '..');
})();

// --- Tiedostoluettelo (git ensisijaisesti) ---------------------------------

const OHITA_HAKEMISTOT = new Set([
  'node_modules', 'dist', 'build', 'target', 'out', 'vendor', '.venv', 'venv',
  '__pycache__', 'generated', '.git', '.idea', '.vscode', 'coverage',
  'vnetcon-docs', '.next', '.nuxt', 'bin', 'obj', '.gradle', '.terraform',
]);

function gitOn() {
  try {
    execFileSync('git', ['-C', PROJEKTI, 'rev-parse', '--git-dir'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}
const GIT = gitOn();

function git(...args) {
  try { return execFileSync('git', ['-C', PROJEKTI, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); }
  catch { return ''; }
}

function tiedostoluettelo() {
  if (GIT) {
    const ulos = git('ls-files', '-z');
    const lista = ulos.split('\0').filter(Boolean)
      .filter((p) => !p.split('/').some((o) => OHITA_HAKEMISTOT.has(o)));
    if (lista.length) return { lista, lahde: 'git ls-files' };
  }
  const acc = [];
  (function kavele(d, syvyys) {
    if (syvyys > 12) return;
    let alkiot;
    try { alkiot = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of alkiot) {
      if (e.name.startsWith('.') || OHITA_HAKEMISTOT.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) kavele(p, syvyys + 1);
      else if (e.isFile()) acc.push(path.relative(PROJEKTI, p).split(path.sep).join('/'));
    }
  })(PROJEKTI, 0);
  return { lista: acc, lahde: 'tiedostojärjestelmä (ei versionhallintaa)' };
}

const { lista: TIEDOSTOT, lahde: LUETTELON_LAHDE } = tiedostoluettelo();

// --- Kielet ja laajuus -----------------------------------------------------

const KOODIPAATTEET = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte',
  'java', 'kt', 'kts', 'scala', 'groovy',
  'py', 'rb', 'php', 'go', 'rs', 'cs', 'fs', 'vb',
  'sql', 'graphql', 'proto', 'sh', 'bash', 'ps1',
  'c', 'h', 'cpp', 'hpp', 'm', 'swift', 'dart', 'ex', 'exs', 'pl', 'cbl', 'cob',
]);

const paate = (p) => (p.includes('.') ? p.split('.').pop().toLowerCase() : '');

const paatehistogrammi = {};
for (const f of TIEDOSTOT) {
  const e = paate(f);
  if (!e || e.length > 6) continue;
  paatehistogrammi[e] = (paatehistogrammi[e] || 0) + 1;
}
const KIELET = Object.entries(paatehistogrammi)
  .filter(([e]) => KOODIPAATTEET.has(e))
  .sort((a, b) => b[1] - a[1]);

const KOODITIEDOSTOT = TIEDOSTOT.filter((f) => KOODIPAATTEET.has(paate(f)));

// --- Moduuliehdokkaat manifesteista ---------------------------------------

const MANIFESTIT = [
  { re: /(^|\/)package\.json$/, tyyppi: 'node-ts' },
  { re: /(^|\/)pom\.xml$/, tyyppi: 'jvm (maven)' },
  { re: /(^|\/)build\.gradle(\.kts)?$/, tyyppi: 'jvm (gradle)' },
  { re: /(^|\/)pyproject\.toml$/, tyyppi: 'python' },
  { re: /(^|\/)requirements(-\w+)?\.txt$/, tyyppi: 'python' },
  { re: /(^|\/)go\.mod$/, tyyppi: 'go' },
  { re: /(^|\/)[^/]+\.csproj$/, tyyppi: 'dotnet' },
  { re: /(^|\/)composer\.json$/, tyyppi: 'php' },
  { re: /(^|\/)Cargo\.toml$/, tyyppi: 'rust' },
  { re: /(^|\/)Gemfile$/, tyyppi: 'ruby' },
];

const moduuliehdokkaat = new Map();   // hakemisto -> { tyypit:Set, tiedostot, loc }
for (const f of TIEDOSTOT) {
  for (const m of MANIFESTIT) {
    if (!m.re.test(f)) continue;
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
    if (!moduuliehdokkaat.has(dir)) moduuliehdokkaat.set(dir, { tyypit: new Set(), tiedostot: 0, loc: 0 });
    moduuliehdokkaat.get(dir).tyypit.add(m.tyyppi);
  }
}

// Jos manifesteja on vain juuressa, moduulit päätellään koodin sijainnista.
//
// HUOM: tämä päättely EI käytä kiinteää lähdehakemistolistaa (src, app, lib…).
// Kiinteä lista jätti katveeseen jokaisen projektin, jonka koodi ei asu niiden
// alla — shared/, domain/, cmd/, web/, backend/ — eikä listaa voi koskaan
// täydentää kattavaksi. Kelpuutetaan sen sijaan mikä tahansa hakemisto, jossa
// on vähintään KYNNYS koodi­tiedostoa. Jako on silti vain ehdokas: virallinen
// jako syntyy /vnetcon-init -ajossa tila/rekisteri.yaml:iin.
// Hakemistot, joissa oleva koodi ei ole sovelluslogiikkaa. Nämä on rajattava,
// koska yksi .sh-skripti dokumentaatiokansiossa tuottaisi muuten moduulin.
const EI_LAHDE = new Set(['.github', '.gitlab', 'docs', 'doc', 'documentation',
  'examples', 'example', 'fixtures', 'testdata', 'test', 'tests', 'e2e', 'spec']);
// Vakiintuneet lähdejuuret: näiden alla yksikin tiedosto riittää ehdokkaaksi
// (sama herkkyys kuin ennen). Muualla vaaditaan kaksi, jotta yksittäiset
// irralliset skriptit eivät täytä listaa. Lista EI enää rajaa mitään pois.
const LAHDEJUURET = new Set(['src', 'app', 'lib', 'services', 'packages', 'apps', 'modules']);

// Sijaintipäättely ajetaan AINA, myös manifestien rinnalla. Jos se ajettaisiin
// vain manifestien puuttuessa, manifestiton koodi (scripts/, deployment/,
// infra/) jäisi näkymättömiin niissä projekteissa, joissa manifesteja sattuu
// olemaan — eli juuri isoissa. Päällekkäiset ehdotukset ohitetaan, jottei
// manifestimoduulin ylä- tai alapuolelle synny kaksoiskappaletta.
{
  const manifestiPolut = [...moduuliehdokkaat.keys()].filter((d) => d !== '.');
  const paallekkain = (dir) => manifestiPolut.some((c) =>
    c === dir || dir.startsWith(c + '/') || c.startsWith(dir + '/'));

  const maarat = new Map();
  for (const f of KOODITIEDOSTOT) {
    const osat = f.split('/');
    if (osat.length < 2) continue;               // juuren tiedostot → '.'
    if (EI_LAHDE.has(osat[0].toLowerCase())) continue;
    // Kaksitasoinen hakemisto ensisijaisesti (src/maksut), muuten yksitasoinen
    // (scripts/*.py on yhtä lailla moduuli).
    const dir = osat.length >= 3 ? `${osat[0]}/${osat[1]}` : osat[0];
    maarat.set(dir, (maarat.get(dir) || 0) + 1);
  }
  for (const [dir, n] of maarat) {
    if (n < (LAHDEJUURET.has(dir.split('/')[0]) ? 1 : 2)) continue;
    if (moduuliehdokkaat.has(dir) || paallekkain(dir)) continue;
    moduuliehdokkaat.set(dir, { tyypit: new Set(['(lähdehakemisto)']), tiedostot: 0, loc: 0 });
  }
}

// --- Rekisteri: virallinen moduulijako ------------------------------------
// Luetaan ENNEN rivilaskentaa, jotta rivit voidaan kohdistaa rekisterin
// moduuleille. Tämä on paketin ainoa rekisterin lukija: tyokalut/moduulit.mjs
// käyttää tästä syntyvää tila/kalibrointi.json:ia.
//
// Moduuli ei välttämättä ole hakemisto. Kun `tiedostot`-lista on annettu, se
// ratkaisee moduulin laajuuden ja `polku` on vain viite; useampi moduuli voi
// jakaa saman polun (esim. 20 000 rivin lambda-hakemisto jaettuna loogisesti).

const rekisteriT = path.join(JUURI, 'tila', 'rekisteri.yaml');
const rekisteriModuulit = [];
if (fs.existsSync(rekisteriT)) {
  const teksti = fs.readFileSync(rekisteriT, 'utf8');
  const i = teksti.search(/^moduulit:/m);
  if (i >= 0) {
    const runko = teksti.slice(i).split('\n').slice(1)
      .filter((r) => !/^\s*#/.test(r)).join('\n');
    // Merkinnät erotetaan VAIN ylimmän tason "- " -riveistä. Sisennetyt
    // listat (`tiedostot:`) alkavat myös viivalla, ja niiden mukaan
    // jakaminen pilkkoisi merkinnän paloiksi ja hukkaisi tiedostorajauksen.
    const sisennys = (runko.match(/^([ \t]*)-[ \t]/m) || [, ''])[1];
    const jakaja = new RegExp(`\\n(?=${sisennys}-[ \\t])`);
    for (const pala of runko.split(jakaja)) {
      if (!/\S/.test(pala)) continue;
      // Lainausmerkeissä oleva arvo voi sisältää pilkkuja ja aaltosulkeita.
      const kentta = (nimi) => {
        const m = pala.match(new RegExp(`${nimi}:[ \\t]*("[^"]*"|'[^']*'|[^,}\\n]+)`));
        if (!m) return null;
        return m[1].trim().replace(/^["']|["']$/g, '') || null;
      };
      const nimi = kentta('nimi');
      if (!nimi) continue;
      // tiedostot: lohkolista (- polku) tai flow-lista ([a, b]).
      const tiedostot = [];
      const flow = pala.match(/tiedostot:[ \t]*\[([^\]]*)\]/);
      if (flow) {
        for (const s of flow[1].split(',')) {
          const p = s.trim().replace(/^["']|["']$/g, '');
          if (p) tiedostot.push(p);
        }
      } else if (/tiedostot:/.test(pala)) {
        const jono = pala.slice(pala.search(/tiedostot:/)).split('\n').slice(1);
        for (const r of jono) {
          const m = r.match(/^\s+-\s+(.+?)\s*$/);
          if (!m) break;                       // lista loppui
          tiedostot.push(m[1].replace(/^["']|["']$/g, ''));
        }
      }
      rekisteriModuulit.push({
        nimi,
        polku: kentta('polku'),
        tyyppi: kentta('tyyppi'),
        tila: kentta('tila') || 'tekematta',
        pilotti: /pilotti:\s*true/.test(pala),
        paivitetty: kentta('paivitetty'),
        syy: kentta('syy'),
        kuvaus: kentta('kuvaus'),
        tiedostot,
        loc: 0,
        tiedostoja: 0,
      });
    }
  }
}

// Rekisterin väittämät polut. `tiedostot` voittaa `polku`n: jos lista on
// annettu, polku on pelkkä viite eikä sitä saa käyttää kohdistukseen (muuten
// samaa polkua jakavat moduulit veisivät toistensa rivit).
const rekVaittamat = [];
for (const r of rekisteriModuulit) {
  const polut = r.tiedostot.length ? r.tiedostot : (r.polku ? [r.polku] : []);
  for (const p of polut) rekVaittamat.push({ polku: p.replace(/\/+$/, ''), moduuli: r });
}
const rekIndeksi = new Map(rekisteriModuulit.map((r) => [r.nimi, r]));

// Pisin osuma voittaa, jotta sisäkkäiset väittämät toimivat.
function rekisteriModuuliPolusta(f) {
  let osuma = null;
  for (const v of rekVaittamat) {
    if (f === v.polku || f.startsWith(v.polku + '/')) {
      if (!osuma || v.polku.length > osuma.polku.length) osuma = v;
    }
  }
  return osuma ? osuma.moduuli : null;
}

// Onko pääteltyyn ehdokkaaseen jo kohdistettu rekisterin moduuli? Kumpi tahansa
// suunta kelpaa: väittämä voi olla ehdokkaan sisällä tai sen yläpuolella.
function ehdokasKatettu(dir) {
  if (!rekVaittamat.length) return false;
  return rekVaittamat.some((v) => v.polku === dir
    || v.polku.startsWith(dir + '/') || dir.startsWith(v.polku + '/'));
}

// --- Rivimäärät ja probet (yksi lukukierros) ------------------------------

// HUOM: kaavat rakennetaan merkkijonolistoista ilman ulompaa \b(...)\b-käärettä.
// Kääre rikkoisi kaikki vaihtoehdot, jotka päättyvät sulkuun tai kulmasulkuun
// (\b ei osu sanattoman merkin jälkeen) — sanaraja merkitään siksi kaavakohtaisesti.
const kaava = (osat, liput = '') => new RegExp(osat.join('|'), liput);

const PROBET = [
  { tunnus: 'http-reitit', kuvaus: 'HTTP-reitit / endpointit',
    re: kaava([
      String.raw`\b(?:app|router|api|bp|fastify|server)\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(`,
      String.raw`@(?:Get|Post|Put|Patch|Delete|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|Path|Route|Controller|RestController|ApiController)\b`,
      String.raw`Route::(?:get|post|put|patch|delete|resource)`,
      String.raw`@app\.(?:route|get|post|put|delete)`,
      String.raw`\bHandleFunc\s*\(`,
      String.raw`\bMap(?:Get|Post|Put|Delete)\s*\(`,
      String.raw`#\[Route`,
      String.raw`\bpath\s*\(\s*['"]`,
    ]) },
  { tunnus: 'viestijonot', kuvaus: 'Viestijonot / tapahtumat',
    re: kaava([
      String.raw`\b(?:KafkaListener|RabbitListener|JmsListener|SqsListener|MessagePattern|EventPattern|ShouldQueue|consumeMessage|receiveMessage|publishMessage|sendMessage)\b`,
      String.raw`IConsumer\s*<`,
      String.raw`\.subscribe\s*\(`,
      String.raw`\b(?:amqp|kafka|rabbitmq|pubsub|sqs|sns|kinesis|servicebus)\b`,
    ], 'i') },
  { tunnus: 'ajastukset', kuvaus: 'Ajastetut ajot',
    re: kaava([
      String.raw`@Scheduled`,
      String.raw`\b(?:crontab|RecurringJob|Quartz|APScheduler|shared_task|periodic_task)\b`,
      String.raw`\bcron\b`,
      String.raw`setInterval\s*\(`,
      String.raw`time\.Ticker`,
      String.raw`schedule\s*\.\s*every`,
      String.raw`\$schedule\s*->`,
    ], 'i') },
  { tunnus: 'tietokanta', kuvaus: 'Tietokantakäsittely',
    re: kaava([
      String.raw`\bSELECT\s+[\w*]`,
      String.raw`\bINSERT\s+INTO\b`,
      String.raw`\bUPDATE\s+\w+\s+SET\b`,
      String.raw`\bDELETE\s+FROM\b`,
      String.raw`\bCREATE\s+TABLE\b`,
      String.raw`\b(?:jdbc|EntityManager|JdbcTemplate|Eloquent|mongoose|pgx)\b`,
      String.raw`prisma\s*\.\s*\w`,
      String.raw`createQueryBuilder\s*\(`,
      String.raw`DbSet\s*<`,
      String.raw`session\s*\.\s*(?:query|execute)\s*\(`,
      String.raw`\.objects\s*\.\s*(?:filter|get|create|all)\s*\(`,
      String.raw`knex\s*\(`,
      String.raw`sqlx?\s*\.\s*(?:Query|Exec|MustExec)`,
    ], 'i') },
  { tunnus: 'migraatiot', kuvaus: 'Tietokantamigraatiot / skeema',
    polkuRe: /(^|\/)(migrations?|migration|db\/changelog|flyway)(\/|$)|\.sql$/i },
  { tunnus: 'ulkoiset-kutsut', kuvaus: 'Ulkoiset HTTP-kutsut',
    re: kaava([
      String.raw`axios\s*\.\s*\w`,
      String.raw`\bfetch\s*\(`,
      String.raw`httpx\s*\.\s*\w`,
      String.raw`requests\s*\.\s*(?:get|post|put|delete|patch)\s*\(`,
      String.raw`\b(?:RestTemplate|WebClient|HttpClient|IHttpClientFactory|GuzzleHttp|OkHttp|urllib)\b`,
      String.raw`net/http`,
      String.raw`Http::\s*(?:get|post)`,
      String.raw`curl_exec\s*\(`,
    ]) },
  { tunnus: 'validointiskeemat', kuvaus: 'Validointi- ja skeemamäärittelyt (datan muoto)',
    re: kaava([
      String.raw`\bz\s*\.\s*object\s*\(`,
      String.raw`\b(?:Joi|yup)\s*\.\s*object\s*\(`,
      String.raw`\bBaseModel\b`,
      String.raw`\b(?:TypedDict|Serializer|FormRequest|AbstractValidator|JsonProperty)\b`,
      String.raw`@dataclass`,
      String.raw`@(?:Valid|IsString|IsNumber|IsBoolean)\b`,
      String.raw`Assert\\`,
      String.raw`json:"`,
      String.raw`validate:"`,
    ]) },
  { tunnus: 'konfiguraatio', kuvaus: 'Ympäristö- ja konfiguraatioarvot',
    re: kaava([
      String.raw`process\s*\.\s*env\b`,
      String.raw`os\s*\.\s*(?:environ|getenv)`,
      String.raw`System\s*\.\s*getenv\s*\(`,
      String.raw`\bgetenv\s*\(`,
      String.raw`\b(?:IConfiguration|ConfigurationProperties)\b`,
      String.raw`@Value\s*\(`,
      String.raw`viper\s*\.\s*Get`,
      String.raw`\benv\s*\(\s*['"]`,
      String.raw`import\.meta\.env\b`,
    ]) },
  { tunnus: 'sisaantulo-main', kuvaus: 'Käynnistyspisteet (main / CLI)',
    re: kaava([
      String.raw`func main\s*\(`,
      String.raw`if __name__\s*==`,
      String.raw`public static void main\s*\(`,
      String.raw`@click\.\w`,
      String.raw`typer\s*\.\s*\w`,
      String.raw`\b(?:CommandLineRunner|ApplicationRunner)\b`,
      String.raw`extends Command\b`,
      String.raw`\bfn main\s*\(`,
    ]) },
  { tunnus: 'funktiot-lambdat', kuvaus: 'Serverless-funktiot',
    re: kaava([
      String.raw`exports\s*\.\s*handler\b`,
      String.raw`export\s+(?:const|async function)\s+handler\b`,
      String.raw`\b(?:lambda_handler|FunctionName|RequestStreamHandler|RequestHandler|handleRequest)\b`,
      String.raw`def handler\s*\(`,
      String.raw`AWS::Serverless`,
      String.raw`azure-functions`,
      String.raw`\[Function\b`,
    ]) },
];

const proberOsumat = {};
for (const p of PROBET) proberOsumat[p.tunnus] = { tiedostoja: 0, moduuleissa: new Set() };

const SKANNAUSKATTO = 6000;              // tiedostoa
const TIEDOSTOKATTO = 1.5 * 1024 * 1024; // tavua
let skannattu = 0, ohitettuKoko = 0, katkaistu = false;
let locYhteensa = 0;

function moduuliPolusta(f) {
  let osuma = null;
  for (const dir of moduuliehdokkaat.keys()) {
    if (dir === '.') continue;
    if (f === dir || f.startsWith(dir + '/')) {
      if (!osuma || dir.length > osuma.length) osuma = dir;
    }
  }
  return osuma || '.';
}

// Polkupohjaiset probet eivät vaadi tiedoston lukemista.
for (const f of TIEDOSTOT) {
  for (const p of PROBET) {
    if (p.polkuRe && p.polkuRe.test(f)) {
      proberOsumat[p.tunnus].tiedostoja++;
      proberOsumat[p.tunnus].moduuleissa.add(moduuliPolusta(f));
    }
  }
}

for (const f of KOODITIEDOSTOT) {
  if (skannattu >= SKANNAUSKATTO) { katkaistu = true; break; }
  const abs = path.join(PROJEKTI, f);
  let koko = 0;
  try { koko = fs.statSync(abs).size; } catch { continue; }
  if (koko > TIEDOSTOKATTO) { ohitettuKoko++; continue; }
  let teksti;
  try { teksti = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  skannattu++;

  const rivit = teksti.length ? teksti.split('\n').length : 0;
  locYhteensa += rivit;
  const mod = moduuliPolusta(f);
  if (moduuliehdokkaat.has(mod)) {
    const m = moduuliehdokkaat.get(mod);
    m.tiedostot++; m.loc += rivit;
  }
  const rmod = rekisteriModuuliPolusta(f);
  if (rmod) { rmod.tiedostoja++; rmod.loc += rivit; }

  for (const p of PROBET) {
    if (p.polkuRe || !p.re) continue;
    if (p.re.test(teksti)) {
      proberOsumat[p.tunnus].tiedostoja++;
      proberOsumat[p.tunnus].moduuleissa.add(mod);
    }
  }
}

// --- Skeemalähteet ---------------------------------------------------------

const SKEEMALAHTEET = [
  { re: /openapi.*\.(ya?ml|json)$|swagger.*\.(ya?ml|json)$/i, tyyppi: 'openapi' },
  { re: /\.proto$/, tyyppi: 'protobuf' },
  { re: /\.graphql$|schema\.gql$/i, tyyppi: 'graphql' },
  { re: /schema\.prisma$/, tyyppi: 'prisma' },
  { re: /(^|\/)(migrations?|db\/changelog)\/.*\.(sql|xml|ya?ml)$/i, tyyppi: 'migraatiot' },
  { re: /\.avsc$|json-?schema.*\.json$/i, tyyppi: 'json-schema / avro' },
  { re: /(^|\/)(models?|entities|entity)\/.*\.(py|ts|java|cs|rb)$/i, tyyppi: 'orm-mallit' },
];
const skeemat = {};
for (const f of TIEDOSTOT) {
  for (const s of SKEEMALAHTEET) {
    if (s.re.test(f)) {
      (skeemat[s.tyyppi] ||= { maara: 0, esimerkit: [] });
      skeemat[s.tyyppi].maara++;
      if (skeemat[s.tyyppi].esimerkit.length < 3) skeemat[s.tyyppi].esimerkit.push(f);
    }
  }
}

// --- Komennot (testi/build) ja CI ----------------------------------------

const komennot = { testi: null, build: null, lint: null, lahde: null };
const juuriPkg = path.join(PROJEKTI, 'package.json');
if (fs.existsSync(juuriPkg)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(juuriPkg, 'utf8'));
    const s = pkg.scripts || {};
    if (s.test) { komennot.testi = `npm test`; komennot.lahde = 'package.json'; }
    if (s.build) komennot.build = `npm run build`;
    if (s.lint) komennot.lint = `npm run lint`;
  } catch { /* ohitetaan */ }
}
if (!komennot.testi) {
  if (TIEDOSTOT.some((f) => /(^|\/)pom\.xml$/.test(f))) { komennot.testi = 'mvn test'; komennot.lahde = 'pom.xml'; }
  else if (TIEDOSTOT.some((f) => /build\.gradle/.test(f))) { komennot.testi = './gradlew test'; komennot.lahde = 'gradle'; }
  else if (TIEDOSTOT.some((f) => /(^|\/)pyproject\.toml$/.test(f))) { komennot.testi = 'pytest'; komennot.lahde = 'pyproject.toml'; }
  else if (TIEDOSTOT.some((f) => /(^|\/)go\.mod$/.test(f))) { komennot.testi = 'go test ./...'; komennot.lahde = 'go.mod'; }
  else if (TIEDOSTOT.some((f) => /\.csproj$/.test(f))) { komennot.testi = 'dotnet test'; komennot.lahde = 'csproj'; }
  else if (TIEDOSTOT.some((f) => /(^|\/)composer\.json$/.test(f))) { komennot.testi = 'composer test'; komennot.lahde = 'composer.json'; }
  else if (TIEDOSTOT.some((f) => /(^|\/)Gemfile$/.test(f))) { komennot.testi = 'bundle exec rspec'; komennot.lahde = 'Gemfile'; }
}
const ciTiedostot = TIEDOSTOT.filter((f) => /^\.github\/workflows\/|^\.gitlab-ci\.yml$|^azure-pipelines\.ya?ml$|^Jenkinsfile$|^\.circleci\//.test(f));
const ajoskriptit = TIEDOSTOT.filter((f) => /^(Makefile|justfile|Taskfile\.ya?ml)$|^[^/]*\.sh$/.test(f)).slice(0, 10);
// Viimeinen oljenkorsi: juuren ajoskripti, jonka nimessä on testi/test.
if (!komennot.testi) {
  const testiskripti = ajoskriptit.find((f) => /test|testi/i.test(f));
  if (testiskripti) { komennot.testi = `./${testiskripti}`; komennot.lahde = 'juuren ajoskripti (vahvista)'; }
}

// --- Olemassa oleva dokumentaatio -----------------------------------------

const olemassaOlevatDokit = TIEDOSTOT.filter((f) =>
  /^(README|CONTRIBUTING|ARCHITECTURE)/i.test(f) || /^docs?\//i.test(f) || /(^|\/)adr(\/|s\/)/i.test(f)
);

// --- vnetcon-docsin oma tila ---------------------------------------------

function md_tiedostot(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'html' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) md_tiedostot(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function frontmatter(teksti) {
  const m = teksti.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const ulos = {};
  for (const rivi of m[1].split('\n')) {
    const kv = rivi.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (kv) ulos[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  const lahteet = m[1].match(/^lahteet:\s*(\[[^\]]*\]|(?:\n[ \t]*-[^\n]*)+)/m);
  if (lahteet) {
    ulos._lahteet = lahteet[1].startsWith('[')
      ? lahteet[1].slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
      : lahteet[1].split('\n').map((s) => s.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean);
  }
  return ulos;
}

const DOKIT = ['moduulit', 'liiketoimintaprosessit', 'jarjestelmaprosessit', 'datamallit']
  .flatMap((d) => md_tiedostot(path.join(JUURI, d)));

const dokTila = {
  yhteensa: DOKIT.length,
  tyypit: {},
  luonnos: 0, valmis: 0, vanhentunut: 0,
  todoja: 0,
  dokumentoidutModuulit: new Set(),
  puuttuvatLahteet: [],
  lahteitaYhteensa: 0,
};
for (const f of DOKIT) {
  const teksti = fs.readFileSync(f, 'utf8');
  const fm = frontmatter(teksti);
  if (fm.tyyppi) dokTila.tyypit[fm.tyyppi] = (dokTila.tyypit[fm.tyyppi] || 0) + 1;
  if (fm.tila === 'luonnos') dokTila.luonnos++;
  else if (fm.tila === 'valmis') dokTila.valmis++;
  else if (fm.tila === 'vanhentunut') dokTila.vanhentunut++;
  dokTila.todoja += (teksti.match(/^>\s*TODO:/gm) || []).length;
  const rel = path.relative(JUURI, f).split(path.sep).join('/');
  if (rel.startsWith('moduulit/')) dokTila.dokumentoidutModuulit.add(rel.split('/')[1]);
  for (const l of (fm._lahteet || [])) {
    const puhdas = l.split(':')[0];
    if (!puhdas || puhdas.includes('<') || puhdas.includes('...')) continue;
    dokTila.lahteitaYhteensa++;
    if (!fs.existsSync(path.join(PROJEKTI, puhdas))) dokTila.puuttuvatLahteet.push({ dokki: rel, polku: puhdas });
  }
}

// Käyttöönoton tila
const kartoitusT = path.join(JUURI, 'metodi', 'kartoitus.md');
const kartoitusPohja = fs.existsSync(kartoitusT)
  && /Tämä tiedosto on vielä pohja/.test(fs.readFileSync(kartoitusT, 'utf8'));
const konfOlemassa = fs.existsSync(KONF_T);
const projektiYamlT = path.join(JUURI, 'tila', 'projekti.yaml');
const projektiTayttamaton = !fs.existsSync(projektiYamlT)
  || /TÄYTTÄMÄTÖN/.test(fs.readFileSync(projektiYamlT, 'utf8'));

// Synkronoinnin lähtötaso
const baseline = yamlSkalaari(path.join(JUURI, 'tila', 'synkronoitu.yaml'), 'viimeisin_synkronoitu_commit');
let baselineIka = null, headLyhyt = null;
if (GIT) {
  headLyhyt = git('rev-parse', '--short', 'HEAD').trim() || null;
  if (baseline) {
    const n = git('rev-list', '--count', `${baseline}..HEAD`).trim();
    const pvm = git('log', '-1', '--format=%cs', baseline).trim();
    baselineIka = { committeja: /^\d+$/.test(n) ? Number(n) : null, pvm: pvm || null };
  }
}

// --- Laajuusarvio ---------------------------------------------------------
// Perusta: toteutuneet ajot suuressa julkishallinnon monorepossa — noin
// 0,15–0,35 M tokenia per moduuli sisältäen verifioinnin, ja 6–20 dokumenttia
// per moduuli koon mukaan.

const moduuliLista = [...moduuliehdokkaat.entries()]
  .filter(([d]) => d !== '.' || moduuliehdokkaat.size === 1)
  .map(([dir, v]) => ({
    hakemisto: dir,
    tyypit: [...v.tyypit],
    tiedostot: v.tiedostot,
    loc: v.loc,
    // Rekisteri on jo ottanut tämän koodin haltuunsa → ei oma moduuli.
    katettu: ehdokasKatettu(dir),
  }))
  .sort((a, b) => b.loc - a.loc);

// Rekisteri on virallinen jako. Ilman sitä arvio perustuu pääteltyihin
// ehdokkaisiin — muuten arvio ei vastaisi sitä listaa, jonka käyttäjä näkee.
const rekisteriKaytossa = rekisteriModuulit.length > 0;
const rekisteriTyojono = rekisteriModuulit.filter((r) => r.tila !== 'rajattu-pois');
const moduuleja = rekisteriKaytossa ? rekisteriTyojono.length : moduuliLista.length;
const arvionLahde = rekisteriKaytossa ? 'tila/rekisteri.yaml' : 'päätellyt ehdokkaat';
// Dokumentoitu = moduuliehdokas, jonka nimellä on moduulit/-hakemisto.
// Nimeämissääntö on sama kuin tyokalut/moduulit.mjs:ssä: perusnimi, paitsi jos se
// on liian yleinen tai törmää toiseen ehdokkaaseen → yläkansio mukaan.
const GENEERISET_NIMET = new Set(['src', 'lib', 'app', 'core', 'main', 'server', 'client',
  'api', 'common', 'shared', 'yleiset', 'backend', 'frontend', 'web', 'internal', 'pkg']);
const kaikkiModuuliPolut = moduuliLista.map((m) => m.hakemisto);
const nimiPolusta = (dir) => {
  const osat = String(dir).split('/').filter(Boolean);
  const perus = osat[osat.length - 1] || dir;
  if (osat.length < 2) return perus;
  const tormaa = kaikkiModuuliPolut.filter((d) => (d.split('/').filter(Boolean).pop() || d) === perus).length > 1;
  return (GENEERISET_NIMET.has(perus.toLowerCase()) || tormaa) ? osat.slice(-2).join('-') : perus;
};
// Rekisterin kanssa tila luetaan rekisteristä; ilman sitä päätellään siitä,
// onko ehdokkaan nimellä moduulit/-hakemisto.
const dokumentoidutKandidaatit = rekisteriKaytossa
  ? rekisteriTyojono.filter((r) => r.tila === 'valmis'
    || dokTila.dokumentoidutModuulit.has(r.nimi)).length
  : moduuliLista.filter((m) => dokTila.dokumentoidutModuulit.has(nimiPolusta(m.hakemisto))).length;
const dokumentoimatta = Math.max(0, moduuleja - dokumentoidutKandidaatit);
// Dokumentoituja moduuleja voi olla enemmän kuin ehdokkaita (nimet eivät täsmää
// tai jako on tehty käsin) — se on itsessään tieto, joten kirjataan molemmat.
const nimieroja = dokTila.dokumentoidutModuulit.size - dokumentoidutKandidaatit;

// Kertoimet ovat konfiguroitavissa, koska oletukset ovat YHDESTÄ mitatusta
// projektista (62 kloc, python + react-ts). Kalibroi omista ajoistasi:
// dokumentoi yksi moduuli, ota seinäkelloaika ja Claude Coden /cost-luku.
const TUNNIT_PER_KLOC = Number(konf('arvio.tunnit_per_kloc')) || 0.39;
const USD_PER_KLOC = Number(konf('arvio.usd_per_kloc')) || 9.2;
const TUNNIT_PER_MODUULI = Number(konf('arvio.tunnit_per_moduuli')) || 1;
const USD_PER_MODUULI = Number(konf('arvio.usd_per_moduuli')) || 25;
// Yhdestä mittauksesta ei saa haarukkaa, joten se levitetään karkeasti.
const ALA = 0.6, YLA = 1.4;

// Rivipainotus: moduulien koot vaihtelevat mitatusti satakertaisesti (85 → 11 852
// riviä samassa projektissa), joten tasainen kerroin per moduuli on väärä heti kun
// arviota katsotaan moduuli- tai osa-aluetasolla. Käytetään rivimäärää kun se on
// tiedossa; muuten palataan moduulikertoimeen.
const dokumentoimattomatModuulit = rekisteriKaytossa
  ? rekisteriTyojono.filter((r) => r.tila !== 'valmis' && !dokTila.dokumentoidutModuulit.has(r.nimi))
  : moduuliLista.filter((m) => !dokTila.dokumentoidutModuulit.has(nimiPolusta(m.hakemisto)));
const dokumentoimattomatRivit = dokumentoimattomatModuulit.reduce((s, m) => s + (m.loc || 0), 0);
const rivipainotus = dokumentoimattomatRivit > 0;
const kloc = dokumentoimattomatRivit / 1000;

const tunnitPohja = rivipainotus ? kloc * TUNNIT_PER_KLOC : dokumentoimatta * TUNNIT_PER_MODUULI;
const usdPohja = rivipainotus ? kloc * USD_PER_KLOC : dokumentoimatta * USD_PER_MODUULI;

// Moduulikohtainen erittely: tämä on se taso, jolla osa-alue kerrallaan myyminen
// ja priorisointi tapahtuu — kokonaissumma peittää satakertaiset erot.
const arvioModuuleittain = dokumentoimattomatModuulit
  .map((m) => {
    const nimi = m.nimi || nimiPolusta(m.hakemisto);
    const loc = m.loc || 0;
    const t = loc > 0 ? (loc / 1000) * TUNNIT_PER_KLOC : TUNNIT_PER_MODUULI;
    const u = loc > 0 ? (loc / 1000) * USD_PER_KLOC : USD_PER_MODUULI;
    return { nimi, loc, tunnit: +t.toFixed(2), usd: Math.round(u) };
  })
  .sort((a, b) => b.loc - a.loc);

const arvio = {
  moduuleja,
  lahde: arvionLahde,
  dokumentoitu: dokumentoidutKandidaatit,
  dokumentoituja_dokeissa: dokTila.dokumentoidutModuulit.size,
  nimieroja,
  dokumentoimatta,
  dokumentoimatta_rivit: dokumentoimattomatRivit,
  painotus: rivipainotus ? 'koodirivit' : 'moduulimäärä',
  tunnit_min: +(tunnitPohja * ALA).toFixed(2),
  tunnit_max: +(tunnitPohja * YLA).toFixed(2),
  usd_min: Math.round(usdPohja * ALA),
  usd_max: Math.round(usdPohja * YLA),
  tokenit_min_M: +(dokumentoimatta * 0.15).toFixed(2),
  tokenit_max_M: +(dokumentoimatta * 0.35).toFixed(2),
  dokkeja_min: dokumentoimatta * 6,
  dokkeja_max: dokumentoimatta * 20,
  moduuleittain: arvioModuuleittain,
  perusta: rivipainotus
    ? `toteutuneet ajot — ~${TUNNIT_PER_KLOC} h agenttiaikaa ja ~$${USD_PER_KLOC} tokenikulutusta per 1 000 koodiriviä`
    : `toteutuneet ajot — per moduuli ~${TUNNIT_PER_MODUULI} h agenttiaikaa ja ~$${USD_PER_MODUULI} tokenikulutusta`,
};

// --- Löydökset -----------------------------------------------------------

const loydokset = [];
const L = (vakavuus, aihe, teksti, toimenpide) => loydokset.push({ vakavuus, aihe, teksti, toimenpide });

if (!konfOlemassa) L('esto', 'Käyttöönotto', 'vnetcon.config.yaml puuttuu.', 'Aja Claudessa /vnetcon-init.');
if (kartoitusPohja) L('esto', 'Kartoitus', 'metodi/kartoitus.md on yhä geneerinen pohja — dokumentointi käyttää silloin vain yleisiä hakuja.', 'Aja /vnetcon-init (vaihe I2) tai kirjoita projektikohtaiset haut käsin.');
if (projektiTayttamaton) L('esto', 'Projektin faktat', 'tila/projekti.yaml on täyttämätön.', 'Aja /vnetcon-init.');
if (!GIT) L('varoitus', 'Versionhallinta', 'Projekti ei näytä olevan git-repo — skooppirajaus ja synkronointi eivät toimi.', 'Aseta projekti.versionhallinta: none ja huomioi, että päivitys tehdään käsin.');

// --- Onko katve jo tutkittu ja kirjattu? ----------------------------------
// metodi/kartoitus.md:n "Katvealueet"-taulukko on se paikka, johon ihminen
// kirjaa tutkitun katveen ja sen syyn. Ilman tätä tarkistusta kalibrointi
// raportoi saman ratkaistun löydöksen joka ajossa ikuisesti — ja raportti, joka
// toistaa käsiteltyjä löydöksiä, opettaa lukijan ohittamaan löydökset.
//
// Löydöstä EI poisteta, vain sen vakavuus laskee: hiljainen katoaminen olisi
// vastoin koko menettelyn periaatetta (sano ääneen mitä jäi katveeseen).
const kartoituksenKatveet = (() => {
  const f = path.join(JUURI, 'metodi', 'kartoitus.md');
  if (!fs.existsSync(f)) return [];
  const teksti = fs.readFileSync(f, 'utf8');
  const i = teksti.search(/^##+\s*Katvealueet/mi);
  if (i < 0) return [];
  const loppu = teksti.slice(i + 1).search(/^##+\s/m);
  const runko = loppu > 0 ? teksti.slice(i, i + 1 + loppu) : teksti.slice(i);
  const ulos = [];
  for (const rivi of runko.split('\n')) {
    if (!/^\s*\|/.test(rivi)) continue;
    const sarakkeet = rivi.split('|').map((s) => s.trim()).filter((s, n, a) => n > 0 && n < a.length - 1);
    if (sarakkeet.length < 2) continue;
    const alue = sarakkeet[0], vastaus = sarakkeet[1];
    // Ohita otsikko-, erotin- ja pohjarivit (mallipohjan <esim. …> -paikanvaraajat).
    if (/^-+$/.test(alue) || /^:?-{2,}/.test(alue)) continue;
    if (/^alue$/i.test(alue) || !alue || !vastaus) continue;
    if (/^</.test(alue)) continue;
    ulos.push({ alue, vastaus });
  }
  return ulos;
})();

// Normalisoitu vertailu: agentti kirjoittaa alueen nimen omin sanoin, joten
// tarkka merkkijonovertailu ei riitä. Osumaksi kelpaa kumpi tahansa suunta.
const norm = (s) => String(s).toLowerCase().replace(/[^a-zä-ö0-9]+/g, ' ').trim();
function kartoituksessaKasitelty(nimi) {
  const n = norm(nimi);
  if (!n) return null;
  return kartoituksenKatveet.find((k) => {
    const a = norm(k.alue);
    return a === n || a.includes(n) || n.includes(a);
  }) || null;
}

for (const p of PROBET) {
  const o = proberOsumat[p.tunnus];
  if (o.tiedostoja !== 0) continue;
  const kirjattu = kartoituksessaKasitelty(p.kuvaus);
  if (kirjattu) {
    L('kasitelty', `Kartoitus: ${p.kuvaus}`,
      `Ei osumia (${p.tunnus}), mutta alue on tutkittu ja kirjattu kartoitukseen: "${kirjattu.vastaus}".`,
      'Ei toimenpiteitä. Tarkista uudelleen vain jos koodi on muuttunut niin, että kirjattu päätelmä ei enää pidä.');
  } else {
    L('katve', `Kartoitus: ${p.kuvaus}`,
      `Yleiset haut eivät löytäneet yhtään osumaa (${p.tunnus}).`,
      'Joko tätä ei tässä projektissa ole, tai se on toteutettu tavalla jota geneeriset haut eivät tunnista. Tarkista käsin; jos kyse on jälkimmäisestä, lisää projektikohtainen haku metodi/kartoitus.md:hen.');
  }
}

if (moduuleja === 0) L('esto', 'Moduulijako', 'Manifestitiedostoja tai lähdehakemistorakennetta ei löytynyt — moduulijakoa ei voi päätellä.', 'Määrittele moduulijako käsin tila/rekisteri.yaml:iin ja perustele se tila/projekti.yaml:iin.');
if (Object.keys(skeemat).length === 0) {
  const kirjattu = kartoituksessaKasitelty('skeemalähteet');
  if (kirjattu) {
    L('kasitelty', 'Skeemalähteet',
      `Koneluettavia skeemalähteitä ei löytynyt, ja asia on kirjattu kartoitukseen: "${kirjattu.vastaus}".`,
      'Ei toimenpiteitä. Muista silti, että datamallit on kirjoitettava koodista lukemalla ja merkittävä tila: luonnos kunnes tarkistettu.');
  } else {
    L('katve', 'Skeemalähteet', 'Koneluettavia skeemalähteitä ei löytynyt (OpenAPI, migraatiot, ORM, protobuf).', 'Datamallit kuvataan silloin koodista lukemalla — hitaampaa ja epävarmempaa. Tarkista onko skeemoja epätyypillisessä muodossa.');
  }
}
if (!komennot.testi) L('varoitus', 'Testikomento', 'Testikomentoa ei voitu päätellä.', 'Kirjaa se tila/projekti.yaml → komennot.testi; tiketin toteutus tarvitsee sitä.');
if (dokTila.puuttuvatLahteet.length) L('varoitus', 'Ajautuminen', `${dokTila.puuttuvatLahteet.length} lähdepolkua dokumentaatiossa ei löydy enää projektista.`, 'Aja /synkronoi-dokumentaatio.');
if (baselineIka && baselineIka.committeja > 200) L('varoitus', 'Ajautuminen', `Synkronoinnin lähtötaso on ${baselineIka.committeja} committia jäljessä.`, 'Aja /synkronoi-dokumentaatio; erittäin suuri aukko kannattaa käydä osa-alue kerrallaan.');
if (dokTila.yhteensa > 0) {
  const tiheys = dokTila.todoja / dokTila.yhteensa;
  if (tiheys > 1.5) L('varoitus', 'Dokumentaation laatu', `TODO-tiheys on korkea (${dokTila.todoja} merkintää / ${dokTila.yhteensa} dokumenttia).`, 'Suuri osa TODOista on substanssikysymyksiä: käy ne läpi substanssiosaajan kanssa. Jos ne ovat teknisiä, kartoitus ei osu.');
}
if (katkaistu) L('varoitus', 'Kalibroinnin kattavuus', `Skannaus katkaistiin ${SKANNAUSKATTO} tiedoston jälkeen — osumaluvut ovat alarajoja.`, 'Suuressa projektissa aja kalibrointi osa-alue kerrallaan.');
if (nimieroja > 0) L('varoitus', 'Moduulien nimet', `${nimieroja} dokumentoitua moduulia ei vastaa yhtään ${rekisteriKaytossa ? 'rekisterin moduulia' : 'pääteltyä moduuliehdokasta'} nimeltä.`, `Tarkista, että moduulit/-hakemistojen nimet vastaavat ${rekisteriKaytossa ? 'tila/rekisteri.yaml:n nimiä' : 'projektin hakemistoja'} — muuten synkronointi ei löydä oikeita dokkeja.`);

// Rekisterin väittämät polut on tarkistettava: kirjoitusvirhe `tiedostot`- tai
// `polku`-kentässä ei näy mitenkään, mutta pudottaa koodin dokumentoinnin
// ulkopuolelle ilman varoitusta.
if (rekisteriKaytossa) {
  const tiedostojoukko = new Set(TIEDOSTOT);
  const hakemistot = new Set();
  for (const f of TIEDOSTOT) {
    const osat = f.split('/');
    for (let i = 1; i < osat.length; i++) hakemistot.add(osat.slice(0, i).join('/'));
  }
  const kuolleet = rekVaittamat
    .filter((v) => !tiedostojoukko.has(v.polku) && !hakemistot.has(v.polku))
    .map((v) => `${v.moduuli.nimi} → ${v.polku}`);
  if (kuolleet.length) {
    L('varoitus', 'Rekisterin polut',
      `${kuolleet.length} rekisterin polkua ei löydy projektista: ${kuolleet.slice(0, 5).join(', ')}${kuolleet.length > 5 ? ` (+${kuolleet.length - 5})` : ''}.`,
      'Korjaa polut tila/rekisteri.yaml:iin. Väärä polku tarkoittaa, että moduulin koodi jää kokonaan dokumentoinnin ulkopuolelle.');
  }
  const tyhjat = rekisteriTyojono.filter((r) => r.loc === 0).map((r) => r.nimi);
  if (tyhjat.length) {
    L('varoitus', 'Rekisterin kattavuus',
      `${tyhjat.length} rekisterin moduulille ei kohdistunut yhtään koodiriviä: ${tyhjat.slice(0, 5).join(', ')}${tyhjat.length > 5 ? ` (+${tyhjat.length - 5})` : ''}.`,
      'Lisää moduulille `polku` tai `tiedostot`-lista tila/rekisteri.yaml:iin — muuten laajuusarvio ja moduulilistaus eivät tunne sen kokoa.');
  }
  const kattamattomat = moduuliLista.filter((m) => !m.katettu && m.loc > 0);
  if (kattamattomat.length) {
    L('katve', 'Rekisterin ulkopuolinen koodi',
      `${kattamattomat.length} koodihakemistoa ei kuulu yhteenkään rekisterin moduuliin: ${kattamattomat.slice(0, 5).map((m) => `${m.hakemisto} (${m.loc.toLocaleString('fi-FI')} riviä)`).join(', ')}${kattamattomat.length > 5 ? ` (+${kattamattomat.length - 5})` : ''}.`,
      'Joko lisää moduuli tila/rekisteri.yaml:iin tai merkitse alue rajattu-pois ja perustele syy. Ilman tätä koodi jää hiljaisesti dokumentoimatta.');
  }
}

const VAKAVUUS_JARJ = { esto: 0, varoitus: 1, katve: 2, kasitelty: 3 };
loydokset.sort((a, b) => VAKAVUUS_JARJ[a.vakavuus] - VAKAVUUS_JARJ[b.vakavuus]);

// --- Tuloste --------------------------------------------------------------

const tulos = {
  luotu: null,   // leimataan raporttiin, ei JSONiin (vertailukelpoisuus)
  projekti: konf('projekti.nimi') || path.basename(PROJEKTI),
  luettelon_lahde: LUETTELON_LAHDE,
  git: GIT ? { head: headLyhyt, baseline, baselineIka } : null,
  laajuus: { tiedostoja: TIEDOSTOT.length, kooditiedostoja: KOODITIEDOSTOT.length, rivit: locYhteensa, skannattu, ohitettu_koko: ohitettuKoko, katkaistu },
  kielet: KIELET.slice(0, 12).map(([e, n]) => ({ paate: e, tiedostoja: n })),
  moduulit: moduuliLista.map((m) => ({ ...m, nimi: nimiPolusta(m.hakemisto) })),
  rekisteri: rekisteriModuulit,
  probet: PROBET.map((p) => ({ tunnus: p.tunnus, kuvaus: p.kuvaus, tiedostoja: proberOsumat[p.tunnus].tiedostoja, moduuleissa: proberOsumat[p.tunnus].moduuleissa.size })),
  skeemalahteet: skeemat,
  komennot,
  ci: ciTiedostot.slice(0, 10),
  ajoskriptit,
  olemassa_oleva_dokumentaatio: olemassaOlevatDokit.slice(0, 15),
  dokumentaation_tila: {
    dokkeja: dokTila.yhteensa,
    tyypit: dokTila.tyypit,
    valmis: dokTila.valmis, luonnos: dokTila.luonnos, vanhentunut: dokTila.vanhentunut,
    todoja: dokTila.todoja,
    dokumentoituja_moduuleja: dokTila.dokumentoidutModuulit.size,
    lahteita: dokTila.lahteitaYhteensa,
    puuttuvia_lahteita: dokTila.puuttuvatLahteet.length,
  },
  kayttoonotto: { konfiguraatio: konfOlemassa, kartoitus_kalibroitu: !kartoitusPohja, projekti_yaml_taytetty: !projektiTayttamaton },
  arvio,
  loydokset,
};

const jsonPolku = path.join(JUURI, 'tila', 'kalibrointi.json');
fs.mkdirSync(path.dirname(jsonPolku), { recursive: true });
fs.writeFileSync(jsonPolku, JSON.stringify(tulos, null, 2) + '\n');

if (!JSON_VAIN) {
  const raporttiPolku = path.resolve(JUURI, lippuArvo('--ulos') || 'kalibrointiraportti.md');
  fs.writeFileSync(raporttiPolku, raportti(tulos));
  kerro(`Kalibrointiraportti: ${raporttiPolku}`);
}
kerro(`Konedata:             ${jsonPolku}`);
kerro('');
const estot = loydokset.filter((l) => l.vakavuus === 'esto').length;
const varoitukset = loydokset.filter((l) => l.vakavuus === 'varoitus').length;
const katveet = loydokset.filter((l) => l.vakavuus === 'katve').length;
const kasitellyt = loydokset.filter((l) => l.vakavuus === 'kasitelty').length;
kerro(`Löydökset: ${estot} estoa · ${varoitukset} varoitusta · ${katveet} katvealuetta`
  + (kasitellyt ? ` · ${kasitellyt} käsiteltyä` : ''));
if (estot) kerro('→ Estot on korjattava ennen kuin dokumentointi tuottaa luotettavaa jälkeä.');

// --- Raportin muotoilu ---------------------------------------------------

function taulu(otsikot, rivit) {
  if (!rivit.length) return '_(ei havaintoja)_\n';
  return `| ${otsikot.join(' | ')} |\n| ${otsikot.map(() => '---').join(' | ')} |\n`
    + rivit.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n';
}

function raportti(t) {
  // Pieni moduuli antaa alle 0,1 h — nolla näyttäisi siltä ettei työtä ole.
  const tunnit = (h) => (h > 0 && h < 0.1 ? '<0,1' : String(+Number(h).toFixed(1)));
  const pvm = new Date().toISOString().slice(0, 10);
  const VAK = { esto: '🔴 esto', varoitus: '🟡 varoitus', katve: '⚪ katve', kasitelty: '✅ käsitelty' };
  let s = `# Kalibrointiraportti — ${t.projekti}

_Luotu ${pvm} · vnetcon-docs · lähde: ${t.luettelon_lahde}${t.git && t.git.head ? ` · HEAD ${t.git.head}` : ''}_

Tämä raportti kertoo, kuinka hyvin geneerinen vnetcon-docs osuu tähän projektiin
ja mikä jää katveeseen. Se on luotu koneellisesti, ilman tekoälyagenttia.

> **Tietosisältö:** raportissa on hakemisto- ja moduulinimiä, tiedostomääriä ja
> osumalukuja. **Ei koodia eikä tiedostojen sisältöä.** Raportti on tarkoitettu
> myös lähetettäväksi eteenpäin — lue se silti läpi ennen kuin lähetät.

## Yhteenveto

${taulu(['Asia', 'Tila'], [
    ['Käyttöönotto tehty', t.kayttoonotto.konfiguraatio ? 'kyllä' : '**ei**'],
    ['Kartoitus kalibroitu tähän projektiin', t.kayttoonotto.kartoitus_kalibroitu ? 'kyllä' : '**ei — käytössä vain geneeriset haut**'],
    ['Moduuleja', `${t.arvio.moduuleja}  _(lähde: ${t.arvio.lahde})_`],
    ['Dokumentoitu', `${t.arvio.dokumentoitu} / ${t.arvio.moduuleja}`],
    ['Dokumentteja', String(t.dokumentaation_tila.dokkeja)],
    ['Avoimia TODO-merkintöjä', String(t.dokumentaation_tila.todoja)],
    ['Lähdepolkuja jotka eivät löydy', String(t.dokumentaation_tila.puuttuvia_lahteita)],
  ])}
## Löydökset

${t.loydokset.length === 0 ? '_Ei löydöksiä._\n' : t.loydokset.map((l) =>
    `### ${VAK[l.vakavuus]} — ${l.aihe}\n\n${l.teksti}\n\n**Toimenpide:** ${l.toimenpide}\n`).join('\n')}
**Vakavuusluokat.** 🔴 *esto* = dokumentointi ei tuota luotettavaa jälkeä ennen
korjausta. 🟡 *varoitus* = toimii, mutta laatu tai ajantasaisuus kärsii.
⚪ *katve* = geneeriset haut eivät nähneet aluetta; voi olla myös oikea tulos
(aluetta ei ole). ✅ *käsitelty* = katve on tutkittu ja päätelmä kirjattu
\`metodi/kartoitus.md\`:n Katvealueet-taulukkoon — ei toimenpiteitä. Käsitellyt
näkyvät edelleen, koska hiljainen katoaminen olisi vastoin sitä periaatetta,
että katve sanotaan ääneen.

## Projektin laajuus

- Tiedostoja: **${t.laajuus.tiedostoja}** (koodia ${t.laajuus.kooditiedostoja})
- Koodirivejä: **${t.laajuus.rivit.toLocaleString('fi-FI')}** (skannattu ${t.laajuus.skannattu} tiedostoa${t.laajuus.ohitettu_koko ? `, ${t.laajuus.ohitettu_koko} ohitettu koon vuoksi` : ''})
${t.laajuus.katkaistu ? '- ⚠️ Skannaus katkaistiin kattoon — luvut ovat alarajoja.\n' : ''}
### Kielet

${taulu(['Pääte', 'Tiedostoja'], t.kielet.map((k) => [`\`${k.paate}\``, String(k.tiedostoja)]))}
${t.rekisteri.length ? `## Moduulit (rekisteri)

Virallinen jako on \`tila/rekisteri.yaml\`. Koodirivit on kohdistettu moduulin
\`tiedostot\`-listan mukaan, tai sen puuttuessa \`polku\`n mukaan.

${taulu(['Moduuli', 'Polku', 'Tyyppi', 'Koodirivejä', 'Tila'],
    t.rekisteri.slice(0, 60).map((r) => [
      `\`${r.nimi}\``,
      r.polku ? `\`${r.polku}\`${r.tiedostot.length ? ` (${r.tiedostot.length} kohdetta)` : ''}` : '—',
      r.tyyppi || '—',
      r.loc ? r.loc.toLocaleString('fi-FI') : '—',
      r.tila,
    ]))}${t.rekisteri.length > 60 ? `\n_(${t.rekisteri.length - 60} muuta jätetty pois listasta)_\n` : ''}
### Rekisterin ulkopuolelle jäävä koodi

${t.moduulit.filter((m) => !m.katettu && m.loc > 0).length
    ? taulu(['Hakemisto', 'Koodirivejä'], t.moduulit.filter((m) => !m.katettu && m.loc > 0).slice(0, 20)
      .map((m) => [`\`${m.hakemisto}\``, m.loc.toLocaleString('fi-FI')]))
    : 'Ei mitään — rekisteri kattaa kaiken löydetyn koodin.\n'}` : `## Moduuliehdokkaat

Nämä on päätelty manifestitiedostoista tai koodin sijainnista. **Jako on
vahvistettava** — se ratkaisee koko dokumentaation rakenteen, eikä sitä ole
vielä kirjattu \`tila/rekisteri.yaml\`:iin.

${taulu(['Moduuli', 'Hakemisto', 'Tyyppi', 'Koodirivejä'],
    t.moduulit.slice(0, 40).map((m) => [
      `\`${m.nimi}\``,
      `\`${m.hakemisto}\``,
      m.tyypit.join(', ') || '—',
      m.loc ? m.loc.toLocaleString('fi-FI') : '—',
    ]))}${t.moduulit.length > 40 ? `\n_(${t.moduulit.length - 40} muuta jätetty pois listasta)_\n` : ''}`}
## Kartoituksen osumat

Kukin rivi on geneerinen haku. **Nolla osumaa tarkoittaa joko sitä, ettei aluetta
ole, tai sitä että se on toteutettu tavalla jota haku ei tunnista** — ja jälkimmäinen
on se tapaus, joka tuottaa vaillinaista dokumentaatiota huomaamatta.

${taulu(['Alue', 'Tiedostoja', 'Moduuleissa'],
    t.probet.map((p) => [
      p.tiedostoja === 0 ? `**${p.kuvaus}**` : p.kuvaus,
      p.tiedostoja === 0 ? '**0**' : String(p.tiedostoja),
      String(p.moduuleissa),
    ]))}
## Skeemalähteet (datamallien perusta)

${Object.keys(t.skeemalahteet).length === 0 ? '_Ei löytynyt._\n'
    : taulu(['Tyyppi', 'Tiedostoja', 'Esimerkkejä'],
      Object.entries(t.skeemalahteet).map(([tyyppi, v]) => [tyyppi, String(v.maara), v.esimerkit.map((e) => `\`${e}\``).join(', ')]))}
## Testaus ja build

- Testikomento: ${t.komennot.testi ? `\`${t.komennot.testi}\`` : '**ei pääteltävissä**'}${t.komennot.lahde ? ` _(lähde: ${t.komennot.lahde})_` : ''}
- Build: ${t.komennot.build ? `\`${t.komennot.build}\`` : '—'}
- CI-konfiguraatio: ${t.ci.length ? t.ci.map((c) => `\`${c}\``).join(', ') : '—'}
- Ajoskriptit: ${t.ajoskriptit.length ? t.ajoskriptit.map((c) => `\`${c}\``).join(', ') : '—'}

## Olemassa oleva dokumentaatio

${t.olemassa_oleva_dokumentaatio.length ? t.olemassa_oleva_dokumentaatio.map((f) => `- \`${f}\``).join('\n') + '\n\nNäihin **linkitetään**, niitä ei duplikoida.\n' : '_Ei löytynyt._\n'}
## Dokumentaation tila

${taulu(['Mittari', 'Arvo'], [
    ['Dokumentteja', String(t.dokumentaation_tila.dokkeja)],
    ['— valmis / luonnos / vanhentunut', `${t.dokumentaation_tila.valmis} / ${t.dokumentaation_tila.luonnos} / ${t.dokumentaation_tila.vanhentunut}`],
    ['Avoimia TODO-merkintöjä', String(t.dokumentaation_tila.todoja)],
    ['Lähdepolkuja', String(t.dokumentaation_tila.lahteita)],
    ['— joita ei enää löydy', String(t.dokumentaation_tila.puuttuvia_lahteita)],
    ['Synkronoinnin lähtötaso', t.git && t.git.baseline ? `${t.git.baseline}${t.git.baselineIka && t.git.baselineIka.committeja != null ? ` (${t.git.baselineIka.committeja} committia jäljessä)` : ''}` : '—'],
  ])}
## Laajuusarvio jäljellä olevalle työlle

Karkea arvio, perusta: ${t.arvio.perusta}.

- Dokumentoimattomia moduuleja: **${t.arvio.dokumentoimatta}**${t.arvio.dokumentoimatta_rivit ? ` (${t.arvio.dokumentoimatta_rivit.toLocaleString('fi-FI')} koodiriviä)` : ''}
- Arvioitu dokumenttimäärä: **${t.arvio.dokkeja_min}–${t.arvio.dokkeja_max}**
- Arvioitu **agenttiaika**: **${tunnit(t.arvio.tunnit_min)}–${tunnit(t.arvio.tunnit_max)} h**
- Arvioitu **AI-kustannus**: **$${t.arvio.usd_min}–${t.arvio.usd_max}** omalla AI-tililläsi
- Arvioitu tokenikulutus: **${t.arvio.tokenit_min_M}–${t.arvio.tokenit_max_M} M tokenia** _(moduulimäärästä, ei rivipainotettu)_
${t.arvio.moduuleittain && t.arvio.moduuleittain.length > 1 ? `
Kokonaissumma peittää sen, että moduulit ovat eri kokoisia. Priorisointi ja
osa-alue kerrallaan myyminen tapahtuvat tällä tasolla:

${taulu(['Moduuli', 'Koodirivejä', 'Agenttiaika', 'AI-kustannus'],
    t.arvio.moduuleittain.slice(0, 30).map((m) => [
      `\`${m.nimi}\``,
      m.loc ? m.loc.toLocaleString('fi-FI') : '—',
      `${tunnit(m.tunnit)} h`,
      `$${m.usd}`,
    ]))}${t.arvio.moduuleittain.length > 30 ? `_(${t.arvio.moduuleittain.length - 30} muuta jätetty pois listasta)_\n` : ''}` : ''}

> ⚠️ **Arvio ei sisällä sitä osaa, joka ratkaisee lopputuloksen laadun:
> substanssiosaajan validointiaikaa** ja TODO-kysymysten läpikäyntiä. Agenttiaika
> ja AI-kustannus ovat koneen osuus; ne ovat mitattuja ja pieniä. Ihmisen osuutta
> ei voi arvioida koneellisesti — se selviää vain käymällä ensimmäisen moduulin
> dokumentit läpi ja mittaamalla.
>
> Aika- ja kustannuskertoimet ovat **yhdestä mitatusta projektista**. Kalibroi ne
> omiin ajoihisi: \`vnetcon.config.yaml\` → \`arvio.tunnit_per_moduuli\` ja
> \`arvio.usd_per_moduuli\`. Kustannus laskettiin sillä mallilla, jolla mittaus
> tehtiin — halvempi malli aliagenteille pudottaa sitä olennaisesti
> (ks. [\`metodi/agentit.md\`](metodi/agentit.md)).

## Mitä tämä raportti ei kerro

- **Onko dokumentaatio sisällöllisesti oikein.** Osumaluvut kertovat kattavuudesta,
  eivät totuudenmukaisuudesta. Sen näkee vain lukemalla dokumentit koodia vasten.
- **Onko moduulijako mielekäs.** Kone päättelee sen manifesteista; oikea jako on
  domain-kysymys.
- **Mitkä TODO-merkinnät ovat tärkeitä.** Substanssikysymys ja tekninen epävarmuus
  näyttävät tässä samalta.

## Miten katveet korjataan

Kaikki projektikohtainen kalibrointi kuuluu **laajennuspisteisiin** — ei moottoriin,
jotta paketti pysyy päivitettävänä. Ks. [\`metodi/laajennuspisteet.md\`](metodi/laajennuspisteet.md).

Tämän voi tehdä itse: kirjoita puuttuvat haut \`metodi/kartoitus.md\`:hen, vahvista
moduulijako \`tila/rekisteri.yaml\`:iin ja aja kalibrointi uudelleen. Jos kalibrointi
kannattaa ostaa, tämä raportti riittää tarjouksen pohjaksi sellaisenaan — koodia ei
tarvitse luovuttaa.

---

_Aja uudelleen:_ \`node tyokalut/kalibroi.mjs\` _· konedata:_ \`tila/kalibrointi.json\`
`;
  return s;
}
