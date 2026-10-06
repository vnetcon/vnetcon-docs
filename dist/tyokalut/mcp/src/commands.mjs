// Komentorekisteri: yksi lähde CLI:n ohjeelle, käyttöliittymän komentoviitteelle ja
// sille, mitä komentoja käyttöliittymä saa ajaa (ui: true). Jokaisella
// käyttöliittymän toiminnolla on täsmälleen yksi vastaava komento täällä.

export const COMMANDS = [
  // Työtila
  { path: ['init'], group: 'Työtila', usage: 'init [<hakemisto>] [--emoprojekti | --ilman-emoprojektia]', description: 'Luo MCP-työtilan (oletus vnetcon-docs/mcp-tyotila) ja ehdottaa emoprojektia.', ui: true },
  { path: ['process'], group: 'Työtila', usage: 'process [--project <id>] [--json]', description: 'Näyttää prosessin vaiheet: mitä on tehty, mitä on jäljellä ja miten.' },
  { path: ['status'], group: 'Työtila', usage: 'status', description: 'Listaa alustetut projektityötilat.' },
  { path: ['doctor'], group: 'Työtila', usage: 'doctor [--http] [--project <id>]', description: 'Tarkistaa ympäristön, konfiguraation ja repositoriot.', ui: true },
  { path: ['config', 'validate'], group: 'Työtila', usage: 'config validate', description: 'Tarkistaa konfiguraation.', ui: true },
  { path: ['config', 'show'], group: 'Työtila', usage: 'config show [--effective]', description: 'Näyttää konfiguraation.' },

  // Projektit
  { path: ['discover'], group: 'Projektit', usage: 'discover --root <hakemisto>', description: 'Etsii hakemiston Git-repositoriot.' },
  { path: ['inspect-project'], group: 'Projektit', usage: 'inspect-project --path <repo>', description: 'Tutkii repositorion ennen lisäämistä.' },
  { path: ['add-project'], group: 'Projektit', usage: 'add-project --id <id> (--path <repo> | --url <url>) --refs <haara,...> --docs-mode <repository|separate|managed> [--name <nimi>] [--docs-path <polku>] [--docs-repo <polku|url>] [--docs-ref <haara>]', description: 'Lisää projektin.', ui: true },
  { path: ['project', 'set'], group: 'Projektit', usage: 'project set --id <id> [--name <nimi>] [--path <repo> | --url <url>] [--refs <haara,...>] [--docs-mode <tila>] [--docs-path <polku>] [--docs-repo <polku|url>] [--docs-ref <haara>]', description: 'Muokkaa projektia. Vain annetut kentät muuttuvat.', ui: true },
  { path: ['remove-project'], group: 'Projektit', usage: 'remove-project <id> [--confirm] [--purge]', description: 'Poistaa projektin roskakoriin. --purge poistaa pysyvästi myös työtilat ja julkaisut.', ui: true, destructive: true },

  // Kanavat
  { path: ['channel', 'create'], group: 'Kanavat', usage: 'channel create <id>', description: 'Luo julkaisukanavan.', ui: true },
  { path: ['channel', 'set-ref'], group: 'Kanavat', usage: 'channel set-ref <kanava> <projekti> <haara>', description: 'Valitsee kanavaan projektin haaran.', ui: true },
  { path: ['channel', 'unset-ref'], group: 'Kanavat', usage: 'channel unset-ref <kanava> <projekti>', description: 'Poistaa projektin kanavasta.', ui: true },
  { path: ['channel', 'set-default'], group: 'Kanavat', usage: 'channel set-default <kanava>', description: 'Vaihtaa oletuskanavan.', ui: true },
  { path: ['channel', 'remove'], group: 'Kanavat', usage: 'channel remove <kanava> [--confirm] [--purge]', description: 'Poistaa kanavan roskakoriin. --purge poistaa pysyvästi.', ui: true, destructive: true },
  { path: ['channel', 'show'], group: 'Kanavat', usage: 'channel show <kanava>', description: 'Näyttää kanavan ja sen haarojen commitit.' },

  // Päivitys ja julkaisu
  { path: ['plan', 'refresh'], group: 'Päivitys ja julkaisu', usage: 'plan refresh (--all | --project <id> [--ref <haara>])', description: 'Näyttää, mitkä projektit ovat muuttuneet.', ui: true },
  { path: ['bootstrap'], group: 'Päivitys ja julkaisu', usage: 'bootstrap (--all | --project <id> [--ref <haara>])', description: 'Hakee projektin uusimman commitin MCP-työtilaan.', ui: true },
  { path: ['refresh'], group: 'Päivitys ja julkaisu', usage: 'refresh (--all | --project <id>) | refresh detect | refresh run [--now]', description: 'Päivittää muuttuneet projektit; detect ja run hallitsevat automaattista jonoa.', ui: true },
  { path: ['review'], group: 'Päivitys ja julkaisu', usage: 'review --project <id> --ref <haara>', description: 'Näyttää managed-dokumentaation revision ja hyväksynnän.', ui: true },
  { path: ['approve'], group: 'Päivitys ja julkaisu', usage: 'approve --project <id> --ref <haara> [--revision <sha>]', description: 'Hyväksyy managed-dokumentaation julkaistavaksi.', ui: true },
  { path: ['publish'], group: 'Päivitys ja julkaisu', usage: 'publish --channel <kanava>', description: 'Julkaisee kanavan AI-clienteille.', ui: true },
  { path: ['smoke-test'], group: 'Päivitys ja julkaisu', usage: 'smoke-test --channel <kanava>', description: 'Tarkistaa julkaisun haun.', ui: true },
  { path: ['publications', 'prune'], group: 'Päivitys ja julkaisu', usage: 'publications prune [--keep <n>] [--confirm]', description: 'Poistaa vanhat julkaisut säilytyskäytännön mukaan.', ui: true, destructive: true },

  // Dokumentointi (agentit)
  { path: ['agent', 'run'], group: 'Dokumentointi', usage: 'agent run --project <id> [--ref <haara>] --workflow <vnetcon-init|dokumentoi|dokumentoi-kaikki|synkronoi|katselmoi|kuvaa-integraatio|yhdenmukaista> [--module <moduuli>] [--input-file <polku> | --input-stdin] [--background]', description: 'Ajaa dokumentoivan agentin ilman vuorovaikutusta. Kysymykset kirjataan ja ajoa jatketaan vastauksilla.', ui: true },
  { path: ['agent', 'list'], group: 'Dokumentointi', usage: 'agent list', description: 'Listaa agenttiajot.' },
  { path: ['agent', 'show'], group: 'Dokumentointi', usage: 'agent show <ajo>', description: 'Näyttää ajon lokin, kysymykset ja yhteenvedon.' },
  { path: ['agent', 'answer'], group: 'Dokumentointi', usage: 'agent answer <ajo> (--file <polku> | --stdin) [--background]', description: 'Vastaa ajon kysymyksiin ja jatkaa ajoa.', ui: true },
  { path: ['agent', 'cancel'], group: 'Dokumentointi', usage: 'agent cancel <ajo>', description: 'Keskeyttää käynnissä olevan ajon.', ui: true },
  { path: ['document'], group: 'Dokumentointi', usage: 'document --project <id> --ref <haara> [--module <moduuli>]', description: 'Käynnistää interaktiivisen agentin managed-työtilassa (pääte).' },
  { path: ['docs', 'diff'], group: 'Dokumentointi', usage: 'docs diff --project <id> [--ref <haara>]', description: 'Näyttää dokumentaation commitoimattomat muutokset.', ui: true },
  { path: ['docs', 'commit'], group: 'Dokumentointi', usage: 'docs commit --project <id> [--ref <haara>] --message <viesti>', description: 'Commitoi dokumentaation muutokset (repository- ja separate-malli).', ui: true },

  // Ohjaus ja integraatiot
  { path: ['guidance', 'list'], group: 'Ohjaus ja integraatiot', usage: 'guidance list', description: 'Listaa yhteisen ohjauksen tiedostot.' },
  { path: ['guidance', 'show'], group: 'Ohjaus ja integraatiot', usage: 'guidance show <nimi.md>', description: 'Näyttää yhteisen ohjauksen tiedoston.' },
  { path: ['guidance', 'set'], group: 'Ohjaus ja integraatiot', usage: 'guidance set <nimi.md> (--file <polku> | --stdin)', description: 'Tallentaa yhteisen ohjauksen tiedoston.', ui: true },
  { path: ['guidance', 'remove'], group: 'Ohjaus ja integraatiot', usage: 'guidance remove <nimi.md> [--confirm] [--purge]', description: 'Poistaa tiedoston roskakoriin. --purge poistaa pysyvästi.', ui: true, destructive: true },
  { path: ['interface', 'list'], group: 'Ohjaus ja integraatiot', usage: 'interface list', description: 'Listaa integraatiotietueet luonnoksineen.' },
  { path: ['interface', 'show'], group: 'Ohjaus ja integraatiot', usage: 'interface show <id>', description: 'Näyttää integraatiotietueen.' },
  { path: ['interface', 'set'], group: 'Ohjaus ja integraatiot', usage: 'interface set <id> (--file <polku> | --stdin)', description: 'Tallentaa integraatiotietueen.', ui: true },
  { path: ['interface', 'set-status'], group: 'Ohjaus ja integraatiot', usage: 'interface set-status <id> <draft|active|deprecated>', description: 'Vaihtaa tietueen tilan; active näkyy AI-clienteille.', ui: true },
  { path: ['interface', 'remove'], group: 'Ohjaus ja integraatiot', usage: 'interface remove <id> [--confirm] [--purge]', description: 'Poistaa tietueen roskakoriin. --purge poistaa pysyvästi.', ui: true, destructive: true },

  // Roskakori
  { path: ['trash', 'list'], group: 'Roskakori', usage: 'trash list', description: 'Listaa poistetut kohteet.' },
  { path: ['trash', 'restore'], group: 'Roskakori', usage: 'trash restore <kohde> [--force]', description: 'Palauttaa poistetun kohteen.', ui: true },
  { path: ['trash', 'empty'], group: 'Roskakori', usage: 'trash empty [--confirm]', description: 'Tyhjentää roskakorin pysyvästi.', ui: true, destructive: true },

  // Palvelin ja tunnistus
  { path: ['server', 'configure-http'], group: 'Palvelin ja tunnistus', usage: 'server configure-http [--listen <host:port>] [--channel <kanava>] [--allowed-hosts <nimi,...>]', description: 'Tallentaa HTTP-palvelimen osoitteen (oletus 127.0.0.1:8799). Ei muuta oletussiirtotapaa.', ui: true },
  { path: ['server', 'set-transport'], group: 'Palvelin ja tunnistus', usage: 'server set-transport <stdio|http>', description: 'Valitsee oletussiirtotavan.', ui: true },
  { path: ['server', 'status'], group: 'Palvelin ja tunnistus', usage: 'server status', description: 'Näyttää palvelinasetukset.' },
  { path: ['auth', 'set-mode'], group: 'Palvelin ja tunnistus', usage: 'auth set-mode <none|bearer|basic|oidc>', description: 'Valitsee tunnistustavan.', ui: true },
  { path: ['auth', 'status'], group: 'Palvelin ja tunnistus', usage: 'auth status', description: 'Näyttää tunnistustavan.' },
  { path: ['auth', 'configure-oidc'], group: 'Palvelin ja tunnistus', usage: 'auth configure-oidc --issuer <url> --audience <arvo> --resource <https-url> [--ui-client-id <id>] [--ui-scopes <scope ...>]', description: 'Määrittää OIDC-tunnistuksen ja käyttöliittymän selainkirjautumisen.', ui: true },
  { path: ['auth', 'oidc-rule', 'add'], group: 'Palvelin ja tunnistus', usage: 'auth oidc-rule add --name <nimi> --claim <claim> --values <arvo,...> [--channels <id,...>] [--projects <id,...>] [--admin]', description: 'Lisää OIDC-käyttöoikeussäännön.', ui: true },
  { path: ['auth', 'token', 'create'], group: 'Palvelin ja tunnistus', usage: 'auth token create --name <nimi> [--channels <id,...>] [--projects <id,...>] [--admin]', description: 'Luo bearer-tokenin (näytetään vain kerran).', ui: true },
  { path: ['auth', 'token', 'list'], group: 'Palvelin ja tunnistus', usage: 'auth token list', description: 'Listaa bearer-tokenit.', ui: true },
  { path: ['auth', 'token', 'revoke'], group: 'Palvelin ja tunnistus', usage: 'auth token revoke <nimi>', description: 'Mitätöi bearer-tokenin.', ui: true, destructive: true },
  { path: ['auth', 'user', 'add'], group: 'Palvelin ja tunnistus', usage: 'auth user add --username <nimi> --password-stdin [--channels <id,...>] [--projects <id,...>] [--admin]', description: 'Lisää käyttäjän (basic).', ui: true },
  { path: ['auth', 'user', 'list'], group: 'Palvelin ja tunnistus', usage: 'auth user list', description: 'Listaa käyttäjät.', ui: true },
  { path: ['auth', 'user', 'remove'], group: 'Palvelin ja tunnistus', usage: 'auth user remove <nimi>', description: 'Poistaa käyttäjän.', ui: true, destructive: true },
  { path: ['refresh', 'configure-poll'], group: 'Palvelin ja tunnistus', usage: 'refresh configure-poll --interval <s> --debounce <s>', description: 'Ottaa käyttöön ajastetun muutosten haun.', ui: true },
  { path: ['refresh', 'configure-webhook'], group: 'Palvelin ja tunnistus', usage: 'refresh configure-webhook --debounce <s>', description: 'Ottaa käyttöön webhookin.', ui: true },
  { path: ['tunnel', 'install', 'openai'], group: 'Palvelin ja tunnistus', usage: 'tunnel install openai [--version <v>] [--from <zip|hakemisto|tiedosto>]', description: 'Asentaa tunnel-clientin MCP-työtilaan (.multiproject/tunnel-client): lataa OpenAI:n julkaisusta tarkistussummalla tai kopioi paikallisesta lähteestä.', ui: true },
  { path: ['tunnel', 'uninstall', 'openai'], group: 'Palvelin ja tunnistus', usage: 'tunnel uninstall openai', description: 'Poistaa työtilaan asennetun tunnel-clientin ja sen profiilit.', ui: true, destructive: true },
  { path: ['tunnel', 'configure', 'openai'], group: 'Palvelin ja tunnistus', usage: 'tunnel configure openai --tunnel-id <id> [--client-profile <nimi>]', description: 'Tallentaa OpenAI-tunnelin tunnisteen ja tunnel-clientin profiilin.', ui: true },
  { path: ['tunnel', 'remove', 'openai'], group: 'Palvelin ja tunnistus', usage: 'tunnel remove openai', description: 'Poistaa tallennetun tunnelin tiedot (tulostaa palautuskomennon).', ui: true, destructive: true },
  { path: ['tunnel', 'prepare', 'openai'], group: 'Palvelin ja tunnistus', usage: 'tunnel prepare openai [--tunnel-id <id>] [--client-profile <nimi>]', description: 'Tulostaa tunnel-clientin komennot tallennetuilla tiedoilla.', ui: true },
  { path: ['serve'], group: 'Palvelin ja tunnistus', usage: 'serve [--transport <stdio|http>] [--channel <kanava>]', description: 'Käynnistää MCP-palvelun.' },
  { path: ['ui'], group: 'Palvelin ja tunnistus', usage: 'ui [--listen <host:port>]', description: 'Käynnistää HTTP-palvelimen ja hallintakäyttöliittymän (/ui).' },
];

// Pisin rekisteröity komentopolku, jolla argumentit alkavat.
export function matchCommand(args) {
  let best = null;
  for (const command of COMMANDS) {
    if (command.path.every((part, index) => args[index] === part) && (!best || command.path.length > best.path.length)) best = command;
  }
  return best;
}

export function helpText() {
  const lines = ['multiproject-mcp — moniprojektidokumentaation julkaisu ja MCP', '',
    'Käytä vnetcon-docs-hakemistossa: vnetcon-ai mcp <komento>', ''];
  const groups = [...new Set(COMMANDS.map((command) => command.group))];
  for (const group of groups) {
    lines.push(`${group}:`);
    for (const command of COMMANDS.filter((item) => item.group === group)) {
      lines.push(`  ${command.usage}`);
      lines.push(`      ${command.description}`);
    }
    lines.push('');
  }
  lines.push('Poistot näyttävät ensin suunnitelman; --confirm toteuttaa. Poistettu kohde siirtyy');
  lines.push('roskakoriin (trash restore palauttaa). --purge poistaa pysyvästi.');
  return lines.join('\n');
}
