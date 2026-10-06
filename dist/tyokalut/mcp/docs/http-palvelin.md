# HTTP-palvelin ja käyttöönotto

> 🇬🇧 [English](http-server.md) · [Takaisin pääohjeeseen](../README.md) ·
> [Autentikointi](autentikointi.md) · [Virkistys](virkistys.md) · [AI-clientit](asiakkaat.md)

Palvelin toteuttaa MCP:n Streamable HTTP -siirtotavan. Sama julkaistu aineisto
ja samat MCP-työkalut ovat käytettävissä sekä stdio- että HTTP-yhteydellä.

## Paikallinen kokeilu

Julkaise kanava ennen palvelimen käynnistämistä. Konfiguroi sitten vain omalla
koneella kuunteleva palvelin:

```bash
./multiproject-mcp server configure-http \
  --listen 127.0.0.1:8793 \
  --channel local
./multiproject-mcp auth set-mode none
./multiproject-mcp doctor --http
./multiproject-mcp serve --transport http
```

Päätepisteet:

| Osoite | Tarkoitus |
|--------|-----------|
| `http://127.0.0.1:8793/mcp` | Oletuskanavan MCP-yhteys |
| `http://127.0.0.1:8793/channels/<kanava>/mcp` | Eksplisiittisesti valitun kanavan MCP-yhteys |
| `http://127.0.0.1:8793/healthz` | Prosessin elossaolotarkistus |
| `http://127.0.0.1:8793/readyz` | Oletuskanavan julkaisun valmiustarkistus |
| `POST http://127.0.0.1:8793/hooks/git` | Suojattu refresh-heräte webhook-tilassa |

`server configure-http` tallentaa vain osoitteen; ilman `--listen`-valitsinta
oletus on `127.0.0.1:8799`, sama kuin `ui`-komennolla. Se ei muuta
oletussiirtotapaa, joten stdio-clientit toimivat ennallaan. Käynnistä HTTP
komennolla `serve --transport http` tai `ui` (hallintakäyttöliittymä ja MCP
samassa osoitteessa). Jos haluat pelkän `serve`-komennon käynnistävän HTTP:n,
aja kerran `server set-transport http`. `server status` näyttää efektiivisen
palvelinkonfiguraation.
Jos refresh-tilaksi on valittu `poll` tai `webhook`, sama prosessi käynnistää
myös debounce-jonon workerin. Se ei käynnistä AI:ta eikä julkaise kanavaa.

## Lähiverkko tai palvelinkone

`0.0.0.0` tarkoittaa, että prosessi kuuntelee koneen kaikissa IPv4-liitännöissä.
Se ei ole clientille annettava osoite. Client käyttää koneen todellista DNS-nimeä
tai IP-osoitetta, esimerkiksi `https://docs-mcp.intra.example/mcp`.

```bash
./multiproject-mcp server configure-http \
  --listen 0.0.0.0:8793 \
  --channel production \
  --allow-network \
  --allowed-hosts docs-mcp.intra.example,10.20.30.40
./multiproject-mcp auth set-mode bearer
./multiproject-mcp auth token create \
  --name docs-client \
  --channels production \
  --projects laskutus,asiakkuudet
./multiproject-mcp doctor --http
./multiproject-mcp serve --transport http
```

`--allow-network` vaaditaan konfiguroitaessa ei-loopback-osoitetta. Se sallii
kuuntelun, mutta ei ohita autentikointia. `--allowed-hosts` rajoittaa hyväksytyt
Host-headerit ja toimii DNS rebinding -suojana.

Organisaatiokäytössä bearer voidaan korvata OIDC:llä. Katso
[Autentikointi ja käyttöoikeudet](autentikointi.md).

## TLS ja reverse proxy

Nykyinen prosessi kuuntelee HTTP:tä. Palvelinkäytössä sijoita sen eteen TLS:n
päättävä reverse proxy, ingress tai kuormantasaaja. Suositeltu ketju on:

```text
AI-client
  -> HTTPS / organisaation verkko
  -> reverse proxy tai ingress
  -> http://127.0.0.1:8793/mcp
  -> multiproject-mcp
```

Rajaa taustaportti palomuurilla vain proxylle. Basic-tunnuksia ei saa lähettää
salaamattomassa verkossa. Bearer-tokenkin on haltijatunniste, joten TLS on sille
yhtä lailla tarpeen koneen ulkopuolisessa liikenteessä.

## Yhteys ja snapshotit

Palvelin on tilallinen Streamable HTTP -palvelin. Alustuksessa client saa
session-tunnisteen, jota se käyttää jatkokutsuissa. Session tunniste sidotaan
tunnistettuun käyttäjään ja kanavaan.

Jokainen uusi MCP-yhteys lukitaan kanavan sillä hetkellä osoittamaan
muuttumattomaan bundleen. Jos `publish` siirtää kanavan uuteen bundleen:

- olemassa oleva yhteys jatkaa vanhalla aineistolla
- uusi yhteys saa uuden bundlen
- yhden keskustelun hakutuloksiin ei sekoitu kahta julkaisuhetkeä.

## ChatGPT ja tunneli

Yksityistä palvelinta ei tarvitse avata internetiin ChatGPT:tä varten. Kun
OpenAI Secure MCP Tunnel on organisaatiossa käytettävissä, tulosta tämän
tunnelin tunniste kerran ja tulosta komennot:

```bash
./multiproject-mcp tunnel configure openai --tunnel-id tunnel_<32 merkkiä>
./multiproject-mcp tunnel install openai
./multiproject-mcp tunnel prepare openai
```

`tunnel install` asentaa `tunnel-client`in MCP-työtilaan
(`.multiproject/tunnel-client/`, gitin ulkopuolella): ohjelma ladataan OpenAI:n
julkaisusta ja sen SHA-256-summa tarkistetaan, tai se kopioidaan valitsimella
`--from <zip|hakemisto|tiedosto>`. Profiilit tallentuvat samaan hakemistoon
(`--profile-dir`), joten mitään ei asenneta PATHiin tai kotihakemistoon.
`tunnel uninstall openai` tai hakemiston poisto poistaa kaiken.

`tunnel configure` tallentaa tunnisteen ja `tunnel-client`in profiilin
(oletus `vnetcon-docs-<emoprojekti>`, vaihdettavissa valitsimella
`--client-profile`) koneen profiiliin. `tunnel remove openai` poistaa ne ja
tulostaa palautuskomennon. `tunnel prepare` ei luo pilviresursseja. Se näyttää `tunnel-client init`, `doctor` ja `run` -komennot
tallennetun HTTP-osoitteen (tai `ui`:n oletuksen) perusteella. Samat vaiheet
tiloineen näkyvät hallintakäyttöliittymän Prosessi-välilehdellä kohdassa
*Yhteys AI-clienteihin*. Tunnelin ja ChatGPT-connectorin käyttöönotto vaatii
OpenAI-puolen oikeudet. Katso myös [AI-clienttien yhteensopivuus](asiakkaat.md).

## Avoin verkkopalvelu

Avoin tila on mahdollinen mutta tarkoituksella kaksivaiheinen:

```bash
./multiproject-mcp server configure-http \
  --listen 0.0.0.0:8793 \
  --channel local \
  --allow-network
./multiproject-mcp auth set-mode none --allow-unauthenticated-network
```

Tällöin jokainen verkosta palvelimen tavoittava voi käyttää kaikkea kanavan
aineistoa. Käytä tätä vain eristetyssä testiympäristössä, jossa verkkorajaus on
todennettu. `doctor --http` näyttää tilasta aina varoituksen.

## Käyttöönoton tarkistuslista

1. `publish` ja `smoke-test` onnistuvat valitulle kanavalle.
2. `doctor --http` ei raportoi virheitä.
3. Ei-loopback-palvelussa on bearer tai basic, ellei avoin tila ole tietoinen
   testipäätös.
4. `allowed_hosts` sisältää clienttien käyttämät DNS-nimet tai IP-osoitteet.
5. Koneen ulkopuolinen liikenne kulkee TLS:n tai suojatun tunnelin läpi.
6. Palomuuri sallii vain tarvittavat lähdeverkot.
7. Tunnuksille on annettu vain tarvittavat kanavat ja projektit.
