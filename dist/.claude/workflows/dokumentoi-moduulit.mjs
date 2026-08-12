export const meta = {
  name: 'dokumentoi-moduulit',
  description: 'Dokumentoi annetut moduulit syvästi rinnakkain (fan-out) + adversariaalinen verifiointi koodia vasten. Moduulilista tulee argsissa.',
  phases: [
    { title: 'Moduulit', detail: 'yksi agentti per moduuli, syvä dokumentointi' },
    { title: 'Verify', detail: 'tarkistetaan kunkin moduulin dokumentaatio koodia vasten' },
  ],
}

// args = { osaAlue?, moduulit: string[], metodiVersio?, mallit?: { dokumentointi?, verifiointi? } }
// Orkestroija (skill) poimii moduulit tila/rakenne.yaml:sta ja mallit
// vnetcon.config.yaml:sta ja välittää ne tänne — workflow itse ei lue tiedostoja
// (ei YAML-jäsentäjää). Robusti: args voi tulla oliona tai JSON-merkkijonona.
let a = args
if (typeof a === 'string') {
  try { a = JSON.parse(a) } catch (e) { a = {} }
}
const moduulit = (a && Array.isArray(a.moduulit)) ? a.moduulit : []
const metodiVersio = (a && a.metodiVersio) ? a.metodiVersio : 1
// Tyhjä/puuttuva malli = peri pääagentilta (agent() jättää mallin asettamatta).
const mallit = (a && a.mallit) || {}
const optiot = (perus, malli) => (malli ? { ...perus, model: malli } : perus)

if (!moduulit.length) {
  log('Ei moduuleja argsissa (odotettiin { moduulit: [...] }). Ei tehdä mitään.')
  return { ok: false, syy: 'ei-moduuleja' }
}

log(`Dokumentoidaan ${moduulit.length} moduulia syvästi: ${moduulit.join(', ')}`)

const DOK = (m) =>
  `Dokumentoi projektin moduuli "${m}" SYVÄSTI vnetcon-docs-järjestelmään. Toimi täsmälleen näin:
1. Lue ohjeet: vnetcon-docs/metodi/tyonkulku.md (luonti-/päivitystila), vnetcon-docs/metodi/konventiot.md, vnetcon-docs/metodi/kartoitus.md (tämän projektin hakukomennot) ja vnetcon-docs/tila/projekti.yaml.
2. Jos vnetcon-docs/moduulit/${m}/ on jo olemassa, PÄIVITÄ paikallaan (älä luo alusta) — säilytä runko ja vaihe-tunnisteet.
3. Kartoita VAIN versionhallinnassa oleva koodi (varmista polut: git -C .. ls-files): sisääntulopisteet (reitit/kuuntelijat/ajastukset) → logiikka → tietokanta/ulkoiset → paluu; datan muodon määrittelevät skeemat/tyypit; sarjallistetut kentät (JSON/JSONB/blob/payload) ja niiden sisältörakenne.
4. Kirjoita vnetcon-docs/moduulit/${m}/ alle: yleiskuvaus.md, prosessit/, datavirrat/ (KENTTÄTASO: hallitseva skeema per solmu + sarjallistettujen kenttien sisältö), datarakenteet/. Käytä mallipohjia vnetcon-docs/metodi/mallipohjat/. Linkitä jaettuihin datamalleihin vnetcon-docs/datamallit/ sen sijaan että kopioisit skeeman.
5. Koodipolut kirjoitetaan PROJEKTIN JUURESTA (ei ../-alkuisina). Täytä frontmatter: lahteet (tarkat polut), paivitetty, git-viite (git -C .. rev-parse --short HEAD), metodi-versio: ${metodiVersio}.
6. Merkitse epävarmat kohdat "> TODO: varmistettava — <mikä>" ja jätä dokki tila: luonnos. ÄLÄ arvaa.
7. ÄLÄ muokkaa vnetcon-docs/tila/-tiedostoja (orkestroija päivittää rekisterin ja lokin). ÄLÄ committaa. ÄLÄ muokkaa projektin koodia.
Palauta lyhyt yhteenveto: mitä tiedostoja kirjoitit, keskeiset löydökset ja avoimet TODOt.`

const VERIFY = (m) =>
  `Tarkista adversariaalisesti moduulin "${m}" dokumentaatio hakemistossa vnetcon-docs/moduulit/${m}/. Oleta että siinä on virheitä ja etsi ne:
- Vastaavatko prosessit/datavirrat/datarakenteet oikeasti koodia (lue lähteet)?
- Ovatko datavirrat kenttätasolla, ja onko sarjallistettujen kenttien (JSON/JSONB/blob) sisältö avattu tai linkitetty datamalliin?
- Ovatko KAIKKI polkuviittaukset git -C .. ls-files -listalla (ei versioimattomia, ei keksittyjä rivinumeroita)?
- Puuttuuko sisääntulopisteitä (reittejä, kuuntelijoita, ajastuksia), joita koodissa on?
- Onko arvauksia, jotka pitäisi merkitä "> TODO:"?
- Ovatko sisäiset linkit olemassa oleviin tiedostoihin?
Korjaa löytämäsi puutteet paikallaan. ÄLÄ committaa. Palauta lista korjauksista ja jäljelle jäävistä epävarmuuksista.`

if (mallit.dokumentointi) log(`Dokumentointiagentit: ${mallit.dokumentointi}`)
if (mallit.verifiointi) log(`Verifiointiagentit: ${mallit.verifiointi}`)

const tulokset = await pipeline(
  moduulit,
  (m) => agent(DOK(m), optiot({ label: `dok:${m}`, phase: 'Moduulit' }, mallit.dokumentointi)),
  (_res, m) => agent(VERIFY(m), optiot({ label: `verify:${m}`, phase: 'Verify' }, mallit.verifiointi))
    .then((v) => ({ moduuli: m, verify: v }))
)

const valmiit = tulokset.filter(Boolean).map((t) => t.moduuli)
const epaonnistuneet = moduulit.filter((m) => !valmiit.includes(m))
if (epaonnistuneet.length) log(`HUOM: kesken jäi ${epaonnistuneet.length}: ${epaonnistuneet.join(', ')}`)
log(`Valmis: ${valmiit.length}/${moduulit.length} moduulia dokumentoitu.`)

return { osaAlue: a && a.osaAlue, dokumentoidut: valmiit, kesken: epaonnistuneet }
