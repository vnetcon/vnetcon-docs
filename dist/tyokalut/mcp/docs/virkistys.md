# Git-muutosten havaitseminen ja virkistys

> 🇬🇧 [English](refresh.md) · [Takaisin pääohjeeseen](../README.md) ·
> [HTTP-palvelin](http-palvelin.md)

Virkistys on erotettu kolmeen vaiheeseen:

```text
muutoksen havaitseminen
  -> debounce-jono
  -> lähdekoodityötilan refresh
  -> erillinen dokumentointi, hyväksyntä ja julkaisu
```

Git-tapahtuma ei käynnistä AI-agenttia eikä vaihda MCP-kanavan julkaisua.

## Käsin ajettava virkistys

Nykyinen suora toimintatapa säilyy:

```bash
./multiproject-mcp plan refresh --all
./multiproject-mcp refresh --all
```

Jonon kautta saman voi tehdä näin:

```bash
./multiproject-mcp refresh detect --all
./multiproject-mcp refresh queue --active
./multiproject-mcp refresh run --now
```

`detect` vertailee seurattujen refien nykyisiä commit-SHA-arvoja työtilojen
viimeksi käsiteltyihin arvoihin. Se ei kloonaa, dokumentoi tai julkaise.

## Polling

Polling sopii ensimmäiseen palvelinasennukseen, koska Git-palveluun ei tarvitse
tehdä muutoksia:

```bash
./multiproject-mcp refresh configure-poll \
  --interval 300 \
  --debounce 900
```

HTTP-palvelin käynnistää polling-controllerin samalla `serve`-komennolla.
Ilman HTTP-palvelinta controller voidaan ajaa omana prosessinaan:

```bash
./multiproject-mcp refresh watch
```

Esimerkissä refit tarkistetaan viiden minuutin välein ja havaittu muutos saa
15 minuutin debounce-ajan. Uusi push siirtää saman projekti–refi-parin ajoa
eteenpäin, joten push-sarja muodostaa yhden refreshin.

Jos haluat vain havaita muutokset mutta et päivittää checkoutteja
automaattisesti:

```bash
./multiproject-mcp refresh configure-poll \
  --interval 300 \
  --debounce 900 \
  --detect-only
```

Tällöin ylläpitäjä ajaa jonon komennolla `refresh run`.

## Webhook tai CI-heräte

Ota yleinen webhook-päätepiste käyttöön ja luo satunnainen tunnus:

```bash
./multiproject-mcp refresh configure-webhook --debounce 900
./multiproject-mcp refresh webhook-token create \
  --name git-service \
  --projects laskutus,asiakkuudet
./multiproject-mcp serve
```

Heräte lähetetään osoitteeseen `POST /hooks/git`:

```bash
curl -X POST https://docs-mcp.intra.example/hooks/git \
  -H 'Content-Type: application/json' \
  -H 'X-Multiproject-Webhook-Token: hook_...' \
  -d '{
    "project_id": "laskutus",
    "ref": "development",
    "source_commit_sha": "<täysi commit-SHA>"
  }'
```

Palvelin ratkaisee refin myös itse ja hylkää pyynnön, jos ilmoitettu SHA ei
vastaa lähteen nykyistä arvoa. Token voidaan rajata projekteihin.

```bash
./multiproject-mcp refresh webhook-token list
./multiproject-mcp refresh webhook-token revoke git-service
```

Päätepiste on tarjoajariippumaton. GitHub-, GitLab-, Bitbucket- ja Azure DevOps
-payloadien omat allekirjoitusmuodot voidaan lisätä myöhemmin adaptereina.
Nykyinen endpoint sopii suoraan CI-tehtävälle, itse hallitun Git-palvelimen
hookille tai pienelle välitysskriptille.

## Repositoryn lähteen valinta

Automaattisessa palvelinkäytössä suositellaan `repository.url`-asetusta. Tällöin
palvelu ratkaisee refin suoraan Git-palvelusta ja tekee omaan checkoutiinsa
`fetch --prune origin` -operaation.

`repository.path` tarkoittaa, että annettu paikallinen Git-repository on
totuuden lähde. Se sopii kehityskoneelle, mutta näkee ulkoisen Git-palvelun
muutoksen vasta, kun paikallinen repository on itse päivitetty.

Työkalu ei tee tavallista `git pull` -mergeä. Jokainen työtila siirretään
pakotetusti detached-tilaan täsmällisen commit-SHA:n kohdalle.

## Mitä refresh tekee dokumentaatiolle?

- `repository`-mallissa uusi `vnetcon-docs` tulee samasta lähdecommitista.
  Julkaisu tehdään edelleen erillisellä `publish`-komennolla.
- `managed`-mallissa lähdekoodi päivittyy ja työtila merkitään
  `needs_documentation`-tilaan. AI-ajo, review, approve ja publish pysyvät
  erillisinä vaiheina.

Tämä estää jokaista pushia käynnistämästä turhaa AI-ajoa tai julkaisemasta
tarkistamatonta dokumentaatiota.
